/**
 * ARCHIVIO ACCOUNT MODULE (V4.3)
 * Gestisce la visualizzazione e il ripristino di account archiviati (Cestino).
 * Refactor: Eliminazione innerHTML a favore di dom-utils.
 */

import { SwipeList } from '../../swipe-list-v6.js';
import { showToast, showInputModal } from '../../ui-core-v129.js';
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

let allArchived = [];
let currentUser = null;
let currentSwipeList = null;
let currentContext = 'all';

/**
 * ARCHIVIO ACCOUNT MODULE (V5.0 ADAPTER)
 * Gestisce l'archivio (cestino).
 * - Entry Point: initArchivioAccount(user)
 */

export async function initArchivioAccount(user) {
    
    if (!user) return;
    currentUser = user;

    // 1. SETUP UI LISTENERS
    // Context Selector
    const filterBtn = document.getElementById('archive-filter-btn');
    const filterMenu = document.getElementById('archive-context-menu');
    const activeLabel = document.getElementById('active-context-label');

    if (filterBtn && filterMenu) {
        filterBtn.onclick = (e) => {
            e.stopPropagation();
            filterMenu.classList.toggle('show');
        };

        document.addEventListener('click', () => filterMenu.classList.remove('show'));

        filterMenu.onclick = async (e) => {
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
    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.oninput = () => filterAndRender();
    }

    // Empty Trash
    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
        btnEmpty.onclick = handleEmptyTrash; // Use onclick to avoid duplicate listeners on re-init
    }

    // Delegated Actions
    const container = document.getElementById('accounts-container');
    if (container) {
        container.onclick = (e) => {
            // Copy Action
            const btnCopy = e.target.closest('.copy-btn-dynamic');
            if (btnCopy) {
                e.stopPropagation();
                const text = btnCopy.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    showToast(t('copied') || "Copiato!", "success");
                });
                return;
            }
            // Restore Action
            const btnRestore = e.target.closest('.btn-restore-acc');
            if (btnRestore) {
                e.stopPropagation();
                handleRestore(btnRestore.dataset.id);
                return;
            }
        };
    }

    // 2. LOAD DATA
    await loadCompanies();
    await loadArchived();

    
}
async function loadCompanies() {
    const filterMenu = document.getElementById('archive-context-menu');
    if (!filterMenu) return;

    try {
        const companies = await listArchiveContexts(currentUser.uid);
        companies.forEach(data => {
            const item = createElement('div', {
                className: 'base-dropdown-item',
                dataset: { value: data.id },
                textContent: data.ragioneSociale || data.id
            });
            filterMenu.appendChild(item);
        });
    } catch (e) {
        console.error("Errore caricamento aziende:", e);
    }
}

async function loadArchived() {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    clearElement(container);
    container.appendChild(createUiState({
        kind: 'loading',
        message: t('searching_archives') || 'Ricerca archivi...'
    }));

    try {
        allArchived = await loadArchivedAccounts(currentUser.uid, currentContext);

        filterAndRender();
    } catch (e) {
        console.error("[ARCHIVIO-EXCEPTION] Full details:", e);
        showToast(t('error_generic') || "Errore durante il caricamento dell'archivio", "error");
    }
}

function filterAndRender() {
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';
    const filtered = allArchived.filter(acc =>
        (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
        (acc.username || acc.utente || '').toLowerCase().includes(searchVal)
    );

    const container = document.getElementById('accounts-container');
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

        // Content Wrapper
        const swipeContent = createElement('div', {
            className: 'archive-item-content swipe-content'
        }, [iconBox, infoCol]);

        // Riga principale
        return createElement('div', {
            className: 'archive-row-container swipe-row',
            id: `arch-${acc.id}`,
            dataset: { id: acc.id }
        }, [bgRestore, bgDelete, swipeContent]);
    });

    setChildren(container, items);
    setupSwipe();
}


function setupSwipe() {
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.archive-row-container', {
        threshold: 0.2,
        onSwipeRight: (item) => handleRestore(item.dataset.id), // Swippa a DESTRA -> Ripristina
        onSwipeLeft: (item) => handleDeleteForever(item.dataset.id) // Swippa a SINISTRA -> Elimina
    });
}


async function handleRestore(id) {
    const item = allArchived.find(a => a.id === id);
    if (!item) return;

    try {
        await restoreArchivedAccount(currentUser.uid, item);
        showToast(t('success_restored') || "Ripristinato", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        const el = document.getElementById(`arch-${id}`);
        if (el) {
            el.classList.add('is-removing');
            setTimeout(() => filterAndRender(), 300);
        } else {
            filterAndRender();
        }
    } catch (e) {
        console.error(e);
        showToast(t('error_generic') || "Errore", "error");
    }
}
async function handleDeleteForever(id) {
    // Assuming showInputModal is globally available or we should import it if it's in ui-core?
    // Usually it's attached to window in main.js or similar? 
    // Best practice: import confirm modal. But this was asking for explicit typing "SI".
    // I'll assume window.showInputModal exists for now as it was in legacy code, 
    // but ideally we should move it to ui-core export.

    const confirmReq = await showInputModal(
        t('confirm_delete_forever_title') || "ELIMINA PER SEMPRE",
        "",
        t('confirm_delete_forever_msg') || "Scrivi 'SI' per confermare l'eliminazione definitiva."
    );
    // Accetta 'SI' o 'YES' in base alla lingua (o entrambi per sicurezza)
    if (confirmReq !== 'SI' && confirmReq !== 'YES') return filterAndRender();

    try {
        const item = allArchived.find(a => a.id === id);
        await deleteArchivedAccount(currentUser.uid, item);
        showToast(t('success_deleted_forever') || "Eliminato definitivamente", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast(t('error_generic') || "Errore", "error");
    }
}

async function handleEmptyTrash() {
    if (allArchived.length === 0) return;

    const confirmReq = await showInputModal(
        t('confirm_empty_trash_title') || "SVUOTA CESTINO",
        "",
        t('confirm_empty_trash_msg') || "Scrivi 'SVUOTA' per eliminare tutto definitivamente."
    );

    if (confirmReq !== 'SVUOTA' && confirmReq !== 'EMPTY') return;

    try {
        await emptyArchivedAccounts(currentUser.uid, allArchived);
        showToast(t('success_trash_emptied') || "Cestino svuotato", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast(t('error_generic') || "Errore", "error");
    }
}

