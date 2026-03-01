/**
 * DETTAGLIO SCADENZA MODULE (V4.1)
 * Gestisce la visualizzazione del dettaglio di una scadenza.
 */

import { getScadenza, updateScadenza, deleteScadenza } from '../../db.js';
import { auth } from '../../firebase-config.js';

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';

let currentScadenza = null;
let currentScadenzaId = new URLSearchParams(window.location.search).get('id');

/**
 * DETTAGLIO SCADENZA MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 */
export async function initDettaglioScadenza(user) {
    if (!user) return;
    currentScadenzaId = new URLSearchParams(window.location.search).get('id');
    if (!currentScadenzaId) {
        window.location.href = 'scadenze.html';
        return;
    }
    await loadScadenza(user.uid);
    setupFooterActions();
}

async function loadScadenza(uid) {
    try {
        currentScadenza = await getScadenza(uid, currentScadenzaId);
        if (!currentScadenza) {
            showToast("Scadenza non trovata", "error");
            return;
        }
        renderScadenza(currentScadenza);
    } catch (e) {
        console.error(e);
    }
}

function setupFooterActions() {
    function initFooterFromDetail(detail) {
        const { center: footerCenter, right: footerRight } = detail;
        if (!footerRight || !footerCenter || !currentScadenza) return;

        const settLink = createElement('div', { id: 'footer-settings-link' });
        settLink.appendChild(
            createElement('a', {
                href: 'impostazioni.html',
                className: 'btn-icon-header footer-settings-link'
            }, [
                createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
            ])
        );
        clearElement(footerRight);
        footerRight.appendChild(settLink);

        const deleteBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-danger', onclick: handleDelete
        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]);

        const editBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-scadenza',
            onclick: () => window.location.href = `aggiungi_scadenza.html?id=${currentScadenzaId}`
        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })]);

        const fabWrapper = createElement('div', { className: 'fab-group' }, [deleteBtn, editBtn]);
        clearElement(footerCenter);
        footerCenter.appendChild(fabWrapper);
    }

    // V6.1: Late-subscriber safe — se il footer è già pronto, inizializza subito
    if (window.__footerReady) {
        initFooterFromDetail(window.__footerReady);
    } else {
        document.addEventListener('footer:ready', (e) => initFooterFromDetail(e.detail), { once: true });
    }
}

async function handleDelete() {
    try {
        const ok = await showConfirmModal("ELIMINA SCADENZA", "Sei sicuro?", "Elimina", true);
        if (ok) {
            await deleteScadenza(auth.currentUser.uid, currentScadenzaId);
            window.location.href = 'scadenze.html';
        }
    } catch (error) { showToast("Errore", "error"); }
}

function renderScadenza(scadenza) {
    // Titolo: usa title (vecchio) o name + type (nuovo)
    const title = scadenza.title || `${scadenza.type || ''} - ${scadenza.name || ''}`.trim();
    document.getElementById('detail-title').textContent = title || 'Dettaglio Scadenza';

    document.getElementById('detail-intestatario').textContent = scadenza.name || '---';
    document.getElementById('detail-category').textContent = scadenza.type || 'Generale';

    if (scadenza.dueDate) {
        const d = new Date(scadenza.dueDate);
        document.getElementById('detail-date-day').textContent = `${d.getDate()} ${d.toLocaleString('it-IT', { month: 'short' }).toUpperCase()}`;
        document.getElementById('detail-date-year').textContent = d.getFullYear();
    }

    const vSec = document.getElementById('section-vehicle');
    if (scadenza.veicolo_modello) {
        vSec?.classList.remove('hidden');
        document.getElementById('display-veicolo').textContent = scadenza.veicolo_modello;
    }

    const attCont = document.getElementById('display-attachments');
    const attSec = document.getElementById('section-attachments');
    if (scadenza.attachments && scadenza.attachments.length > 0) {
        attSec?.classList.remove('hidden');
        clearElement(attCont);
        const items = scadenza.attachments.map(a => {
            const ext = a.name.split('.').pop().toLowerCase();
            return createElement('a', { href: a.url, target: '_blank', className: 'detail-list-item clickable' }, [
                createElement('div', { className: 'detail-list-item-left' }, [
                    createElement('div', { className: 'detail-list-icon-box' }, [
                        createElement('span', { className: `material-symbols-outlined`, textContent: 'description' })
                    ]),
                    createElement('span', { className: 'detail-list-item-title', textContent: a.name })
                ]),
                createElement('span', { className: 'material-symbols-outlined detail-list-item-arrow', textContent: 'open_in_new' })
            ]);
        });
        setChildren(attCont, items);
    }

    const noteBody = document.getElementById('detail-note-body');
    if (scadenza.notes && noteBody) noteBody.textContent = scadenza.notes;

    // Notifiche Email
    const emailSec = document.getElementById('section-emails');
    const e1 = scadenza.emails ? scadenza.emails[0] : scadenza.email1;
    const e2 = scadenza.emails ? scadenza.emails[1] : scadenza.email2;
    if (e1 || e2) {
        if (emailSec) emailSec.classList.remove('hidden');
        document.getElementById('detail-email1').textContent = e1 || '';
        document.getElementById('detail-email2').textContent = e2 || '';
    }

    // Pianificazione
    const planSec = document.getElementById('section-planning');
    // Mappatura retrocompatibile o attuale se salvate nel DB
    const preavviso = scadenza.notif_days_before || scadenza.period || '14';
    const frequenza = scadenza.notif_frequency || scadenza.freq || '7';
    if (planSec) {
        planSec.classList.remove('hidden'); // mostriamo sempre la pianificazione di default
        document.getElementById('detail-preavviso').textContent = preavviso + ' gg';
        document.getElementById('detail-frequenza').textContent = frequenza + ' gg';
    }

    // Template Testo
    const templateSec = document.getElementById('section-template');
    if (scadenza.templateText) {
        if (templateSec) templateSec.classList.remove('hidden');

        let compiledText = '';
        if (scadenza.mode === 'automezzi') {
            const subject = scadenza.templateText.trim();
            const vehicle = scadenza.veicolo_modello ? ` ${scadenza.veicolo_modello.trim()}` : '';
            compiledText = `E' in scadenza ${subject}${vehicle}`;
        } else if (scadenza.mode === 'documenti') {
            const subject = scadenza.templateText.trim();
            let code = scadenza.veicolo_modello ? scadenza.veicolo_modello.trim() : '';
            if (code.includes(' - ')) {
                code = code.split(' - ')[1].trim();
            }
            const vehicle = code ? ` ${code}` : '';
            compiledText = `E' in scadenza ${subject}${vehicle}`;
        } else {
            compiledText = `E' in scadenza ${scadenza.templateText.trim()}`;
        }

        document.getElementById('detail-template').textContent = compiledText;
    }
}
