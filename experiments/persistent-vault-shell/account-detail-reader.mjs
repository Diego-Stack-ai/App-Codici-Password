const fields = ['nomeAccount', 'username', 'account', 'password', 'note', 'url'];
const segment = value => {
    if (typeof value !== 'string' || !value.trim() || value.includes('/') || value === '.' || value === '..') {
        throw new Error('INVALID_RECORD_ID');
    }
    return value;
};

// Experimental own-record reader: the canonical repository returns ciphertext;
// the route's owner-bound reader alone may decrypt it. No key or record escapes.
export function createAccountDetailReader({context, getUser, repository}) {
    const uid = context.user?.uid;
    const assertActive = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (!context.unlocked) throw new Error('VAULT_LOCKED');
    };
    const checkField = field => {
        if (!fields.includes(field)) throw new Error('FIELD_NOT_ALLOWED');
    };
    return async function open(selection) {
        assertActive();
        if (!selection || !['private', 'company'].includes(selection.domain)) throw new Error('INVALID_ACCOUNT_DOMAIN');
        const id = segment(selection.id);
        if (selection.domain === 'private' && selection.companyId !== undefined) throw new Error('INVALID_ACCOUNT_DOMAIN');
        const companyId = selection.domain === 'company' ? segment(selection.companyId) : undefined;
        const record = companyId === undefined
            ? await repository.getPrivateAccount(uid, id)
            : await repository.getCompanyAccount(uid, companyId, id);
        assertActive();
        if (!record) throw new Error('RECORD_NOT_FOUND');
        if (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid) throw new Error('OWNER_MISMATCH');
        const ciphertext = Object.fromEntries(fields.map(field => [field, structuredClone(record[field])]));
        const has = field => {
            assertActive(); checkField(field);
            return ciphertext[field] !== undefined && ciphertext[field] !== null && ciphertext[field] !== '';
        };
        return Object.freeze({has, async read(field) {
            if (!has(field)) return '';
            const value = await context.read({ownerId: uid, ciphertext: structuredClone(ciphertext[field])});
            assertActive();
            return value;
        }});
    };
}
