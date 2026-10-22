export const PORTABLE_ATTACHMENT_LIMITS = Object.freeze({
    perFileBytes: 32 * 1024 * 1024,
    totalBytes: 256 * 1024 * 1024
});

export function portableRecordKey(record) {
    return [record.scope, record.companyId || '', record.accountId || '', record.id].join(':');
}

function portableError(code) {
    return Object.assign(new Error(code), {code});
}

export function createPortableCapacityGuard(limits = PORTABLE_ATTACHMENT_LIMITS) {
    const perFileBytes = limits.perFileBytes;
    const totalBytes = limits.totalBytes;
    if (!Number.isSafeInteger(perFileBytes) || perFileBytes <= 0 ||
        !Number.isSafeInteger(totalBytes) || totalBytes < perFileBytes) {
        throw portableError('PORTABLE_CAPACITY_LIMIT_INVALID');
    }
    let total = 0;
    return Object.freeze({
        accept(size) {
            if (!Number.isSafeInteger(size) || size < 0) throw portableError('PORTABLE_ATTACHMENT_SIZE_INVALID');
            if (size > perFileBytes) throw portableError('PORTABLE_ATTACHMENT_CAPACITY_EXCEEDED');
            if (size > totalBytes - total) throw portableError('PORTABLE_CAPACITY_EXCEEDED');
            total += size;
            return total;
        },
        get totalBytes() { return total; }
    });
}

function findParentRecord(records, record) {
    if (record.scope === 'private-account-attachment') {
        return records.find(item => item.scope === 'private-account' && item.id === record.accountId) || null;
    }
    if (record.scope === 'company-account-attachment') {
        return records.find(item => item.scope === 'company-account' && item.id === record.accountId && item.companyId === record.companyId) || null;
    }
    return record;
}

function visitAttachments(value, callback) {
    if (Array.isArray(value)) {
        for (const child of value) visitAttachments(child, callback);
        return;
    }
    if (!value || typeof value !== 'object') return;
    if (value.encryption?.chunked === true && Array.isArray(value.chunks)) {
        throw portableError('PORTABLE_CHUNKED_ATTACHMENT_UNSUPPORTED');
    }
    if (typeof value.storagePath === 'string') callback(value);
    for (const child of Object.values(value)) visitAttachments(child, callback);
}

function attachmentContract(attachment) {
    return JSON.stringify({
        encryption: attachment.encryption || null,
        originalName: attachment.originalName || attachment.fileName || attachment.nomeFile || attachment.name || '',
        mimeType: attachment.encryption?.originalType || attachment.mimeType || attachment.type || ''
    });
}

export function reconcilePortableAttachmentInventory(records, storagePaths, projectedKeys) {
    const allowedKeys = projectedKeys instanceof Set ? projectedKeys : new Set(projectedKeys || []);
    const expectedPaths = new Set(storagePaths);
    if (expectedPaths.size !== storagePaths.length) throw portableError('PORTABLE_ATTACHMENT_INVENTORY_DUPLICATE');
    const inventory = new Map();
    for (const record of records) {
        const owner = findParentRecord(records, record);
        visitAttachments(record.data, attachment => {
            const storagePath = attachment.storagePath;
            if (!expectedPaths.has(storagePath)) throw portableError('PORTABLE_ATTACHMENT_INVENTORY_MISMATCH');
            if (!owner) throw portableError('PORTABLE_ATTACHMENT_OWNER_MISSING');
            const ownerKey = portableRecordKey(owner);
            if (!allowedKeys.has(ownerKey)) throw portableError('PORTABLE_ATTACHMENT_OWNER_MISSING');
            const contract = attachmentContract(attachment);
            const current = inventory.get(storagePath);
            if (current && current.contract !== contract) throw portableError('PORTABLE_ATTACHMENT_METADATA_CONFLICT');
            if (current) {
                current.recordKeys.add(ownerKey);
            } else {
                inventory.set(storagePath, {storagePath, attachment, contract, recordKeys: new Set([ownerKey])});
            }
        });
    }
    if (inventory.size !== expectedPaths.size) throw portableError('PORTABLE_ATTACHMENT_INVENTORY_MISMATCH');
    return [...inventory.values()]
        .sort((left, right) => left.storagePath.localeCompare(right.storagePath))
        .map(({storagePath, attachment, recordKeys}) => ({
            storagePath, attachment, recordKeys: [...recordKeys].sort()
        }));
}
