const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function assertIdentifier(value) {
    const normalized = String(value || '').trim();
    if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error('BACKUP_IDENTIFIER_INVALID');
    return normalized;
}

export function encodeFirestoreValue(value) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (value instanceof Date) return {$type: 'date', value: value.toISOString()};
    if (value instanceof Uint8Array) return {$type: 'bytes', value: Array.from(value)};
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : encodeFirestoreValue(item));
    if (value && typeof value.toMillis === 'function' &&
        Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
        return {$type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds};
    }
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, encodeFirestoreValue(item)]));
    }
    throw new Error('BACKUP_VALUE_UNSUPPORTED');
}

export function createRecordDescriptor(scope, snapshot, options = {}) {
    if (!snapshot?.id || typeof snapshot.data !== 'function') throw new Error('BACKUP_SNAPSHOT_INVALID');
    const descriptor = {
        kind: 'record',
        scope,
        id: assertIdentifier(snapshot.id),
        data: encodeFirestoreValue(snapshot.data())
    };
    if (options.companyId) descriptor.companyId = assertIdentifier(options.companyId);
    if (options.accountId) descriptor.accountId = assertIdentifier(options.accountId);
    if (options.sharedDataId) descriptor.sharedDataId = assertIdentifier(options.sharedDataId);
    return descriptor;
}

export function createRecordDescriptorFromData(scope, record, options = {}) {
    if (!record?.id) throw new Error('BACKUP_RECORD_INVALID');
    const {id, ...data} = record;
    const descriptor = {kind: 'record', scope, id: assertIdentifier(id), data: encodeFirestoreValue(data)};
    if (options.companyId) descriptor.companyId = assertIdentifier(options.companyId);
    if (options.accountId) descriptor.accountId = assertIdentifier(options.accountId);
    if (options.sharedDataId) descriptor.sharedDataId = assertIdentifier(options.sharedDataId);
    return descriptor;
}

export function createProfileDescriptor(uid, snapshot) {
    if (!snapshot?.exists?.()) throw new Error('BACKUP_PROFILE_MISSING');
    return {kind: 'record', scope: 'profile', id: assertIdentifier(uid), data: encodeFirestoreValue(snapshot.data())};
}

export function createProfileDescriptorFromData(uid, profile) {
    if (!profile) throw new Error('BACKUP_PROFILE_MISSING');
    const {id: _id, ...data} = profile;
    return {kind: 'record', scope: 'profile', id: assertIdentifier(uid), data: encodeFirestoreValue(data)};
}

export function collectStoragePaths(records, uid) {
    const prefix = `users/${assertIdentifier(uid)}/`;
    const paths = new Set();
    const visit = value => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
            if (key === 'storagePath' && typeof child === 'string') {
                if (!child.startsWith(prefix) || child.includes('..') || child.length > 1024) {
                    throw new Error('BACKUP_STORAGE_PATH_INVALID');
                }
                paths.add(child);
            } else {
                visit(child);
            }
        }
    };
    records.forEach(record => visit(record.data));
    return [...paths].sort();
}

export function attachmentRecordScope(context) {
    if (context === 'private') return 'private-account-attachment';
    if (context === 'company') return 'company-account-attachment';
    throw new Error('BACKUP_ATTACHMENT_CONTEXT_INVALID');
}
