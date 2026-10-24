export const PORTABLE_ATTACHMENT_LIMITS = Object.freeze({
    perFileBytes: 512 * 1024 * 1024,
    totalBytes: 1024 * 1024 * 1024
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
        callback(value);
        return;
    }
    if (typeof value.storagePath === 'string') callback(value);
    for (const child of Object.values(value)) visitAttachments(child, callback);
}

function attachmentContract(attachment) {
    return JSON.stringify({
        encryption: attachment.encryption || null,
        chunks: attachment.encryption?.chunked === true ? attachment.chunks || null : null,
        originalName: attachment.originalName || attachment.fileName || attachment.nomeFile || attachment.name || '',
        mimeType: attachment.encryption?.originalType || attachment.mimeType || attachment.type || ''
    });
}

function validatePortableChunkedAttachmentManifest(attachment) {
    const encryption = attachment?.encryption, chunks = attachment?.chunks;
    if (encryption?.version !== 1 || encryption?.cipher !== 'AES-GCM-256' ||
        encryption?.keyWrap !== 'HKDF-SHA256+A256GCM' || encryption?.chunked !== true ||
        encryption?.chunkVersion !== 1 || !Array.isArray(chunks) || chunks.length === 0 ||
        !Number.isSafeInteger(encryption.originalSize) || encryption.originalSize <= 0 ||
        encryption.originalSize > PORTABLE_ATTACHMENT_LIMITS.perFileBytes ||
        !Number.isSafeInteger(encryption.chunkSize) || encryption.chunkSize <= 0 ||
        encryption.chunkSize > 32 * 1024 * 1024 ||
        !Number.isSafeInteger(encryption.chunkCount) || encryption.chunkCount !== chunks.length ||
        !/^[A-Za-z0-9._:-]{1,180}$/.test(String(encryption.chunkBinding || '')) ||
        !String(encryption.originalType || '').startsWith('video/') ||
        typeof encryption.wrapSalt !== 'string' || encryption.wrapSalt.length !== 44 ||
        typeof encryption.wrapIv !== 'string' || encryption.wrapIv.length !== 16 ||
        typeof encryption.wrappedFileKey !== 'string' || encryption.wrappedFileKey.length !== 64) {
        throw portableError('PORTABLE_CHUNK_MANIFEST_INVALID');
    }
    const paths = new Set();
    let clearTotal = 0;
    for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index], clearSize = Number(chunk?.clearSize), encryptedSize = Number(chunk?.encryptedSize);
        const storagePath = String(chunk?.storagePath || '');
        if (Number(chunk?.index) !== index || !Number.isSafeInteger(clearSize) || clearSize <= 0 ||
            clearSize > encryption.chunkSize || (index < chunks.length - 1 && clearSize !== encryption.chunkSize) ||
            !Number.isSafeInteger(encryptedSize) || encryptedSize !== clearSize + 16 ||
            typeof chunk?.contentIv !== 'string' || chunk.contentIv.length !== 16 ||
            !storagePath || storagePath.length > 1024 || storagePath.includes('..') || paths.has(storagePath) ||
            clearSize > Number.MAX_SAFE_INTEGER - clearTotal) {
            throw portableError('PORTABLE_CHUNK_MANIFEST_INVALID');
        }
        paths.add(storagePath);
        clearTotal += clearSize;
    }
    if (clearTotal !== encryption.originalSize) throw portableError('PORTABLE_CHUNK_MANIFEST_INVALID');
    return chunks;
}

function attachmentStorage(attachment) {
    if (attachment.encryption?.chunked === true) {
        const chunks = validatePortableChunkedAttachmentManifest(attachment);
        return {
            layout: 'chunked-v1',
            storagePaths: chunks.map(chunk => chunk.storagePath),
            chunks
        };
    }
    if (typeof attachment.storagePath !== 'string' || !attachment.storagePath) {
        throw portableError('PORTABLE_ATTACHMENT_INVENTORY_MISMATCH');
    }
    return {layout: 'single', storagePaths: [attachment.storagePath], chunks: null};
}

export function reconcilePortableAttachmentInventory(records, storagePaths, projectedKeys) {
    const allowedKeys = projectedKeys instanceof Set ? projectedKeys : new Set(projectedKeys || []);
    const expectedPaths = new Set(storagePaths);
    if (expectedPaths.size !== storagePaths.length) throw portableError('PORTABLE_ATTACHMENT_INVENTORY_DUPLICATE');
    const inventory = new Map(), consumedPaths = new Set(), pathContracts = new Map();
    for (const record of records) {
        const owner = findParentRecord(records, record);
        visitAttachments(record.data, attachment => {
            if (!owner) throw portableError('PORTABLE_ATTACHMENT_OWNER_MISSING');
            const ownerKey = portableRecordKey(owner);
            if (!allowedKeys.has(ownerKey)) throw portableError('PORTABLE_ATTACHMENT_OWNER_MISSING');
            const storage = attachmentStorage(attachment);
            const contract = attachmentContract(attachment);
            for (const storagePath of storage.storagePaths) {
                if (!expectedPaths.has(storagePath)) throw portableError('PORTABLE_ATTACHMENT_INVENTORY_MISMATCH');
                const existingContract = pathContracts.get(storagePath);
                if (existingContract && existingContract !== contract) {
                    throw portableError('PORTABLE_ATTACHMENT_METADATA_CONFLICT');
                }
                pathContracts.set(storagePath, contract);
                consumedPaths.add(storagePath);
            }
            const inventoryKey = storage.storagePaths.join('\n');
            const current = inventory.get(inventoryKey);
            if (current && current.contract !== contract) throw portableError('PORTABLE_ATTACHMENT_METADATA_CONFLICT');
            if (current) {
                current.recordKeys.add(ownerKey);
            } else {
                inventory.set(inventoryKey, {
                    ...storage,
                    storagePath: storage.layout === 'single' ? storage.storagePaths[0] : null,
                    attachment, contract, recordKeys: new Set([ownerKey])
                });
            }
        });
    }
    if (consumedPaths.size !== expectedPaths.size || [...expectedPaths].some(path => !consumedPaths.has(path))) {
        throw portableError('PORTABLE_ATTACHMENT_INVENTORY_MISMATCH');
    }
    return [...inventory.values()]
        .sort((left, right) => left.storagePaths[0].localeCompare(right.storagePaths[0]))
        .map(({layout, storagePath, storagePaths: paths, chunks, attachment, recordKeys}) => ({
            layout, storagePath, storagePaths: paths, chunks, attachment, recordKeys: [...recordKeys].sort()
        }));
}
