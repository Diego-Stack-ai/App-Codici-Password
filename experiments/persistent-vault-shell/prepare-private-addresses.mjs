import {privateAddressBasis, privateAddressCreatedId, privateAddressDeleteRefusal, privateAddressFields,
    privateAddressId, privateAddressLegacyId, privateAddressSpec, privateAddressesRevision,
    validatePrivateAddressesRequest, PRIVATE_ADDRESS_REFUSALS} from './private-addresses-contract.mjs';

// `userAddresses` is stored in clear, so the preparation never encrypts: it only
// maps the fields the user actually changed, preserves the stored form of every
// other field, refuses any operation on a row whose identity is not persisted, and
// never lets `utilities[]`, links or unknown keys enter a command.
export async function preparePrivateAddresses({context, getUser, record, snapshot, draft, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check();
    if (record.ownerId !== undefined && record.ownerId !== uid) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
    const revision = privateAddressesRevision(record);
    const staged = value => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        return value;
    };
    const creates = staged(draft?.creates), updates = staged(draft?.updates), deletes = staged(draft?.deletes);
    const rows = record.userAddresses === undefined ? [] : record.userAddresses;
    if (!Array.isArray(rows) || rows.length > 10000 || rows.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw Error(PRIVATE_ADDRESS_REFUSALS.SHAPE);
    }
    const mapFields = (fields, stored) => {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            const spec = privateAddressSpec(key);
            if (spec.format === 'boolean') {
                if (stored?.fields?.[key] === value) continue;
                result[key] = value;
                continue;
            }
            if (typeof value !== 'string' || value.length > spec.maxLength) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
            if (stored?.fields?.[key] === value) continue;
            result[key] = value;
        }
        return result;
    };
    const operations = [];
    for (const value of creates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        if (!privateAddressCreatedId(value.id)) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        if (rows.some(item => item.id === value.id)) throw Error('PROFILE_CHANGED');
        const fields = mapFields(value.fields, null);
        if (!Object.keys(fields).length) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        operations.push({kind: 'create', id: value.id, fields});
    }
    for (const value of updates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        const matches = rows.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('PROFILE_CHANGED');
        // An identity that was derived from the row content and its position is not
        // an identity: the row stays consultable and is never targeted.
        if (privateAddressLegacyId(value.id) || privateAddressId(value.id) === null) throw Error(PRIVATE_ADDRESS_REFUSALS.ID_DERIVED);
        const fields = mapFields(value.fields, snapshot?.get(value.id) ?? null);
        if (!Object.keys(fields).length) continue;
        operations.push({kind: 'update', id: value.id, basis: await hash(privateAddressBasis(matches[0])), fields});
    }
    for (const value of deletes) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_ADDRESS_REFUSALS.INVALID);
        const matches = rows.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('PROFILE_CHANGED');
        const refusal = privateAddressDeleteRefusal(matches[0]);
        if (refusal) throw Error(refusal);
        operations.push({kind: 'delete', id: value.id, basis: await hash(privateAddressBasis(matches[0]))});
    }
    if (!operations.length) throw Error(PRIVATE_ADDRESS_REFUSALS.UNCHANGED);
    check();
    return validatePrivateAddressesRequest({target: {domain: 'private'}, expectedRevision: revision, operations, operationId});
}
