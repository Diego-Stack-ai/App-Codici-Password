/**
 * DETTAGLIO ACCOUNT AZIENDA — ATTACHMENTS MODULE (V1.0)
 * Gestione allegati (upload, visualizzazione, eliminazione) per account aziendali.
 * Estratto da dettaglio_account_azienda.js per ridurre la complessità del modulo principale.
 * Init: initAttachmentModule(ctx)
 */

import { db, storage } from '../../firebase-config.js?v=1.2.203';
import { doc, collection, addDoc, deleteDoc, serverTimestamp } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, deleteObject, getBytes } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile, openDecryptedAttachment, openExternalUrl, validateAttachmentFile } from '../shared/attachment-security.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { listCompanyAccountAttachments } from '../data/vault-repository.js';
import {decryptReceivedCompanyAttachment, syncCompanyAttachmentAccess} from '../shared/shared-attachment-access.js';
import {editImageBeforeUpload} from '../shared/image-crop-editor.js';
import {closeAttachmentSourcePicker, selectAttachmentSource} from '../shared/attachment-source-picker.js';
import {captureCardAttachment as captureGuidedCard} from '../shared/card-attachment-capture.js';

// --- STATE (inizializzato da initAttachmentModule, immutabile per tutta la vita della pagina) ---
let _ownerUid = null;
let _currentUid = null;
let _currentAziendaId = null;
let _currentId = null;
let _account = null;
let _readOnly = false;
let _active = () => true, _version = 0, _confirm = showConfirmModal;
let _previewUrls = [];

function clearPreviewUrls() {
    _previewUrls.forEach(url => URL.revokeObjectURL(url));
    _previewUrls = [];
}

/**
 * Inizializza il modulo con il contesto dell'account corrente.
 * Va chiamato in initDettaglioAccountAzienda dopo aver impostato lo stato.
 */
export function initAttachmentModule({ ownerUid, currentUid, currentAziendaId, currentId, account,
    readOnly = false, isActive = () => true, signal, confirm: confirmAction = showConfirmModal }) {
    closeAttachmentSourcePicker();
    clearPreviewUrls();
    _confirm = confirmAction;
    const version = ++_version;
    _active = () => version === _version && !signal?.aborted && isActive();
    _ownerUid = ownerUid;
    _currentUid = currentUid;
    _currentAziendaId = currentAziendaId;
    _currentId = currentId;
    _account = account;
    _readOnly = readOnly;
}

export async function openSourceSelector() {
    if (!_active() || _readOnly) return;
    const source = await selectAttachmentSource();
    if (!_active() || !source) return;
    if (source === 'card') return captureCardAttachment();
    document.getElementById({camera:'input-camera',gallery:'input-gallery',document:'input-file'}[source])?.click();
}

export function closeSourceSelector() {
    closeAttachmentSourcePicker();
    document.body.style.overflow = '';
}

export async function handleFileUpload(input, {initialMode = 'free', skipImageEditor = false} = {}) {
    const active = _active, confirmAction = _confirm;
    if (!active()) return;
    const owner = _ownerUid, company = _currentAziendaId, account = _currentId;
    closeSourceSelector();

    if (_readOnly) {
        if (input) input.value = '';
        showToast('Gli allegati condivisi sono disponibili in sola lettura.', 'warning');
        return;
    }

    let file = input.files[0];
    if (!file) return;
    try { validateAttachmentFile(file); } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
        return;
    }
    if (file.type.startsWith('image/') && !skipImageEditor) {
        file = await editImageBeforeUpload(file, {initialMode});
        if (!file || !active()) {input.value = ''; return;}
    }

    // Feedback immediato per mobile
    showToast(`File selezionato: ${file.name}`, 'info');

    // Piccolo delay per permettere alla UI mobile di stabilizzarsi dopo chiusura picker/modal
    await new Promise(r => setTimeout(r, 800));

    if (!active()) return;
    const ok = await confirmAction("CARICA ALLEGATO", `Vuoi caricare il file ${file.name}?`, "Carica", t('cancel') || "Annulla");
    if (!active()) return;
    if (!ok) {
        input.value = '';
        return;
    }

    showToast("Caricamento in corso...", "info");

    try {
        const storagePath = `users/${owner}/aziende/${company}/accounts/${account}/attachments/${createStorageObjectName(file)}`;
        const sRef = ref(storage, storagePath);
        const vaultKey = await ensureVaultKeyMaterial();
        if (!active()) return;
        const encryptedFile = await encryptAttachmentFile(file, vaultKey);
        if (!active()) return;
        await uploadBytes(sRef, encryptedFile.blob, {
            contentType: 'application/octet-stream', customMetadata: { encrypted: 'v1' }
        });
        if (!active()) return;
        const colRef = collection(db, "users", owner, "aziende", company, "accounts", account, "attachments");
        await addDoc(colRef, {
            name: file.name,
            storagePath: storagePath,
            type: file.type || 'application/octet-stream',
            size: file.size,
            encryption: encryptedFile.metadata,
            createdAt: serverTimestamp()
        });

        if (!active()) return;
        showToast("Allegato caricato!", "success");
        await loadAttachments();
    } catch (e) {
        if (!active()) return;
        logError("UploadAttachment", e);
        showToast("Errore durante il caricamento", "error");
    } finally {
        input.value = '';
    }
}

export async function captureCardAttachment() {
    closeSourceSelector();
    const askFallback = _confirm;
    const file = await captureGuidedCard({
        fallbackInput: document.getElementById('input-camera'),
        confirmFallback: (...args) => askFallback(...args)
    });
    if (file && _active()) await handleFileUpload({files: [file], value: ''}, {skipImageEditor: true});
}

export async function loadAttachments() {
    const active = _active;
    if (!active()) return;
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const attachments = await listCompanyAccountAttachments(
            _ownerUid, _currentAziendaId, _currentId, _readOnly ? _currentUid : ''
        );
        const hasAcceptedRecipients = Object.values(_account?.sharedWith || {})
            .some(item => item?.status === 'accepted' && item?.uid);
        if (!_readOnly && attachments.length && hasAcceptedRecipients) {
            const vaultKeyMaterial = await ensureVaultKeyMaterial();
            if (!active()) return;
            const outcome = await syncCompanyAttachmentAccess({
                ownerUid: _ownerUid, companyId: _currentAziendaId, accountId: _currentId,
                account: _account, attachments, vaultKeyMaterial
            });
            if (outcome.waiting && active()) {
                showToast('Alcuni destinatari devono aggiornare l’app prima di ricevere gli allegati.', 'info');
            }
        }
        if (!active()) return;
        renderAttachments(attachments, active);
    } catch (e) {
        if (!active()) return;
        logError("LoadAttachments", e);
    }
}

function renderAttachments(list, active = _active) {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    clearPreviewUrls();
    clearElement(container);

    if (list.length === 0) {
        container.appendChild(createElement('p', {
            className: 'text-[10px] text-white/20 uppercase text-center py-4',
            textContent: 'Nessun allegato'
        }));
        return;
    }

    const imagePreviews = [];
    const items = list.map(a => {
        const type = (a.type || "").toLowerCase();
        let icon = 'description';
        let color = 'text-blue-400/40';

        if (type.includes('image')) { icon = 'image'; color = 'text-purple-400/40'; }
        else if (type.includes('video')) { icon = 'movie'; color = 'text-pink-400/40'; }
        else if (type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-400/40'; }

        const date = a.createdAt?.toDate
            ? a.createdAt.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
            : '---';
        const size = (a.size / (1024 * 1024)).toFixed(2);

        const preview = type.includes('image') ? createElement('div', {
            className: 'attachment-preview attachment-preview-loading',
            textContent: 'Caricamento anteprima…'
        }) : null;
        if (preview) imagePreviews.push({attachment: a, preview});
        return createElement('div', {
            className: 'attachment-item attachment-item-visible animate-in slide-in-from-left-2'
        }, [
            createElement('div', {
                className: 'attachment-info cursor-pointer',
                onclick: () => { if (active()) openAttachment(a); }
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: a.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            preview,
            !_readOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: (e) => { e.stopPropagation(); if (active()) deleteAttachment(a); }
            }, [
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'delete' })
            ]) : null
        ]);
    });

    setChildren(container, items);
    imagePreviews.forEach(item => loadVisibleImagePreview(item.attachment, item.preview, active));
}

async function loadVisibleImagePreview(attachment, preview, active = _active) {
    if (!active() || !attachment.storagePath || !attachment.encryption) return;
    try {
        const vaultKey = await ensureVaultKeyMaterial();
        if (!active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 32 * 1024 * 1024 + 1024);
        if (!active()) return;
        const clear = _readOnly
            ? await decryptReceivedCompanyAttachment({ownerUid: _ownerUid, companyId: _currentAziendaId,
                accountId: _currentId, attachment, recipientUid: _currentUid,
                vaultKeyMaterial: vaultKey, ciphertext: bytes})
            : await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!active()) {clear?.fill?.(0); return;}
        const type = attachment.encryption?.originalType || attachment.type || 'image/jpeg';
        const objectUrl = URL.createObjectURL(new Blob([clear], {type}));
        clear?.fill?.(0);
        _previewUrls.push(objectUrl);
        const image = createElement('img', {className: 'attachment-preview-image', src: objectUrl,
            alt: `Anteprima ${attachment.name || 'allegato'}`});
        image.onclick = () => openAttachment(attachment);
        setChildren(preview, [image]);
        preview.classList.remove('attachment-preview-loading');
    } catch (error) {
        if (!active()) return;
        preview.textContent = 'Anteprima non disponibile';
        preview.classList.remove('attachment-preview-loading');
        preview.classList.add('attachment-preview-unavailable');
        logError('LoadAttachmentPreview', error);
    }
}

async function openAttachment(attachment) {
    const active = _active;
    if (!active()) return;
    try {
        if (!attachment.encryption) {
            if (_readOnly) throw new Error('SHARED_LEGACY_ATTACHMENT_UNSUPPORTED');
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        if (!active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 32 * 1024 * 1024 + 1024);
        if (!active()) return;
        const clear = _readOnly
            ? await decryptReceivedCompanyAttachment({
                ownerUid: _ownerUid, companyId: _currentAziendaId, accountId: _currentId,
                attachment, recipientUid: _currentUid, vaultKeyMaterial: vaultKey, ciphertext: bytes
            })
            : await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!active()) { if (clear?.fill) clear.fill(0); return; }
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        if (!active()) return;
        logError('OpenEncryptedAttachment', error);
        const pending = ['SHARED_ATTACHMENT_KEY_PENDING', 'SHARING_IDENTITY_NOT_PERSISTED',
            'SHARING_PUBLIC_IDENTITY_MISSING'].includes(error?.message);
        showToast(pending
            ? 'Allegato in preparazione: aggiorna entrambi i dispositivi e fai riaprire l’Account al proprietario.'
            : 'Impossibile aprire l’allegato cifrato.', pending ? 'warning' : 'error');
    }
}

async function deleteAttachment(att) {
    const active = _active, confirmAction = _confirm;
    const owner = _ownerUid, company = _currentAziendaId, account = _currentId;
    if (_readOnly) return;
    const ok = await confirmAction("ELIMINA", `Sei sicuro di voler eliminare l'allegato ${att.name}?`, "Elimina", t('cancel') || "Annulla");
    if (!active() || !ok) return;

    try {
        if (att.storagePath) {
            const sRef = ref(storage, att.storagePath);
            await deleteObject(sRef);
        }
        if (!active()) return;
        const docRef = doc(db, "users", owner, "aziende", company, "accounts", account, "attachments", att.id);
        await deleteDoc(docRef);

        if (!active()) return;
        showToast("Allegato eliminato", "success");
        await loadAttachments();
    } catch (e) {
        if (!active()) return;
        logError("DeleteAttachment", e);
        showToast("Errore durante l'eliminazione", "error");
    }
}
