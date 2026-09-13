/**
 * DETTAGLIO ACCOUNT AZIENDA — ATTACHMENTS MODULE (V1.0)
 * Gestione allegati (upload, visualizzazione, eliminazione) per account aziendali.
 * Estratto da dettaglio_account_azienda.js per ridurre la complessità del modulo principale.
 * Init: initAttachmentModule(ctx)
 */

import { db, storage } from '../../firebase-config.js?v=1.2.118';
import { doc, collection, addDoc, deleteDoc, serverTimestamp } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBytes } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile, openDecryptedAttachment, openExternalUrl, validateAttachmentFile } from '../shared/attachment-security.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { listCompanyAccountAttachments } from '../data/vault-repository.js';

// --- STATE (inizializzato da initAttachmentModule, immutabile per tutta la vita della pagina) ---
let _ownerUid = null;
let _currentAziendaId = null;
let _currentId = null;
let _readOnly = false;
let _active = () => true, _version = 0, _confirm = showConfirmModal;

/**
 * Inizializza il modulo con il contesto dell'account corrente.
 * Va chiamato in initDettaglioAccountAzienda dopo aver impostato lo stato.
 */
export function initAttachmentModule({ ownerUid, currentAziendaId, currentId, readOnly = false, isActive = () => true, signal, confirm: confirmAction = showConfirmModal }) {
    _confirm = confirmAction;
    const version = ++_version;
    _active = () => version === _version && !signal?.aborted && isActive();
    _ownerUid = ownerUid;
    _currentAziendaId = currentAziendaId;
    _currentId = currentId;
    _readOnly = readOnly;
}

export function openSourceSelector() {
    if (!_active() || _readOnly) return;
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const active = _active;
        setTimeout(() => { if (active()) modal.classList.add('active'); }, 10);
        document.body.style.overflow = 'hidden';
    }
}

export function closeSourceSelector() {
    const active = _active;
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!active()) return;
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
}

export async function handleFileUpload(input) {
    const active = _active, confirmAction = _confirm;
    if (!active()) return;
    const owner = _ownerUid, company = _currentAziendaId, account = _currentId;
    closeSourceSelector();

    if (_readOnly) {
        if (input) input.value = '';
        showToast('Gli allegati condivisi sono disponibili in sola lettura.', 'warning');
        return;
    }

    const file = input.files[0];
    if (!file) return;
    try { validateAttachmentFile(file); } catch (error) {
        showToast(error.message, 'error');
        input.value = '';
        return;
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
        const snap = await uploadBytes(sRef, encryptedFile.blob, {
            contentType: 'application/octet-stream', customMetadata: { encrypted: 'v1' }
        });
        if (!active()) return;
        const url = await getDownloadURL(snap.ref);

        if (!active()) return;
        const colRef = collection(db, "users", owner, "aziende", company, "accounts", account, "attachments");
        await addDoc(colRef, {
            name: file.name,
            url: url,
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

export async function loadAttachments() {
    const active = _active;
    if (!active()) return;
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const attachments = await listCompanyAccountAttachments(_ownerUid, _currentAziendaId, _currentId);
        if (!active()) return;
        renderAttachments(attachments, active);
    } catch (e) {
        if (!active()) return;
        logError("LoadAttachments", e);
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

        return createElement('div', {
            className: 'attachment-item animate-in slide-in-from-left-2'
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
            !_readOnly ? createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: (e) => { e.stopPropagation(); if (active()) deleteAttachment(a); }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ]) : null
        ]);
    });

    setChildren(container, items);
}

async function openAttachment(attachment) {
    const active = _active;
    if (!active()) return;
    try {
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        if (!active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        if (!active()) return;
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!active()) { if (clear?.fill) clear.fill(0); return; }
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        if (!active()) return;
        logError('OpenEncryptedAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
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
