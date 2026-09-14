// Admission limit for retained encrypted JSON lines, not a total heap estimate.
const MAX_CHARACTERS = 64 * 1024 * 1024;

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
