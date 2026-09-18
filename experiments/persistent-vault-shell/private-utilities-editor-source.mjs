import {PRIVATE_UTILITY_FIELDS, PRIVATE_UTILITY_REFUSALS, privateUtilityBasis, privateUtilityDeleteRefusal,
    privateUtilityId, privateUtilityLegacyId, privateUtilityParent, privateUtilitiesRevision} from './private-utilities-contract.mjs';
import {preparePrivateUtilities} from './prepare-private-utilities.mjs';

const LABELS = {type: 'Tipo utenza', value: 'Valore'};
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function createPrivateUtilitiesEditorSource({context, getUser, repository, parentAddressId, isEncryptedValue = () => false,
    hash, createId, isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    let disposed = false, loaded = null;
    const dispose = () => {disposed = true; loaded = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        const record = await repository[confirmed ? 'getUserProfileConfirmed' : 'getUserProfile'](uid);
        if (!object(record) || (record.ownerId !== undefined && record.ownerId !== uid)) throw Error('PROFILE_NOT_FOUND');
        return record;
    };
    const signature = record => JSON.stringify([record.userAddresses ?? null, record._profileUtilitiesRevision ?? 0]);
    return Object.freeze({dispose,
        createId() {
            const id = createId('utility');
            if (typeof id !== 'string' || !id.startsWith('utility-') || id.includes('-legacy-')) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
            return id;
        },
        async load() {
            loaded = null;
            const initial = await read(isOnline()); check();
            const current = signature(initial), revision = privateUtilitiesRevision(initial);
            const {utilities} = privateUtilityParent(initial, parentAddressId);
            const rows = [], snapshot = new Map();
            for (const item of utilities) {
                if (!object(item)) throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
                const id = privateUtilityId(item.id), derived = privateUtilityLegacyId(item.id), stable = id !== null && !derived;
                const fields = [], originals = {}, forms = {};
                for (const spec of PRIVATE_UTILITY_FIELDS) {
                    const raw = item[spec.key] ?? '';
                    if (typeof raw !== 'string') throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
                    const encrypted = spec.format === 'cipher' && raw !== '' && isEncryptedValue(raw);
                    check(); const value = encrypted ? await context.read({ownerId: uid, ciphertext: raw}) : raw; check();
                    if (typeof value !== 'string' || value.length > spec.maxLength || (encrypted && value === raw)) throw Error('PROFILE_UTILITY_VALUE_INVALID');
                    fields.push(Object.freeze({key: spec.key, label: LABELS[spec.key], value, maxLength: spec.maxLength,
                        secret: spec.key === 'value'}));
                    originals[spec.key] = value; forms[spec.key] = encrypted ? 'cipher' : spec.format;
                }
                rows.push(Object.freeze({id, editable: stable, blocked: stable ? null : (derived ? PRIVATE_UTILITY_REFUSALS.ID_DERIVED : PRIVATE_UTILITY_REFUSALS.ID_MISSING),
                    linked: Boolean(item.linkedAccountId || item.linkedAccountCompanyId), fields: Object.freeze(fields),
                    linkOrigin: stable ? Object.freeze({domain: 'private', collection: 'utilities', id, parentAddressId}) : null}));
                if (stable) snapshot.set(id, {fields: originals, forms});
            }
            const confirmed = await read(isOnline()); check();
            if (signature(confirmed) !== current) throw Error('PROFILE_CHANGED');
            loaded = {signature: current, snapshot};
            return Object.freeze({revision, canSave: isOnline(), rows: Object.freeze(rows), templates: Object.freeze(PRIVATE_UTILITY_FIELDS.map(spec =>
                Object.freeze({key: spec.key, label: LABELS[spec.key], value: '', maxLength: spec.maxLength, secret: spec.key === 'value'})))});
        },
        async prepare(draft, operationId) {
            check(); if (!loaded || !isOnline()) throw Error('PROFILE_SAVE_UNAVAILABLE');
            const current = await read(true); check();
            if (signature(current) !== loaded.signature) throw Error('PROFILE_CHANGED');
            const request = await preparePrivateUtilities({context, getUser, record: current, parentAddressId,
                snapshot: loaded.snapshot, draft, operationId, hash}); check(); return request;
        }});
}
