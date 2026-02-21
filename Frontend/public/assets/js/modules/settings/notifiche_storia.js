/**
 * NOTIFICHE MODULE (V4.1)
 * Gestisce lo storico e la visualizzazione delle notifiche.
 * Refactor: Uso di dom-utils per rendering sicuro.
 */

import { auth, db } from '../../firebase-config.js';
import {
    collection, doc, getDocs, updateDoc, writeBatch, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { showToast, showConfirmModal } from '../../ui-core.js';
import { clearElement, createElement, setChildren } from '../../dom-utils.js';

let currentUid = null;
let isSelectionMode = false;
let selectedIds = new Set();
let allNotifications = []; // Per seleziona tutto rapido

/**
 * NOTIFICHE MODULE (V5.2 - Selection Mode)
 * Gestione storico notifiche con selezione multipla.
 */
export async function initNotificheStoria(user) {
    console.log("[NOTIFICHE] Init V5.2 Selection Mode...");
    if (!user) return;
    currentUid = user.uid;

    initEvents();
    await loadNotifications(user.uid);

    console.log("[NOTIFICHE] Ready.");
}

function initEvents() {
    // Normal Mode
    document.getElementById('btn-clear-history')?.addEventListener('click', clearHistory);
    document.getElementById('btn-select-mode')?.addEventListener('click', () => toggleSelectionMode(true));

    // Selection Mode
    document.getElementById('btn-cancel-selection')?.addEventListener('click', () => toggleSelectionMode(false));
    document.getElementById('btn-select-all')?.addEventListener('click', toggleSelectAll);
    document.getElementById('btn-delete-selected')?.addEventListener('click', deleteSelected);
}

const CACHE_KEY = 'notifications_cache_data';
const CACHE_TS_KEY = 'notifications_cache_timestamp';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 ore (2 volte al giorno)

async function loadNotifications(uid) {
    const list = document.getElementById('notifications-list');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');

    if (!list) return;

    // 1. Controlla la Cache
    const cachedData = localStorage.getItem(`${CACHE_KEY}_${uid}`);
    const cachedTs = localStorage.getItem(`${CACHE_TS_KEY}_${uid}`);
    const now = Date.now();

    if (cachedData && cachedTs && (now - parseInt(cachedTs) < CACHE_DURATION)) {
        console.log("PWA: Caricamento notifiche da cache locale.");
        const data = JSON.parse(cachedData);
        if (loading) loading.classList.add('hidden');
        renderNotifications(data, list, empty);
        return;
    }

    // 2. Se la cache è scaduta o mancante, scarica da Firestore
    try {
        console.log("PWA: Sincronizzazione notifiche con il server...");
        if (loading) loading.classList.remove('hidden'); // Forza visibilità all'inizio sync

        const q = query(
            collection(db, 'users', uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const snap = await getDocs(q);
        const notifications = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            let tsRaw = data.timestamp;
            let tsMillis = now;

            if (tsRaw) {
                if (typeof tsRaw.toDate === 'function') {
                    tsMillis = tsRaw.toDate().getTime();
                } else {
                    // Prendi come stringa ISO o numero
                    tsMillis = new Date(tsRaw).getTime() || now;
                }
            }

            notifications.push({
                id: docSnap.id,
                ...data,
                timestamp: tsMillis
            });
        });

        // Aggiorna Cache
        localStorage.setItem(`${CACHE_KEY}_${uid}`, JSON.stringify(notifications));
        localStorage.setItem(`${CACHE_TS_KEY}_${uid}`, now.toString());

        allNotifications = notifications;
        renderNotifications(notifications, list, empty);

    } catch (e) {
        console.error("Sync Error:", e);
        showToast("Errore sincronizzazione", "error");
        // Se fallisce il server, proviamo comunque a mostrare la vecchia cache se esiste
        if (cachedData) {
            allNotifications = JSON.parse(cachedData);
            renderNotifications(allNotifications, list, empty);
        }
    } finally {
        if (loading) loading.classList.add('hidden'); // SPEGNIMENTO GARANTITO
    }
}

function renderNotifications(data, list, empty) {
    if (!data || data.length === 0) {
        list.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    list.classList.remove('hidden');
    clearElement(list);

    if (isSelectionMode) list.classList.add('selection-active');
    else list.classList.remove('selection-active');

    const items = [];
    data.forEach(notif => {
        const date = new Date(notif.timestamp);
        const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

        const config = getNotificationConfig(notif.type, notif.title);
        const isSelected = selectedIds.has(notif.id);

        const card = createElement('div', {
            className: `notification-item-card ${isSelected ? 'selected' : ''}`,
            onclick: () => isSelectionMode ? toggleItemSelection(notif.id) : null
        }, [
            // 1. Checkbox
            createElement('div', { className: 'notif-checkbox-wrapper' }, [
                createElement('div', { className: 'custom-checkbox' }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'done' })
                ])
            ]),

            // 2. Icon Wrapper
            createElement('div', { className: `notification-icon-wrapper ${config.variant}` }, [
                createElement('span', { className: 'material-symbols-outlined filled', textContent: config.icon })
            ]),

            // 3. Data Wrapper
            createElement('div', { className: 'notification-data-wrapper' }, [
                createElement('div', { className: 'notification-header' }, [
                    createElement('span', { className: 'notification-title', textContent: config.label }),
                    createElement('span', { className: 'notification-time', textContent: `${dateStr} • ${timeStr}` })
                ]),
                createElement('div', {
                    className: 'notification-body',
                    textContent: notif.accountName ? `[${notif.accountName}] ${notif.message}` : notif.message
                })
            ])
        ]);

        items.push(card);
    });

    setChildren(list, items);
}

function toggleSelectionMode(active) {
    isSelectionMode = active;
    selectedIds.clear();

    const normalActions = document.getElementById('normal-actions');
    const selectionActions = document.getElementById('selection-actions');
    const btnTextSelectAll = document.querySelector('#btn-select-all [data-t="select_all_btn"]');
    if (btnTextSelectAll) btnTextSelectAll.textContent = "Tutti";

    if (active) {
        normalActions?.classList.add('hidden');
        selectionActions?.classList.remove('hidden');
    } else {
        normalActions?.classList.remove('hidden');
        selectionActions?.classList.add('hidden');
    }

    const list = document.getElementById('notifications-list');
    renderNotifications(allNotifications, list, document.getElementById('empty-state'));
}

function toggleItemSelection(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);

    renderNotifications(allNotifications, document.getElementById('notifications-list'), document.getElementById('empty-state'));
}

function toggleSelectAll() {
    const btnText = document.querySelector('#btn-select-all [data-t="select_all_btn"]');

    if (selectedIds.size === allNotifications.length) {
        selectedIds.clear();
        if (btnText) btnText.textContent = "Tutti";
    } else {
        allNotifications.forEach(n => selectedIds.add(n.id));
        if (btnText) btnText.textContent = "Nessuno";
    }
    renderNotifications(allNotifications, document.getElementById('notifications-list'), document.getElementById('empty-state'));
}

function getNotificationConfig(type, title) {
    const base = { icon: 'notifications', variant: 'notif-info', label: 'Sistema' };
    const tLower = (title || '').toLowerCase();

    switch (type) {
        case 'share_response':
            if (tLower.includes('accet')) {
                return { icon: 'check_circle', variant: 'notif-success', label: 'Collaborazione' };
            } else {
                return { icon: 'cancel', variant: 'notif-error', label: 'Accesso' };
            }
        case 'invite_accepted':
            return { icon: 'check_circle', variant: 'notif-success', label: 'Collaborazione' };
        case 'invite_rejected':
        case 'share_revoked':
            return { icon: 'cancel', variant: 'notif-error', label: 'Accesso' };
        case 'deadline':
            return { icon: 'warning', variant: 'notif-warning', label: 'Scadenza' };
        case 'security':
            return { icon: 'shield', variant: 'notif-security', label: 'Sicurezza' };
        default:
            return base;
    }
}

async function deleteSelected() {
    if (selectedIds.size === 0) {
        showToast("Seleziona almeno una notifica", "warning");
        return;
    }

    const msg = `Vuoi eliminare definitivamente le ${selectedIds.size} notifiche selezionate?`;
    const ok = await showConfirmModal("ELIMINA SELEZIONATE", msg, "Elimina", true);
    if (!ok) return;

    try {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            const ref = doc(db, 'users', currentUid, 'notifications', id);
            batch.delete(ref);
        });

        await batch.commit();

        // Aggiorna Stato Locale
        allNotifications = allNotifications.filter(n => !selectedIds.has(n.id));

        // Pulisci Cache Locale per forzare ricaricamento pulito
        localStorage.removeItem(`${CACHE_KEY}_${currentUid}`);
        localStorage.removeItem(`${CACHE_TS_KEY}_${currentUid}`);

        showToast(`${selectedIds.size} notifiche eliminate`, "success");
        toggleSelectionMode(false);

    } catch (e) {
        console.error("Delete Error:", e);
        showToast("Errore durante l'eliminazione", "error");
    }
}

async function clearHistory() {
    if (!currentUid) return;

    const ok = await showConfirmModal("SVUOTA STORICO", "Vuoi davvero cancellare definitivamente tutte le notifiche? L'azione non è reversibile.", "Svuota Tutto", true);
    if (!ok) return;

    const list = document.getElementById('notifications-list');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');

    try {
        if (loading) loading.classList.remove('hidden');
        if (list) list.classList.add('hidden');

        const q = collection(db, 'users', currentUid, 'notifications');
        const snap = await getDocs(q);

        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        // Pulisci Cache Locale
        localStorage.removeItem(`${CACHE_KEY}_${currentUid}`);
        localStorage.removeItem(`${CACHE_TS_KEY}_${currentUid}`);

        if (list) clearElement(list);
        if (empty) empty.classList.remove('hidden');
        if (loading) loading.classList.add('hidden');

        showToast("Cronologia svuotata", "success");
    } catch (e) {
        console.error(e);
        showToast("Errore cancellazione", "error");
        if (loading) loading.classList.add('hidden');
        if (list) list.classList.remove('hidden');
    }
}
