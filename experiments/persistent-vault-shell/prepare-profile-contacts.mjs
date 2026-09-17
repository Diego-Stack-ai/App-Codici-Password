import {contactBasis, contactCollectionOf, contactCreatedId, contactFieldSpec, contactRevision,
    profileContactsCipher, profileContactsId, profileContactsInvalid, profileContactsObject, validateProfileContactsRequest} from './profile-contacts-contract.mjs';

// The session crypto performs every encryption. Unchanged values are never sent,
// so nothing is re-encrypted; a row whose stored field is legacy ciphertext keeps
// that form, and a plain row stays plain. Contacts remain an online-only write.
export async function prepareProfileContacts({context, getUser, record, snapshot, draft, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check();
    if (record.ownerId !== undefined && record.ownerId !== uid) profileContactsInvalid();
    const revision = contactRevision(record);
    if (!profileContactsObject(draft)) profileContactsInvalid();
    const staged = value => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) profileContactsInvalid();
        return value;
    };
    const creates = staged(draft.creates), updates = staged(draft.updates), deletes = staged(draft.deletes);
    const arrays = {contactEmails: record.contactEmails ?? [], contactPhones: record.contactPhones ?? []};
    for (const collection of Object.keys(arrays)) {
        if (!Array.isArray(arrays[collection]) || arrays[collection].length > 10000 ||
            arrays[collection].some(item => !profileContactsObject(item))) profileContactsInvalid();
    }
    const identity = value => {
        const collection = contactCollectionOf(value);
        if (!profileContactsId(value.id)) profileContactsInvalid();
        return {collection, id: value.id, stored: snapshot?.get(`${collection}:${value.id}`) ?? null};
    };
    // Only fields the user actually changed travel: the stored bytes stay bytes.
    const mapFields = async (collection, fields, stored) => {
        if (!profileContactsObject(fields) || !Object.keys(fields).length) profileContactsInvalid();
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            const spec = contactFieldSpec(collection, key);
            if (typeof value !== 'string' || value.length > spec.maxLength) profileContactsInvalid();
            if (stored?.fields?.[key] === value) continue;
            if (spec.format === 'cipher' || stored?.forms?.[key] === 'cipher') {
                if (value === '') {
                    result[key] = '';
                    continue;
                }
                check();
                const ciphertext = await context.encrypt(value);
                check();
                if (!profileContactsCipher(ciphertext) || ciphertext === value) throw Error('ENCRYPTION_FAILED');
                result[key] = ciphertext;
                continue;
            }
            result[key] = value;
        }
        return result;
    };
    const operations = [];
    for (const value of creates) {
        const {collection, id} = identity(value);
        if (!contactCreatedId(collection, id)) profileContactsInvalid();
        if (arrays[collection].some(item => item.id === id)) throw Error('PROFILE_CHANGED');
        operations.push({kind: 'create', collection, id, fields: await mapFields(collection, value.fields, null)});
    }
    for (const value of updates) {
        const {collection, id, stored} = identity(value);
        if (arrays[collection].filter(item => item.id === id).length !== 1) throw Error('PROFILE_CHANGED');
        const fields = await mapFields(collection, value.fields, stored);
        if (!Object.keys(fields).length) continue;
        const item = arrays[collection].find(entry => entry.id === id);
        operations.push({kind: 'update', collection, id, basis: await hash(contactBasis(item)), fields});
    }
    for (const value of deletes) {
        const {collection, id} = identity(value);
        const matches = arrays[collection].filter(item => item.id === id);
        if (matches.length !== 1) throw Error('PROFILE_CHANGED');
        operations.push({kind: 'delete', collection, id, basis: await hash(contactBasis(matches[0]))});
    }
    if (!operations.length) throw Error('PROFILE_CONTACTS_UNCHANGED');
    check();
    return validateProfileContactsRequest({target: {domain: 'private'}, expectedRevision: revision,
        operations, operationId});
}
