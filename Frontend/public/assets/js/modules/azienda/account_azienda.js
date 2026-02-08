/**
 * ACCOUNT AZIENDA MODULE (V4.1)
 * Gestione lista account per una specifica azienda con supporto SwipeList.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sortOrder = 'asc';
let currentAziendaId = null;

// --- INITIALIZATION ---
observeAuth(async (user) => {
    if (user) {
        currentUser = user;
        const urlParams = new URLSearchParams(window.location.search);
        currentAziendaId = urlParams.get('id');

        if (!currentAziendaId) {
            window.location.href = 'lista_aziende.html';
            return;
        }

        try {
            await initComponents();
            await Promise.all([
                initProtocolUI(),
                loadAccounts()
            ]);
        } catch (error) {
            logError("Initialization", error);
            const container = document.getElementById('accounts-container');
            if (container) {
                clearElement(container);
                setChildren(container, createElement('p', {
                    className: 'text-center text-red-500 py-10',
                    textContent: t('error_loading_accounts') || "Errore durante il caricamento degli account."
                }));
            }
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function initProtocolUI() {
    try {
        console.log('[account_azienda] Configurazione UI specifica...');

        // 2. Header Center - Usa il titolo standard da initComponents() ("Account Azienda")

        // 3. Header Right - Aggiungi Sort button accanto a Home (già presente da initComponents)
        const hRight = document.getElementById('header-right');
        if (hRight) {
            const sortBtn = createElement('button', {
                id: 'sort-btn',
                className: 'btn-icon-header',
                title: t('sort') || 'Ordina',
                onclick: () => toggleSort()
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'sort_by_alpha' })
            ]);

            if (hRight.firstChild) {
                hRight.insertBefore(sortBtn, hRight.firstChild);
            } else {
                hRight.appendChild(sortBtn);
            }
        }

        // 4. Footer Center - Pulsante Add Account
        const fCenter = document.getElementById('footer-center-actions');
        if (fCenter && currentAziendaId) {
            clearElement(fCenter);
            setChildren(fCenter, createElement('button', {
                id: 'add-account-btn',
                className: 'btn-floating-add bg-accent-blue',
                onclick: () => window.location.href = `form_account_azienda.html?aziendaId=${currentAziendaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ]));
        }

        // 5. Search Bar
        const searchInput = document.getElementById('account-search');
        if (searchInput) {
            searchInput.addEventListener('input', filterAndRender);
        }

        console.log('[account_azienda] UI inizializzata con successo');
    } catch (error) {
        console.error('[account_azienda] Errore in initProtocolUI:', error);
        logError("initProtocolUI", error);
        throw error;
    }
}

async function loadAccounts() {
    if (!currentUser || !currentAziendaId) return;
    try {
        const colRef = collection(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts");
        const snap = await getDocs(colRef);
        allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        filterAndRender();
    } catch (e) {
        logError("FirebaseLoad", e);
        throw e;
    }
}

function filterAndRender() {
    const term = document.getElementById('account-search')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        if (acc.isArchived) return false;
        if (!term) return true;
        const name = (acc.nomeAccount || "").toLowerCase();
        const user = (acc.username || "").toLowerCase();
        const info = (acc.account || "").toLowerCase();
        return name.includes(term) || user.includes(term) || info.includes(term);
    });

    filtered.sort((a, b) => {
        const pinA = !!a.isPinned;
        const pinB = !!b.isPinned;
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;
        const nameA = (a.nomeAccount || "").toLowerCase();
        const nameB = (b.nomeAccount || "").toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    clearElement(container);

    if (list.length === 0) {
        setChildren(container, createElement('div', { className: 'text-center py-10 opacity-50' }, [
            createElement('p', { textContent: t('no_accounts_found') || 'Nessun account trovato' })
        ]));
        return;
    }

    const cards = list.map(acc => createAccountCard(acc));
    setChildren(container, cards);

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

function createAccountCard(acc) {
    const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
    const isPinned = !!acc.isPinned;
    const dots = '••••••••';

    const card = createElement('div', {
        className: 'micro-account-card swipe-row cursor-pointer hover:bg-white/5 transition-all active:scale-95',
        id: `acc-${acc.id}`,
        dataset: { id: acc.id },
        onclick: (e) => {
            if (e.target.closest('button')) return;
            window.location.href = `dettaglio_account_azienda.html?id=${acc.id}&aziendaId=${currentAziendaId}`;
        }
    }, [
        // Swipe Backgrounds
        createElement('div', { className: 'swipe-backgrounds' }, [
            createElement('div', { className: 'swipe-bg-left' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ]),
            createElement('div', { className: 'swipe-bg-right' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'archive' })
            ])
        ]),
        // Swipe Content
        createElement('div', { className: 'relative z-10 swipe-content' }, [
            createElement('div', { className: 'micro-account-content' }, [
                createElement('div', { className: 'micro-account-avatar-box' }, [
                    createElement('img', { className: 'micro-account-avatar', src: avatar }),
                    createElement('div', { className: 'micro-item-badge-dot bg-accent-blue' })
                ]),
                createElement('div', { className: 'micro-account-info' }, [
                    createElement('h3', { className: 'micro-account-name', textContent: acc.nomeAccount || t('without_name') })
                ]),
                createElement('div', { className: 'micro-account-top-actions' }, [
                    acc.password ? createElement('button', {
                        className: 'micro-btn-utility btn-toggle-visibility relative z-10 text-accent-blue',
                        onclick: (e) => {
                            e.stopPropagation();
                            if (window.toggleTripleVisibility) window.toggleTripleVisibility(acc.id);
                        }
                    }, [
                        createElement('span', { id: `pass-eye-${acc.id}`, className: 'material-symbols-outlined', textContent: 'visibility' })
                    ]) : null,
                    createElement('button', {
                        className: `micro-btn-utility btn-toggle-pin relative z-10 ${isPinned ? 'is-active' : ''}`,
                        onclick: (e) => { e.stopPropagation(); togglePin(acc.id); }
                    }, [
                        createElement('span', { className: `material-symbols-outlined ${isPinned ? 'filled' : ''}`, textContent: 'push_pin' })
                    ])
                ].filter(Boolean))
            ]),
            // Data Display
            createElement('div', { className: 'micro-data-display' }, [
                acc.username ? createDataRow(t('label_user'), acc.username, null, t('copy_username')) : null,
                acc.account ? createDataRow(t('label_account'), acc.account, null, t('copy_account')) : null,
                acc.password ? createDataRow(t('label_password'), dots, acc.password, t('copy_password'), `pass-text-${acc.id}`) : null
            ].filter(Boolean))
        ])
    ]);

    return card;
}

function createDataRow(label, displayValue, copyValue = null, title = '', valId = null) {
    return createElement('div', { className: 'micro-data-row' }, [
        createElement('span', { className: 'micro-data-label', textContent: `${label}:` }),
        createElement('span', { className: 'micro-data-value', id: valId, textContent: displayValue }),
        createElement('button', {
            className: 'copy-btn-dynamic micro-btn-copy-inline relative z-10',
            title: title,
            onclick: (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(copyValue || displayValue).then(() => {
                    showToast(t('copied') || "Copiato!", "success");
                });
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'content_copy' })
        ])
    ]);
}

// --- ACTIONS ---

async function handleArchive(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), {
            isArchived: true
        });
        showToast(t('success_archived') || "Archiviato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        logError("ArchiveAccount", e);
        showToast(t('error_generic'), "error");
        filterAndRender();
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;

    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) {
        filterAndRender();
        return;
    }

    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
        showToast(t('success_deleted') || "Eliminato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        logError("DeleteAccount", e);
        showToast(t('error_generic'), "error");
        filterAndRender();
    }
}

function toggleSort() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    filterAndRender();
}

async function togglePin(accountId) {
    if (!currentUser || !currentAziendaId) return;

    const acc = allAccounts.find(a => a.id === accountId);
    if (!acc) return;

    if (!acc.isPinned && allAccounts.filter(a => a.isPinned).length >= 10) {
        showToast(t('error_pin_limit') || "Limite pin raggiunto", "error");
        return;
    }

    const newState = !acc.isPinned;
    acc.isPinned = newState;
    filterAndRender();

    try {
        const docRef = doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", accountId);
        await updateDoc(docRef, { isPinned: newState });
        showToast(newState ? "Fissato in alto" : "Rimosso dai fissati", "success");
    } catch (e) {
        logError("PinUpdate", e);
        acc.isPinned = !newState;
        filterAndRender();
        showToast(t('error_generic'), "error");
    }
}

