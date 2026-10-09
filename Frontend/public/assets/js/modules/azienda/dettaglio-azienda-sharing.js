/**
 * Elenco condivisioni del dettaglio Account aziendale.
 * Il dettaglio è di sola lettura: ogni modifica vive nel form Crea/Modifica.
 */

import { createElement, clearElement } from '../../dom-utils.js';

let activeView = () => true;

export function initSharingModule({isActive = () => true, signal} = {}) {
    activeView = () => !signal?.aborted && isActive();
}

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const normalizeGuest = guest => typeof guest === 'object' ? guest : {email: guest, status: 'accepted'};
const activeGuests = guests => (guests || []).map(normalizeGuest)
    .filter(guest => guest?.status === 'pending' || guest?.status === 'accepted');

function renderGuestList(list, guests, contactNames = new Map()) {
    clearElement(list);
    for (const guest of activeGuests(guests)) {
        const email = normalizeEmail(guest.email);
        const name = contactNames.get(email) || email.split('@')[0] || 'Utente condiviso';
        list.appendChild(createElement('div', {className: 'rubrica-list-item'}, [
            createElement('p', {className: 'rubrica-item-name m-0', textContent: name})
        ]));
    }
}

export function renderSharingMap(account, contactNames = new Map()) {
    if (!activeView()) return;
    const list = document.getElementById('guests-list');
    const section = document.getElementById('shared-management-section');
    if (!list) return;
    const guests = account?.visibility === 'shared' ? activeGuests(Object.values(account?.sharedWith || {})) : [];
    section?.classList.toggle('hidden', guests.length === 0);
    renderGuestList(list, guests, contactNames);
}

// Compatibilità per i test/adapter legacy: sempre sola lettura e senza lookup inviti.
export async function renderGuests(guests, contactNames = new Map()) {
    if (!activeView()) return;
    const list = document.getElementById('guests-list');
    if (!list) return;
    renderGuestList(list, guests, contactNames);
}
