/**
 * ARCHIVIO ACCOUNT MODULE (V4.3)
 * Gestisce la visualizzazione e il ripristino di account archiviati (Cestino).
 * Refactor: Eliminazione innerHTML a favore di dom-utils.
 */

import { auth, db } from '../../firebase-config.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from '../../ui-core.js';
import { clearElement, createElement, setChildren, safeSetText } from '../../dom-utils.js';
import { t } from '../../translations.js';

let allArchived = [];
let currentUser = null;
let currentSwipeList = null;
let currentContext = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Context Selector
    const selector = document.getElementById('archive-context-select');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentContext = e.target.value;
            loadArchived();
        });
    }

    // 2. Search Area
    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterAndRender());
    }

    // 3. Empty Trash
    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', handleEmptyTrash);
    }

    // 4. Delegated Actions (Copy & Toggle Visibility)
    const container = document.getElementById('accounts-container');
    if (container) {
        container.addEventListener('click', (e) => {
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
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanies();
            await loadArchived();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadCompanies() {
    const selector = document.getElementById('archive-context-select');
    if (!selector) return;

    try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const option = createElement('option', {
                value: docSnap.id,
                textContent: data.ragioneSociale || docSnap.id
            });
            selector.appendChild(option);
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadArchived() {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    clearElement(container);
    // Loading State
    const loading = createElement('div', { className: 'archive-loading-container' }, [
        createElement('div', { className: 'archive-spinner' }),
        createElement('span', {
            className: 'archive-loading-text',
            dataset: { t: 'searching_archives' },
            textContent: t('searching_archives') || 'Ricerca archivi...'
        })
    ]);
    container.appendChild(loading);

    try {
        let results = [];
        // Privato
        if (currentContext === 'all' || currentContext === 'privato') {
            const snap = await getDocs(query(collection(db, "users", currentUser.uid, "accounts"), where("isArchived", "==", true)));
            snap.forEach(d => results.push({ ...d.data(), id: d.id, context: 'privato' }));
        }
        // Aziende
        if (currentContext === 'all') {
            const bizSnap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
            for (const b of bizSnap.docs) {
                const snap = await getDocs(query(collection(db, "users", currentUser.uid, "aziende", b.id, "accounts"), where("isArchived", "==", true)));
                snap.forEach(d => results.push({ ...d.data(), id: d.id, context: b.id, businessName: b.data().ragioneSociale }));
            }
        } else if (currentContext !== 'privato') {
            const snap = await getDocs(query(collection(db, "users", currentUser.uid, "aziende", currentContext, "accounts"), where("isArchived", "==", true)));
            snap.forEach(d => results.push({ ...d.data(), id: d.id, context: currentContext }));
        }

        allArchived = results;
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast(t('error_generic') || "Errore caricamento", "error");
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
        const emptyState = createElement('div', { className: 'archive-empty-state' }, [
            createElement('span', { className: 'material-symbols-outlined archive-empty-icon', textContent: 'archive' }),
            createElement('p', {
                className: 'archive-empty-text',
                dataset: { t: 'no_accounts_found' },
                textContent: t('no_accounts_found') || 'Nessun account trovato'
            })
        ]);
        container.appendChild(emptyState);
        return;
    }

    const items = filtered.map(acc => {
        // 1. BACKGROUND AZIONI (Sotto la card)

        // A SINISTRA (Compare swippando verso DESTRA) -> RIPRISTINA
        const bgRestore = createElement('div', {
            className: 'swipe-action-bg bg-restore'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'restore_from_trash' })
        ]);

        // A DESTRA (Compare swippando verso SINISTRA) -> ELIMINA
        const bgDelete = createElement('div', {
            className: 'swipe-action-bg bg-delete'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete_forever' })
        ]);

        // 2. CONTENUTO VISIBILE (Sopra)
        const titleRow = createElement('div', { className: 'archive-item-content-header' }, [
            createElement('h4', {
                textContent: acc.nomeAccount || t('without_name') || 'Senza Nome'
            })
        ]);

        if (acc.businessName) {
            titleRow.appendChild(createElement('span', {
                className: 'archive-badge-context',
                textContent: acc.businessName
            }));
        }

        // Wrapper del contenuto che si sposta
        const swipeContent = createElement('div', {
            className: 'archive-item-content swipe-content'
        }, [titleRow]);

        // Contenitore principale della riga
        const card = createElement('div', {
            className: 'archive-row-container swipe-row',
            id: `arch-${acc.id}`,
            dataset: { id: acc.id }
        }, [bgRestore, bgDelete, swipeContent]);

        return card;
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
        const ref = getCollectionRef(id, item.context);
        await updateDoc(ref, { isArchived: false });
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

    if (!window.showInputModal) {
        if (!confirm(t('confirm_delete_forever_title') || "ELIMINA PER SEMPRE?")) {
            filterAndRender();
            return;
        }
    } else {
        const confirmReq = await window.showInputModal(
            t('confirm_delete_forever_title') || "ELIMINA PER SEMPRE",
            "",
            t('confirm_delete_forever_msg') || "Scrivi 'SI' per confermare l'eliminazione definitiva."
        );
        // Accetta 'SI' o 'YES' in base alla lingua (o entrambi per sicurezza)
        if (confirmReq !== 'SI' && confirmReq !== 'YES') return filterAndRender();
    }

    try {
        const item = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, item.context);
        await deleteDoc(ref);
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

    let confirmReq;
    if (window.showInputModal) {
        confirmReq = await window.showInputModal(
            t('confirm_empty_trash_title') || "SVUOTA CESTINO",
            "",
            t('confirm_empty_trash_msg') || "Scrivi 'SVUOTA' per eliminare tutto definitivamente."
        );
    } else {
        confirmReq = prompt(t('confirm_empty_trash_msg') || "Scrivi 'SVUOTA' per eliminare tutto:");
    }

    if (confirmReq !== 'SVUOTA' && confirmReq !== 'EMPTY') return;

    try {
        const batch = writeBatch(db);
        allArchived.forEach(acc => {
            batch.delete(getCollectionRef(acc.id, acc.context));
        });
        await batch.commit();
        showToast(t('success_trash_emptied') || "Cestino svuotato", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast(t('error_generic') || "Errore", "error");
    }
}

function getCollectionRef(id, context) {
    if (context === 'privato') return doc(db, "users", currentUser.uid, "accounts", id);
    return doc(db, "users", currentUser.uid, "aziende", context, "accounts", id);
}
