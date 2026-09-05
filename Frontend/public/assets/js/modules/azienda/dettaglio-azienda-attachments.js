/**
 * DETTAGLIO ACCOUNT AZIENDA — ATTACHMENTS MODULE (V1.0)
 * Gestione allegati (upload, visualizzazione, eliminazione) per account aziendali.
 * Estratto da dettaglio_account_azienda.js per ridurre la complessità del modulo principale.
 * Init: initAttachmentModule(ctx)
 */

import { db, storage } from '../../firebase-config.js?v=1.2.35';
import {
    doc, collection, addDoc, query, orderBy, getDocs, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject, getBytes
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { createStorageObjectName, decryptAttachmentBytes, encryptAttachmentFile, openDecryptedAttachment, openExternalUrl, validateAttachmentFile } from '../shared/attachment-security.js';
import { ensureMasterKey } from '../core/security-manager.js';

// --- STATE (inizializzato da initAttachmentModule, immutabile per tutta la vita della pagina) ---
let _currentUid = null;
let _currentAziendaId = null;
let _currentId = null;

/**
 * Inizializza il modulo con il contesto dell'account corrente.
 * Va chiamato in initDettaglioAccountAzienda dopo aver impostato lo stato.
 */
export function initAttachmentModule({ currentUid, currentAziendaId, currentId }) {
    _currentUid = currentUid;
    _currentAziendaId = currentAziendaId;
    _currentId = currentId;
}

export function openSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
    }
}

export function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    }
}

export async function handleFileUpload(input) {
    closeSourceSelector();

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

    const ok = await showConfirmModal("CARICA ALLEGATO", `Vuoi caricare il file ${file.name}?`, "Carica", t('cancel') || "Annulla");
    if (!ok) {
        input.value = '';
        return;
    }

    showToast("Caricamento in corso...", "info");

    try {
        const storagePath = `users/${_currentUid}/aziende/${_currentAziendaId}/accounts/${_currentId}/attachments/${createStorageObjectName(file)}`;
        const sRef = ref(storage, storagePath);
        const vaultKey = await ensureMasterKey();
        const encryptedFile = await encryptAttachmentFile(file, vaultKey);
        const snap = await uploadBytes(sRef, encryptedFile.blob, {
            contentType: 'application/octet-stream', customMetadata: { encrypted: 'v1' }
        });
        const url = await getDownloadURL(snap.ref);

        const colRef = collection(db, "users", _currentUid, "aziende", _currentAziendaId, "accounts", _currentId, "attachments");
        await addDoc(colRef, {
            name: file.name,
            url: url,
            storagePath: storagePath,
            type: file.type || 'application/octet-stream',
            size: file.size,
            encryption: encryptedFile.metadata,
            createdAt: serverTimestamp()
        });

        showToast("Allegato caricato!", "success");
        await loadAttachments();
    } catch (e) {
        logError("UploadAttachment", e);
        showToast("Errore durante il caricamento", "error");
    } finally {
        input.value = '';
    }
}

export async function loadAttachments() {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    try {
        const colRef = collection(db, "users", _currentUid, "aziende", _currentAziendaId, "accounts", _currentId, "attachments");
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);

        const attachments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAttachments(attachments);
    } catch (e) {
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
                onclick: () => openAttachment(a)
            }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: a.name }),
                    createElement('span', { className: 'attachment-status', textContent: `${size} MB • ${date}` })
                ])
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: (e) => { e.stopPropagation(); deleteAttachment(a); }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ])
        ]);
    });

    setChildren(container, items);
}

async function openAttachment(attachment) {
    try {
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureMasterKey();
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        logError('OpenEncryptedAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    }
}

async function deleteAttachment(att) {
    const ok = await showConfirmModal("ELIMINA", `Sei sicuro di voler eliminare l'allegato ${att.name}?`, "Elimina", t('cancel') || "Annulla");
    if (!ok) return;

    try {
        if (att.storagePath) {
            const sRef = ref(storage, att.storagePath);
            await deleteObject(sRef);
        }
        const docRef = doc(db, "users", _currentUid, "aziende", _currentAziendaId, "accounts", _currentId, "attachments", att.id);
        await deleteDoc(docRef);

        showToast("Allegato eliminato", "success");
        await loadAttachments();
    } catch (e) {
        logError("DeleteAttachment", e);
        showToast("Errore durante l'eliminazione", "error");
    }
}
