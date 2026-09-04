/**
 * MA UI (V1.0)
 * Setup UI: toggle sezioni, source selector, anteprima immagini, titoli creazione.
 * Estratto da modifica_azienda.js (righe 91–267 + 101–187).
 *
 * Import graph: ma_state, ma_attachments, ma_cards, translations (nessuna dep circolare)
 */

import { state } from './ma_state.js';
import { renderAttachments } from './ma_attachments.js';
import { addExtraEmail, addExtraSede } from './ma_cards.js';
import { t } from '../../translations.js';

// ─── TITOLI CREAZIONE ─────────────────────────────────────────────────────────

export function updateTitlesForCreation() {
    document.title = (t('new_company') || 'Nuova Azienda') + " - PROTOCOLLO BASE";

    const hTitle = document.querySelector('.hero-title');
    if (hTitle) hTitle.textContent = t('new_company') || 'Nuova Azienda';

    const headerTitle = document.querySelector('.base-header .header-title');
    if (headerTitle) headerTitle.textContent = t('new_company') || 'Nuova Azienda';
}

// ─── FORM EVENTS ──────────────────────────────────────────────────────────────

export function initFormEvents() {
    document.querySelector('form.anti-autofill-trap')?.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    // Gestione eliminazione card email statiche (CSP Compatibile)
    document.querySelectorAll('.inside-card .btn-remove-item').forEach(btn => {
        btn.addEventListener('click', function () {
            const card = this.closest('.inside-card');
            if (card) card.remove();
        });
    });

    // Logo & Photos
    document.getElementById('btn-trigger-logo')?.addEventListener('click', () =>
        document.getElementById('logo-upload')?.click());
    document.getElementById('logo-upload')?.addEventListener('change', (e) =>
        handleImagePreview(e, 'logo-preview', 'logo-placeholder'));

    document.getElementById('btn-trigger-ref-photo')?.addEventListener('click', () =>
        document.getElementById('referente-photo-upload')?.click());
    document.getElementById('referente-photo-upload')?.addEventListener('change', (e) =>
        handleImagePreview(e, 'referente-photo-preview', 'referente-photo-placeholder'));

    // Toggles & Sections (event delegation su body)
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('[data-stop-propagation]')) return;

        const btnToggle = e.target.closest('.btn-toggle-section');
        if (btnToggle) {
            e.preventDefault();
            toggleSection(btnToggle.dataset.target, btnToggle);
        }

        const btnPass = e.target.closest('.btn-toggle-pass');
        if (btnPass) {
            // 1. Cerca input via data-target (card statiche HTML)
            let input = btnPass.dataset.target
                ? document.getElementById(btnPass.dataset.target)
                : null;
            // 2. Fallback: cerca l'input nel .detail-field-box più vicino (card dinamiche JS)
            if (!input) {
                input = btnPass.closest('.detail-field-box')?.querySelector('input');
            }
            if (input) {
                const isNowShielded = input.classList.toggle('base-shield');
                // Fallback Firefox: -webkit-text-security non funziona → cambio type
                if (!CSS.supports('-webkit-text-security', 'disc')) {
                    input.type = isNowShielded ? 'password' : 'text';
                }
                const icon = btnPass.querySelector('span');
                if (icon) icon.textContent = isNowShielded ? 'visibility' : 'visibility_off';
            }
        }
    });

    // Attachments Premium
    const btnUpload = document.getElementById('btn-trigger-upload');
    if (btnUpload) btnUpload.onclick = openSourceSelector;

    // Modal source selector events
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.querySelectorAll('[data-source]').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.source;
                const input = document.getElementById(`input-${type}`);
                if (input) input.click();
                closeSourceSelector();
            };
        });
        document.getElementById('btn-cancel-source').onclick = closeSourceSelector;
    }

    // Hidden file input listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                state.selectedFiles.push(...files);
                renderAttachments();
            }
            e.target.value = '';
        });
    });

    // Extra Emails & Sedi
    document.getElementById('btn-add-email')?.addEventListener('click', () => addExtraEmail());
    document.getElementById('btn-add-sede')?.addEventListener('click', () => addExtraSede());
}

// ─── SOURCE SELECTOR ──────────────────────────────────────────────────────────

export function openSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Modale source-selector non trovato");
    }
}

export function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ─── IMAGE PREVIEW ────────────────────────────────────────────────────────────

export function handleImagePreview(e, previewId, placeholderId) {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.getElementById(previewId);
            const placeholder = document.getElementById(placeholderId);
            if (img) { img.src = ev.target.result; img.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

// ─── TOGGLE SECTION ───────────────────────────────────────────────────────────

export function toggleSection(id, btn) {
    const el = document.getElementById(id);
    const arrow = btn.querySelector('.chevron') || btn.querySelector('.icon-chevron') || document.getElementById('arrow-' + id);
    if (!el) return;

    // Se ha la classe hidden-content, la rimuoviamo per permettere il calcolo delle dimensioni
    if (el.classList.contains('hidden-content')) {
        el.classList.remove('hidden-content');
        el.style.maxHeight = '0px';
    }

    const isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';

    if (isOpen) {
        // FIX: se maxHeight è 'none', CSS non può animare verso 0px —
        // dobbiamo prima ancorarlo all'altezza reale, poi ridurlo a 0 nel frame successivo
        if (el.style.maxHeight === 'none' || !el.style.maxHeight) {
            el.style.maxHeight = el.scrollHeight + 'px';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { // doppio rAF per garantire il paint
                    el.style.maxHeight = '0px';
                });
            });
        } else {
            el.style.maxHeight = '0px';
        }
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        // Rimettiamo la classe dopo la transizione (400ms)
        setTimeout(() => {
            if (el.style.maxHeight === '0px') el.classList.add('hidden-content');
        }, 400);
    } else {
        el.classList.remove('hidden-content');
        const contentHeight = el.scrollHeight;
        el.style.maxHeight = contentHeight + 'px';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        // Dopo la transizione impostiamo 'none' per permettere scroll interno/resize
        setTimeout(() => {
            if (el.style.maxHeight !== '0px') el.style.maxHeight = 'none';
        }, 400);
    }
}
