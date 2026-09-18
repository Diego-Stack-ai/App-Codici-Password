// A2, private addresses only: `users/{uid}.userAddresses[]`. The company slice has
// its own contract and is never converted into this one. Every address field is
// stored in clear (`profilo-sync.js`), so nothing here encrypts an address; the
// nested `utilities[]` are not editable in this increment and are preserved by
// construction, because only the allowlisted fields ever travel.
export const PRIVATE_ADDRESS_REFUSALS = Object.freeze({
    INVALID: 'PROFILE_ADDRESSES_INVALID',
    UNCHANGED: 'PROFILE_ADDRESSES_UNCHANGED',
    SHAPE: 'PROFILE_ADDRESSES_SHAPE_INVALID',
    ID_MISSING: 'ADDRESS_ID_MISSING',
    ID_DERIVED: 'ADDRESS_ID_DERIVED'
});
export const PRIVATE_ADDRESS_METADATA = Object.freeze(['_profileAddressesRevision', '_profileAddressesSchemaVersion',
    '_profileAddressesUpdatedAt']);
export const PRIVATE_ADDRESS_FIELDS = Object.freeze([
    Object.freeze({key: 'type', maxLength: 120, format: 'plain'}),
    Object.freeze({key: 'address', maxLength: 320, format: 'plain'}),
    Object.freeze({key: 'civic', maxLength: 20, format: 'plain'}),
    Object.freeze({key: 'cap', maxLength: 10, format: 'plain'}),
    Object.freeze({key: 'city', maxLength: 120, format: 'plain'}),
    Object.freeze({key: 'province', maxLength: 20, format: 'plain'}),
    Object.freeze({key: 'isPrimary', format: 'boolean'})
]);
const fail = () => {throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);};
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const privateAddressUid = value => typeof value === 'string' && UID_PATTERN.test(value);
export const privateAddressHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const privateAddressCipher = value => typeof value === 'string' && (value === '' ||
    (value.length >= 60 && value.length <= 100000 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)));
// `createProfileItemId('address')` produces `address-<uuid>`; the read-only model
// synthesizes `address-legacy-<hash>` from the row content **and its index**
// (`profile-model.js`), so such an id is never an identity and is never targeted.
export const privateAddressCreatedId = value => typeof value === 'string' && /^address-[A-Za-z0-9-]{1,110}$/.test(value) &&
    !value.includes('-legacy-');
export const privateAddressLegacyId = value => typeof value === 'string' && value.includes('-legacy-');
export const privateAddressId = value => {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'string' && value.length <= 256 && !/[\u0000-\u001f/]/.test(value) ? value : null;
};
export const privateAddressSpec = key => {
    const spec = PRIVATE_ADDRESS_FIELDS.find(item => item.key === key);
    if (!spec) fail();
    return spec;
};
export function privateAddressFields(fields) {
    if (!object(fields)) fail();
    const keys = Object.keys(fields);
    if (!keys.length || keys.length > PRIVATE_ADDRESS_FIELDS.length) fail();
    const result = {};
    for (const key of keys) {
        const spec = privateAddressSpec(key), value = fields[key];
        if (spec.format === 'boolean') {
            if (typeof value !== 'boolean') fail();
            result[key] = value;
            continue;
        }
        if (typeof value !== 'string' || value.length > 100000) fail();
        if (value.length > spec.maxLength && !privateAddressCipher(value)) fail();
        result[key] = value;
    }
    return Object.freeze(result);
}
// Stable serialization of one stored address: the whole row is the conflict basis,
// so a concurrent change to a utility, a link or an unknown legacy key is detected
// instead of being overwritten.
export function privateAddressBasis(value) {
    let count = 0;
    const copy = (item, depth = 0) => {
        if (++count > 20000 || depth > 12) fail();
        if (item === null || typeof item === 'boolean') return item;
        if (typeof item === 'string') {
            if (item.length > 100000) fail();
            return item;
        }
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (Array.isArray(item)) {
            if (item.length > 10000) fail();
            return item.map(child => copy(child, depth + 1));
        }
        if (!object(item)) fail();
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(item).sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
            result[key] = copy(descriptor.value, depth + 1);
        }
        return result;
    };
    const serialized = JSON.stringify(copy(value));
    if (serialized.length > 200000) fail();
    return serialized;
}
export function privateAddressesRevision(record) {
    if (!object(record) || record.isArchived) throw Error(PRIVATE_ADDRESS_REFUSALS.SHAPE);
    const revision = Object.hasOwn(record, '_profileAddressesRevision') ? record._profileAddressesRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_profileAddressesSchemaVersion') && record._profileAddressesSchemaVersion !== 1)) {
        throw Error(PRIVATE_ADDRESS_REFUSALS.SHAPE);
    }
    return revision;
}
// An address is never deleted while it still owns utilities or an Account
// reference: the legacy application deletes it and then repairs the references,
// which is exactly the destructive path this candidate refuses.
export function privateAddressDeleteRefusal(item, {qrIncluded = false} = {}) {
    if (!object(item)) return PRIVATE_ADDRESS_REFUSALS.ID_MISSING;
    const id = privateAddressId(item.id);
    if (id === null || privateAddressLegacyId(item.id)) {
        return privateAddressLegacyId(item.id) ? PRIVATE_ADDRESS_REFUSALS.ID_DERIVED : PRIVATE_ADDRESS_REFUSALS.ID_MISSING;
    }
    const utilities = item.utilities === undefined ? [] : item.utilities;
    if (!Array.isArray(utilities)) return 'PROFILE_ADDRESSES_UNVERIFIABLE';
    if (utilities.length) return 'PROFILE_ADDRESS_UTILITIES_PRESENT';
    for (const field of ['linkedAccountId', 'linkedAccountCompanyId']) {
        if (typeof item[field] === 'string' && item[field]) return 'PROFILE_ADDRESS_LINKED';
    }
    return qrIncluded === true ? 'PROFILE_ADDRESS_QR_SELECTED' : null;
}
export const PRIVATE_ADDRESS_OPERATION_KEYS = Object.freeze({
    create: Object.freeze(['kind', 'id', 'fields']),
    update: Object.freeze(['kind', 'id', 'basis', 'fields']),
    delete: Object.freeze(['kind', 'id', 'basis'])
});
export function privateAddressTarget(value) {
    if (!object(value) || value.domain !== 'private' || Object.keys(value).length !== 1) fail();
    return Object.freeze({domain: 'private'});
}
export function validatePrivateAddressesRequest(data) {
    const allowed = ['target', 'expectedRevision', 'operations', 'operationId'];
    if (!object(data) || Object.keys(data).length !== allowed.length || Object.keys(data).some(key => !allowed.includes(key)) ||
        !UID_PATTERN.test(data.operationId ?? '') || !Number.isSafeInteger(data.expectedRevision) ||
        data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !Array.isArray(data.operations) || !data.operations.length || data.operations.length > 50) fail();
    const target = privateAddressTarget(data.target), seen = new Set(), operations = [];
    for (const raw of data.operations) {
        if (!object(raw) || typeof raw.kind !== 'string' || !Object.hasOwn(PRIVATE_ADDRESS_OPERATION_KEYS, raw.kind)) fail();
        const keys = PRIVATE_ADDRESS_OPERATION_KEYS[raw.kind];
        if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) fail();
        // A derived identity (`*-legacy-*`) is never addressable, not even by a
        // hand-made request: only a persisted id can be updated or deleted.
        if (raw.kind === 'create' ? !privateAddressCreatedId(raw.id)
            : (privateAddressId(raw.id) === null || privateAddressLegacyId(raw.id))) fail();
        if (seen.has(raw.id)) fail();
        seen.add(raw.id);
        if (raw.kind === 'create') {
            operations.push(Object.freeze({kind: 'create', id: raw.id, fields: privateAddressFields(raw.fields)}));
            continue;
        }
        if (!privateAddressHash(raw.basis)) fail();
        if (raw.kind === 'update') {
            operations.push(Object.freeze({kind: 'update', id: raw.id, basis: raw.basis, fields: privateAddressFields(raw.fields)}));
            continue;
        }
        operations.push(Object.freeze({kind: 'delete', id: raw.id, basis: raw.basis}));
    }
    return Object.freeze({target, expectedRevision: data.expectedRevision, operations: Object.freeze(operations),
        operationId: data.operationId});
}
