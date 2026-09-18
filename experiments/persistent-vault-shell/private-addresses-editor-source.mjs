import {PRIVATE_ADDRESS_REFUSALS, privateAddressDeleteRefusal, privateAddressId, privateAddressLegacyId,
    privateAddressesRevision} from './private-addresses-contract.mjs';
import {preparePrivateAddresses} from './prepare-private-addresses.mjs';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';

const LABELS = Object.freeze({type: 'Tipo', address: 'Indirizzo', civic: 'Civico', cap: 'CAP', city: 'Città',
    province: 'Provincia', isPrimary: 'Indirizzo principale'});
const KEYS = Object.freeze(['type', 'address', 'civic', 'cap', 'city', 'province']);
const MAX = Object.freeze({type: 120, address: 320, civic: 20, cap: 10, city: 120, province: 20});
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// A private address is modifiable only while its identity is persisted: the read
// model synthesizes `address-legacy-<hash>` from the row content and its position,
// and such an identity is reported, never targeted.
export function createPrivateAddressesEditorSource({context, getUser, repository, hash, createId,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    if (typeof createId !== 'function') throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
    const uid = context.user?.uid;
    let disposed = false, loaded = null;
    const fail = code => {throw Error(code);};
    const dispose = () => {disposed = true; loaded = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        const record = await repository[confirmed ? 'getUserProfileConfirmed' : 'getUserProfile'](uid);
        if (!object(record)) fail('PROFILE_NOT_FOUND');
        if (record.ownerId !== undefined && record.ownerId !== uid) fail('OWNER_MISMATCH');
        return record;
    };
    // Three outcomes only. A missing document is a verified empty selection; a read
    // failure or a configuration that does not resolve canonically is "unverified"
    // and disables every deletion, without blocking consultation or plain edits.
    const selections = async projection => {
        let setting;
        try {
            setting = await repository.getUserSetting(uid, 'qrCodeInclusions');
        } catch {return {state: 'unverified'};}
        if (setting === null || setting === undefined) return {state: 'absent'};
        if (!object(setting)) return {state: 'unverified'};
        const config = {...setting};
        if (config.id !== undefined && config.id !== 'qrCodeInclusions') return {state: 'unverified'};
        delete config.id;
        const revision = Object.hasOwn(config, '_qrRevision') ? config._qrRevision : 0;
        if (!Number.isSafeInteger(revision) || revision < 0 ||
            (Object.hasOwn(config, '_qrSchemaVersion') && config._qrSchemaVersion !== 1)) return {state: 'unverified'};
        delete config._qrRevision; delete config._qrSchemaVersion;
        try {
            return {state: 'verified', selection: preparePrivateQrSelection(config, projection)};
        } catch {return {state: 'unverified'};}
    };
    const signature = record => JSON.stringify([record.userAddresses ?? null, record._profileAddressesRevision ?? 0]);
    return Object.freeze({dispose,
        createId() {
            const value = createId('address');
            if (typeof value !== 'string' || !value.startsWith('address-')) fail(PRIVATE_ADDRESS_REFUSALS.INVALID);
            return value;
        },
        async load() {
            loaded = null;
            const initial = await read(isOnline()); check();
            const revision = privateAddressesRevision(initial), current = signature(initial);
            const items = initial.userAddresses === undefined ? [] : initial.userAddresses;
            if (!Array.isArray(items) || items.length > 10000) fail(PRIVATE_ADDRESS_REFUSALS.SHAPE);
            const qr = await selections({contactEmails: (initial.contactEmails ?? []).map(item => ({id: item?.id})),
                contactPhones: (initial.contactPhones ?? []).map(item => ({id: item?.id})),
                userAddresses: items.map(item => ({id: item?.id}))});
            check();
            const rows = [], snapshot = new Map();
            for (const item of items) {
                if (!object(item)) fail(PRIVATE_ADDRESS_REFUSALS.SHAPE);
                const id = privateAddressId(item.id), derived = privateAddressLegacyId(item.id);
                // A derived identity is not an identity: the row stays consultable
                // and is never editable nor targeted.
                const stable = id !== null && !derived;
                const fields = [];
                for (const key of KEYS) {
                    const value = item[key] ?? '';
                    if (typeof value !== 'string' || value.length > MAX[key]) fail('PROFILE_ADDRESS_VALUE_INVALID');
                    fields.push(Object.freeze({key, label: LABELS[key], value, maxLength: MAX[key]}));
                }
                fields.push(Object.freeze({key: 'isPrimary', label: LABELS.isPrimary, type: 'boolean', value: item.isPrimary === true}));
                const selected = qr.state === 'unverified' ? 'unverified'
                    : stable && qr.state === 'verified' && qr.selection.addresses.includes(id);
                const deleteRefusal = !stable ? (derived ? PRIVATE_ADDRESS_REFUSALS.ID_DERIVED : PRIVATE_ADDRESS_REFUSALS.ID_MISSING)
                    : (qr.state === 'unverified' ? 'PROFILE_ADDRESSES_QR_UNVERIFIABLE'
                        : privateAddressDeleteRefusal(item, {qrIncluded: selected === true}));
                rows.push(Object.freeze({id, label: item.type || 'Indirizzo', fields: Object.freeze(fields),
                    editable: stable, blocked: stable ? null : (derived ? PRIVATE_ADDRESS_REFUSALS.ID_DERIVED
                        : PRIVATE_ADDRESS_REFUSALS.ID_MISSING), deleteRefusal}));
                if (stable) {
                    const original = {};
                    for (const key of KEYS) original[key] = item[key] ?? '';
                    original.isPrimary = item.isPrimary === true;
                    snapshot.set(id, {fields: original});
                }
            }
            const confirmed = await read(isOnline()); check();
            if (signature(confirmed) !== current) fail('PROFILE_CHANGED');
            loaded = {revision, signature: current, snapshot};
            const templates = [...KEYS.map(key => Object.freeze({key, label: LABELS[key], value: '', maxLength: MAX[key]})),
                Object.freeze({key: 'isPrimary', label: LABELS.isPrimary, type: 'boolean', value: false})];
            return Object.freeze({revision, canSave: isOnline(), addLabel: 'Aggiungi indirizzo', newLabel: 'Nuovo indirizzo',
                qrState: qr.state, rows: Object.freeze(rows), templates: Object.freeze(templates)});
        },
        async prepare(draft, operationId) {
            check();
            if (!loaded || !isOnline()) fail('PROFILE_SAVE_UNAVAILABLE');
            const current = await read(true); check();
            if (signature(current) !== loaded.signature) fail('PROFILE_CHANGED');
            const request = await preparePrivateAddresses({context, getUser, record: current, snapshot: loaded.snapshot,
                draft: {creates: draft.creates, updates: draft.updates, deletes: draft.deletes}, operationId, hash});
            check();
            return request;
        }});
}
