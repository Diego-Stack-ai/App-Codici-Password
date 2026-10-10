import {functions, db, storage} from '../../firebase-config.js';
import {collection, getDocsFromServer, query, where, getBytes, ref, httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showToast, showConfirmModal} from '../../ui-core-v129.js';
import {encryptAttachmentFile, decryptAttachmentBytes, openDecryptedAttachment, validateAttachmentFile} from '../shared/attachment-security.js';
import {editImageBeforeUpload} from '../shared/image-crop-editor.js';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_DOCUMENT = 10;
let activeDialog = null;

function bytesToBase64(value) {
    let binary = '';
    const bytes = new Uint8Array(value);
    for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
}

function attachmentId() {
    return typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replaceAll('-', '_')
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function friendlyType(type) {
    if (type === 'application/pdf') return 'PDF';
    if (String(type).startsWith('image/')) return 'Immagine';
    return 'Allegato';
}

function closeActiveDialog() {
    if (!activeDialog) return;
    activeDialog.remove();
    activeDialog = null;
}

export async function openProfileDocumentAttachments({uid, documentItem, vaultKey, encryptName, decryptName}) {
    if (!uid || !documentItem?.id || !vaultKey) throw new Error('Allegati non disponibili: documento o Vault non valido.');
    closeActiveDialog();
    const overlay = createElement('div', {className: 'profile-document-attachments-overlay'});
    const dialog = createElement('section', {className: 'profile-document-attachments-dialog', role: 'dialog', ariaModal: 'true'});
    const title = createElement('h2', {className: 'profile-document-attachments-title', textContent: `Allegati · ${documentItem.type || 'Documento'}`});
    const status = createElement('p', {className: 'profile-document-attachments-status', ariaLive: 'polite'});
    const list = createElement('div', {className: 'profile-document-attachments-list'});
    const close = createElement('button', {type: 'button', className: 'btn-edit-section', title: 'Chiudi', onclick: closeActiveDialog}, [
        createElement('span', {className: 'material-symbols-outlined', textContent: 'close'})
    ]);
    const header = createElement('div', {className: 'card-header-row'}, [title, close]);
    const photoInput = createElement('input', {type: 'file', accept: 'image/*', capture: 'environment', className: 'hidden'});
    const fileInput = createElement('input', {type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf', multiple: true, className: 'hidden'});
    const photoButton = createElement('button', {type: 'button', className: 'btn-upload-trigger'}, [
        createElement('span', {className: 'material-symbols-outlined', textContent: 'photo_camera'}),
        createElement('span', {textContent: 'Scatta foto'})
    ]);
    const fileButton = createElement('button', {type: 'button', className: 'btn-upload-trigger'}, [
        createElement('span', {className: 'material-symbols-outlined', textContent: 'attach_file'}),
        createElement('span', {textContent: 'Scegli foto o PDF'})
    ]);
    photoButton.onclick = () => photoInput.click();
    fileButton.onclick = () => fileInput.click();
    const actions = createElement('div', {className: 'profile-document-attachments-actions'}, [photoButton, fileButton, photoInput, fileInput]);
    setChildren(dialog, [header, actions, status, list]);
    overlay.append(dialog);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeActiveDialog(); });
    document.body.append(overlay);
    activeDialog = overlay;

    let busy = false;
    let atLimit = false;
    const setBusy = value => {
        busy = value;
        photoButton.disabled = value || atLimit;
        fileButton.disabled = value || atLimit;
        close.disabled = value;
    };

    async function load() {
        status.textContent = 'Caricamento allegati…';
        const snapshot = await getDocsFromServer(query(collection(db, 'users', uid, 'profileDocumentAttachments'), where('documentId', '==', documentItem.id)));
        const attachments = snapshot.docs.map(entry => ({id: entry.id, ...entry.data()}))
            .filter(entry => entry.status === 'ready');
        clearElement(list);
        if (!attachments.length) {
            list.append(createElement('p', {className: 'card-no-data', textContent: 'Nessun allegato per questo documento.'}));
        }
        for (const attachment of attachments) {
            let name = friendlyType(attachment.mimeType);
            try { name = await decryptName(attachment.encryptedName); } catch {}
            const open = createElement('button', {type: 'button', className: 'btn-upload-trigger', textContent: 'Apri'});
            const remove = createElement('button', {type: 'button', className: 'btn-upload-trigger btn-delete', textContent: 'Elimina'});
            const row = createElement('div', {className: 'profile-document-attachment-row'}, [
                createElement('div', {className: 'attachment-meta'}, [
                    createElement('span', {className: 'attachment-name', textContent: name}),
                    createElement('span', {className: 'attachment-status', textContent: `${friendlyType(attachment.mimeType)} · ${(attachment.size / 1024 / 1024).toFixed(2)} MB`})
                ]), open, remove
            ]);
            open.onclick = async () => {
                if (busy) return;
                setBusy(true);
                status.textContent = 'Apertura allegato…';
                try {
                    const ciphertext = await getBytes(ref(storage, attachment.storagePath), MAX_BYTES + 1024);
                    const clear = await decryptAttachmentBytes(ciphertext, attachment.encryption, vaultKey);
                    openDecryptedAttachment(clear, {name, type: attachment.mimeType, encryption: attachment.encryption});
                    status.textContent = 'Allegato aperto.';
                } catch (error) {
                    status.textContent = 'Impossibile aprire l’allegato.';
                    showToast(error.message || 'Apertura allegato non riuscita.', 'error');
                } finally { setBusy(false); }
            };
            remove.onclick = async () => {
                if (busy || !await showConfirmModal('Elimina allegato', `Eliminare “${name}”? Il documento rimarrà disponibile.`)) return;
                setBusy(true);
                try {
                    await httpsCallable(functions, 'removeProfileDocumentAttachment')({attachmentId: attachment.id});
                    status.textContent = 'Allegato eliminato.';
                    await load();
                } catch (error) {
                    showToast(error.message || 'Eliminazione non riuscita.', 'error');
                } finally { setBusy(false); }
            };
            list.append(row);
        }
        status.textContent = `${attachments.length}/${MAX_PER_DOCUMENT} allegati.`;
        atLimit = attachments.length >= MAX_PER_DOCUMENT;
        photoButton.disabled = busy || atLimit;
        fileButton.disabled = busy || atLimit;
    }

    async function uploadFiles(files) {
        if (busy || !files.length) return;
        setBusy(true);
        try {
            for (const selectedFile of files) {
                let file = selectedFile;
                validateAttachmentFile(file, {maxBytes: MAX_BYTES});
                if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) throw new Error('Sono ammesse solo immagini e PDF.');
                if (file.type.startsWith('image/')) {
                    file = await editImageBeforeUpload(file);
                    if (!file) continue;
                    validateAttachmentFile(file, {maxBytes: MAX_BYTES});
                }
                status.textContent = `Cifratura di ${file.name || 'allegato'}…`;
                const id = attachmentId();
                const encrypted = await encryptAttachmentFile(file, vaultKey);
                const payloadBase64 = bytesToBase64(await encrypted.blob.arrayBuffer());
                await httpsCallable(functions, 'uploadProfileDocumentAttachment')({
                    documentId: documentItem.id,
                    attachmentId: id,
                    storagePath: `users/${uid}/profile-documents/${documentItem.id}/attachments/${id}`,
                    mimeType: file.type,
                    size: file.size,
                    encryptedName: await encryptName(file.name || friendlyType(file.type)),
                    encryption: encrypted.metadata,
                    payloadBase64
                });
            }
            showToast('Allegato salvato.', 'success');
            await load();
        } catch (error) {
            status.textContent = 'Caricamento non riuscito.';
            showToast(error.message || 'Caricamento non riuscito.', 'error');
        } finally {
            photoInput.value = '';
            fileInput.value = '';
            setBusy(false);
        }
    }
    photoInput.onchange = () => uploadFiles([...photoInput.files]);
    fileInput.onchange = () => uploadFiles([...fileInput.files]);
    await load();
}

export function closeProfileDocumentAttachments() {
    closeActiveDialog();
}
