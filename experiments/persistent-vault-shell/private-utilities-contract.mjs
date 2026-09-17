// A3, nested utilities only: `users/{uid}.userAddresses[].utilities[]`. The parent
// address is an identity, not a payload: the service replaces the `utilities` array
// of one address and nothing else. `value` is the only cipher field the real writer
// encrypts (`profilo-sync.js`); `type` and any legacy or unknown key stay as stored.
export const PRIVATE_UTILITY_REFUSALS = Object.freeze({
    INVALID: 'PROFILE_UTILITIES_INVALID',
    UNCHANGED: 'PROFILE_UTILITIES_UNCHANGED',
    SHAPE: 'PROFILE_UTILITIES_SHAPE_INVALID',
    ID_MISSING: 'UTILITY_ID_MISSING',
    ID_DERIVED: 'UTILITY_ID_DERIVED'
});
export const PRIVATE_UTILITY_METADATA = Object.freeze(['_profileUtilitiesRevision', '_profileUtilitiesSchemaVersion',
    '_profileUtilitiesUpdatedAt']);
export const PRIVATE_UTILITY_FIELDS = Object.freeze([
    Object.freeze({key: 'type', maxLength: 120, format: 'plain'}),
    Object.freeze({key: 'value', maxLength: 1000, format: 'cipher'})
]);
const fail = () => {throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);};
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const privateUtilityUid = value => typeof value === 'string' && UID_PATTERN.test(value);
export const privateUtilityHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const privateUtilityCipher = value => typeof value === 'string' && (value === '' ||
    (value.length >= 60 && value.length <= 100000 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)));
// `createProfileItemId('utility')` produces `utility-<uuid>`; the read model
// synthesizes `utility-<addressId>-legacy-<hash>` from the row content **and its
// position** (`profile-model.js`), so such an id is never an identity.
export const privateUtilityCreatedId = value => typeof value === 'string' && /^utility-[A-Za-z0-9-]{1,110}$/.test(value) &&
    !value.includes('-legacy-');
export const privateUtilityLegacyId = value => typeof value === 'string' && value.includes('-legacy-');
export const privateUtilityId = value => {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'string' && value.length <= 256 && !/[\u0000-\u001f/]/.test(value) ? value : null;
};
// The parent address is addressed by its persisted id only: a legacy address id is
// not an identity and its utilities are therefore not addressable either.
export const privateUtilityParentId = value => typeof value === 'string' && value.length <= 256 &&
    !/[\u0000-\u001f/]/.test(value) && !value.includes('-legacy-') ? value : null;
export function privateUtilityFields(fields) {
    if (!object(fields)) fail();
    const keys = Object.keys(fields);
    if (!keys.length || keys.length > PRIVATE_UTILITY_FIELDS.length) fail();
    const result = {};
    for (const key of keys) {
        const spec = PRIVATE_UTILITY_FIELDS.find(item => item.key === key), value = fields[key];
        if (!spec || typeof value !== 'string' || value.length > 100000) fail();
        if (value.length > spec.maxLength && !privateUtilityCipher(value)) fail();
        if (spec.format === 'cipher' && !privateUtilityCipher(value)) fail();
        result[key] = value;
    }
    return Object.freeze(result);
}
// The whole utility row is the conflict basis: a concurrent change to a link, to an
// unknown legacy key or to the value itself is detected instead of overwritten.
export function privateUtilityBasis(value) {
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
export function privateUtilitiesRevision(record) {
    if (!object(record) || record.isArchived) throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
    const revision = Object.hasOwn(record, '_profileUtilitiesRevision') ? record._profileUtilitiesRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_profileUtilitiesSchemaVersion') && record._profileUtilitiesSchemaVersion !== 1)) {
        throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
    }
    return revision;
}
// The utilities of one persisted address, with the address itself validated: an
// address without a stable id has no addressable utilities at all.
export function privateUtilityParent(record, parentAddressId) {
    if (!object(record) || privateUtilityParentId(parentAddressId) === null) fail();
    const addresses = record.userAddresses === undefined ? [] : record.userAddresses;
    if (!Array.isArray(addresses) || addresses.length > 10000 ||
        addresses.some(item => !object(item))) throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
    const matches = addresses.filter(item => item.id === parentAddressId);
    if (matches.length !== 1) throw Error(matches.length ? 'UTILITY_PARENT_AMBIGUOUS' : 'UTILITY_PARENT_MISSING');
    const parent = matches[0], utilities = parent.utilities === undefined ? [] : parent.utilities;
    if (!Array.isArray(utilities) || utilities.length > 10000 || utilities.some(item => !object(item))) {
        throw Error(PRIVATE_UTILITY_REFUSALS.SHAPE);
    }
    return {parent, utilities};
}
// A utility linked to an Account, or published with a parent address that the
// digital card includes, is never deleted.
export function privateUtilityDeleteRefusal(item, {qrIncluded = false} = {}) {
    if (!object(item)) return PRIVATE_UTILITY_REFUSALS.ID_MISSING;
    const id = privateUtilityId(item.id);
    if (id === null || privateUtilityLegacyId(item.id)) {
        return privateUtilityLegacyId(item.id) ? PRIVATE_UTILITY_REFUSALS.ID_DERIVED : PRIVATE_UTILITY_REFUSALS.ID_MISSING;
    }
    for (const field of ['linkedAccountId', 'linkedAccountCompanyId']) {
        if (typeof item[field] === 'string' && item[field]) return 'PROFILE_UTILITY_LINKED';
    }
    return qrIncluded === true ? 'PROFILE_UTILITY_QR_SELECTED' : null;
}
export const PRIVATE_UTILITY_OPERATION_KEYS = Object.freeze({
    create: Object.freeze(['kind', 'id', 'fields']),
    update: Object.freeze(['kind', 'id', 'basis', 'fields']),
    delete: Object.freeze(['kind', 'id', 'basis'])
});
export function privateUtilitiesTarget(value) {
    if (!object(value) || value.domain !== 'private' || Object.keys(value).length !== 1) fail();
    return Object.freeze({domain: 'private'});
}
export function validatePrivateUtilitiesRequest(data) {
    const allowed = ['target', 'parentAddressId', 'expectedRevision', 'operations', 'operationId'];
    if (!object(data) || Object.keys(data).length !== allowed.length || Object.keys(data).some(key => !allowed.includes(key)) ||
        !UID_PATTERN.test(data.operationId ?? '') || privateUtilityParentId(data.parentAddressId) === null ||
        !Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0 ||
        data.expectedRevision >= Number.MAX_SAFE_INTEGER || !Array.isArray(data.operations) ||
        !data.operations.length || data.operations.length > 50) fail();
    const target = privateUtilitiesTarget(data.target), seen = new Set(), operations = [];
    for (const raw of data.operations) {
        if (!object(raw) || typeof raw.kind !== 'string' || !Object.hasOwn(PRIVATE_UTILITY_OPERATION_KEYS, raw.kind)) fail();
        const keys = PRIVATE_UTILITY_OPERATION_KEYS[raw.kind];
        if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) fail();
        // A derived identity is never addressable, not even by a hand-made request.
        if (raw.kind === 'create' ? !privateUtilityCreatedId(raw.id)
            : (privateUtilityId(raw.id) === null || privateUtilityLegacyId(raw.id))) fail();
        if (seen.has(raw.id)) fail();
        seen.add(raw.id);
        if (raw.kind === 'create') {
            operations.push(Object.freeze({kind: 'create', id: raw.id, fields: privateUtilityFields(raw.fields)}));
            continue;
        }
        if (!privateUtilityHash(raw.basis)) fail();
        if (raw.kind === 'update') {
            operations.push(Object.freeze({kind: 'update', id: raw.id, basis: raw.basis, fields: privateUtilityFields(raw.fields)}));
            continue;
        }
        operations.push(Object.freeze({kind: 'delete', id: raw.id, basis: raw.basis}));
    }
    return Object.freeze({target, parentAddressId: data.parentAddressId, expectedRevision: data.expectedRevision,
        operations: Object.freeze(operations), operationId: data.operationId});
}
