const fail = () => {throw Error('PROFILE_LINK_INVALID');};
const object = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
export function profileLinkAccount(value) {
    if (value === null) return null;
    if (!object(value) || !['private', 'company'].includes(value.domain) || !id(value.id) ||
        !exact(value, value.domain === 'private' ? ['domain', 'id'] : ['domain', 'id', 'companyId']) ||
        (value.domain === 'company' && !id(value.companyId))) fail();
    return Object.freeze(value.domain === 'private' ? {domain: 'private', id: value.id} : {domain: 'company', id: value.id, companyId: value.companyId});
}
export function profileLinkSource(value) {
    if (!object(value) || !['private', 'company'].includes(value.domain) || !id(value.id)) fail();
    const keys = ['domain', 'type', 'id'];
    if (value.domain === 'company') {
        keys.push('companyId');
        if (!id(value.companyId) || !['email', 'phone'].includes(value.type) ||
            !(value.type === 'email' ? ['pec', 'amministrazione', 'personale'] : ['telefonoAzienda', 'faxAzienda', 'referenteCellulare']).includes(value.id)) fail();
    } else {
        if (!['email', 'phone', 'document', 'utility'].includes(value.type)) fail();
        if (value.type === 'utility') {keys.push('parentAddressId'); if (!id(value.parentAddressId)) fail();}
    }
    if (!exact(value, keys)) fail();
    return Object.freeze(Object.fromEntries(keys.map(key => [key, value[key]])));
}
export function currentProfileLink(item) {
    if (!object(item)) fail();
    const accountId = item.linkedAccountId ?? '', companyId = item.linkedAccountCompanyId ?? '';
    if (typeof accountId !== 'string' || typeof companyId !== 'string' || (!accountId && companyId)) fail();
    return accountId ? profileLinkAccount(companyId ? {domain: 'company', id: accountId, companyId} : {domain: 'private', id: accountId}) : null;
}
export function profileLinkRevision(record) {
    if (!object(record) || record.isArchived) fail();
    const revision = Object.hasOwn(record, '_profileLinkRevision') ? record._profileLinkRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_profileLinkSchemaVersion') && record._profileLinkSchemaVersion !== 1)) fail();
    return revision;
}
export function validateProfileLinkRequest(value) {
    if (!exact(value, ['source', 'expectedAccount', 'account', 'expectedFingerprint', 'expectedRevision', 'operationId', 'expectedOwnerUid']) ||
        !id(value.operationId) || !id(value.expectedOwnerUid) || typeof value.expectedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.expectedFingerprint) ||
        !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || value.expectedRevision >= Number.MAX_SAFE_INTEGER) fail();
    const source = profileLinkSource(value.source), expectedAccount = profileLinkAccount(value.expectedAccount), account = profileLinkAccount(value.account);
    if (JSON.stringify(expectedAccount) === JSON.stringify(account)) throw Error('PROFILE_LINK_UNCHANGED');
    return Object.freeze({source, expectedAccount, account, expectedFingerprint: value.expectedFingerprint,
        expectedRevision: value.expectedRevision, operationId: value.operationId, expectedOwnerUid: value.expectedOwnerUid});
}

// Stable hashing of supported stored JSON contact data. No legacy ID is created.
// Typed timestamps/references need a dedicated adapter and are rejected here.
export function profileLinkFingerprintInput(value) {
    let count = 0;
    const copy = (item, depth = 0) => {
        if (++count > 20000 || depth > 12) fail();
        if (item === null || typeof item === 'boolean') return item;
        if (typeof item === 'string') {if (item.length > 100000) fail(); return item;}
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (Array.isArray(item)) {if (item.length > 10000) fail(); return item.map(child => copy(child, depth + 1));}
        if (!object(item)) fail();
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(item).sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
            result[key] = copy(descriptor.value, depth + 1);
        }
        return result;
    };
    const serialized = JSON.stringify(copy(value)); if (serialized.length > 200000) fail(); return serialized;
}
export function assertProfileLinkAccount(record, uid, selection, {destination = false} = {}) {
    if (!object(record) || (record.ownerId !== undefined && record.ownerId !== uid) || (record.id !== undefined && record.id !== selection.id)) fail();
    if (!destination) return;
    for (const field of ['isArchived', '_isGuest', 'shared', 'isMemo', 'isExplicitMemo', 'hasMemo', 'isMemoShared']) if (record[field] !== undefined && record[field] !== false) fail();
    if ((record.visibility !== undefined && record.visibility !== 'private') || (record.type !== undefined && record.type !== 'account') ||
        (record.acceptedCount != null && record.acceptedCount !== 0) || (record.recipientEmail != null && record.recipientEmail !== '')) fail();
    for (const key of ['sharedWithUids', 'sharedWithEmails']) if (record[key] != null && (!Array.isArray(record[key]) || record[key].length)) fail();
    if (record.sharedWith != null && (!object(record.sharedWith) || Object.keys(record.sharedWith).length)) fail();
}
