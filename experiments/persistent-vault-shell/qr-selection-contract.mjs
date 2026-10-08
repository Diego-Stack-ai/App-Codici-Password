// Selection-only contract shared by the future editor and its write boundary.
// No values, labels, Vault key, persistence or permission decision belongs here.
export const PRIVATE_QR_SCALARS = Object.freeze(['nome', 'cognome', 'cf', 'nascita', 'photo']);
const collections = {phones: 'contactPhones', emails: 'contactEmails', addresses: 'userAddresses'};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => {throw new Error('QR_SELECTION_INVALID');};
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f/]/.test(value);

// Legacy indexes are resolved against the supplied snapshot, never persisted
// again as positions. A deleted or ambiguous row is an error, not a silent drop.
export function preparePrivateQrSelection(input, profile) {
    if (!object(input) || !object(profile) || profile.isArchived) invalid();
    const allowed = new Set([...PRIVATE_QR_SCALARS, ...Object.keys(collections)]);
    if (Object.keys(input).some(key => !allowed.has(key))) invalid();
    const result = {};
    for (const key of PRIVATE_QR_SCALARS) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean') invalid();
        result[key] = input[key] === true;
    }
    for (const [key, collection] of Object.entries(collections)) {
        const refs = input[key] ?? [], rows = profile[collection] ?? [];
        if (!Array.isArray(refs) || refs.length > 1000 || !Array.isArray(rows) || rows.length > 10000 || rows.some(row => !object(row))) invalid();
        const ids = refs.map(ref => {
            const id = Number.isSafeInteger(ref) && ref >= 0 ? rows[ref]?.id : ref;
            if (!validId(id) || rows.filter(row => row.id === id).length !== 1) invalid();
            return id;
        });
        if (new Set(ids).size !== ids.length) invalid();
        result[key] = Object.freeze(ids);
    }
    return Object.freeze(result);
}
