import {auth, storage} from '../../firebase-config.js?v=1.2.237';
import {getBytes, ref} from '/assets/js/vendor/firebase-runtime.js';
import {decryptRequiredValue, isEncryptedValue} from '../core/crypto-utils.js';
import {
    decryptAttachmentBytes, MAX_ATTACHMENT_BYTES, unwrapAttachmentFileKey
} from '../shared/attachment-security.js';
import {streamDecryptedAttachmentChunks} from '../shared/chunked-attachment-security.js';
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

const MAX_SINGLE_ATTACHMENT_DOWNLOAD = MAX_ATTACHMENT_BYTES + 1024;
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

function portableError(code) {
    return Object.assign(new Error(code), {code});
}

async function *chunkedAttachmentSource(uid, item, vaultKeyMaterial, options) {
    let fileKeyBytes = null;
    try {
        fileKeyBytes = await unwrapAttachmentFileKey(item.attachment.encryption, vaultKeyMaterial);
        yield* streamDecryptedAttachmentChunks({
            attachment: item.attachment,
            fileKeyBytes,
            async loadChunk(chunk) {
                checkSession(uid, options);
                const bytes = await getBytes(ref(storage, chunk.storagePath), chunk.encryptedSize);
                checkSession(uid, options);
                return bytes;
            }
        });
    } catch (error) {
        if (error?.code === 'PORTABLE_SESSION_INVALIDATED' || error?.name === 'AbortError') throw error;
        throw portableError('PORTABLE_ATTACHMENT_DECRYPT_FAILED');
    } finally {
        fileKeyBytes?.fill(0);
    }
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

function portableReadmeText() {
    return [
        'Archivio portabile Codici & Password', '',
        `Apri ${VIEWER_FILE_NAME} e seleziona archivio.cpportable.`,
        'Il visualizzatore lavora offline. Il file non è un backup reimportabile.', '',
        'CONSULTAZIONE E ALLEGATI',
        '- Foto, video, audio, PDF e formati supportati si aprono direttamente nel visualizzatore.',
        '- Il salvataggio sul PC è facoltativo. “Salva tutti gli allegati” crea copie solo dopo una conferma esplicita.',
        '- Gli allegati restano cifrati dentro archivio.cpportable finché non scegli di salvarli.', '',
        'COMPATIBILITÀ E PROBLEMI DI VISUALIZZAZIONE',
        '- Per i file grandi usa un browser desktop aggiornato, preferibilmente Chrome o Edge.',
        '- Un formato o codec non supportato può essere salvato e aperto con un programma compatibile.',
        '- Se un PDF non appare, salvalo e aprilo con un lettore PDF.',
        '- Se manca memoria o spazio temporaneo, chiudi altre applicazioni oppure salva il file sul PC.',
        '- Un allegato danneggiato o incompleto non viene aperto: ripeti la verifica dell’archivio.', '',
        'PRIVACY DEI FILE TEMPORANEI',
        'Le anteprime vengono create solo su richiesta. Il visualizzatore revoca i collegamenti temporanei, azzera i buffer disponibili e rimuove i file temporanei applicativi alla chiusura e alla successiva apertura.',
        'Un browser non può garantire la cancellazione fisica forense assoluta dalla memoria o dal supporto del dispositivo.', '',
        'AVVISO DI SICUREZZA',
        'Excel, ODS, CSV, JSON e gli allegati salvati sul PC sono copie decifrate e leggibili. Conservali in un luogo sicuro.', ''
    ].join('\n');
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
                downloadBlob(new Blob([portableReadmeText()], {type: 'text/plain;charset=utf-8'}), 'LEGGIMI.txt');
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
            await writePackageFile(directory, 'LEGGIMI.txt', portableReadmeText());
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
                const fallbackPath = storagePath || item.storagePaths[0];
                const openedName = await openValue(attachmentName(attachment, fallbackPath), vaultKeyMaterial, 'attachment.name');
                const entry = {
                    id: `attachment:${attachmentCount}:${String(attachment.id || attachment.attachmentId || fallbackPath.split('/').pop())}`,
                    kind: 'attachment', name: String(openedName || 'allegato'), recordKeys: item.recordKeys,
                    type: attachment.encryption?.originalType || attachment.mimeType || attachment.type || 'application/octet-stream'
                };
                if (item.layout === 'chunked-v1') {
                    capacity.accept(attachment.encryption.originalSize);
                    await writer.addEntry({
                        ...entry, schemaVersion: 1
                    }, chunkedAttachmentSource(uid, item, vaultKeyMaterial, options));
                } else {
                    const ciphertext = new Uint8Array(await getBytes(ref(storage, storagePath), MAX_SINGLE_ATTACHMENT_DOWNLOAD));
                    let clear = ciphertext;
                    try {
                        if (attachment.encryption) {
                            try {
                                clear = new Uint8Array(await decryptAttachmentBytes(ciphertext, attachment.encryption, vaultKeyMaterial));
                            } catch {
                                throw portableError('PORTABLE_ATTACHMENT_DECRYPT_FAILED');
                            }
                        }
                        capacity.accept(clear.byteLength);
                        await writer.addEntry(entry, clear);
                    } finally {
                        if (clear !== ciphertext) clear.fill(0);
                        ciphertext.fill(0);
                    }
                }
                attachmentCount += 1;
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
