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
                    showToast("Copiato!", "success");
                });
                return;
            }

            // Visibility Action
            const btnEye = e.target.closest('.btn-toggle-eye');
            if (btnEye) {
                e.stopPropagation();
                toggleTripleVisibility(btnEye.dataset.id);
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
    const loading = createElement('div', { className: 'flex-center-col py-10 opacity-50' }, [
        createElement('div', { className: 'size-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4' }),
        createElement('span', {
            className: 'text-xs uppercase tracking-widest font-bold',
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
        showToast("Errore caricamento", "error");
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
        const emptyState = createElement('div', { className: 'flex-center-col py-16 opacity-30 text-center' }, [
            createElement('span', { className: 'material-symbols-outlined text-5xl mb-4', textContent: 'inventory_2' }),
            createElement('p', {
                className: 'text-xs font-bold uppercase tracking-widest',
                dataset: { t: 'no_accounts_found' },
                textContent: t('no_accounts_found') || 'Nessun account trovato'
            })
        ]);
        container.appendChild(emptyState);
        return;
    }

    const items = filtered.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

        // Swipe Backgrounds -> Delete
        const bgDelete = createElement('div', { className: 'absolute inset-y-0 left-0 w-full flex items-center pl-6 bg-red-500/20 opacity-0 swipe-bg-delete' }, [
            createElement('span', { className: 'material-symbols-outlined text-red-500', textContent: 'delete_forever' })
        ]);

        // Swipe Backgrounds -> Restore
        const bgRestore = createElement('div', { className: 'absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 bg-emerald-500/20 opacity-0 swipe-bg-restore' }, [
            createElement('span', { className: 'material-symbols-outlined text-emerald-500', textContent: 'restore_from_trash' })
        ]);

        // Card Content
        const img = createElement('img', {
            src: avatar,
            className: 'size-10 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0'
        });

        // Info Block
        const headerTitle = createElement('div', { className: 'flex justify-between items-start gap-2 mb-3' }, [
            createElement('h4', { className: 'text-sm font-bold truncate text-white', textContent: acc.nomeAccount || 'Senza Nome' })
        ]);

        if (acc.businessName) {
            headerTitle.appendChild(createElement('span', {
                className: 'text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-black uppercase',
                textContent: acc.businessName
            }));
        }

        const dataRows = createElement('div', { className: 'flex-col-gap-2' }, [
            renderDataRow(acc.id, 'User', acc.username || acc.utente, 'username'),
            renderDataRow(acc.id, 'Acc', acc.account, 'account'),
            renderDataRow(acc.id, 'Pass', acc.password, 'password')
        ].filter(Boolean)); // filter out nulls

        const infoBlock = createElement('div', { className: 'flex-1 min-w-0' }, [headerTitle, dataRows]);

        // Actions Block
        const btnRestore = createElement('button', {
            className: 'btn-restore-acc size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex-center border border-emerald-500/20 hover:bg-emerald-500/20 transition-all',
            dataset: { id: acc.id, title: 'Ripristina' }
        }, [
            createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'restore_from_trash' })
        ]);

        const btnEye = createElement('button', {
            className: 'btn-toggle-eye size-8 rounded-lg bg-white/5 text-white/40 flex-center border border-white/10 hover:bg-white/10 transition-all',
            dataset: { id: acc.id, title: 'Mostra/Nascondi' }
        }, [
            createElement('span', { id: `pass-eye-${acc.id}`, className: 'material-symbols-outlined text-lg', textContent: 'visibility' })
        ]);

        const actionsBlock = createElement('div', { className: 'flex-center-col gap-2 shrink-0' }, [btnRestore, btnEye]);

        // Swipe Content Wrapper
        const swipeContent = createElement('div', {
            className: 'swipe-content relative z-10 bg-[#0f172a] p-4 flex gap-4 transition-transform border-l-4 border-blue-500/50'
        }, [img, infoBlock, actionsBlock]);

        // Initial Card
        const card = createElement('div', {
            className: 'glass-card swipe-row overflow-hidden relative',
            id: `arch-${acc.id}`,
            dataset: { id: acc.id },
            style: 'padding:0;'
        }, [bgDelete, bgRestore, swipeContent]);

        return card;
    });

    setChildren(container, items);
    setupSwipe();
}

function renderDataRow(id, label, value, type) {
    if (!value) return null;

    const row = createElement('div', { className: 'flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5' }, [
        createElement('span', { className: 'text-[9px] font-black text-white/30 uppercase w-8', textContent: label }),
        createElement('span', {
            id: `${type}-text-${id}`,
            className: 'text-xs font-mono text-white/80 truncate flex-1',
            textContent: '••••••••'
        }),
        createElement('button', {
            className: 'copy-btn-dynamic text-white/20 hover:text-blue-400 transition-colors',
            title: 'Copia',
            dataset: { copy: value } // dom-utils handles attributes safely, innerHTML replacement not needed here provided we don't inject value into HTML
        }, [
            createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'content_copy' })
        ])
    ]);

    return row;
}

function setupSwipe() {
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.2,
        onSwipeLeft: (item) => handleRestore(item.dataset.id),
        onSwipeRight: (item) => handleDeleteForever(item.dataset.id)
    });
}

function toggleTripleVisibility(id) {
    const eye = document.getElementById(`pass-eye-${id}`);
    const rows = ['username', 'account', 'password'];
    if (!eye) return;

    const isHidden = eye.textContent === 'visibility';
    eye.textContent = isHidden ? 'visibility_off' : 'visibility';

    rows.forEach(type => {
        const textEl = document.getElementById(`${type}-text-${id}`);
        if (!textEl) return;

        if (isHidden) {
            // Reveal: find value in copy btn
            const btn = textEl.parentElement.querySelector('.copy-btn-dynamic');
            safeSetText(textEl, btn ? btn.dataset.copy : '---');
            textEl.classList.remove('text-white/80');
            textEl.classList.add('text-blue-300');
        } else {
            // Hide
            safeSetText(textEl, '••••••••');
            textEl.classList.add('text-white/80');
            textEl.classList.remove('text-blue-300');
        }
    });
}

async function handleRestore(id) {
    const item = allArchived.find(a => a.id === id);
    if (!item) return;

    try {
        const ref = getCollectionRef(id, item.context);
        await updateDoc(ref, { isArchived: false });
        showToast("Ripristinato", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        const el = document.getElementById(`arch-${id}`);
        if (el) {
            el.style.transform = 'scale(0.9)';
            el.style.opacity = '0';
            setTimeout(() => filterAndRender(), 300);
        } else {
            filterAndRender();
        }
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

async function handleDeleteForever(id) {
    // Assuming showInputModal is globally available or we should import it if it's in ui-core?
    // Usually it's attached to window in main.js or similar? 
    // Best practice: import confirm modal. But this was asking for explicit typing "SI".
    // I'll assume window.showInputModal exists for now as it was in legacy code, 
    // but ideally we should move it to ui-core export.

    if (!window.showInputModal) {
        // Fallback if not available
        if (!confirm("ELIMINA PER SEMPRE?")) {
            filterAndRender();
            return;
        }
    } else {
        const confirmReq = await window.showInputModal("ELIMINA PER SEMPRE", "", "Scrivi 'SI' per confermare l'eliminazione definitiva.");
        if (confirmReq !== 'SI') return filterAndRender(); // Reset swipe
    }

    try {
        const item = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, item.context);
        await deleteDoc(ref);
        showToast("Eliminato definitivamente", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

async function handleEmptyTrash() {
    if (allArchived.length === 0) return;

    let confirmReq;
    if (window.showInputModal) {
        confirmReq = await window.showInputModal("SVUOTA CESTINO", "", "Scrivi 'SVUOTA' per eliminare tutto definitivamente.");
    } else {
        confirmReq = prompt("Scrivi 'SVUOTA' per eliminare tutto:");
    }

    if (confirmReq !== 'SVUOTA') return;

    try {
        const batch = writeBatch(db);
        allArchived.forEach(acc => {
            batch.delete(getCollectionRef(acc.id, acc.context));
        });
        await batch.commit();
        showToast("Cestino svuotato", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

function getCollectionRef(id, context) {
    if (context === 'privato') return doc(db, "users", currentUser.uid, "accounts", id);
    return doc(db, "users", currentUser.uid, "aziende", context, "accounts", id);
}
