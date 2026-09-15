/**
 * Gestione allegati del dettaglio Account privato.
 * Il contesto viene inizializzato una sola volta dalla pagina principale.
 */

import { db, storage } from '../../firebase-config.js?v=1.2.127';
import { doc, collection, addDoc, deleteDoc, serverTimestamp } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile, openDecryptedAttachment, openExternalUrl, validateAttachmentFile } from '../shared/attachment-security.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { listPrivateAccountAttachments } from '../data/vault-repository.js';

let mounted = null;

export function initPrivateAttachmentModule(context) {
    mounted?.destroy();
    const modal = document.getElementById('source-selector-modal');
    const cancelButton = document.getElementById('btn-cancel-source');
    let destroyed = false;
    const cleanups = new Set();
    const mount = {ownerId: context.ownerId, accountId: context.accountId, readOnly: Boolean(context.readOnly),
        confirm: context.confirm || showConfirmModal,
        active() {
            if (!destroyed && (mounted !== mount || context.signal?.aborted || (context.isActive && !context.isActive()))) mount.destroy();
            return !destroyed;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            context.signal?.removeEventListener('abort', mount.destroy);
            for (const cleanup of cleanups) cleanup();
            cleanups.clear();
            if (mounted === mount) {
                if (modal) { modal.onclick = null; modal.classList.remove('active'); modal.classList.add('hidden'); }
                if (cancelButton) cancelButton.onclick = null;
                if (document.body) document.body.style.overflow = '';
            }
        },
        later(callback, milliseconds) {
            const timer = setTimeout(() => { cleanups.delete(cancel); if (mount.active()) callback(); }, milliseconds);
            const cancel = () => clearTimeout(timer);
            cleanups.add(cancel);
        }
    };
    mounted = mount;
    context.signal?.addEventListener('abort', mount.destroy, {once: true});
    if (!mount.active()) return mount;
    if (cancelButton) cancelButton.onclick = () => closeSourceSelector(mount);
    if (modal) modal.onclick = event => { if (event.target === modal) closeSourceSelector(mount); };
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        const previous = document.getElementById(id);
        const input = previous?.cloneNode ? previous.cloneNode(true) : previous;
        if (!input) return;
        if (input !== previous) previous.parentNode?.replaceChild(input, previous);
        input.value = '';
        input.onchange = () => handleFileUpload(input, mount);
        cleanups.add(() => { input.value = ''; input.onchange = null; });
    });
    return mount;
}

export function openSourceSelector(mount = mounted) {
    if (!mount?.active() || mount.readOnly) return;
    const modal = document.getElementById('source-selector-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    mount.later(() => modal.classList.add('active'), 10);
    document.body.style.overflow = 'hidden';
}

export function closeSourceSelector(mount = mounted) {
    if (!mount?.active()) return;
    const modal = document.getElementById('source-selector-modal');
    if (!modal) return;
    modal.classList.remove('active');
    mount.later(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

export async function handleFileUpload(input, mount = mounted) {
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

    showToast('Caricamento in corso...', 'info');
    try {
        const storagePath = `users/${ownerId}/accounts/${accountId}/attachments/${createStorageObjectName(file)}`;
        const storageRef = ref(storage, storagePath);
        const vaultKey = await ensureVaultKeyMaterial();
        if (!mount.active()) return;
        const encryptedFile = await encryptAttachmentFile(file, vaultKey);
        if (!mount.active()) return;
        const snapshot = await uploadBytes(storageRef, encryptedFile.blob, {
            contentType: 'application/octet-stream',
            customMetadata: { encrypted: 'v1' }
        });
        if (!mount.active()) return;
        const url = await getDownloadURL(snapshot.ref);
        if (!mount.active()) return;

        await addDoc(collection(db, 'users', ownerId, 'accounts', accountId, 'attachments'), {
            name: file.name,
            url,
            storagePath,
            type: file.type || 'application/octet-stream',
            size: file.size,
            encryption: encryptedFile.metadata,
            createdAt: serverTimestamp()
        });
        if (!mount.active()) return;
        showToast('Allegato caricato!', 'success');
        await loadPrivateAttachments(mount);
    } catch (error) {
        if (!mount.active()) return;
        logError('UploadAttachment', error);
        showToast('Errore durante il caricamento', 'error');
    } finally {
        input.value = '';
    }
}

export async function loadPrivateAttachments(mount = mounted) {
    if (!mount?.active()) return;
    const {ownerId, accountId} = mount;
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const attachments = await listPrivateAccountAttachments(ownerId, accountId);
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
                onclick: () => openAttachment(attachment, mount)
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: attachment.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            !mount.readOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: event => {
                    event.stopPropagation();
                    deleteAttachment(attachment, mount);
                }
            }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]) : null
        ]);
    }));
}

async function openAttachment(attachment, mount = mounted) {
    if (!mount?.active()) return;
    attachment = {...attachment, encryption: attachment.encryption ? {...attachment.encryption} : null};
    try {
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        if (!mount.active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        if (!mount.active()) return;
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!mount.active()) return;
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        if (!mount.active()) return;
        logError('OpenEncryptedAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
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
        if (storagePath) await deleteObject(ref(storage, storagePath));
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
