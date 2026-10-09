/**
 * Elenco condivisioni del dettaglio Account privato.
 * Il dettaglio è di sola lettura: ogni modifica vive nel form Crea/Modifica.
 */

import { createElement, clearElement } from '../../dom-utils.js';

let mounted = null;

export function initPrivateSharingModule(context) {
    mounted?.destroy();
    let destroyed = false;
    const mount = {
        active() {
            if (!destroyed && (mounted !== mount || context.signal?.aborted || (context.isActive && !context.isActive()))) mount.destroy();
            return !destroyed;
        },
        destroy() {
            destroyed = true;
            context.signal?.removeEventListener('abort', mount.destroy);
        }
    };
    mounted = mount;
    context.signal?.addEventListener('abort', mount.destroy, {once: true});
    mount.active();
    return mount;
}

const normalizeEmail = email => String(email || '').trim().toLowerCase();
const activeGuests = account => Object.values(account?.sharedWith || {})
    .filter(guest => guest?.status === 'pending' || guest?.status === 'accepted');

export function renderPrivateSharingMap(account, contactNames = new Map(), mount = mounted) {
    if (!mount?.active()) return;
    const list = document.getElementById('guests-list');
    const section = document.getElementById('shared-management-section');
    if (!list) return;

    clearElement(list);
    const guests = account?.visibility === 'shared' ? activeGuests(account) : [];
    section?.classList.toggle('hidden', guests.length === 0);
    for (const guest of guests) {
        const email = normalizeEmail(guest.email);
        const name = contactNames.get(email) || email.split('@')[0] || 'Utente condiviso';
        list.appendChild(createElement('div', {className: 'rubrica-list-item'}, [
            createElement('p', {className: 'rubrica-item-name m-0', textContent: name})
        ]));
    }
}
