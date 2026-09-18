import {PRIVATE_UTILITY_REFUSALS, privateUtilityBasis, privateUtilityCreatedId, privateUtilityDeleteRefusal,
    privateUtilityFields, privateUtilityId, privateUtilityLegacyId, privateUtilityParent, privateUtilitiesRevision,
    validatePrivateUtilitiesRequest} from './private-utilities-contract.mjs';

// The utilities of one address are the only thing this preparation touches. `value`
// is encrypted only where the session can already decrypt it, following the stored
// form of the row; `type` and every other field travel as they are, and a field the
// user did not change never enters a command. The parent address is identified, not
// rewritten.
export async function preparePrivateUtilities({context, getUser, record, parentAddressId, snapshot, draft, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check();
    if (record.ownerId !== undefined && record.ownerId !== uid) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
    const revision = privateUtilitiesRevision(record);
    const {utilities} = privateUtilityParent(record, parentAddressId);
    const staged = value => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        return value;
    };
    const creates = staged(draft?.creates), updates = staged(draft?.updates), deletes = staged(draft?.deletes);
    const mapFields = async (fields, stored) => {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            const spec = key === 'value' ? 'cipher' : 'plain';
            if (typeof value !== 'string' || value.length > (key === 'value' ? 100000 : 1000)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
            if (stored?.fields?.[key] === value) continue;
            const form = stored?.forms?.[key] ?? spec;
            if (form === 'cipher' || spec === 'cipher') {
                if (value === '') {
                    result[key] = '';
                    continue;
                }
                check();
                const ciphertext = await context.encrypt(value);
                check();
                if (typeof ciphertext !== 'string' || ciphertext.length < 60 || ciphertext === value) throw Error('ENCRYPTION_FAILED');
                result[key] = ciphertext;
                continue;
            }
            result[key] = value;
        }
        return result;
    };
    const operations = [];
    for (const value of creates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        if (!privateUtilityCreatedId(value.id)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        if (utilities.some(item => item.id === value.id)) throw Error('PROFILE_CHANGED');
        const fields = await mapFields(value.fields, null);
        if (!Object.keys(fields).length) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        operations.push({kind: 'create', id: value.id, fields});
    }
    for (const value of updates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        const matches = utilities.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('PROFILE_CHANGED');
        if (privateUtilityLegacyId(value.id) || privateUtilityId(value.id) === null) throw Error(PRIVATE_UTILITY_REFUSALS.ID_DERIVED);
        const fields = await mapFields(value.fields, snapshot?.get(value.id) ?? null);
        if (!Object.keys(fields).length) continue;
        operations.push({kind: 'update', id: value.id, basis: await hash(privateUtilityBasis(matches[0])), fields});
    }
    for (const value of deletes) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(PRIVATE_UTILITY_REFUSALS.INVALID);
        const matches = utilities.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('PROFILE_CHANGED');
        const refusal = privateUtilityDeleteRefusal(matches[0]);
        if (refusal) throw Error(refusal);
        operations.push({kind: 'delete', id: value.id, basis: await hash(privateUtilityBasis(matches[0]))});
    }
    if (!operations.length) throw Error(PRIVATE_UTILITY_REFUSALS.UNCHANGED);
    check();
    return validatePrivateUtilitiesRequest({target: {domain: 'private'}, parentAddressId, expectedRevision: revision,
        operations, operationId});
}
