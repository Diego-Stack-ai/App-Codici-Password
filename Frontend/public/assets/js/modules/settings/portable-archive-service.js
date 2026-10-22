import {auth, storage} from '../../firebase-config.js?v=1.2.224';
import {getBytes, ref} from '/assets/js/vendor/firebase-runtime.js';
import {decryptRequiredValue, isEncryptedValue} from '../core/crypto-utils.js';
import {decryptAttachmentBytes} from '../shared/attachment-security.js';
import {collectOwnerBackup} from './backup-export-service.js';
import {
    createBoundedPortableSink, createPortableArchiveWriter, createPortableHeader, PORTABLE_ARCHIVE_LIMITS
} from './portable-archive-stream.js';
import {buildPortableViewerHtml} from './portable-archive-viewer.js';
import {
    createPortableCapacityGuard, PORTABLE_ATTACHMENT_LIMITS, portableRecordKey,
    reconcilePortableAttachmentInventory
} from './portable-archive-inventory.js';
import {iteratePortableProjectionEntries} from './portable-archive-projections.js';

const MAX_ATTACHMENT_DOWNLOAD = PORTABLE_ATTACHMENT_LIMITS.perFileBytes + 1024;
const FALLBACK_ENCRYPTED_LIMIT = 12 * 1024 * 1024;
const VIEWER_FILE_NAME = ['visualizzatore', 'html'].join('.');
const encoder = new TextEncoder();
const PORTABLE_SCOPES = new Set([
    'profile', 'private-account', 'company-account', 'company', 'contact', 'deadline',
    'profile-widget', 'private-account-widget', 'company-account-widget',
    'account-widget-profile',
    'shared-vault-data', 'shared-vault-data-link'
]);
const LEGACY_VAULT_KEY_MATERIAL_FIELD = ['master', 'Key'].join('');
const OMITTED_KEYS = new Set([
    LEGACY_VAULT_KEY_MATERIAL_FIELD, 'masterPassword', 'vaultKey', 'vaultKeyring', 'vaultVerifier', 'wrappedVaultKey',
    'recoveryKey', 'passwordHash', 'salt', 'iv', 'ciphertext', 'wrappedFileKey', 'wrapSalt', 'wrapIv', 'contentIv',
    'verifier', 'vaultKeyEnvelope', 'storagePath', 'downloadURL', 'encryption'
]);

function checkSession(uid, options) {
    if (!uid || options.signal?.aborted || options.isActive?.() === false || auth.currentUser?.uid !== uid) {
        throw Object.assign(new Error('PORTABLE_SESSION_INVALIDATED'), {code: 'PORTABLE_SESSION_INVALIDATED'});
    }
}

async function openValue(value, vaultKeyMaterial, path = '') {
    if (value === null || value === undefined || ['number', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'string') {
        if (!isEncryptedValue(value)) return value;
        try { return await decryptRequiredValue(value, vaultKeyMaterial); }
        catch { throw Object.assign(new Error(`PORTABLE_DECRYPT_FAILED:${path}`), {code: 'PORTABLE_DECRYPT_FAILED'}); }
    }
    if (Array.isArray(value)) {
        const result = [];
        for (let index = 0; index < value.length; index += 1) {
            result.push(await openValue(value[index], vaultKeyMaterial, `${path}[${index}]`));
        }
        return result;
    }
    if (typeof value === 'object') {
        const result = {};
        for (const [key, child] of Object.entries(value)) {
            if (OMITTED_KEYS.has(key) || key.startsWith('_')) continue;
            result[key] = await openValue(child, vaultKeyMaterial, path ? `${path}.${key}` : key);
        }
        return result;
    }
    return String(value);
}

function recordTitle(record, data) {
    const candidates = ['nome', 'name', 'titolo', 'title', 'ragioneSociale', 'denominazione', 'label', 'tipo'];
    for (const key of candidates) if (typeof data?.[key] === 'string' && data[key].trim()) return data[key].trim();
    return `${record.scope} · ${record.id}`;
}

function attachmentName(attachment, storagePath) {
    return String(attachment.originalName || attachment.fileName || attachment.nomeFile || attachment.name || storagePath.split('/').pop() || 'allegato');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function writePackageFile(directory, name, content) {
    const handle = await directory.getFileHandle(name, {create: true});
    const writable = await handle.createWritable();
    try { await writable.write(content); await writable.close(); }
    catch (error) { try { await writable.abort(error); } catch {} throw error; }
}

function fallbackSink() {
    const sink = createBoundedPortableSink({
        limitBytes: FALLBACK_ENCRYPTED_LIMIT,
        async onComplete(parts) {
            downloadBlob(new Blob(parts, {type: 'application/x-codici-password-portable'}), 'archivio.cpportable');
        }
    });
    sink.streamed = false;
    return sink;
}

export async function preparePortableArchiveOutput(createdAt = new Date().toISOString()) {
    const packageName = `Archivio-Codici-Password-${createdAt.slice(0, 10)}-${createdAt.slice(11, 19).replaceAll(':', '')}`;
    if (typeof window.showDirectoryPicker !== 'function') {
        const sink = fallbackSink();
        return {
            sink, streamed: false,
            async finish() {
                downloadBlob(new Blob([buildPortableViewerHtml()], {type: 'text/html;charset=utf-8'}), VIEWER_FILE_NAME);
                downloadBlob(new Blob([
                    `Archivio portabile Codici & Password\n\nApri ${VIEWER_FILE_NAME} e seleziona archivio.cpportable.\n`,
                    'Il visualizzatore lavora offline. Il file non è un backup reimportabile.\n'
                ], {type: 'text/plain;charset=utf-8'}), 'LEGGIMI.txt');
            },
            async cleanup() { await sink.abort(); }
        };
    }
    const parent = await window.showDirectoryPicker({mode: 'readwrite', id: 'codici-password-portable-archive'});
    const directory = await parent.getDirectoryHandle(packageName, {create: true});
    const archiveHandle = await directory.getFileHandle('archivio.cpportable', {create: true});
    const writable = await archiveHandle.createWritable();
    let closed = false;
    const sink = {
        streamed: true,
        write: value => writable.write(value),
        async close() { await writable.close(); closed = true; },
        async abort(reason) { if (!closed) try { await writable.abort(reason); } catch {} }
    };
    return {
        sink, streamed: true, packageName,
        async finish() {
            await writePackageFile(directory, VIEWER_FILE_NAME, buildPortableViewerHtml());
            await writePackageFile(directory, 'LEGGIMI.txt',
                `Archivio portabile Codici & Password\n\nApri ${VIEWER_FILE_NAME} e seleziona archivio.cpportable.\nIl visualizzatore lavora offline. Il file non è un backup reimportabile.\n`);
        },
        async cleanup() {
            await sink.abort();
            try { await directory.removeEntry('archivio.cpportable'); } catch {}
            try { await directory.removeEntry(VIEWER_FILE_NAME); } catch {}
            try { await directory.removeEntry('LEGGIMI.txt'); } catch {}
        }
    };
}

export async function exportPortableArchive(uid, {
    password, vaultKeyMaterial, includeAttachments = true, preparedOutput = null,
    createdAt = new Date().toISOString(), ...options
} = {}) {
    if (!navigator.onLine) throw Object.assign(new Error('PORTABLE_REQUIRES_ONLINE'), {code: 'PORTABLE_REQUIRES_ONLINE'});
    if (!vaultKeyMaterial) throw Object.assign(new Error('PORTABLE_VAULT_REQUIRED'), {code: 'PORTABLE_VAULT_REQUIRED'});
    checkSession(uid, options);
    let records = [], storagePaths = [], projected = [], attachmentInventory = [], packageOutput, writer;
    try {
        packageOutput = preparedOutput || await preparePortableArchiveOutput(createdAt);
        writer = await createPortableArchiveWriter({
            sink: packageOutput.sink, password, signal: options.signal,
            header: createPortableHeader({createdAt})
        });
        ({records, storagePaths} = await collectOwnerBackup(uid, options));
        checkSession(uid, options);
        for (const record of records) {
            checkSession(uid, options);
            if (!PORTABLE_SCOPES.has(record.scope)) continue;
            const data = await openValue(record.data, vaultKeyMaterial, `${record.scope}.${record.id}`);
            projected.push({
                key: portableRecordKey(record), scope: record.scope, id: record.id,
                companyId: record.companyId || null, accountId: record.accountId || null,
                title: recordTitle(record, data), data
            });
        }
        if (projected.length > PORTABLE_ARCHIVE_LIMITS.maxRecords) {
            throw Object.assign(new Error('PORTABLE_RECORD_LIMIT'), {code: 'PORTABLE_RECORD_LIMIT'});
        }
        const recordsPayload = encoder.encode(JSON.stringify({
            format: 'codici-password-portable-data', version: 2, schemaVersion: 1, createdAt, records: projected
        }));
        try {
            if (recordsPayload.byteLength > PORTABLE_ARCHIVE_LIMITS.maxRetainedPlaintextBytes) {
                throw Object.assign(new Error('PORTABLE_RETAINED_LIMIT'), {code: 'PORTABLE_RETAINED_LIMIT'});
            }
            await writer.addEntry({
                id: 'records', kind: 'records', name: 'dati-interni.json', type: 'application/json;charset=utf-8'
            }, recordsPayload);
        } finally { recordsPayload.fill(0); }
        checkSession(uid, options);
        let projectionCount = 0;
        for await (const file of iteratePortableProjectionEntries(projected, {createdAt})) {
            checkSession(uid, options);
            try {
                await writer.addEntry({
                    id: `projection:${file.filename}`,
                    kind: file.kind, name: file.filename, type: file.type
                }, file.bytes);
                projectionCount += 1;
            } finally { file.bytes.fill(0); }
        }
        let attachmentCount = 0;
        if (includeAttachments) {
            attachmentInventory = reconcilePortableAttachmentInventory(
                records, storagePaths, new Set(projected.map(record => record.key))
            );
            const capacity = createPortableCapacityGuard();
            for (const item of attachmentInventory) {
                checkSession(uid, options);
                const {storagePath, attachment} = item;
                const ciphertext = new Uint8Array(await getBytes(ref(storage, storagePath), MAX_ATTACHMENT_DOWNLOAD));
                let clear = ciphertext;
                try {
                    if (attachment.encryption) {
                        clear = new Uint8Array(await decryptAttachmentBytes(ciphertext, attachment.encryption, vaultKeyMaterial));
                    }
                    capacity.accept(clear.byteLength);
                    const openedName = await openValue(attachmentName(attachment, storagePath), vaultKeyMaterial, 'attachment.name');
                    await writer.addEntry({
                        id: `attachment:${attachmentCount}:${String(attachment.id || attachment.attachmentId || storagePath.split('/').pop())}`,
                        kind: 'attachment', name: String(openedName || 'allegato'), recordKeys: item.recordKeys,
                        type: attachment.encryption?.originalType || attachment.mimeType || attachment.type || 'application/octet-stream'
                    }, clear);
                    attachmentCount += 1;
                } finally {
                    if (clear !== ciphertext) clear.fill(0);
                    ciphertext.fill(0);
                }
            }
        }
        checkSession(uid, options);
        await writer.close({
            counts: {records: projected.length, attachments: attachmentCount, projections: projectionCount},
            scopes: [...new Set(projected.map(record => record.scope))].sort(),
            warning: 'Copia leggibile utilizzabile al di fuori dell’app. Non è un backup reimportabile.'
        });
        await packageOutput.finish();
        return {recordCount: projected.length, attachmentCount, streamed: packageOutput.streamed, packageName: packageOutput.packageName || null};
    } catch (error) {
        try { await writer?.abort(error); } catch {}
        try { await packageOutput?.cleanup(); } catch {}
        if (error?.name === 'AbortError') throw Object.assign(new Error('PORTABLE_EXPORT_CANCELLED'), {name: 'AbortError'});
        if (error?.code) throw error;
        throw Object.assign(new Error('PORTABLE_EXPORT_FAILED'), {code: 'PORTABLE_EXPORT_FAILED'});
    } finally {
        records.length = 0; storagePaths.length = 0; projected.length = 0;
        attachmentInventory.length = 0; writer = null; packageOutput = null;
    }
}
