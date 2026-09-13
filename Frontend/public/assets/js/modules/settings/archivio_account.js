/**
 * ARCHIVIO ACCOUNT MODULE (V4.3)
 * Gestisce la visualizzazione e il ripristino di account archiviati (Cestino).
 * Refactor: Eliminazione innerHTML a favore di dom-utils.
 */

import { SwipeList } from '../../swipe-list-v6.js';
import { showToast } from '../../ui-core-v129.js';
import { auth } from '../../firebase-config.js?v=1.2.110';
import { onAuthStateChanged } from '/assets/js/vendor/firebase-runtime.js';
import { clearElement, createElement, setChildren } from '../../dom-utils.js';
import { t } from '../../translations.js';
import {
    deleteArchivedAccount,
    emptyArchivedAccounts,
    listArchiveContexts,
    loadArchivedAccounts,
    restoreArchivedAccount
} from './archive-account-service.js';
import { createUiState } from '../shared/ui-state-view.js';

let mountedArchive = null;

/**
 * ARCHIVIO ACCOUNT MODULE (V5.0 ADAPTER)
 * Gestisce l'archivio (cestino).
 * - Entry Point: initArchivioAccount(user)
 */

export async function initArchivioAccount(user, options = {}) {
    mountedArchive?.destroy();
    if (!user) return;
    const uid = user.uid;
    let allArchived = [], currentSwipeList = null, currentContext = 'all';
    let destroyed = false, generation = 0, unsubscribe = () => {}, pendingConfirmation = null;
    const controller = new AbortController(), cleanups = new Set();
    const container = document.getElementById('accounts-container');
    const searchInput = document.querySelector('input[type="search"]');
    const btnEmpty = document.getElementById('btn-empty-trash');

    // 1. SETUP UI LISTENERS
    // Context Selector
    const filterBtn = document.getElementById('archive-filter-btn');
    const filterMenu = document.getElementById('archive-context-menu');
    const activeLabel = document.getElementById('active-context-label');
    const baseContextItems = new Set(filterMenu?.children || []);
    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        generation += 1;
        controller.abort();
        unsubscribe();
        options.signal?.removeEventListener('abort', destroy);
        globalThis.removeEventListener?.('vault-session-locked', destroy);
        globalThis.removeEventListener?.('pagehide', destroy);
        currentSwipeList?.destroy(); currentSwipeList = null;
        for (const cleanup of cleanups) cleanup();
        cleanups.clear();
        allArchived = [];
        if (mountedArchive === mount) {
            if (container) clearElement(container);
            if (searchInput) { searchInput.value = ''; searchInput.oninput = null; }
            for (const element of [filterBtn, filterMenu, btnEmpty, container]) if (element) element.onclick = null;
            for (const item of [...(filterMenu?.children || [])]) if (!baseContextItems.has(item)) item.remove();
            if (activeLabel) { activeLabel.textContent = ''; activeLabel.removeAttribute('data-t'); }
            filterMenu?.classList.remove('show');
            mountedArchive = null;
        }
    };
    const active = () => {
        if (!destroyed && (auth.currentUser?.uid !== uid || options.signal?.aborted ||
            container?.isConnected === false || (options.isActive && !options.isActive()))) destroy();
        return !destroyed;
    };
    const mount = {active, destroy};
    mountedArchive = mount;
    const serviceOptions = {signal: controller.signal, isActive: active};
    options.signal?.addEventListener('abort', destroy, {once: true});
    globalThis.addEventListener?.('vault-session-locked', destroy, {once: true});
    globalThis.addEventListener?.('pagehide', destroy, {once: true});
    if (!container || !active()) { destroy(); return mount; }
    unsubscribe = onAuthStateChanged(auth, current => { if (current?.uid !== uid) destroy(); });
    if (destroyed) { unsubscribe(); return mount; }
    for (const item of baseContextItems) {
        item.classList.remove('active');
        if (item.dataset.value === 'all') {
            item.classList.add('active');
            if (activeLabel) {
                activeLabel.textContent = item.textContent;
                if (item.dataset.t) activeLabel.setAttribute('data-t', item.dataset.t);
            }
        }
    }
    const identity = account => JSON.stringify([account.context, account.id]);
    const ownTimer = callback => {
        const timer = setTimeout(() => { cleanups.delete(cancel); if (active()) callback(); }, 300);
        const cancel = () => clearTimeout(timer);
        cleanups.add(cancel);
    };
    const askConfirmation = (title, message) => new Promise(resolve => {
        if (!active() || pendingConfirmation) return resolve(null);
        let settled = false;
        const previousFocus = document.activeElement;
        const input = createElement('input', {type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
            'aria-label': message, className: 'glass-field modal-input-glass', placeholder: message});
        const close = value => {
            if (settled) return;
            settled = true;
            input.value = '';
            pendingConfirmation = null;
            overlay.remove(); cleanups.delete(cancel);
            resolve(value);
            if (active() && previousFocus?.isConnected) previousFocus.focus();
        };
        const cancel = () => close(null);
        pendingConfirmation = cancel;
        const overlay = createElement('div', {className: 'modal-overlay active'}, [
            createElement('section', {className: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title}, [
                createElement('h3', {className: 'modal-title', textContent: title}),
                createElement('p', {className: 'modal-text', textContent: message}), input,
                createElement('div', {className: 'modal-actions'}, [
                    createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: t('cancel') || 'Annulla', onclick: cancel}),
                    createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t('confirm') || 'Conferma', onclick: () => { if (active()) close(input.value); }})
                ])
            ])
        ]);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); cancel(); }
            if (event.key === 'Enter' && active()) { event.preventDefault(); close(input.value); }
        });
        cleanups.add(cancel); document.body.appendChild(overlay); input.focus();
    });

    if (filterBtn && filterMenu) {
        filterBtn.onclick = (e) => {
            if (!active()) return;
            e.stopPropagation();
            filterMenu.classList.toggle('show');
        };

        const closeMenu = () => { if (active()) filterMenu.classList.remove('show'); };
        document.addEventListener('click', closeMenu);
        cleanups.add(() => document.removeEventListener('click', closeMenu));

        filterMenu.onclick = async (e) => {
            if (!active()) return;
            const item = e.target.closest('.base-dropdown-item');
            if (item) {
                currentContext = item.dataset.value;
                // Update UI
                filterMenu.querySelectorAll('.base-dropdown-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (activeLabel) {
                    activeLabel.textContent = item.textContent;
                    if (item.dataset.t) activeLabel.setAttribute('data-t', item.dataset.t);
                    else activeLabel.removeAttribute('data-t');
                }
                filterMenu.classList.remove('show');
                await loadArchived();
            }
        };
    }

    // Search
    if (searchInput) {
        searchInput.oninput = () => filterAndRender();
    }

    // Empty Trash
    if (btnEmpty) {
        btnEmpty.onclick = handleEmptyTrash; // Use onclick to avoid duplicate listeners on re-init
    }

    // Delegated Actions
    if (container) {
        container.onclick = (e) => {
            if (!active()) return;
            // Copy Action
            const btnCopy = e.target.closest('.copy-btn-dynamic');
            if (btnCopy) {
                e.stopPropagation();
                const text = btnCopy.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    if (!active()) return;
                    showToast(t('copied') || "Copiato!", "success");
                });
                return;
            }
            // Restore Action
            const btnRestore = e.target.closest('.btn-restore-acc');
            if (btnRestore) {
                e.stopPropagation();
                handleRestore(btnRestore.dataset.key);
                return;
            }
        };
    }

    // 2. LOAD DATA
    await loadCompanies();
    if (!active()) return mount;
    await loadArchived();
    return mount;

async function loadCompanies() {
    if (!filterMenu || !active()) return;

    try {
        const companies = await listArchiveContexts(uid, serviceOptions);
        if (!active()) return;
        companies.forEach(data => {
            const item = createElement('div', {
                className: 'base-dropdown-item',
                dataset: { value: data.id },
                textContent: data.ragioneSociale || data.id
            });
            filterMenu.appendChild(item);
        });
    } catch (e) {
        if (active()) showToast(t('error_generic') || 'Errore caricamento aziende', 'error');
    }
}

async function loadArchived() {
    if (!container || !active()) return;
    const loadGeneration = ++generation;
    const loadContext = currentContext;
    const loadActive = () => active() && loadGeneration === generation;
    currentSwipeList?.destroy(); currentSwipeList = null;
    allArchived = [];

    clearElement(container);
    container.appendChild(createUiState({
        kind: 'loading',
        message: t('searching_archives') || 'Ricerca archivi...'
    }));

    try {
        const records = await loadArchivedAccounts(uid, loadContext, {signal: controller.signal, isActive: loadActive});
        if (!loadActive()) return;
        allArchived = records;
        filterAndRender();
    } catch (e) {
        if (!loadActive()) return;
        showToast(t('error_generic') || "Errore durante il caricamento dell'archivio", "error");
    }
}

function filterAndRender() {
    if (!active()) return;
    currentSwipeList?.destroy();
    currentSwipeList = null;
    const searchVal = searchInput?.value.toLowerCase() || '';
    const filtered = allArchived.filter(acc =>
        (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
        (acc.username || acc.utente || '').toLowerCase().includes(searchVal)
    );

    if (!container) return;

    clearElement(container);

    if (filtered.length === 0) {
        const emptyState = createUiState({
            kind: 'empty',
            icon: 'archive',
            message: t('no_accounts_found') || 'Nessun account trovato'
        });
        container.appendChild(emptyState);
        return;
    }

    const items = filtered.map(acc => {
        // 1. BACKGROUND AZIONI (Sotto la card)
        const bgRestore = createElement('div', { className: 'swipe-action-bg bg-restore' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'restore_from_trash' })
        ]);

        const bgDelete = createElement('div', { className: 'swipe-action-bg bg-delete' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete_forever' })
        ]);

        // 2. CONTENUTO VISIBILE (Sopra)
        // Icona differenziata per contesto
        const iconBox = createElement('div', { className: 'archive-icon-box' }, [
            createElement('span', {
                className: 'material-symbols-outlined',
                textContent: acc.context === 'privato' ? 'person' : 'account_balance'
            })
        ]);

        // Info Account
        const infoCol = createElement('div', { className: 'archive-item-info' }, [
            createElement('span', {
                className: 'archive-item-name',
                textContent: acc.nomeAccount || t('without_name') || 'Senza Nome'
            })
        ]);

        if (acc.businessName) {
            infoCol.appendChild(createElement('span', {
                className: 'archive-badge-context',
                textContent: acc.businessName
            }));
        }
        infoCol.appendChild(createElement('span', {
            className: 'archive-badge-context',
            textContent: 'Conservato finché non lo elimini manualmente'
        }));

        // Content Wrapper
        const swipeContent = createElement('div', {
            className: 'archive-item-content swipe-content'
        }, [iconBox, infoCol]);

        // Riga principale
        return createElement('div', {
            className: 'archive-row-container swipe-row',
            dataset: { key: identity(acc) }
        }, [bgRestore, bgDelete, swipeContent]);
    });

    setChildren(container, items);
    setupSwipe();
}


function setupSwipe() {
    currentSwipeList = new SwipeList('.archive-row-container', {
        threshold: 0.2,
        onSwipeRight: (item) => handleRestore(item.dataset.key),
        onSwipeLeft: (item) => handleDeleteForever(item.dataset.key)
    });
}


async function handleRestore(key) {
    if (!active()) return;
    const item = allArchived.find(account => identity(account) === key);
    if (!item) return;

    try {
        await restoreArchivedAccount(uid, {...item}, serviceOptions);
        if (!active()) return;
        showToast(t('success_restored') || "Ripristinato", "success");
        allArchived = allArchived.filter(account => identity(account) !== key);
        const el = [...container.children].find(row => row.dataset.key === key);
        if (el) {
            el.classList.add('is-removing');
            ownTimer(filterAndRender);
        } else {
            filterAndRender();
        }
    } catch (e) {
        if (!active()) return;
        showToast(t('error_generic') || "Errore", "error");
    }
}
async function handleDeleteForever(key) {
    if (!active()) return;
    const selected = allArchived.find(account => identity(account) === key);
    if (!selected) return;
    const item = {...selected};
    const confirmReq = await askConfirmation(
        t('confirm_delete_forever_title') || "ELIMINA PER SEMPRE",
        t('confirm_delete_forever_msg') || "Scrivi 'SI' per confermare l'eliminazione definitiva."
    );
    if (!active()) return;
    // Accetta 'SI' o 'YES' in base alla lingua (o entrambi per sicurezza)
    if (confirmReq !== 'SI' && confirmReq !== 'YES') return filterAndRender();

    try {
        await deleteArchivedAccount(uid, item, serviceOptions);
        if (!active()) return;
        showToast(t('success_deleted_forever') || "Eliminato definitivamente", "success");
        allArchived = allArchived.filter(account => identity(account) !== key);
        filterAndRender();
    } catch (e) {
        if (!active()) return;
        showToast(t('error_generic') || "Errore", "error");
    }
}

async function handleEmptyTrash() {
    if (!active() || allArchived.length === 0) return;
    const selected = allArchived.map(account => ({...account}));
    const selectedKeys = new Set(selected.map(identity));

    const confirmReq = await askConfirmation(
        t('confirm_empty_trash_title') || "SVUOTA CESTINO",
        t('confirm_empty_trash_msg') || "Scrivi 'SVUOTA' per eliminare tutto definitivamente."
    );
    if (!active()) return;
    if (confirmReq !== 'SVUOTA' && confirmReq !== 'EMPTY') return;

    try {
        await emptyArchivedAccounts(uid, selected, serviceOptions);
        if (!active()) return;
        showToast(t('success_trash_emptied') || "Cestino svuotato", "success");
        allArchived = allArchived.filter(account => !selectedKeys.has(identity(account)));
        filterAndRender();
    } catch (e) {
        if (!active()) return;
        showToast(t('error_generic') || "Errore", "error");
    }
}
}
