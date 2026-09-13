import {auth, functions, storage} from '../../firebase-config.js?v=1.2.121';
import {httpsCallable, onAuthStateChanged, ref, uploadBytes} from '/assets/js/vendor/firebase-runtime.js';
import {decryptBackupEntry, deriveBackupKey, parseBackupLine} from './backup-crypto.js';
import {chunkRestoreRecords, describeRestoreRecords, validateBackupFooter, validateRestoreStoragePath} from './backup-import-model.js';
import {collectStoragePaths} from './backup-export-model.js';

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 + 1024;
const BACKUP_READ_BYTES = 64 * 1024;
// Admission bounds for retained preview data, not an exact browser heap quota.
const MAX_RESTORE_RECORDS = 10000;
const MAX_RESTORE_RECORD_CHARACTERS = 16 * 1024 * 1024;
const MAX_RESTORE_ATTACHMENTS = 10000;
const MAX_RESTORE_ATTACHMENT_CHARACTERS = 2 * 1024 * 1024;
// Attachment bytes are Base64 inside encrypted JSON, then ciphertext is Base64
// again. Allow metadata/escaped paths and the GCM tag at both JSON layers.
const BACKUP_LINE_METADATA_BYTES = 64 * 1024;
const MAX_BACKUP_LINE_CHARACTERS = Math.ceil((Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 +
    BACKUP_LINE_METADATA_BYTES + 16) / 3) * 4 + BACKUP_LINE_METADATA_BYTES;
const sessions = new WeakMap();

function freezeRestoreValue(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freezeRestoreValue);
        Object.freeze(value);
    }
    return value;
}

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
        plan.storagePaths = [];
        plan.comparison = null;
    }
}

async function* decodedBackupChunks(file, check, signal) {
    check();
    if (!Number.isSafeInteger(file?.size) || file.size <= 0 || file.size > MAX_BACKUP_BYTES) {
        throw new Error('BACKUP_FILE_SIZE_INVALID');
    }
    if (typeof TextDecoderStream === 'function' && typeof file.stream === 'function') {
        const reader = file.stream().pipeThrough(new TextDecoderStream('utf-8', {fatal: true})).getReader();
        let finished = false, cancelled = false;
        const cancel = () => {
            if (cancelled) return;
            cancelled = true;
            void reader.cancel().catch(() => {});
        };
        signal?.addEventListener('abort', cancel, {once: true});
        try {
            while (true) {
                check();
                const {done, value} = await reader.read();
                check();
                if (done) { finished = true; break; }
                yield value;
            }
        } finally {
            signal?.removeEventListener('abort', cancel);
            if (!finished) cancel();
            reader.releaseLock();
        }
        return;
    }
    if (typeof file.slice !== 'function' || typeof TextDecoder !== 'function') throw new Error('BACKUP_STREAM_UNAVAILABLE');
    const decoder = new TextDecoder('utf-8', {fatal: true});
    for (let offset = 0; offset < file.size; offset += BACKUP_READ_BYTES) {
        check();
        const end = Math.min(offset + BACKUP_READ_BYTES, file.size);
        const buffer = await file.slice(offset, end).arrayBuffer();
        check();
        if (buffer.byteLength !== end - offset) throw new Error('BACKUP_FILE_READ_INVALID');
        yield decoder.decode(buffer, {stream: true});
    }
    check();
    const tail = decoder.decode();
    if (tail) yield tail;
}

async function* lines(file, check, signal) {
    let fragments = [], length = 0;
    try {
        for await (const chunk of decodedBackupChunks(file, check, signal)) {
            let offset = 0;
            while (offset < chunk.length) {
                check();
                const newline = chunk.indexOf('\n', offset);
                const end = newline < 0 ? chunk.length : newline;
                const segmentLength = end - offset;
                if (length + segmentLength > MAX_BACKUP_LINE_CHARACTERS) throw new Error('BACKUP_LINE_TOO_LARGE');
                if (segmentLength) fragments.push(chunk.slice(offset, end));
                length += segmentLength;
                if (newline < 0) break;
                const line = fragments.join('');
                fragments = []; length = 0;
                if (line.trim()) yield line;
                offset = newline + 1;
            }
        }
        check();
        if (length) {
            const line = fragments.join('');
            if (line.trim()) yield line;
        }
    } finally { fragments = []; }
}

function base64ToBytes(value) {
    const binary = atob(String(value));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function attachmentBytes(content) {
    if (typeof content !== 'string' || !content.length || content.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) {
        throw new Error('BACKUP_ATTACHMENT_SIZE_INVALID');
    }
    if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
        throw new Error('BACKUP_ATTACHMENT_CONTENT_INVALID');
    }
    const bytes = base64ToBytes(content);
    if (!bytes.length || bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('BACKUP_ATTACHMENT_SIZE_INVALID');
    return bytes;
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
        if (visit) await visit(opened.entry, opened.digest);
        check();
    }
    if (!header || !footer) throw new Error('BACKUP_FOOTER_MISSING');
    validateBackupFooter(footer, counts);
    return {header, key, counts};
}

function operationId(backupId, chunkIndex) {
    return `restore:${backupId}:${chunkIndex}`;
}

function previewEntries(value, length) {
    const fail = () => { throw new Error('BACKUP_PREVIEW_INVALID'); };
    const keys = (object, names) => object && typeof object === 'object' && !Array.isArray(object) &&
        Object.keys(object).length === names.length && names.every(name => Object.hasOwn(object, name));
    if (value?.previewVersion !== 1 || !Array.isArray(value.entries) || value.entries.length !== length) fail();
    const entries = new Map();
    for (const entry of value.entries) {
        if (!entry || !Number.isInteger(entry.index) || entry.index < 0 || entry.index >= length || entries.has(entry.index) ||
            !['missing', 'changed', 'unchanged'].includes(entry.status)) fail();
        const version = entry.expectedVersion;
        if (version?.exists === false) {
            if (!keys(version, ['exists']) || entry.status !== 'missing') fail();
            entries.set(entry.index, {status: entry.status, expectedVersion: Object.freeze({exists: false})});
        } else {
            const time = version?.updateTime;
            if (version?.exists !== true || !keys(version, ['exists', 'updateTime']) ||
                !keys(time, ['seconds', 'nanoseconds']) || !Number.isSafeInteger(time.seconds) ||
                time.seconds < -62135596800 || time.seconds > 253402300799 ||
                !Number.isInteger(time.nanoseconds) || time.nanoseconds < 0 || time.nanoseconds > 999999999 ||
                entry.status === 'missing') fail();
            entries.set(entry.index, {status: entry.status, expectedVersion: Object.freeze({exists: true,
                updateTime: Object.freeze({seconds: time.seconds, nanoseconds: time.nanoseconds})})});
        }
    }
    return entries;
}

export async function prepareBackupRestore(file, uid, recoveryKey, options = {}) {
    const session = restoreSession(uid, options);
    const check = session.check;
    try {
        const records = [];
        const storagePaths = new Set();
        const attachmentDigests = new Map();
        let recordCharacters = 0, attachmentCharacters = 0;
        session.own(() => attachmentDigests.clear());
        const scan = await scanBackup(file, uid, recoveryKey, (entry, digest) => {
            if (entry.kind === 'record') {
                chunkRestoreRecords([entry]);
                const characters = JSON.stringify(entry).length;
                if (records.length >= MAX_RESTORE_RECORDS || characters > MAX_RESTORE_RECORD_CHARACTERS - recordCharacters) {
                    throw new Error('BACKUP_PREVIEW_CAPACITY_EXCEEDED');
                }
                recordCharacters += characters;
                records.push(entry);
            }
            else {
                const path = validateRestoreStoragePath(entry.storagePath, uid);
                if (storagePaths.has(path)) throw new Error('BACKUP_ATTACHMENT_DUPLICATE');
                attachmentBytes(entry.content);
                if (typeof digest !== 'string' || !digest) throw new Error('BACKUP_ATTACHMENT_DIGEST_INVALID');
                const characters = path.length + digest.length;
                if (attachmentDigests.size >= MAX_RESTORE_ATTACHMENTS ||
                    characters > MAX_RESTORE_ATTACHMENT_CHARACTERS - attachmentCharacters) {
                    throw new Error('BACKUP_PREVIEW_CAPACITY_EXCEEDED');
                }
                attachmentCharacters += characters;
                attachmentDigests.set(path, digest);
                storagePaths.add(path);
            }
        }, check, session.signal);
        check();
        collectStoragePaths(records, uid);
        const chunks = chunkRestoreRecords(records);
        if (!chunks.length) throw new Error('BACKUP_EMPTY');
        const descriptions = describeRestoreRecords(records);
        const comparison = {entries: [], counts: {missing: 0, unchanged: 0, changed: 0}};
        const versions = new Map();
        session.own(() => versions.clear());
        session.versions = versions;
        const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
        let offset = 0;
        for (let index = 0; index < chunks.length; index += 1) {
            check();
            const response = await restoreChunk({
                expectedOwnerUid: uid,
                operationId: operationId(scan.header.backupId, index), backupId: scan.header.backupId,
                chunkIndex: index, chunkCount: chunks.length, mode: 'preview', records: chunks[index]
            });
            check();
            const entries = previewEntries(response.data, chunks[index].length);
            for (let localIndex = 0; localIndex < chunks[index].length; localIndex += 1) {
                const originalIndex = offset + localIndex;
                const entry = entries.get(localIndex);
                versions.set(originalIndex, entry.expectedVersion);
                comparison.entries.push({index: originalIndex, scope: records[originalIndex].scope,
                    id: records[originalIndex].id, status: entry.status, description: descriptions[originalIndex]});
                comparison.counts[entry.status] += 1;
            }
            offset += chunks[index].length;
        }
        const collisions = comparison.counts.changed + comparison.counts.unchanged;
        const plan = {
            file, uid, recoveryKey, header: scan.header, records, chunks, counts: scan.counts,
            storagePaths: [...storagePaths], comparison, collisionCount: collisions
        };
        session.source = {file, recoveryKey, backupId: scan.header.backupId,
            records: freezeRestoreValue(records), comparison: freezeRestoreValue(comparison),
            counts: freezeRestoreValue(scan.counts), collisionCount: collisions,
            storagePaths: freezeRestoreValue([...storagePaths]), attachmentDigests};
        session.own(() => {
            session.source = null;
            if (session.execution) {
                session.execution.commands = [];
                session.execution.records = [];
                session.execution.storagePaths = [];
                session.execution.selection = null;
                session.execution.result = null;
            }
            session.execution = null;
        });
        sessions.set(plan, session);
        session.own(() => releaseBackupRestore(plan));
        return plan;
    } catch (error) {
        session.dispose();
        throw error;
    }
}

function restoreProgress(execution) {
    return {attemptedChunks: execution?.attemptedChunks || 0, confirmedChunks: execution?.confirmedChunks || 0,
        uploaded: execution?.uploaded || 0,
        mayHaveApplied: Boolean(execution?.confirmedChunks || execution?.possiblyApplied || execution?.storageStarted)};
}

function restoreError(code, execution, retryable = false) {
    const error = new Error(code);
    error.code = code;
    error.retryable = retryable;
    error.progress = restoreProgress(execution);
    return error;
}

function restoreSelection(selectedIndexes, recordCount) {
    if (selectedIndexes === null) return null;
    if (!Array.isArray(selectedIndexes) || selectedIndexes.some(index => !Number.isInteger(index) || index < 0 || index >= recordCount)) {
        throw new Error('BACKUP_RESTORE_SELECTION_INVALID');
    }
    return [...new Set(selectedIndexes)].sort((left, right) => left - right);
}

function prepareRestoreExecution(session, selection) {
    const source = session.source;
    const selective = selection !== null;
    const selected = new Set(selection || []);
    const entries = source.comparison.entries.filter(entry => entry.status !== 'unchanged' && (!selective || selected.has(entry.index)));
    if (!entries.length) throw restoreError('BACKUP_RESTORE_NOTHING_SELECTED');
    if (!selective && source.collisionCount) throw restoreError('BACKUP_COLLISIONS');
    const records = entries.map(entry => {
        const expectedVersion = session.versions.get(entry.index);
        if (!expectedVersion) throw restoreError('BACKUP_PREVIEW_INVALID');
        return freezeRestoreValue({...source.records[entry.index], expectedVersion});
    });
    const storagePaths = freezeRestoreValue(collectStoragePaths(records, session.uid));
    const availablePaths = new Set(source.storagePaths);
    if (storagePaths.some(path => !availablePaths.has(path))) throw restoreError('BACKUP_ATTACHMENT_MISSING');
    const chunks = chunkRestoreRecords(records);
    const overwriteExisting = entries.some(entry => entry.status === 'changed');
    const executionId = crypto.randomUUID();
    const commands = freezeRestoreValue(chunks.map((chunk, index) => ({
        expectedOwnerUid: session.uid,
        operationId: `restore:${source.backupId}:${executionId}:${index}`, backupId: source.backupId,
        chunkIndex: index, chunkCount: chunks.length, mode: 'apply', overwriteExisting,
        confirmation: overwriteExisting ? 'RESTORE_SELECTED_OVERWRITE' : 'RESTORE_VALIDATED', records: chunk
    })));
    return {executionId, selection: freezeRestoreValue(selection), selective, records, commands, storagePaths,
        attemptedChunks: 0, confirmedChunks: 0, uploaded: 0, uncertain: false, possiblyApplied: false, storageStarted: false,
        inFlight: false, blocked: false, result: null};
}

export async function executeBackupRestore(plan, selectedIndexes = null, {retry = false} = {}) {
    const session = sessions.get(plan);
    if (!session || plan.uid !== session.uid) throw new Error('BACKUP_PLAN_INVALID');
    const check = session.check;
    check();
    const selection = restoreSelection(selectedIndexes, session.source.records.length);
    let execution = session.execution;
    if (execution && JSON.stringify(selection) !== JSON.stringify(execution.selection)) {
        throw restoreError('BACKUP_RESTORE_SELECTION_CHANGED', execution);
    }
    if (execution?.inFlight) throw restoreError('BACKUP_RESTORE_IN_PROGRESS', execution);
    if (execution?.result) return {...execution.result};
    if (execution?.blocked) throw restoreError(execution.storageStarted ? 'BACKUP_STORAGE_RETRY_BLOCKED' : 'BACKUP_RESTORE_RETRY_BLOCKED', execution);
    if (execution?.uncertain && !retry) throw restoreError('BACKUP_RETRY_REQUIRED', execution, true);
    if (!execution) {
        execution = prepareRestoreExecution(session, selection);
        session.execution = execution;
    }
    execution.inFlight = true;
    const source = session.source;
    let stage = 'firestore';
    let previouslyPossible = false;
    try {
        const restoreChunk = httpsCallable(functions, 'restoreBackupChunk');
        for (let index = execution.confirmedChunks; index < execution.commands.length; index += 1) {
            check();
            execution.attemptedChunks += 1;
            previouslyPossible = execution.possiblyApplied;
            execution.possiblyApplied = true;
            execution.uncertain = true;
            const response = await restoreChunk(execution.commands[index]);
            check();
            if (response.data?.status === 'stale-preview') {
                execution.uncertain = false;
                execution.possiblyApplied = previouslyPossible;
                throw restoreError('BACKUP_PREVIEW_STALE', execution);
            }
            if (response.data?.status !== 'applied') {
                if (response.data?.status === 'collision') {
                    execution.uncertain = false;
                    execution.possiblyApplied = previouslyPossible;
                    execution.blocked = true;
                }
                throw restoreError('BACKUP_RESTORE_CHUNK_FAILED', execution);
            }
            execution.uncertain = false;
            execution.possiblyApplied = false;
            execution.confirmedChunks += 1;
        }
        stage = 'storage';
        const selectedStoragePaths = new Set(execution.storagePaths);
        const visitedStoragePaths = new Set();
        check();
        await scanBackup(source.file, session.uid, source.recoveryKey, async (entry, digest) => {
            if (entry.kind !== 'attachment') return;
            const storagePath = validateRestoreStoragePath(entry.storagePath, session.uid);
            if (!selectedStoragePaths.has(storagePath)) return;
            if (visitedStoragePaths.has(storagePath)) throw new Error('BACKUP_ATTACHMENT_DUPLICATE');
            if (!source.attachmentDigests.has(storagePath) || source.attachmentDigests.get(storagePath) !== digest) {
                throw new Error('BACKUP_ATTACHMENT_SOURCE_CHANGED');
            }
            visitedStoragePaths.add(storagePath);
            const bytes = attachmentBytes(entry.content);
            check();
            execution.storageStarted = true;
            await uploadBytes(ref(storage, storagePath), bytes, {
                contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}
            });
            check();
            execution.uploaded += 1;
        }, check, session.signal);
        check();
        const expectedAttachments = selectedStoragePaths.size;
        if (execution.uploaded !== expectedAttachments) throw new Error('BACKUP_ATTACHMENT_COUNT_INVALID');
        execution.result = freezeRestoreValue({recordCount: execution.records.length, attachmentCount: execution.uploaded});
        return {...execution.result};
    } catch (cause) {
        if (cause?.code === 'BACKUP_SESSION_INVALIDATED' || cause?.code === 'BACKUP_PREVIEW_STALE') {
            const error = restoreError(cause.code, execution);
            if (cause.code === 'BACKUP_PREVIEW_STALE') releaseBackupRestore(plan);
            throw error;
        }
        const definitiveRejection = ['invalid-argument', 'failed-precondition', 'permission-denied', 'unauthenticated', 'not-found', 'already-exists']
            .includes(String(cause?.code || '').replace(/^functions\//, ''));
        if (stage === 'firestore' && execution.uncertain && !definitiveRejection) {
            throw restoreError('BACKUP_FIRESTORE_UNCERTAIN', execution, true);
        }
        if (definitiveRejection) {
            execution.uncertain = false;
            execution.possiblyApplied = previouslyPossible;
        }
        execution.blocked = true;
        throw restoreError(execution.storageStarted ? 'BACKUP_STORAGE_RETRY_BLOCKED' : 'BACKUP_RESTORE_INTERRUPTED', execution);
    } finally { execution.inFlight = false; }
}
