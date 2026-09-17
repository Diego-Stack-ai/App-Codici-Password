// Private profile contacts only: e-mails and telephones. Company contacts,
// addresses, utilities and documents keep their own slices. Nothing here decides
// permissions, persistence, re-encryption or id assignment for legacy rows.
export const CONTACT_COLLECTIONS = Object.freeze({contactEmails: 'email', contactPhones: 'phone'});
export const CONTACT_METADATA = Object.freeze(['_profileContactsRevision', '_profileContactsSchemaVersion', '_profileContactsUpdatedAt']);
// `format` is the stored form this slice writes: cipher fields are always
// ciphertext, plain fields keep the form already stored for that row.
export const CONTACT_FIELDS = Object.freeze({
    contactEmails: Object.freeze([
        Object.freeze({key: 'label', maxLength: 120, format: 'plain'}),
        Object.freeze({key: 'address', maxLength: 320, format: 'plain'}),
        Object.freeze({key: 'note', maxLength: 20000, format: 'cipher', multiline: true}),
        Object.freeze({key: 'password', maxLength: 1000, format: 'cipher', secret: true})
    ]),
    contactPhones: Object.freeze([
        Object.freeze({key: 'label', maxLength: 120, format: 'plain'}),
        Object.freeze({key: 'number', maxLength: 120, format: 'plain'})
    ])
});
const OPERATION_KEYS = Object.freeze({
    create: Object.freeze(['kind', 'collection', 'id', 'fields']),
    update: Object.freeze(['kind', 'collection', 'id', 'basis', 'fields']),
    delete: Object.freeze(['kind', 'collection', 'id', 'basis'])
});
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const profileContactsInvalid = () => {throw Error('PROFILE_CONTACTS_INVALID');};
export const profileContactsObject = value => value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
// Same shape the QR selection contract accepts: no control characters, no slash.
export const profileContactsId = value => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    !/[\u0000-\u001f/]/.test(value);
export const profileContactsUid = value => typeof value === 'string' && UID_PATTERN.test(value);
export const profileContactsHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const profileContactsCipher = value => typeof value === 'string' && (value === '' ||
    (value.length >= 60 && value.length <= 100000 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)));
export const contactFieldSpec = (collection, key) => {
    if (!Object.hasOwn(CONTACT_FIELDS, collection)) profileContactsInvalid();
    const spec = CONTACT_FIELDS[collection].find(item => item.key === key);
    if (!spec) profileContactsInvalid();
    return spec;
};
export const contactCollectionOf = value => {
    if (!profileContactsObject(value) || !Object.hasOwn(CONTACT_COLLECTIONS, value.collection)) profileContactsInvalid();
    return value.collection;
};
// New rows only ever take the prefix of their own collection: never a position.
export function contactCreatedId(collection, value) {
    if (!Object.hasOwn(CONTACT_COLLECTIONS, collection)) profileContactsInvalid();
    const prefix = CONTACT_COLLECTIONS[collection];
    return typeof value === 'string' && value.length <= 128 && new RegExp(`^${prefix}-[A-Za-z0-9_-]{1,120}$`).test(value);
}
export function contactFields(collection, fields) {
    if (!profileContactsObject(fields)) profileContactsInvalid();
    const specs = CONTACT_FIELDS[collection], keys = Object.keys(fields);
    if (!keys.length || keys.length > specs.length) profileContactsInvalid();
    const result = {};
    for (const key of keys) {
        const spec = contactFieldSpec(collection, key), value = fields[key];
        if (typeof value !== 'string' || value.length > 100000) profileContactsInvalid();
        if (value.length > spec.maxLength && !(spec.format === 'plain' && profileContactsCipher(value))) profileContactsInvalid();
        // Cipher-form fields carry ciphertext or an explicit empty clear.
        if (spec.format === 'cipher' && !profileContactsCipher(value)) profileContactsInvalid();
        result[key] = value;
    }
    return Object.freeze(result);
}
// Stable serialization of one stored row: the whole row is the conflict basis, so
// a concurrent change to any field (including links and unknown legacy keys) is
// detected instead of being overwritten.
export function contactBasis(value) {
    let count = 0;
    const copy = (item, depth = 0) => {
        if (++count > 20000 || depth > 12) profileContactsInvalid();
        if (item === null || typeof item === 'boolean') return item;
        if (typeof item === 'string') {
            if (item.length > 100000) profileContactsInvalid();
            return item;
        }
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (Array.isArray(item)) {
            if (item.length > 10000) profileContactsInvalid();
            return item.map(child => copy(child, depth + 1));
        }
        if (!profileContactsObject(item)) profileContactsInvalid();
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(item).sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) profileContactsInvalid();
            result[key] = copy(descriptor.value, depth + 1);
        }
        return result;
    };
    const serialized = JSON.stringify(copy(value));
    if (serialized.length > 200000) profileContactsInvalid();
    return serialized;
}
export function contactRevision(record) {
    if (!profileContactsObject(record) || record.isArchived) profileContactsInvalid();
    const revision = Object.hasOwn(record, '_profileContactsRevision') ? record._profileContactsRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_profileContactsSchemaVersion') && record._profileContactsSchemaVersion !== 1)) profileContactsInvalid();
    return revision;
}
export function profileContactsTarget(value) {
    if (!profileContactsObject(value) || Object.keys(value).length !== 1 || value.domain !== 'private') profileContactsInvalid();
    return Object.freeze({domain: 'private'});
}
export function validateProfileContactsRequest(data) {
    const allowed = ['target', 'expectedRevision', 'operations', 'operationId'];
    if (!profileContactsObject(data) || Object.keys(data).length !== allowed.length ||
        Object.keys(data).some(key => !allowed.includes(key)) ||
        !profileContactsUid(data.operationId) || !Number.isSafeInteger(data.expectedRevision) ||
        data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !Array.isArray(data.operations) || !data.operations.length || data.operations.length > 50) profileContactsInvalid();
    const target = profileContactsTarget(data.target), seen = new Set(), operations = [];
    for (const raw of data.operations) {
        if (!profileContactsObject(raw) || typeof raw.kind !== 'string' || !Object.hasOwn(OPERATION_KEYS, raw.kind)) profileContactsInvalid();
        const keys = OPERATION_KEYS[raw.kind];
        if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) profileContactsInvalid();
        const collection = contactCollectionOf(raw);
        if (raw.kind === 'create' ? !contactCreatedId(collection, raw.id) : !profileContactsId(raw.id)) profileContactsInvalid();
        const identity = `${collection}:${raw.id}`;
        if (seen.has(identity)) profileContactsInvalid();
        seen.add(identity);
        if (raw.kind === 'create') {
            operations.push(Object.freeze({kind: 'create', collection, id: raw.id, fields: contactFields(collection, raw.fields)}));
            continue;
        }
        if (!profileContactsHash(raw.basis)) profileContactsInvalid();
        if (raw.kind === 'update') {
            operations.push(Object.freeze({kind: 'update', collection, id: raw.id, basis: raw.basis, fields: contactFields(collection, raw.fields)}));
            continue;
        }
        operations.push(Object.freeze({kind: 'delete', collection, id: raw.id, basis: raw.basis}));
    }
    return Object.freeze({target, expectedRevision: data.expectedRevision,
        operations: Object.freeze(operations), operationId: data.operationId});
}
