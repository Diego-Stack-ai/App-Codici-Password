// Anagraphic text only. Contacts, links, documents, permissions and banking
// records are deliberately excluded from this narrow patch boundary.
export const PROFILE_TEXT_FIELDS = Object.freeze({
    private: Object.freeze(['nome', 'cognome', 'birth_place', 'birth_date', 'note']),
    company: Object.freeze(['ragioneSociale', 'formaGiuridica', 'partitaIva', 'codiceSDI', 'numeroCCIAA',
        'dataIscrizione', 'referenteNome', 'referenteCognome', 'referenteTitolo', 'note'])
});
export const PROFILE_TEXT_METADATA = Object.freeze(['_profileTextRevision', '_profileTextSchemaVersion', '_profileTextUpdatedAt']);
export const profileTextInvalid = () => {throw Error('PROFILE_TEXT_INVALID');};
export const profileTextObject = value => value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const profileTextId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const profileTextHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function profileTextTarget(value) {
    if (!profileTextObject(value) || !Object.hasOwn(PROFILE_TEXT_FIELDS, value.domain) ||
        Object.keys(value).some(key => !['domain', 'companyId'].includes(key))) profileTextInvalid();
    if (value.domain === 'private') {
        if (Object.hasOwn(value, 'companyId')) profileTextInvalid();
        return Object.freeze({domain: 'private'});
    }
    if (!profileTextId(value.companyId)) profileTextInvalid();
    return Object.freeze({domain: 'company', companyId: value.companyId});
}
export function profileTextRevision(record) {
    if (!profileTextObject(record) || record.isArchived) profileTextInvalid();
    const revision = Object.hasOwn(record, '_profileTextRevision') ? record._profileTextRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_profileTextSchemaVersion') && record._profileTextSchemaVersion !== 1)) profileTextInvalid();
    return revision;
}
export function profileTextBasis(record, field) {
    const exists = Object.hasOwn(record, field), value = exists ? record[field] : null;
    if (exists && value !== null && (typeof value !== 'string' || value.length > 100000)) profileTextInvalid();
    return JSON.stringify([exists, value]);
}
export function profileTextCipher(value) {
    return typeof value === 'string' && (value === '' || (value.length >= 60 && value.length <= 100000 &&
        value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)));
}

// Snapshot the entire request before any asynchronous hashing/transaction.
export function validateProfileTextRequest(data) {
    const allowed = ['target', 'changes', 'expected', 'expectedRevision', 'operationId'];
    if (!profileTextObject(data) || Object.keys(data).length !== allowed.length ||
        Object.keys(data).some(key => !allowed.includes(key)) || !profileTextId(data.operationId) ||
        !Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !profileTextObject(data.changes) || !profileTextObject(data.expected)) profileTextInvalid();
    const target = profileTextTarget(data.target), fields = Object.keys(data.changes).sort();
    if (!fields.length || fields.length > PROFILE_TEXT_FIELDS[target.domain].length ||
        Object.keys(data.expected).length !== fields.length) profileTextInvalid();
    const changes = {}, expected = {};
    for (const field of fields) {
        if (!PROFILE_TEXT_FIELDS[target.domain].includes(field) || !profileTextCipher(data.changes[field]) ||
            !Object.hasOwn(data.expected, field) || !profileTextHash(data.expected[field])) profileTextInvalid();
        changes[field] = data.changes[field]; expected[field] = data.expected[field];
    }
    if (Object.values(changes).reduce((sum, value) => sum + value.length, 0) > 200000) profileTextInvalid();
    return Object.freeze({target, changes: Object.freeze(changes), expected: Object.freeze(expected),
        expectedRevision: data.expectedRevision, operationId: data.operationId});
}
