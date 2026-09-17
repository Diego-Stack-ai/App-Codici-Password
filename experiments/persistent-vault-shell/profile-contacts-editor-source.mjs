import {CONTACT_COLLECTIONS, CONTACT_FIELDS, contactBasis, contactRevision, profileContactsObject} from './profile-contacts-contract.mjs';
import {prepareProfileContacts} from './prepare-profile-contacts.mjs';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';

const labels = Object.freeze({label: 'Etichetta', address: 'Indirizzo email', note: 'Note', password: 'Password', number: 'Numero'});
const settings = Object.freeze({contactEmails: 'emails', contactPhones: 'phones'});
// Deletion is refused for every row while the QR protection cannot be verified.
const QR_UNVERIFIED = 'unverified';
// Private contacts only. No company source is accepted: company contacts are a
// separate slice and the projection used here would not be safe to write back.
export function createProfileContactsEditorSource({context, getUser, repository, isEncryptedValue, hash, createId,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    if (typeof createId !== 'function') throw Error('PROFILE_CONTACTS_INVALID');
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
        if (!profileContactsObject(record)) throw Error('PROFILE_NOT_FOUND');
        if (record.ownerId !== undefined && record.ownerId !== uid) throw Error('OWNER_MISMATCH');
        return record;
    };
    // Any change to either array or to the revision invalidates the opened editor.
    const signature = record => contactBasis({contactEmails: record.contactEmails ?? [], contactPhones: record.contactPhones ?? [],
        _profileContactsRevision: record._profileContactsRevision ?? 0});
    // Three outcomes only. A missing document is a verified empty selection; a
    // read failure, foreign transport metadata or any configuration that does
    // not resolve canonically is "unverified" and blocks every deletion. It is
    // never silently reported as "nothing selected", and consultation and
    // editing stay available because only deletion depends on this protection.
    const selections = async projection => {
        let setting;
        try {
            setting = await repository.getUserSetting(uid, 'qrCodeInclusions');
        } catch {return {state: 'unverified'};}
        if (setting === null || setting === undefined) return {state: 'absent'};
        if (!profileContactsObject(setting)) return {state: 'unverified'};
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
    return Object.freeze({dispose,
        createId(collection) {
            if (!Object.hasOwn(CONTACT_COLLECTIONS, collection)) throw Error('PROFILE_CONTACTS_INVALID');
            const value = createId(CONTACT_COLLECTIONS[collection]);
            if (typeof value !== 'string' || !value.startsWith(`${CONTACT_COLLECTIONS[collection]}-`)) throw Error('PROFILE_CONTACTS_INVALID');
            return value;
        },
        async load() {
            loaded = null;
            const initial = await read(isOnline()); check();
            const revision = contactRevision(initial), current = signature(initial);
            // The canonical contract validates the whole saved selection against
            // the profile rows: identifiers are resolved, never guessed.
            const idRows = value => Array.isArray(value)
                ? value.map(item => profileContactsObject(item) ? {id: item.id} : item) : value;
            const qr = await selections({contactEmails: idRows(initial.contactEmails ?? []),
                contactPhones: idRows(initial.contactPhones ?? []), userAddresses: idRows(initial.userAddresses ?? [])});
            check();
            const rows = [], snapshot = new Map();
            for (const collection of Object.keys(settings)) {
                const items = initial[collection] === undefined ? [] : initial[collection];
                if (!Array.isArray(items) || items.length > 10000) throw Error('PROFILE_SHAPE_INVALID');
                for (const item of items) {
                    if (!profileContactsObject(item)) throw Error('PROFILE_SHAPE_INVALID');
                    const id = typeof item.id === 'string' && item.id ? item.id : null;
                    const fields = [], forms = {}, originals = {};
                    for (const spec of CONTACT_FIELDS[collection]) {
                        const raw = item[spec.key] ?? '';
                        if (raw !== '' && typeof raw !== 'string') throw Error('PROFILE_VALUE_INVALID');
                        const encrypted = raw !== '' && isEncryptedValue(raw);
                        check();
                        const value = encrypted ? await context.read({ownerId: uid, ciphertext: raw}) : raw;
                        check();
                        if (typeof value !== 'string' || value.length > spec.maxLength || value === '--ERRORE--' ||
                            (encrypted && value === raw)) throw Error('PROFILE_VALUE_INVALID');
                        fields.push(Object.freeze({key: spec.key, label: labels[spec.key], value, maxLength: spec.maxLength,
                            multiline: spec.multiline === true, secret: spec.secret === true, form: encrypted ? 'cipher' : 'plain'}));
                        forms[spec.key] = encrypted ? 'cipher' : 'plain';
                        originals[spec.key] = value;
                    }
                    // Only a canonically verified selection can allow a deletion:
                    // an unverifiable protection disables it for every row.
                    const selected = qr.state === 'unverified' ? QR_UNVERIFIED
                        : qr.state === 'verified' && qr.selection[settings[collection]].includes(id);
                    rows.push(Object.freeze({collection, id, editable: id !== null,
                        blocked: id === null ? 'CONTACT_ID_MISSING' : null,
                        linked: Boolean(item.linkedAccountId || item.linkedAccountCompanyId), qr: selected,
                        fields: Object.freeze(fields)}));
                    if (id !== null) snapshot.set(`${collection}:${id}`, {fields: originals, forms});
                }
            }
            const confirmed = await read(isOnline()); check();
            if (signature(confirmed) !== current) throw Error('PROFILE_CHANGED');
            loaded = {revision, signature: current, snapshot};
            const templates = {};
            for (const collection of Object.keys(CONTACT_FIELDS)) {
                templates[collection] = Object.freeze(CONTACT_FIELDS[collection].map(spec => Object.freeze({key: spec.key,
                    label: labels[spec.key], maxLength: spec.maxLength, multiline: spec.multiline === true, secret: spec.secret === true})));
            }
            return Object.freeze({revision, canSave: isOnline(), rows: Object.freeze(rows), templates: Object.freeze(templates)});
        },
        async prepare(draft, operationId) {
            check();
            if (!loaded || !isOnline()) throw Error('PROFILE_SAVE_UNAVAILABLE');
            const current = await read(true); check();
            if (signature(current) !== loaded.signature) throw Error('PROFILE_CHANGED');
            const request = await prepareProfileContacts({context, getUser, record: current, snapshot: loaded.snapshot,
                draft, operationId, hash});
            check();
            return request;
        }});
}
