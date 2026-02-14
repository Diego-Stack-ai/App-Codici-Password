/**
 * DETTAGLIO SCADENZA MODULE (V4.1)
 * Gestisce la visualizzazione del dettaglio di una scadenza.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { getScadenza, updateScadenza, deleteScadenza } from '../../db.js';
import { auth } from '../../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { buildEmailBody } from './scadenza_templates.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';

let currentScadenza = null;
let currentScadenzaId = new URLSearchParams(window.location.search).get('id');

document.addEventListener('DOMContentLoaded', () => {
    if (!currentScadenzaId) {
        window.location.href = 'scadenze.html';
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadScadenza(user.uid);
            setupFooterActions();
        } else {
            window.location.href = 'index.html';
        }
    });
});

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

// --------------------------------------------------------------------------
// 4. FOOTER & PAGE ACTIONS
// --------------------------------------------------------------------------

function setupFooterActions() {
    const interval = setInterval(() => {

        // --- 1. FOOTER ACTIONS (Modifica & Elimina) ---
        // Attendiamo che il footer sia renderizzato da core_fascie.js
        const footerRight = document.getElementById('footer-right-actions'); // Container standard nel footer dx
        const footerCenter = document.getElementById('footer-center-actions');

        if (footerRight && footerCenter && currentScadenza) {
            clearInterval(interval); // Stop polling

            // --- A. IMPOSTAZIONI (Stile Classico components.js) ---
            const settLink = createElement('div', { id: 'footer-settings-link' });
            settLink.appendChild(
                createElement('a', {
                    href: 'impostazioni.html',
                    className: 'btn-icon-header footer-settings-link',
                    title: 'Impostazioni'
                }, [
                    createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
                ])
            );
            clearElement(footerRight);
            footerRight.appendChild(settLink);

            // --- B. AZIONI CENTRALI (Elimina & Modifica - Stile FAB Home) ---
            // Tasto ELIMINA
            const deleteBtn = createElement('button', {
                className: 'btn-fab-action',
                style: 'background: #ef4444; width: 44px; height: 44px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);',
                title: 'Elimina Scadenza',
                onclick: handleDelete
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'color: white;', textContent: 'delete' })
            ]);

            // B. Tasto MODIFICA (FAB Blu)
            const editBtn = createElement('button', {
                className: 'btn-fab-action btn-fab-scadenza', // Stile FAB Blu Standard
                style: 'width: 44px; height: 44px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);',
                title: 'Modifica Scadenza',
                onclick: () => window.location.href = `aggiungi_scadenza.html?id=${currentScadenzaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'color: white;', textContent: 'edit' })
            ]);

            const fabWrapper = createElement('div', {
                className: 'flex items-center gap-4',
                style: 'display: flex; gap: 16px; align-items: center;'
            }, [deleteBtn, editBtn]);

            clearElement(footerCenter);
            footerCenter.appendChild(fabWrapper);
        }

    }, 100);
}

async function handleDelete() {
    try {
        const ok = await showConfirmModal("ELIMINA SCADENZA", "Sei sicuro di voler eliminare definitivamente questa scadenza?", "Elimina", true);
        if (ok) {
            await deleteScadenza(auth.currentUser.uid, currentScadenzaId);
            window.location.href = 'scadenze.html';
        }
    } catch (error) {
        console.error("Errore durante l'eliminazione:", error);
        showToast("Errore durante l'eliminazione", "error");
    }
}

async function handleArchive() {
    try {
        const isCompleted = currentScadenza.status === 'completed' || currentScadenza.completed === true;
        const nextStatus = !isCompleted;
        const ok = await showConfirmModal(
            nextStatus ? "ARCHIVIA" : "RIPRISTINA",
            nextStatus ? "Vuoi spostare questa scadenza nell'archivio?" : "Vuoi ripristinare questa scadenza?",
            nextStatus ? "Archivia" : "Ripristina"
        );

        if (ok) {
            await updateScadenza(auth.currentUser.uid, currentScadenzaId, {
                status: nextStatus ? 'completed' : 'active',
                completed: nextStatus
            });
            window.location.reload();
        }
    } catch (error) {
        console.error("Errore modifica stato:", error);
        showToast("Errore aggiornamento stato", "error");
    }
}

function renderScadenza(scadenza) {
    const isCompleted = scadenza.status === 'completed' || scadenza.completed === true;

    // Basic Fields
    const titleEl = document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = scadenza.title;

    const holderEl = document.getElementById('detail-intestatario');
    if (holderEl) holderEl.textContent = scadenza.name || scadenza.holder || scadenza.intestatario || '---';

    const categoryEl = document.getElementById('detail-category');
    if (categoryEl) categoryEl.textContent = scadenza.category || scadenza.tipo_scadenza || scadenza.type || 'Generale';

    // Date logic
    if (scadenza.dueDate) {
        const d = new Date(scadenza.dueDate);
        const day = d.getDate();
        const month = d.toLocaleString('it-IT', { month: 'short' }).toUpperCase();
        const year = d.getFullYear();
        if (document.getElementById('detail-date-day')) document.getElementById('detail-date-day').textContent = `${day} ${month}`;
        if (document.getElementById('detail-date-year')) document.getElementById('detail-date-year').textContent = year;
    }

    // Vehicle
    const vSec = document.getElementById('section-vehicle');
    const vVal = document.getElementById('display-veicolo');
    if (scadenza.veicolo_modello) {
        vSec?.classList.remove('hidden');
        if (vVal) vVal.textContent = scadenza.veicolo_modello + (scadenza.veicolo_targa ? ` (${scadenza.veicolo_targa})` : '');
    }

    // Email Body
    const emailText = document.getElementById('display-testo-email');
    if (emailText) {
        let fmtDate = scadenza.dueDate ? new Date(scadenza.dueDate).toLocaleDateString('it-IT') : '';
        const body = buildEmailBody(
            (scadenza.email_testo_selezionato || '') + (scadenza.veicolo_targa ? ` ${scadenza.veicolo_targa}` : ''),
            null,
            fmtDate
        );
        emailText.textContent = `Ciao ${scadenza.name || 'Cliente'},\n\n${body}`;
    }

    // Recipients
    const destCont = document.getElementById('display-destinatari');
    if (destCont) {
        clearElement(destCont);
        if (scadenza.emails && scadenza.emails.length > 0) {
            const items = scadenza.emails.map(email => createElement('div', { className: 'detail-list-item' }, [
                createElement('div', { className: 'detail-list-item-left' }, [
                    createElement('div', { className: 'detail-list-icon-box icon-blue' }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'alternate_email' })
                    ]),
                    createElement('span', { className: 'detail-list-item-text', textContent: email })
                ])
            ]));
            setChildren(destCont, items);
        } else {
            setChildren(destCont, [
                createElement('p', { className: 'text-xs text-white/20 italic text-center py-4', textContent: 'Nessun destinatario impostato' })
            ]);
        }
    }

    // Attachments
    const attCont = document.getElementById('display-attachments');
    const attSec = document.getElementById('section-attachments');
    if (scadenza.attachments && scadenza.attachments.length > 0) {
        attSec?.classList.remove('hidden');
        if (attCont) {
            clearElement(attCont);
            const items = scadenza.attachments.map(a => {
                const ext = a.name.split('.').pop().toLowerCase();
                let icon = 'description';
                let color = 'text-white/40';
                if (['png', 'jpg', 'jpeg'].includes(ext)) { icon = 'image'; color = 'text-purple-400'; }
                if (ext === 'pdf') { icon = 'picture_as_pdf'; color = 'text-red-400'; }

                return createElement('a', {
                    href: a.url,
                    target: '_blank',
                    className: 'detail-list-item clickable'
                }, [
                    createElement('div', { className: 'detail-list-item-left' }, [
                        createElement('div', { className: 'detail-list-icon-box' }, [
                            createElement('span', { className: `material-symbols-outlined ${color}`, textContent: icon })
                        ]),
                        createElement('div', { className: 'detail-list-item-info' }, [
                            createElement('span', { className: 'detail-list-item-title', textContent: a.name }),
                            createElement('span', { className: 'detail-list-item-meta', textContent: ext })
                        ])
                    ]),
                    createElement('span', { className: 'material-symbols-outlined detail-list-item-arrow', textContent: 'open_in_new' })
                ]);
            });
            setChildren(attCont, items);
        }
    }

    // Notes
    const noteBody = document.getElementById('detail-note-body');
    if (scadenza.notes && noteBody) {
        noteBody.textContent = scadenza.notes;
        noteBody.classList.remove('text-white/50', 'italic');
        noteBody.classList.add('text-white/80');
    }
}

