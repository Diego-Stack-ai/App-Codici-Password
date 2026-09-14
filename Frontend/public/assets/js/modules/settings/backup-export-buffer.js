// Admission limit for retained encrypted JSON lines, not a total heap estimate.
const MAX_CHARACTERS = 64 * 1024 * 1024;

// Match the restore preview's record admission limits. Repository snapshots and
// JSON serialization temporaries are not included in this retained-data budget.
export function createBackupRecordBuffer({maxRecords = 10000, maxCharacters = 16 * 1024 * 1024} = {}) {
    if (!Number.isSafeInteger(maxRecords) || maxRecords <= 0 || maxRecords > 10000 ||
        !Number.isSafeInteger(maxCharacters) || maxCharacters <= 0 || maxCharacters > 16 * 1024 * 1024) throw new Error('BACKUP_BUFFER_LIMIT_INVALID');
    let records = [], characters = 0, closed = false;
    const clear = () => { records.length = 0; characters = 0; closed = true; };
    return Object.freeze({
        append(record) {
            if (closed) throw new Error('BACKUP_BUFFER_CLOSED');
            const length = JSON.stringify(record).length;
            if (records.length >= maxRecords || length > maxCharacters - characters) {
                clear(); throw Object.assign(new Error('BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'), {code: 'BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'});
            }
            records.push(record); characters += length;
        },
        takeRecords() {
            if (closed) throw new Error('BACKUP_BUFFER_CLOSED');
            const result = records; records = []; clear(); return result;
        },
        clear
    });
}

export function createBackupExportBuffer(limit = MAX_CHARACTERS) {
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_CHARACTERS) throw new Error('BACKUP_BUFFER_LIMIT_INVALID');
    const chunks = [];
    let characters = 0, failed = false;
    const clear = () => { chunks.length = 0; characters = 0; failed = true; };
    return Object.freeze({
        append(line) {
            if (failed) throw new Error('BACKUP_BUFFER_CLOSED');
            if (typeof line !== 'string') { clear(); throw new Error('BACKUP_BUFFER_LINE_INVALID'); }
            if (line.length > limit - characters) {
                clear(); throw Object.assign(new Error('BACKUP_EXPORT_CAPACITY_EXCEEDED'), {code: 'BACKUP_EXPORT_CAPACITY_EXCEEDED'});
            }
            chunks.push(line); characters += line.length;
        },
        takeBlob() {
            if (failed) throw new Error('BACKUP_BUFFER_CLOSED');
            try { return new Blob(chunks, {type: 'application/x-codici-password-backup'}); }
            finally { clear(); }
        },
        clear
    });
}
