import {functions, storage} from '../../firebase-config.js?v=1.2.67';
import {httpsCallable, ref, uploadBytes} from '/assets/js/vendor/firebase-runtime.js';
import {decryptBackupEntry, deriveBackupKey, parseBackupLine} from './backup-crypto.js';
import {chunkRestoreRecords, compareRestoreRecords, validateBackupFooter, validateRestoreStoragePath} from './backup-import-model.js';
import {collectOwnerBackup} from './backup-export-service.js';

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 + 1024;

async function* lines(file) {
    if (file.size <= 0 || file.size > MAX_BACKUP_BYTES) throw new Error('BACKUP_FILE_SIZE_INVALID');
    if (typeof TextDecoderStream === 'function' && file.stream) {
        const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
        let pending = '';
        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                pending += value;
                let newline;
                while ((newline = pending.indexOf('\n')) >= 0) {
                    const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
                    if (line.trim()) yield line;
                }
            }
            if (pending.trim()) yield pending;
        } finally {
            reader.releaseLock();
        }
        return;
    }
    for (const line of (await file.text()).split(/\r?\n/)) if (line.trim()) yield line;
}

function base64ToBytes(value) {
    const binary = atob(String(value));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function scanBackup(file, uid, recoveryKey, visit = null) {
    let header = null;
    let key = null;
    let sequence = 0;
    let previousDigest = '';
    let footer = null;
    const counts = {entries: 0, records: 0, attachments: 0};
    for await (const line of lines(file)) {
        if (!header) {
            header = parseBackupLine(line);
            key = await deriveBackupKey(header, recoveryKey, uid);
            continue;
        }
        if (footer) throw new Error('BACKUP_TRAILING_DATA');
        const opened = await decryptBackupEntry({
            header, key, expectedSequence: sequence, previousDigest, envelope: parseBackupLine(line)
        });
        previousDigest = opened.digest;
        sequence += 1;
        if (opened.entry.kind === 'footer') {
            footer = opened.entry;
            continue;
        }
        counts.entries += 1;
        if (opened.entry.kind === 'record') counts.records += 1;
        else if (opened.entry.kind === 'attachment') counts.attachments += 1;
        else throw new Error('BACKUP_ENTRY_KIND_INVALID');
        if (visit) await visit(opened.entry);
    }
    if (!header || !footer) throw new Error('BACKUP_FOOTER_MISSING');
    validateBackupFooter(footer, counts);
    return {header, key, counts};
}

function operationId(backupId, chunkIndex) {
    return `restore:${backupId}:${chunkIndex}`;
}

export async function prepareBackupRestore(file, uid, recoveryKey) {
    const records = [];
    const storagePaths = new Set();
    const scan = await scanBackup(file, uid, recoveryKey, entry => {
        if (entry.kind === 'record') records.push(entry);
        else storagePaths.add(validateRestoreStoragePath(entry.storagePath, uid));
    });
    const chunks = chunkRestoreRecords(records);
    if (!chunks.length) throw new Error('BACKUP_EMPTY');
    const current = await collectOwnerBackup(uid);
    const comparison = compareRestoreRecords(records, current.records);
    const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
    const previews = [];
    for (let index = 0; index < chunks.length; index += 1) {
        const response = await restoreChunk({
            operationId: operationId(scan.header.backupId, index), backupId: scan.header.backupId,
            chunkIndex: index, chunkCount: chunks.length, mode: 'preview', records: chunks[index]
        });
        previews.push(response.data);
    }
    const collisions = previews.reduce((total, item) => total + Number(item?.collisionCount || 0), 0);
    return {
        file, uid, recoveryKey, header: scan.header, chunks, counts: scan.counts,
        storagePaths: [...storagePaths], comparison, collisionCount: collisions
    };
}

export async function executeBackupRestore(plan) {
    if (plan.collisionCount) throw new Error(`BACKUP_COLLISIONS:${plan.collisionCount}`);
    const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
    for (let index = 0; index < plan.chunks.length; index += 1) {
        const response = await restoreChunk({
            operationId: operationId(plan.header.backupId, index), backupId: plan.header.backupId,
            chunkIndex: index, chunkCount: plan.chunks.length, mode: 'apply',
            confirmation: 'RESTORE_VALIDATED', records: plan.chunks[index]
        });
        if (!['applied'].includes(response.data?.status)) throw new Error('BACKUP_RESTORE_CHUNK_FAILED');
    }
    let uploaded = 0;
    await scanBackup(plan.file, plan.uid, plan.recoveryKey, async entry => {
        if (entry.kind !== 'attachment') return;
        const storagePath = validateRestoreStoragePath(entry.storagePath, plan.uid);
        const bytes = base64ToBytes(entry.content);
        if (!bytes.length || bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('BACKUP_ATTACHMENT_SIZE_INVALID');
        await uploadBytes(ref(storage, storagePath), bytes, {
            contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}
        });
        uploaded += 1;
    });
    if (uploaded !== plan.counts.attachments) throw new Error('BACKUP_ATTACHMENT_COUNT_INVALID');
    return {recordCount: plan.counts.records, attachmentCount: uploaded};
}
