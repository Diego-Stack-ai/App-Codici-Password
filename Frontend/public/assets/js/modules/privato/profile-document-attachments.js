import {functions, db, storage} from '../../firebase-config.js';
import {collection, getDocsFromServer, query, where, getBytes, ref, httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showToast, showConfirmModal} from '../../ui-core-v129.js';
import {encryptAttachmentFile, decryptAttachmentBytes, openDecryptedAttachment, validateAttachmentFile} from '../shared/attachment-security.js';
import {createAttachmentSourceGrid} from '../shared/attachment-source-picker.js';
import {captureCardAttachment, consumeAttachmentInitialMode} from '../shared/card-attachment-capture.js';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_PER_DOCUMENT = 10;
let activeDialog = null;
let inlineObjectUrls = [];

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

function attachmentDate(value) {
    const date = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : '---';
}

function closeActiveDialog() {
    if (!activeDialog) return;
    activeDialog.remove();
    activeDialog = null;
}

function clearInlineObjectUrls() {
    inlineObjectUrls.forEach(url => URL.revokeObjectURL(url));
    inlineObjectUrls = [];
}

async function openStoredAttachment(attachment, name, vaultKey) {
    const ciphertext = await getBytes(ref(storage, attachment.storagePath), MAX_BYTES + 1024);
    const clear = await decryptAttachmentBytes(ciphertext, attachment.encryption, vaultKey);
    openDecryptedAttachment(clear, {name, type: attachment.mimeType, encryption: attachment.encryption});
}

export async function renderProfileDocumentAttachmentPreviews({uid, documentItems, vaultKey, decryptName}) {
    const renderOptions = {uid, documentItems, vaultKey, decryptName};
    clearInlineObjectUrls();
    const documents = new Map((documentItems || []).filter(item => item?.id).map(item => [item.id, item]));
    for (const container of document.querySelectorAll('[data-profile-document-attachments-inline]')) {
        clearElement(container);
        container.classList.add('profile-document-inline-loading');
        container.textContent = 'Caricamento allegati…';
    }
    if (!uid || !vaultKey || !documents.size) return;

    const snapshot = await getDocsFromServer(collection(db, 'users', uid, 'profileDocumentAttachments'));
    const grouped = new Map();
    for (const entry of snapshot.docs) {
        const attachment = {id: entry.id, ...entry.data()};
        if (attachment.status !== 'ready' || !documents.has(attachment.documentId)) continue;
        if (!grouped.has(attachment.documentId)) grouped.set(attachment.documentId, []);
        grouped.get(attachment.documentId).push(attachment);
    }

    for (const [documentId] of documents) {
        const container = document.querySelector(`[data-profile-document-attachments-inline="${CSS.escape(documentId)}"]`);
        if (!container) continue;
        container.classList.remove('profile-document-inline-loading');
        clearElement(container);
        const attachments = grouped.get(documentId) || [];
        if (!attachments.length) continue;
        container.append(createElement('div', {className: 'profile-document-inline-heading'}, [
            createElement('span', {className: 'material-symbols-outlined notranslate', textContent: 'attach_file'}),
            createElement('span', {textContent: attachments.length === 1 ? '1 allegato' : `${attachments.length} allegati`})
        ]));
        const gallery = createElement('div', {className: 'profile-document-inline-gallery'});
        container.append(gallery);
        for (const attachment of attachments) {
            let name = friendlyType(attachment.mimeType);
            try { name = await decryptName(attachment.encryptedName); } catch {}
            const isImage = String(attachment.mimeType || '').startsWith('image/');
            const item = createElement('button', {
                type: 'button',
                className: `profile-document-inline-item ${isImage ? 'is-image' : 'is-file'}`,
                title: `Apri ${name}`
            });
            item.onclick = async () => {
                item.disabled = true;
                try { await openStoredAttachment(attachment, name, vaultKey); }
                catch (error) { showToast(error.message || 'Apertura allegato non riuscita.', 'error'); }
                finally { item.disabled = false; }
            };
            if (isImage) {
                try {
                    const ciphertext = await getBytes(ref(storage, attachment.storagePath), MAX_BYTES + 1024);
                    const clear = await decryptAttachmentBytes(ciphertext, attachment.encryption, vaultKey);
                    const url = URL.createObjectURL(new Blob([clear], {type: attachment.mimeType || 'image/jpeg'}));
                    inlineObjectUrls.push(url);
                    item.append(createElement('img', {src: url, alt: name, className: 'profile-document-inline-image'}));
                } catch {
                    item.append(createElement('span', {className: 'material-symbols-outlined notranslate', textContent: 'broken_image'}));
                }
            } else {
                item.append(
                    createElement('span', {className: 'material-symbols-outlined notranslate', textContent: 'picture_as_pdf'}),
                    createElement('span', {className: 'profile-document-inline-name', textContent: name})
                );
            }
            const details = createElement('div', {className: 'profile-document-inline-meta'}, [
                createElement('span', {className: 'profile-document-inline-name', textContent: name}),
                createElement('span', {
                    className: 'profile-document-inline-status',
                    textContent: `${(Number(attachment.size || 0) / 1024 / 1024).toFixed(2)} MB · ${attachmentDate(attachment.readyAt || attachment.createdAt)}`
                })
            ]);
            const remove = createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment profile-document-inline-delete',
                title: `Elimina ${name}`,
                ariaLabel: `Elimina ${name}`
            }, [createElement('span', {className: 'material-symbols-outlined notranslate', textContent: 'delete'})]);
            remove.onclick = async event => {
                event.stopPropagation();
                if (!await showConfirmModal('Elimina allegato', `Eliminare “${name}”? Il documento rimarrà disponibile.`)) return;
                remove.disabled = true;
                try {
                    await httpsCallable(functions, 'removeProfileDocumentAttachment')({attachmentId: attachment.id});
                    showToast('Allegato eliminato.', 'success');
                    await renderProfileDocumentAttachmentPreviews(renderOptions);
                } catch (error) {
                    remove.disabled = false;
                    showToast(error.message || 'Eliminazione non riuscita.', 'error');
                }
            };
            gallery.append(createElement('article', {className: 'profile-document-inline-card'}, [
                item,
                createElement('div', {className: 'profile-document-inline-footer'}, [details, remove])
            ]));
        }
    }
}

export async function openProfileDocumentAttachments({uid, documentItem, vaultKey, encryptName, onChanged}) {
    if (!uid || !documentItem?.id || !vaultKey) throw new Error('Allegati non disponibili: documento o Vault non valido.');
    closeActiveDialog();
    const overlay = createElement('div', {className: 'profile-document-attachments-overlay'});
    const dialog = createElement('section', {className: 'profile-document-attachments-dialog', role: 'dialog', ariaModal: 'true'});
    const title = createElement('h2', {className: 'profile-document-attachments-title', textContent: `Allegati · ${documentItem.type || 'Documento'}`});
    const status = createElement('p', {className: 'profile-document-attachments-status', ariaLive: 'polite'});
    const close = createElement('button', {type: 'button', className: 'btn-edit-section', title: 'Chiudi', onclick: closeActiveDialog}, [
        createElement('span', {className: 'material-symbols-outlined notranslate', textContent: 'close'})
    ]);
    const header = createElement('div', {className: 'card-header-row'}, [title, close]);
    const photoInput = createElement('input', {type: 'file', accept: 'image/*', capture: 'environment', className: 'hidden'});
    const cardFallbackInput = createElement('input', {type: 'file', accept: 'image/*', capture: 'environment', className: 'hidden'});
    const galleryInput = createElement('input', {type: 'file', accept: 'image/*,video/*', multiple: true, className: 'hidden'});
    const documentInput = createElement('input', {type: 'file', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt', multiple: true, className: 'hidden'});
    const sourceGrid = createAttachmentSourceGrid(async source => {
        if (busy || atLimit || activeDialog !== overlay) return;
        if (source === 'card') await captureCard();
        else if (source === 'camera') photoInput.click();
        else if (source === 'gallery') galleryInput.click();
        else if (source === 'document') documentInput.click();
    });
    const uploadButtons = [...sourceGrid.querySelectorAll('button')];
    const actions = createElement('div', {className: 'profile-document-attachments-actions'}, [
        createElement('h3', {textContent: 'Seleziona sorgente'}),
        sourceGrid,
        photoInput, cardFallbackInput, galleryInput, documentInput
    ]);
    setChildren(dialog, [header, actions, status]);
    overlay.append(dialog);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeActiveDialog(); });
    document.body.append(overlay);
    activeDialog = overlay;

    let busy = false;
    let atLimit = false;
    const setBusy = value => {
        busy = value;
        uploadButtons.forEach(button => { button.disabled = value || atLimit; });
        close.disabled = value;
    };

    async function load() {
        const snapshot = await getDocsFromServer(query(collection(db, 'users', uid, 'profileDocumentAttachments'), where('documentId', '==', documentItem.id)));
        const attachments = snapshot.docs.map(entry => ({id: entry.id, ...entry.data()}))
            .filter(entry => entry.status === 'ready');
        status.textContent = `${attachments.length}/${MAX_PER_DOCUMENT} allegati.`;
        atLimit = attachments.length >= MAX_PER_DOCUMENT;
        uploadButtons.forEach(button => { button.disabled = busy || atLimit; });
    }

    async function uploadFiles(files, {initialMode = 'free', skipImageEditor = false} = {}) {
        if (busy || !files.length) return;
        setBusy(true);
        try {
            for (const selectedFile of files) {
                let file = selectedFile;
                validateAttachmentFile(file, {maxBytes: MAX_BYTES});
                if (file.type.startsWith('image/') && !skipImageEditor) {
                    const {editImageBeforeUpload} = await import('../shared/image-crop-editor.js');
                    file = await editImageBeforeUpload(file, {initialMode});
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
            await onChanged?.();
        } catch (error) {
            status.textContent = 'Caricamento non riuscito.';
            showToast(error.message || 'Caricamento non riuscito.', 'error');
        } finally {
            photoInput.value = '';
            cardFallbackInput.value = '';
            galleryInput.value = '';
            documentInput.value = '';
            setBusy(false);
        }
    }
    photoInput.onchange = () => uploadFiles([...photoInput.files]);
    cardFallbackInput.onchange = () => uploadFiles([...cardFallbackInput.files], {
        initialMode: consumeAttachmentInitialMode(cardFallbackInput)
    });
    galleryInput.onchange = () => uploadFiles([...galleryInput.files]);
    documentInput.onchange = () => uploadFiles([...documentInput.files]);
    const captureCard = async () => {
        if (busy || atLimit) return;
        const file = await captureCardAttachment({fallbackInput: cardFallbackInput, confirmFallback: showConfirmModal});
        if (file && activeDialog === overlay) await uploadFiles([file], {skipImageEditor: true});
    };
    await load();
}

export function closeProfileDocumentAttachments() {
    closeActiveDialog();
}
