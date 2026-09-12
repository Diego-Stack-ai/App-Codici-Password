import {preparePrivateAccountPatch} from './prepare-private-account-patch.mjs';

const fields = new Set(['nomeAccount', 'username', 'account', 'password', 'url', 'note', 'logo',
    'referenteNome', 'referenteTelefono', 'referenteCellulare', 'type', 'visibility', 'isBanking',
    'banking', 'isExplicitMemo', 'createdAt', '_encrypted', 'sharedWith', 'sharedWithUids', 'acceptedCount']);
// updatedAt is always assigned by the backend. Its existing SDK Timestamp is
// deliberately omitted, never serialized or converted to a map in the payload.
const metadata = new Set(['id', 'ownerId', 'schemaVersion', 'revision', 'updatedAt']);
const changesAllowed = new Set(['username', 'account', 'password', 'note']);
const plain = value => value && typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const cipherOrEmpty = value => typeof value === 'string' && (value === '' ||
    (value.length >= 30 && /^[A-Za-z0-9+/]+={0,2}$/u.test(value)));
const operationIdPattern = /^[A-Za-z0-9:_-]{1,180}$/u;
const recordIdPattern = /^[A-Za-z0-9_-]{1,180}$/u;
const fail = () => { throw new Error('PRIVATE_ACCOUNT_MUTATION_PREPARATION_INVALID'); };
function dataKeys(value, permitted) {
    if (!plain(value)) return false;
    return Reflect.ownKeys(value).every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return typeof key === 'string' && permitted.has(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
    });
}
function freezeDeep(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value)) freezeDeep(child);
        Object.freeze(value);
    }
    return value;
}
function snapshot(value, seen = new WeakSet()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || (!Array.isArray(value) && !plain(value)) || seen.has(value)) fail();
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value) && (keys.length !== value.length + 1 ||
        !keys.every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9]\d*)$/u.test(key) && Number(key) < value.length)))) fail();
    const copied = Array.isArray(value) ? [] : {};
    for (const key of keys) {
        if (Array.isArray(value) && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || key === 'toJSON' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
        Object.defineProperty(copied, key, {value: snapshot(descriptor.value, seen), enumerable: true});
    }
    seen.delete(value);
    return Object.freeze(copied);
}
function validateRecord(record) {
    if (!dataKeys(record, fields) || record.type !== 'account' || record.visibility !== 'private' || record._encrypted !== true ||
        typeof record.nomeAccount !== 'string' || !record.nomeAccount.trim() || record.nomeAccount.length > 240 ||
        typeof record.url !== 'string' || !['username', 'account', 'password', 'note'].every(field => cipherOrEmpty(record[field])) ||
        record.isBanking === true || (Array.isArray(record.banking) && record.banking.length > 0) ||
        Object.keys(record.sharedWith || {}).length !== 0 || (record.sharedWithUids || []).length !== 0 ||
        Number(record.acceptedCount || 0) !== 0 || new TextEncoder().encode(JSON.stringify(record)).length > 300000) fail();
}

// Candidate M6 envelope only; no network or storage. Source must be the complete
// private document read under the caller's UID. Reverse profile-link evidence is
// supplied by the caller, never established by this helper. Existing title/URL
// semantics are preserved; only the four already-ciphered M6 fields can change.
export async function preparePrivateAccountMutation({context, source, changes, domain, uid,
    recordId, expectedRevision, operationId, deviceId, hasProfileLink} = {}) {
    const assertActive = () => {
        if (context?.signal?.aborted) throw new Error('VIEW_DISPOSED');
        if (typeof uid !== 'string' || !uid || context?.user?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (!context?.signal || !context.unlocked || typeof context.encrypt !== 'function') throw new Error('VAULT_LOCKED');
    };
    assertActive();
    if (domain !== 'private' || typeof recordId !== 'string' || !recordIdPattern.test(recordId) ||
        !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER ||
        typeof operationId !== 'string' || !operationIdPattern.test(operationId) ||
        typeof deviceId !== 'string' || !operationIdPattern.test(deviceId) || hasProfileLink !== false ||
        !dataKeys(source, new Set([...fields, ...metadata])) ||
        source.id !== recordId || source.revision !== expectedRevision || source.schemaVersion !== 1 ||
        (Object.hasOwn(source, 'ownerId') && source.ownerId !== uid) ||
        !dataKeys(changes, changesAllowed)) fail();

    // Snapshot ordinary JSON data before encryption yields. Typed createdAt
    // timestamps, Dates, accessors and custom serializers are rejected, not
    // transformed. Backend-controlled updatedAt is excluded before traversal.
    const capturedSource = snapshot(Object.fromEntries(Object.entries(source).filter(([field]) => field !== 'updatedAt')));
    const capturedChanges = snapshot(changes);
    const record = Object.fromEntries(Object.entries(capturedSource).filter(([field]) => fields.has(field)));
    validateRecord(record);
    const patch = await preparePrivateAccountPatch({context, source: capturedSource,
        changes: capturedChanges, hasProfileLink});
    assertActive();
    const updatedRecord = {...record, ...patch};
    validateRecord(updatedRecord);
    return freezeDeep({schemaVersion: 1, operationId, deviceId, recordId, expectedRevision, record: updatedRecord});
}
