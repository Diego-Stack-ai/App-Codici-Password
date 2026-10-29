/**
 * Gestione allegati del dettaglio Account privato.
 * Il contesto viene inizializzato una sola volta dalla pagina principale.
 */

import { db, storage } from '../../firebase-config.js?v=1.2.244';
import { doc, collection, addDoc, setDoc, deleteDoc, serverTimestamp } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, deleteObject, getBytes } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import {
    MAX_ATTACHMENT_BYTES, createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile,
    openDecryptedAttachment, openExternalUrl, resolveAccountAttachmentMime, unwrapAttachmentFileKey,
    validateAccountAttachmentFile
} from '../shared/attachment-security.js';
import {
    decryptReceivedPrivateAttachment, syncPrivateAttachmentAccess, unwrapReceivedAttachmentFileKey
} from '../shared/shared-attachment-access.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { listPrivateAccountAttachments } from '../data/vault-repository.js';
import {editImageBeforeUpload} from '../shared/image-crop-editor.js';
import {
    attachmentUploadErrorMessage, beginLargeAttachmentUploadFeedback, closeAttachmentSourcePicker,
    selectAttachmentSource
} from '../shared/attachment-source-picker.js';
import {captureCardAttachment, consumeAttachmentInitialMode} from '../shared/card-attachment-capture.js';

let mounted = null;

function isChunkedAttachment(attachment) {
    return attachment?.encryption?.chunked === true &&
        attachment.encryption?.chunkVersion === 1 &&
        Array.isArray(attachment?.chunks) && attachment.chunks.length > 0;
}

export function initPrivateAttachmentModule(context) {
    mounted?.destroy();
    let destroyed = false;
    const cleanups = new Set();
    const mount = {ownerId: context.ownerId, currentUid: context.currentUid, accountId: context.accountId,
        account: context.account, readOnly: Boolean(context.readOnly),
        confirm: context.confirm || showConfirmModal,
        active() {
            if (!destroyed && (mounted !== mount || context.signal?.aborted || (context.isActive && !context.isActive()))) mount.destroy();
            return !destroyed;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            closeAttachmentSourcePicker();
            context.signal?.removeEventListener('abort', mount.destroy);
            for (const cleanup of cleanups) cleanup();
            cleanups.clear();
            if (mounted === mount) {
                if (document.body) document.body.style.overflow = '';
            }
        },
        later(callback, milliseconds) {
            const timer = setTimeout(() => { cleanups.delete(cancel); if (mount.active()) callback(); }, milliseconds);
            const cancel = () => clearTimeout(timer);
            cleanups.add(cancel);
        },
        addCleanup(callback) {
            cleanups.add(callback);
        }
    };
    mounted = mount;
    context.signal?.addEventListener('abort', mount.destroy, {once: true});
    if (!mount.active()) return mount;
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        const previous = document.getElementById(id);
        const input = previous?.cloneNode ? previous.cloneNode(true) : previous;
        if (!input) return;
        if (input !== previous) previous.parentNode?.replaceChild(input, previous);
        input.value = '';
        input.onchange = () => handleFileUpload(input, mount, {initialMode: consumeAttachmentInitialMode(input)});
        cleanups.add(() => { input.value = ''; input.onchange = null; });
    });
    return mount;
}

export async function openSourceSelector(mount = mounted) {
    if (!mount?.active() || mount.readOnly) return;
    const source = await selectAttachmentSource();
    if (!mount.active() || !source) return;
    if (source === 'card') {
        const askFallback = mount.confirm;
        const file = await captureCardAttachment({
            fallbackInput: document.getElementById('input-camera'),
            confirmFallback: (...args) => askFallback(...args)
        });
        if (file && mount.active()) await processFileUpload({files: [file], value: ''}, mount, {skipImageEditor: true});
        return;
    }
    document.getElementById({camera:'input-camera',gallery:'input-gallery',document:'input-file'}[source])?.click();
}

export function closeSourceSelector(mount = mounted) {
    if (!mount?.active()) return;
    closeAttachmentSourcePicker();
    document.body.style.overflow = '';
}

export async function handleFileUpload(input, mount = mounted, options = {}) {
    return processFileUpload(input, mount, options);
}

async function processFileUpload(input, mount = mounted, {initialMode = 'free', skipImageEditor = false} = {}) {
    if (!mount?.active() || mount.readOnly) return;
    const {ownerId, accountId} = mount;
    const confirmAction = mount.confirm;
    closeSourceSelector(mount);

    if (!navigator.onLine) {
        await confirmAction(
            'CONNESSIONE NECESSARIA',
            'Per caricare un allegato devi essere online. Nessun file è stato modificato.'
        );
        if (mount.active()) input.value = '';
        return;
    }

    let file = input.files[0];
    if (!file) return;
    try {
        validateAccountAttachmentFile(file);
    } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
        return;
    }
    const resolvedMime = resolveAccountAttachmentMime(file);
    if (resolvedMime.startsWith('image/') && !skipImageEditor) {
        file = await editImageBeforeUpload(file, {initialMode});
        if (!file || !mount.active()) {input.value = ''; return;}
    }

    showToast(`File selezionato: ${file.name}`, 'info');
    const confirmed = await confirmAction(
        'CARICA ALLEGATO',
        `Vuoi caricare il file ${file.name}?`,
        'Carica',
        t('cancel') || 'Annulla'
    );
    if (!mount.active()) return;
    if (!confirmed) {
        input.value = '';
        return;
    }

    showToast(file.size > MAX_ATTACHMENT_BYTES ? 'Preparazione video a blocchi…' : 'Caricamento in corso...', 'info');
    const uploadedPaths = [];
    const uploadFeedback = file.size > MAX_ATTACHMENT_BYTES
        ? await beginLargeAttachmentUploadFeedback(file)
        : null;
    try {
        const vaultKey = await ensureVaultKeyMaterial();
        if (!mount.active()) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            const attachmentRef = doc(collection(db, 'users', ownerId, 'accounts', accountId, 'attachments'));
            let lastProgress = 0;
            const {encryptAttachmentFileInChunks} = await import('../shared/chunked-attachment-security.js');
            if (!mount.active()) return;
            const encryptedFile = await encryptAttachmentFileInChunks(file, vaultKey, {
                binding: attachmentRef.id,
                onChunk: async chunk => {
                    if (!mount.active()) throw new Error('ATTACHMENT_UPLOAD_ABORTED');
                    const storagePath = `users/${ownerId}/accounts/${accountId}/attachments/${attachmentRef.id}/chunks/${String(chunk.index).padStart(4, '0')}.bin`;
                    await uploadBytes(ref(storage, storagePath), chunk.blob, {
                        contentType: 'application/octet-stream',
                        customMetadata: {encrypted: 'v1', chunk: String(chunk.index)}
                    });
                    uploadedPaths.push(storagePath);
                    const progress = Math.floor(chunk.progress * 100);
                    uploadFeedback?.update(progress);
                    if (progress === 100 || progress - lastProgress >= 10) {
                        lastProgress = progress;
                        showToast(`Caricamento video: ${progress}%`, 'info');
                    }
                    return {storagePath};
                }
            });
            if (!mount.active()) throw new Error('ATTACHMENT_UPLOAD_ABORTED');
            await setDoc(attachmentRef, {
                name: file.name,
                type: resolvedMime || 'application/octet-stream',
                size: file.size,
                chunks: encryptedFile.chunks,
                encryption: encryptedFile.metadata,
                createdAt: serverTimestamp()
            });
        } else {
            const storagePath = `users/${ownerId}/accounts/${accountId}/attachments/${createStorageObjectName(file)}`;
            const storageRef = ref(storage, storagePath);
            const encryptedFile = await encryptAttachmentFile(file, vaultKey, {mimeType: resolvedMime});
            if (!mount.active()) return;
            await uploadBytes(storageRef, encryptedFile.blob, {
                contentType: 'application/octet-stream',
                customMetadata: { encrypted: 'v1' }
            });
            if (!mount.active()) return;

            await addDoc(collection(db, 'users', ownerId, 'accounts', accountId, 'attachments'), {
                name: file.name,
                storagePath,
                type: resolvedMime || 'application/octet-stream',
                size: file.size,
                encryption: encryptedFile.metadata,
                createdAt: serverTimestamp()
            });
        }
        if (!mount.active()) return;
        uploadFeedback?.success();
        showToast('Allegato caricato!', 'success');
        await loadPrivateAttachments(mount);
    } catch (error) {
        await Promise.allSettled(uploadedPaths.map(storagePath => deleteObject(ref(storage, storagePath))));
        if (!mount.active()) return;
        logError('UploadAttachment', error);
        uploadFeedback?.fail(error);
        showToast(attachmentUploadErrorMessage(error), 'error');
    } finally {
        await uploadFeedback?.release();
        input.value = '';
    }
}

export async function loadPrivateAttachments(mount = mounted) {
    if (!mount?.active()) return;
    const {ownerId, accountId} = mount;
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const attachments = await listPrivateAccountAttachments(
            ownerId, accountId, mount.readOnly ? mount.currentUid : ''
        );
        const hasAcceptedRecipients = Object.values(mount.account?.sharedWith || {})
            .some(item => item?.status === 'accepted' && item?.uid);
        if (!mount.readOnly && attachments.length && hasAcceptedRecipients) {
            const vaultKeyMaterial = await ensureVaultKeyMaterial();
            if (!mount.active()) return;
            const outcome = await syncPrivateAttachmentAccess({
                ownerUid: ownerId, accountId, account: mount.account, attachments, vaultKeyMaterial
            });
            if (outcome.waiting && mount.active()) {
                showToast('Alcuni destinatari devono aggiornare l’app prima di ricevere gli allegati.', 'info');
            }
        }
        if (mount.active()) renderAttachments(attachments, mount);
    } catch (error) {
        if (!mount.active()) return;
        logError('LoadAttachments', error);
    }
}

function renderAttachments(list, mount) {
    if (!mount.active()) return;
    const container = document.getElementById('attachments-list');
    if (!container) return;
    clearElement(container);

    if (list.length === 0) {
        container.appendChild(createElement('p', {
            className: 'text-[10px] text-white/20 uppercase text-center py-4',
            textContent: 'Nessun allegato'
        }));
        return;
    }

    const imagePreviews = [];
    setChildren(container, list.map(attachment => {
        const type = (attachment.type || '').toLowerCase();
        let icon = 'description';
        let color = 'text-blue-400/40';
        if (type.includes('image')) { icon = 'image'; color = 'text-purple-400/40'; }
        else if (type.includes('video')) { icon = 'movie'; color = 'text-pink-400/40'; }
        else if (type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-400/40'; }

        const date = attachment.createdAt?.toDate
            ? attachment.createdAt.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
            : '---';
        const size = (attachment.size / (1024 * 1024)).toFixed(2);

        const preview = type.includes('image') ? createElement('div', {
            className: 'attachment-preview attachment-preview-loading',
            textContent: 'Caricamento anteprima…'
        }) : null;
        if (preview) imagePreviews.push({attachment, preview});
        return createElement('div', { className: 'attachment-item attachment-item-visible animate-in slide-in-from-left-2' }, [
            createElement('div', {
                className: 'attachment-info cursor-pointer',
                onclick: () => openAttachment(attachment, mount)
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: attachment.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            preview,
            !mount.readOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: event => {
                    event.stopPropagation();
                    deleteAttachment(attachment, mount);
                }
            }, [createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'delete' })]) : null
        ]);
    }));
    imagePreviews.forEach(item => loadVisibleImagePreview(item.attachment, item.preview, mount));
}

async function loadVisibleImagePreview(attachment, preview, mount) {
    if (!mount.active() || !attachment.storagePath || !attachment.encryption) return;
    try {
        const vaultKey = await ensureVaultKeyMaterial();
        if (!mount.active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 32 * 1024 * 1024 + 1024);
        if (!mount.active()) return;
        const clear = mount.readOnly
            ? await decryptReceivedPrivateAttachment({ownerUid: mount.ownerId, accountId: mount.accountId,
                attachment, recipientUid: mount.currentUid, vaultKeyMaterial: vaultKey, ciphertext: bytes})
            : await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!mount.active()) {clear?.fill?.(0); return;}
        const type = attachment.encryption?.originalType || attachment.type || 'image/jpeg';
        const objectUrl = URL.createObjectURL(new Blob([clear], {type}));
        clear?.fill?.(0);
        mount.addCleanup(() => URL.revokeObjectURL(objectUrl));
        const image = createElement('img', {className: 'attachment-preview-image', src: objectUrl,
            alt: `Anteprima ${attachment.name || 'allegato'}`});
        image.onclick = () => openAttachment(attachment, mount);
        setChildren(preview, [image]);
        preview.classList.remove('attachment-preview-loading');
    } catch (error) {
        if (!mount.active()) return;
        preview.textContent = 'Anteprima non disponibile';
        preview.classList.remove('attachment-preview-loading');
        preview.classList.add('attachment-preview-unavailable');
        logError('LoadAttachmentPreview', error);
    }
}

async function openAttachment(attachment, mount = mounted) {
    if (!mount?.active()) return;
    attachment = {...attachment, encryption: attachment.encryption ? {...attachment.encryption} : null};
    try {
        if (!attachment.encryption) {
            if (mount.readOnly) throw new Error('SHARED_LEGACY_ATTACHMENT_UNSUPPORTED');
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        const chunked = isChunkedAttachment(attachment);
        if (!chunked && !attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        if (!mount.active()) return;
        if (chunked) {
            const fileKeyBytes = mount.readOnly
                ? await unwrapReceivedAttachmentFileKey({
                    ownerUid: mount.ownerId, accountId: mount.accountId, attachment,
                    recipientUid: mount.currentUid, vaultKeyMaterial: vaultKey
                })
                : await unwrapAttachmentFileKey(attachment.encryption, vaultKey);
            try {
                const {openChunkedDecryptedAttachment} = await import('../shared/chunked-attachment-security.js');
                if (!mount.active()) return;
                await openChunkedDecryptedAttachment({
                    attachment,
                    fileKeyBytes,
                    loadChunk: chunk => getBytes(ref(storage, chunk.storagePath), Number(chunk.encryptedSize) + 1024)
                });
            } finally {
                fileKeyBytes.fill(0);
            }
            return;
        }
        const bytes = await getBytes(ref(storage, attachment.storagePath), 32 * 1024 * 1024 + 1024);
        if (!mount.active()) return;
        const clear = mount.readOnly
            ? await decryptReceivedPrivateAttachment({
                ownerUid: mount.ownerId,
                accountId: mount.accountId,
                attachment,
                recipientUid: mount.currentUid,
                vaultKeyMaterial: vaultKey,
                ciphertext: bytes
            })
            : await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!mount.active()) return;
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        if (!mount.active()) return;
        logError('OpenEncryptedAttachment', error);
        const pending = ['SHARED_ATTACHMENT_KEY_PENDING', 'SHARING_IDENTITY_NOT_PERSISTED',
            'SHARING_PUBLIC_IDENTITY_MISSING'].includes(error?.message);
        const unsupported = error?.message === 'ATTACHMENT_LARGE_PREVIEW_UNSUPPORTED';
        showToast(pending
            ? 'Allegato in preparazione: aggiorna entrambi i dispositivi e fai riaprire il Memorandum al proprietario.'
            : unsupported
                ? 'Questo browser non supporta ancora l’apertura sicura dei video grandi.'
                : 'Impossibile aprire l’allegato cifrato.', pending || unsupported ? 'warning' : 'error');
    }
}

async function deleteAttachment(attachment, mount = mounted) {
    if (!mount?.active() || mount.readOnly) return;
    const {ownerId, accountId} = mount;
    const confirmAction = mount.confirm;
    const {id, name, storagePath} = attachment;
    if (!navigator.onLine) {
        await confirmAction(
            'CONNESSIONE NECESSARIA',
            'Per eliminare un allegato devi essere online. Il file resta conservato.'
        );
        return;
    }
    const confirmed = await confirmAction(
        'ELIMINA',
        `Sei sicuro di voler eliminare l'allegato ${name}?`,
        'Elimina',
        t('cancel') || 'Annulla'
    );
    if (!mount.active() || !confirmed) return;

    try {
        const storagePaths = attachment?.encryption?.chunked === true && Array.isArray(attachment?.chunks)
            ? attachment.chunks.map(chunk => chunk.storagePath).filter(Boolean)
            : [storagePath].filter(Boolean);
        const deleted = await Promise.allSettled(storagePaths.map(path => deleteObject(ref(storage, path))));
        if (deleted.some(result => result.status === 'rejected')) throw new Error('ATTACHMENT_STORAGE_DELETE_FAILED');
        if (!mount.active()) return;
        await deleteDoc(doc(db, 'users', ownerId, 'accounts', accountId, 'attachments', id));
        if (!mount.active()) return;
        showToast('Allegato eliminato', 'success');
        await loadPrivateAttachments(mount);
    } catch (error) {
        if (!mount.active()) return;
        logError('DeleteAttachment', error);
        showToast('Errore durante l’eliminazione', 'error');
    }
}
