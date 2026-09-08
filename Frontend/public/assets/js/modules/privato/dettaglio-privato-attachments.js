/**
 * Gestione allegati del dettaglio Account privato.
 * Il contesto viene inizializzato una sola volta dalla pagina principale.
 */

import { db, storage } from '../../firebase-config.js?v=1.2.63';
import { doc, collection, addDoc, deleteDoc, serverTimestamp } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile, openDecryptedAttachment, openExternalUrl, validateAttachmentFile } from '../shared/attachment-security.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { listPrivateAccountAttachments } from '../data/vault-repository.js';

let ownerId = null;
let accountId = null;
let readOnly = true;
let initialized = false;

export function initPrivateAttachmentModule(context) {
    ownerId = context.ownerId;
    accountId = context.accountId;
    readOnly = Boolean(context.readOnly);

    if (initialized) return;
    initialized = true;

    const modal = document.getElementById('source-selector-modal');
    document.getElementById('btn-cancel-source')?.addEventListener('click', closeSourceSelector);
    modal?.addEventListener('click', event => {
        if (event.target === modal) closeSourceSelector();
    });

    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('change', () => handleFileUpload(input));
    });
}

export function openSourceSelector() {
    if (readOnly) return;
    const modal = document.getElementById('source-selector-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
}

export function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

export async function handleFileUpload(input) {
    closeSourceSelector();
    if (readOnly) return;

    const file = input.files[0];
    if (!file) return;
    try {
        validateAttachmentFile(file);
    } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
        return;
    }

    showToast(`File selezionato: ${file.name}`, 'info');
    await new Promise(resolve => setTimeout(resolve, 800));

    const confirmed = await showConfirmModal(
        'CARICA ALLEGATO',
        `Vuoi caricare il file ${file.name}?`,
        'Carica',
        t('cancel') || 'Annulla'
    );
    if (!confirmed) {
        input.value = '';
        return;
    }

    showToast('Caricamento in corso...', 'info');
    try {
        const storagePath = `users/${ownerId}/accounts/${accountId}/attachments/${createStorageObjectName(file)}`;
        const storageRef = ref(storage, storagePath);
        const vaultKey = await ensureVaultKeyMaterial();
        const encryptedFile = await encryptAttachmentFile(file, vaultKey);
        const snapshot = await uploadBytes(storageRef, encryptedFile.blob, {
            contentType: 'application/octet-stream',
            customMetadata: { encrypted: 'v1' }
        });
        const url = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, 'users', ownerId, 'accounts', accountId, 'attachments'), {
            name: file.name,
            url,
            storagePath,
            type: file.type || 'application/octet-stream',
            size: file.size,
            encryption: encryptedFile.metadata,
            createdAt: serverTimestamp()
        });

        showToast('Allegato caricato!', 'success');
        await loadPrivateAttachments();
    } catch (error) {
        logError('UploadAttachment', error);
        showToast('Errore durante il caricamento', 'error');
    } finally {
        input.value = '';
    }
}

export async function loadPrivateAttachments() {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        renderAttachments(await listPrivateAccountAttachments(ownerId, accountId));
    } catch (error) {
        logError('LoadAttachments', error);
    }
}

function renderAttachments(list) {
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

        return createElement('div', { className: 'attachment-item animate-in slide-in-from-left-2' }, [
            createElement('div', {
                className: 'attachment-info cursor-pointer',
                onclick: () => openAttachment(attachment)
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: attachment.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            !readOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: event => {
                    event.stopPropagation();
                    deleteAttachment(attachment);
                }
            }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]) : null
        ]);
    }));
}

async function openAttachment(attachment) {
    try {
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        logError('OpenEncryptedAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    }
}

async function deleteAttachment(attachment) {
    if (readOnly) return;
    const confirmed = await showConfirmModal(
        'ELIMINA',
        `Sei sicuro di voler eliminare l'allegato ${attachment.name}?`,
        'Elimina',
        t('cancel') || 'Annulla'
    );
    if (!confirmed) return;

    try {
        if (attachment.storagePath) await deleteObject(ref(storage, attachment.storagePath));
        await deleteDoc(doc(db, 'users', ownerId, 'accounts', accountId, 'attachments', attachment.id));
        showToast('Allegato eliminato', 'success');
        await loadPrivateAttachments();
    } catch (error) {
        logError('DeleteAttachment', error);
        showToast('Errore durante l’eliminazione', 'error');
    }
}
