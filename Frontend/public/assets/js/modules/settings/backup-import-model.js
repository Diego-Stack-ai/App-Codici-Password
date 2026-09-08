const MAX_RECORDS = 400;
const MAX_CHUNK_BYTES = 7 * 1024 * 1024;

export function validateRestoreStoragePath(storagePath, uid) {
    const prefix = `users/${String(uid || '').trim()}/`;
    if (!uid || typeof storagePath !== 'string' || !storagePath.startsWith(prefix) ||
        storagePath.includes('..') || storagePath.length > 1024) {
        throw new Error('BACKUP_STORAGE_PATH_INVALID');
    }
    return storagePath;
}

export function chunkRestoreRecords(records) {
    if (!Array.isArray(records)) throw new Error('BACKUP_RECORDS_INVALID');
    const chunks = [];
    let current = [];
    let currentBytes = 0;
    for (const record of records) {
        const bytes = new TextEncoder().encode(JSON.stringify(record.data)).byteLength;
        if (bytes > 800 * 1024) throw new Error('BACKUP_RECORD_TOO_LARGE');
        if (current.length && (current.length >= MAX_RECORDS || currentBytes + bytes > MAX_CHUNK_BYTES)) {
            chunks.push(current); current = []; currentBytes = 0;
        }
        current.push(record); currentBytes += bytes;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

export function validateBackupFooter(footer, counts) {
    if (footer?.kind !== 'footer' || footer.entryCount !== counts.entries ||
        footer.recordCount !== counts.records || footer.attachmentCount !== counts.attachments) {
        throw new Error('BACKUP_FOOTER_INVALID');
    }
    return true;
}
