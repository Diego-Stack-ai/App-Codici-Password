import {CONTACT_COLLECTIONS, CONTACT_FIELDS, contactBasis, contactRevision, profileContactsObject} from './profile-contacts-contract.mjs';
import {prepareProfileContacts} from './prepare-profile-contacts.mjs';

const labels = Object.freeze({label: 'Etichetta', address: 'Indirizzo email', note: 'Note', password: 'Password', number: 'Numero'});
const settings = Object.freeze({contactEmails: 'emails', contactPhones: 'phones'});
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
    const selections = async () => {
        try {
            const setting = await repository.getUserSetting(uid, 'qrCodeInclusions');
            return profileContactsObject(setting) ? setting : null;
        } catch {return null;}
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
            const setting = await selections(); check();
            const rows = [], snapshot = new Map();
            for (const collection of Object.keys(settings)) {
                const items = initial[collection] === undefined ? [] : initial[collection];
                if (!Array.isArray(items) || items.length > 10000) throw Error('PROFILE_SHAPE_INVALID');
                const references = setting && Array.isArray(setting[settings[collection]]) ? setting[settings[collection]] : null;
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
                    // A row included in the QR selection (or any legacy positional
                    // reference) cannot be deleted from this editor.
                    const selected = references === null ? null : references.includes(id) ||
                        references.some(reference => Number.isSafeInteger(reference));
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
