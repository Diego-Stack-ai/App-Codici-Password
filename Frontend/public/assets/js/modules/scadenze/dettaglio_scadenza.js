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

function setupFooterActions() {
    const interval = setInterval(() => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight && currentScadenza) {
            clearInterval(interval);
            const isCompleted = currentScadenza.status === 'completed' || currentScadenza.completed === true;

            const archiveBtn = createElement('button', {
                id: 'footer-btn-archive',
                className: 'glass-btn-sm',
                title: isCompleted ? 'Ripristina' : 'Archivia',
                onclick: handleArchive
            }, [
                createElement('span', { className: 'material-symbols-outlined text-lg', textContent: isCompleted ? 'unarchive' : 'archive' })
            ]);

            const deleteBtn = createElement('button', {
                id: 'footer-btn-delete',
                className: 'glass-btn-sm text-red-400',
                title: 'Elimina',
                onclick: handleDelete
            }, [
                createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'delete' })
            ]);

            const editBtn = createElement('button', {
                id: 'footer-btn-edit',
                className: 'base-btn-primary flex-center-gap',
                onclick: () => window.location.href = `modifica_scadenza.html?id=${currentScadenzaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'edit' }),
                createElement('span', { dataset: { t: 'edit' }, textContent: 'Modifica' })
            ]);

            const container = createElement('div', { className: 'flex items-center gap-2' }, [
                archiveBtn, deleteBtn, editBtn
            ]);

            clearElement(footerRight);
            setChildren(footerRight, container);
        }
    }, 100);
}

async function handleDelete() {
    const ok = await showConfirmModal("ELIMINA SCADENZA", "Sei sicuro di voler eliminare definitivamente questa scadenza?", "Elimina", true);
    if (ok) {
        await deleteScadenza(auth.currentUser.uid, currentScadenzaId);
        window.location.href = 'scadenze.html';
    }
}

async function handleArchive() {
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
}

function renderScadenza(scadenza) {
    const isCompleted = scadenza.status === 'completed' || scadenza.completed === true;

    // Basic Fields
    const titleEl = document.getElementById('detail-title');
    if (titleEl) titleEl.textContent = scadenza.title;

    const statusEl = document.getElementById('status-label');
    if (statusEl) {
        statusEl.textContent = isCompleted ? 'Archiviata' : 'Attiva';
        statusEl.classList.remove('text-emerald-500', 'text-blue-500');
        statusEl.classList.add(isCompleted ? 'text-emerald-500' : 'text-blue-500');
    }

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
            const items = scadenza.emails.map(email => createElement('div', { className: 'glass-card flex items-center justify-between p-3 group' }, [
                createElement('div', { className: 'flex items-center gap-3' }, [
                    createElement('div', { className: 'size-8 rounded-lg bg-blue-500/10 text-blue-400 flex-center border border-blue-500/10 shrink-0' }, [
                        createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'alternate_email' })
                    ]),
                    createElement('span', { className: 'text-xs font-bold text-white truncate', textContent: email })
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
                    className: 'glass-card flex items-center justify-between p-3 group hover:bg-white/10 transition-all'
                }, [
                    createElement('div', { className: 'flex items-center gap-3' }, [
                        createElement('div', { className: 'size-10 rounded-xl bg-white/5 flex-center border border-white/5' }, [
                            createElement('span', { className: `material-symbols-outlined ${color}`, textContent: icon })
                        ]),
                        createElement('div', { className: 'flex flex-col min-w-0' }, [
                            createElement('span', { className: 'text-xs font-bold text-white truncate', textContent: a.name }),
                            createElement('span', { className: 'text-[9px] font-black uppercase text-white/30 tracking-widest', textContent: ext })
                        ])
                    ]),
                    createElement('span', { className: 'material-symbols-outlined text-sm opacity-20 group-hover:opacity-100 transition-opacity', textContent: 'open_in_new' })
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

