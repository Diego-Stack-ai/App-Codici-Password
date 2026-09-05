/**
 * MODIFICA AZIENDA MODULE (V6.0 MODULAR)
 * Entry point orchestratore — delega tutto ai moduli ma_*.
 *
 * Architettura:
 *   modifica_azienda.js  (~75r)   ← questo file (orchestratore)
 *   ├── ma_state.js      (~15r)   ← stato condiviso mutabile
 *   ├── ma_attachments.js (~70r)  ← renderAttachments, removeAttachment
 *   ├── ma_cards.js      (~260r)  ← populateForm, addExtraEmail, addExtraSede, createFieldBox
 *   ├── ma_ui.js         (~175r)  ← initFormEvents, toggleSection, openSourceSelector, handleImagePreview
 *   └── ma_save.js       (~155r)  ← saveAzienda, deleteAzienda, resizeImage
 *
 * Il router delle pagine importa questo orchestratore in modo dinamico.
 * modifica_azienda.html carica solo main.js → INVARIATO
 */

import { db } from '../../firebase-config.js?v=1.2.33';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, clearElement, setChildren } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

import { state } from './ma_state.js';
import { populateForm } from './ma_cards.js';
import { updateTitlesForCreation, initFormEvents } from './ma_ui.js';
import { saveAzienda, deleteAzienda } from './ma_save.js';

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────

export async function initModificaAzienda(user) {
    if (!user) return;
    state.currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    state.currentAziendaId = urlParams.get('id');

    initProtocolUI();
    if (state.currentAziendaId) {
        await loadAzienda();
    } else {
        updateTitlesForCreation();
    }
    initFormEvents();
}

// ─── PROTOCOL UI (footer buttons) ─────────────────────────────────────────────

function initProtocolUI() {
    // Footer Center — Pulsante Delete (solo in modalità modifica)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        if (state.currentAziendaId) {
            setChildren(fCenter, createElement('button', {
                id: 'btn-delete',
                className: 'footer-action-btn btn-danger',
                onclick: deleteAzienda
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete_forever' })
            ]));
        }
    }

    // Footer Right — Pulsante Save
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('button', {
            id: 'btn-save',
            className: 'footer-action-btn btn-primary',
            onclick: saveAzienda
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]));
    }
}

// ─── LOAD AZIENDA ─────────────────────────────────────────────────────────────

async function loadAzienda() {
    try {
        const docRef = doc(db, "users", state.currentUid, "aziende", state.currentAziendaId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            showToast(t('error_not_found'), "error");
            return;
        }
        await populateForm(snap.data());
    } catch (e) {
        logError("LoadAzienda", e);
        showToast(t('error_generic'), "error");
    }
}
