const changeFields = new Set(['nomeAccount', 'username', 'account', 'password', 'note', 'url']);
// Existing M6 payload fields plus canonical repository metadata. Unknown source
// fields fail closed: this candidate deliberately supports only a narrow subset.
const sourceFields = new Set([...changeFields, 'id', 'ownerId', 'schemaVersion', 'revision', 'views', 'isPinned',
    'logo', 'referenteNome', 'referenteTelefono', 'referenteCellulare', 'type', 'visibility',
    'isBanking', 'banking', 'isExplicitMemo', 'updatedAt', 'createdAt', '_encrypted',
    'sharedWith', 'sharedWithUids', 'acceptedCount']);
const plainObject = value => Boolean(value) && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const allowedKeys = (value, fields) => Reflect.ownKeys(value).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && fields.has(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
});

// Preparation only: no SDK, persistence, operation envelope, or submission.
// hasProfileLink:false is required evidence supplied by the caller; this helper
// cannot establish reverse profile links or a private Firestore path from a record.
// A six-field encrypted patch is not automatically an M6-compatible payload:
// title length and URL schema need a separate write-path compatibility gate.
// Empty strings/deletion and memorandum are deliberately outside this increment.
export async function preparePrivateAccountPatch({context, source, changes, hasProfileLink} = {}) {
    const uid = context?.user?.uid;
    const assertActive = () => {
        if (context?.signal?.aborted) throw new Error('VIEW_DISPOSED');
        if (typeof uid !== 'string' || !uid || context?.user?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (!context?.signal || !context.unlocked || typeof context.encrypt !== 'function') throw new Error('VAULT_LOCKED');
    };
    assertActive();
    if (!plainObject(source) || !allowedKeys(source, sourceFields) || hasProfileLink !== false ||
        source.type !== 'account' || source.visibility !== 'private' || source._encrypted !== true ||
        (Object.hasOwn(source, 'ownerId') && source.ownerId !== uid) ||
        (Object.hasOwn(source, 'revision') && (!Number.isSafeInteger(source.revision) || source.revision < 0)) ||
        (source.isBanking !== undefined && source.isBanking !== false) ||
        (source.banking !== undefined && (!Array.isArray(source.banking) || source.banking.length !== 0)) ||
        (source.sharedWith !== undefined && (!plainObject(source.sharedWith) || Reflect.ownKeys(source.sharedWith).length !== 0)) ||
        (source.sharedWithUids !== undefined && (!Array.isArray(source.sharedWithUids) || source.sharedWithUids.length !== 0)) ||
        (source.acceptedCount !== undefined && source.acceptedCount !== 0) ||
        (source.isExplicitMemo !== undefined && source.isExplicitMemo !== false)) {
        throw new Error('PRIVATE_ACCOUNT_NOT_ISOLATED');
    }
    if (!plainObject(changes) || !allowedKeys(changes, changeFields) || Object.keys(changes).length === 0 ||
        Object.values(changes).some(value => typeof value !== 'string' || value.length === 0)) {
        throw new Error('PRIVATE_ACCOUNT_PATCH_INVALID');
    }
    // Snapshot caller input before awaiting; later edits cannot change this patch.
    const entries = Object.entries(changes);
    const patch = {};
    for (const [field, value] of entries) {
        assertActive();
        let ciphertext;
        try { ciphertext = await context.encrypt(value); }
        catch {
            assertActive();
            throw new Error('PRIVATE_ACCOUNT_ENCRYPT_FAILED');
        }
        assertActive();
        if (typeof ciphertext !== 'string' || ciphertext.length < 30 || ciphertext === value ||
            !/^[A-Za-z0-9+/]+={0,2}$/u.test(ciphertext)) throw new Error('PRIVATE_ACCOUNT_ENCRYPT_FAILED');
        patch[field] = ciphertext;
    }
    return Object.freeze(patch);
}
