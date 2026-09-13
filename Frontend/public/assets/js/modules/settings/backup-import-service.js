import {auth, functions, storage} from '../../firebase-config.js?v=1.2.110';
import {httpsCallable, onAuthStateChanged, ref, uploadBytes} from '/assets/js/vendor/firebase-runtime.js';
import {decryptBackupEntry, deriveBackupKey, parseBackupLine} from './backup-crypto.js';
import {chunkRestoreRecords, compareRestoreRecords, validateBackupFooter, validateRestoreStoragePath} from './backup-import-model.js';
import {collectOwnerBackup} from './backup-export-service.js';

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 + 1024;
const sessions = new WeakMap();

function restoreSession(uid, {signal, isActive = () => true} = {}) {
    let invalidated = false, unsubscribe = () => {};
    const controller = new AbortController();
    const cleanups = new Set();
    const invalidate = () => {
        if (invalidated) return;
        invalidated = true;
        controller.abort();
        unsubscribe();
        signal?.removeEventListener('abort', invalidate);
        globalThis.removeEventListener?.('vault-session-locked', invalidate);
        globalThis.removeEventListener?.('pagehide', invalidate);
        for (const cleanup of cleanups) cleanup();
        cleanups.clear();
    };
    const check = () => {
        if (invalidated || !uid || auth.currentUser?.uid !== uid || signal?.aborted || !isActive()) {
            invalidate();
            const error = new Error('BACKUP_SESSION_INVALIDATED');
            error.code = 'BACKUP_SESSION_INVALIDATED';
            throw error;
        }
    };
    check();
    signal?.addEventListener('abort', invalidate, {once: true});
    globalThis.addEventListener?.('vault-session-locked', invalidate, {once: true});
    globalThis.addEventListener?.('pagehide', invalidate, {once: true});
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) invalidate(); });
    if (invalidated) unsubscribe();
    return {uid, check, dispose: invalidate, signal: controller.signal,
        own: cleanup => { if (invalidated) cleanup(); else cleanups.add(cleanup); }};
}

export function releaseBackupRestore(plan) {
    sessions.get(plan)?.dispose();
    sessions.delete(plan);
    if (plan) {
        plan.recoveryKey = '';
        plan.file = null;
        plan.records = [];
        plan.chunks = [];
        plan.comparison = null;
    }
}

async function* lines(file, check, signal) {
    check();
    if (file.size <= 0 || file.size > MAX_BACKUP_BYTES) throw new Error('BACKUP_FILE_SIZE_INVALID');
    if (typeof TextDecoderStream === 'function' && file.stream) {
        const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
        const cancel = () => { void reader.cancel().catch(() => {}); };
        signal?.addEventListener('abort', cancel, {once: true});
        let pending = '';
        try {
            while (true) {
                check();
                const {done, value} = await reader.read();
                check();
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
            signal?.removeEventListener('abort', cancel);
            reader.releaseLock();
        }
        return;
    }
    const text = await file.text();
    check();
    for (const line of text.split(/\r?\n/)) if (line.trim()) yield line;
}

function base64ToBytes(value) {
    const binary = atob(String(value));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function scanBackup(file, uid, recoveryKey, visit = null, check = () => {}, signal) {
    let header = null;
    let key = null;
    let sequence = 0;
    let previousDigest = '';
    let footer = null;
    const counts = {entries: 0, records: 0, attachments: 0};
    for await (const line of lines(file, check, signal)) {
        check();
        if (!header) {
            header = parseBackupLine(line);
            key = await deriveBackupKey(header, recoveryKey, uid);
            check();
            continue;
        }
        if (footer) throw new Error('BACKUP_TRAILING_DATA');
        const opened = await decryptBackupEntry({
            header, key, expectedSequence: sequence, previousDigest, envelope: parseBackupLine(line)
        });
        check();
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
        check();
    }
    if (!header || !footer) throw new Error('BACKUP_FOOTER_MISSING');
    validateBackupFooter(footer, counts);
    return {header, key, counts};
}

function operationId(backupId, chunkIndex) {
    return `restore:${backupId}:${chunkIndex}`;
}

export async function prepareBackupRestore(file, uid, recoveryKey, options = {}) {
    const session = restoreSession(uid, options);
    const check = session.check;
    try {
        const records = [];
        const storagePaths = new Set();
        const scan = await scanBackup(file, uid, recoveryKey, entry => {
            if (entry.kind === 'record') records.push(entry);
            else storagePaths.add(validateRestoreStoragePath(entry.storagePath, uid));
        }, check, session.signal);
        check();
        const chunks = chunkRestoreRecords(records);
        if (!chunks.length) throw new Error('BACKUP_EMPTY');
        const current = await collectOwnerBackup(uid);
        check();
        const comparison = compareRestoreRecords(records, current.records);
        const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
        const previews = [];
        for (let index = 0; index < chunks.length; index += 1) {
            check();
            const response = await restoreChunk({
                expectedOwnerUid: uid,
                operationId: operationId(scan.header.backupId, index), backupId: scan.header.backupId,
                chunkIndex: index, chunkCount: chunks.length, mode: 'preview', records: chunks[index]
            });
            check();
            previews.push(response.data);
        }
        const collisions = previews.reduce((total, item) => total + Number(item?.collisionCount || 0), 0);
        const plan = {
            file, uid, recoveryKey, header: scan.header, records, chunks, counts: scan.counts,
            storagePaths: [...storagePaths], comparison, collisionCount: collisions
        };
        sessions.set(plan, session);
        session.own(() => releaseBackupRestore(plan));
        return plan;
    } catch (error) {
        session.dispose();
        throw error;
    }
}

export async function executeBackupRestore(plan, selectedIndexes = null) {
    const session = sessions.get(plan);
    if (!session || plan.uid !== session.uid) throw new Error('BACKUP_PLAN_INVALID');
    const check = session.check;
    check();
    let attemptedChunks = 0, confirmedChunks = 0, uploaded = 0;
    try {
        const selective = Array.isArray(selectedIndexes);
        const selected = selective ? new Set(selectedIndexes) : null;
        const selectedEntries = selective
            ? plan.comparison.entries.filter(entry => selected.has(entry.index) && entry.status !== 'unchanged')
            : plan.comparison.entries;
        if (!selectedEntries.length) throw new Error('BACKUP_RESTORE_NOTHING_SELECTED');
        if (!selective && plan.collisionCount) throw new Error(`BACKUP_COLLISIONS:${plan.collisionCount}`);
        const records = selective ? selectedEntries.map(entry => plan.records[entry.index]) : plan.records;
        const chunks = chunkRestoreRecords(records);
        const overwritesExisting = selectedEntries.some(entry => entry.status === 'changed');
        const executionId = crypto.randomUUID();
        const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
        for (let index = 0; index < chunks.length; index += 1) {
            check();
            attemptedChunks += 1;
            const response = await restoreChunk({
                expectedOwnerUid: session.uid,
                operationId: `restore:${plan.header.backupId}:${executionId}:${index}`, backupId: plan.header.backupId,
                chunkIndex: index, chunkCount: chunks.length, mode: 'apply', overwriteExisting: overwritesExisting,
                confirmation: overwritesExisting ? 'RESTORE_SELECTED_OVERWRITE' : 'RESTORE_VALIDATED', records: chunks[index]
            });
            check();
            if (!['applied'].includes(response.data?.status)) throw new Error('BACKUP_RESTORE_CHUNK_FAILED');
            confirmedChunks += 1;
        }
        const selectedStoragePaths = new Set(records
            .filter(record => record.scope === 'private-account-attachment' || record.scope === 'company-account-attachment')
            .map(record => record.data?.storagePath)
            .filter(Boolean)
            .map(storagePath => validateRestoreStoragePath(storagePath, plan.uid)));
        check();
        await scanBackup(plan.file, plan.uid, plan.recoveryKey, async entry => {
            if (entry.kind !== 'attachment') return;
            const storagePath = validateRestoreStoragePath(entry.storagePath, plan.uid);
            if (selective && !selectedStoragePaths.has(storagePath)) return;
            const bytes = base64ToBytes(entry.content);
            if (!bytes.length || bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('BACKUP_ATTACHMENT_SIZE_INVALID');
            check();
            await uploadBytes(ref(storage, storagePath), bytes, {
                contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}
            });
            check();
            uploaded += 1;
        }, check, session.signal);
        check();
        const expectedAttachments = selective ? selectedStoragePaths.size : plan.counts.attachments;
        if (uploaded !== expectedAttachments) throw new Error('BACKUP_ATTACHMENT_COUNT_INVALID');
        return {recordCount: records.length, attachmentCount: uploaded};
    } catch (cause) {
        const error = new Error(attemptedChunks ? 'BACKUP_RESTORE_INTERRUPTED' : 'BACKUP_RESTORE_NOT_STARTED');
        error.code = cause?.code === 'BACKUP_SESSION_INVALIDATED' ? cause.code : error.message;
        error.progress = {attemptedChunks, confirmedChunks, uploaded, mayHaveApplied: attemptedChunks > 0};
        throw error;
    }
}
