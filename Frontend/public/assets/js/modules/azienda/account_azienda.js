/**
 * ACCOUNT AZIENDA MODULE (V5.0 Compliant)
 * Gestione lista account per una specifica azienda, allineata allo stile Account Privati.
 */

import { auth, db } from '../../firebase-config.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sortOrder = 'asc';
let currentAziendaId = null;

const THEMES = {
    standard: { accent: 'theme-accent-standard', text: 'theme-text-standard' },
    shared: { accent: 'theme-accent-shared', text: 'theme-text-shared' },
    memo: { accent: 'theme-accent-memo', text: 'theme-text-memo' },
    shared_memo: { accent: 'theme-accent-shared-memo', text: 'theme-text-shared-memo' }
};

// --- INITIALIZATION ---
export async function initAccountAziendaList(user) {
    if (!user) { window.location.href = 'index.html'; return; }

    currentUser = user;
    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('id');

    if (!currentAziendaId) { window.location.href = 'lista_aziende.html'; return; }

    setupUI();
    try {
        await loadAccounts();
    } catch (e) {
        logError("InitAccountAzienda", e);
        const container = document.getElementById('accounts-container');
        if (container) {
            clearElement(container);
            setChildren(container, createElement('p', {
                className: 'error-message-box',
                textContent: t('error_loading_accounts') || "Errore caricamento dati."
            }));
        }
    }
}

function setupUI() {
    // 1. Header Left Back Button Override
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => window.location.href = `dettaglio_azienda.html?id=${currentAziendaId}`
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    // 2. Search & Sort Listeners
    const searchInput = document.getElementById('account-search');
    if (searchInput) searchInput.addEventListener('input', filterAndRender);

    const sortBtn = document.getElementById('sort-btn');
    const sortLabel = document.getElementById('sort-label');
    if (sortBtn && sortLabel) {
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
            sortLabel.textContent = (sortOrder === 'asc') ? 'A-Z' : 'Z-A';
            filterAndRender();
        });
    }

    // 3. Footer FAB (Add Account)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter && currentAziendaId) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('a', {
                href: `form_account_azienda.html?aziendaId=${currentAziendaId}`,
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('add_account') || 'Nuovo Account',
                dataset: { label: t('add_short') || 'Aggiungi' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ])
        ]));
    }
}

async function loadAccounts() {
    if (!currentUser || !currentAziendaId) return;
    try {
        const colRef = collection(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts");
        const snap = await getDocs(colRef);
        allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data(), isOwner: true })); // Assumiamo owner per ora in azienda
        filterAndRender();
    } catch (e) {
        logError("LoadAccounts", e);
        throw e;
    }
}

function filterAndRender() {
    const term = document.getElementById('account-search')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        if (acc.isArchived) return false;
        if (!term) return true;
        const n = (acc.nomeAccount || "").toLowerCase();
        const u = (acc.username || "").toLowerCase();
        const a = (acc.account || "").toLowerCase();
        return n.includes(term) || u.includes(term) || a.includes(term);
    });

    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const nA = (a.nomeAccount || "").toLowerCase();
        const nB = (b.nomeAccount || "").toLowerCase();
        return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;
    clearElement(container);

    if (list.length === 0) {
        setChildren(container, createElement('div', { className: 'empty-state-box' }, [
            createElement('p', { className: 'empty-state-text', textContent: t('no_accounts_found') || 'Nessun account trovato' })
        ]));
        return;
    }

    const cards = list.map(acc => createAccountCard(acc));
    setChildren(container, cards);

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleDelete(item),
        onSwipeRight: (item) => handleArchive(item)
    });
}

function createAccountCard(acc) {
    const isMemo = (acc.type === 'memo' || acc.type === 'memorandum') || !!acc.isMemo || !!acc.hasMemo; // Azienda non ha type 'memorandum' esplicito di solito, ma ha flag
    const isShared = acc.visibility === 'shared' || !!acc.shared || !!acc.isMemoShared;
    const isPinned = !!acc.isPinned;

    let theme = THEMES.standard;
    if (isShared && isMemo) theme = THEMES.shared_memo;
    else if (isShared) theme = THEMES.shared;
    else if (isMemo) theme = THEMES.memo;

    const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

    const card = createElement('div', {
        className: 'account-card swipe-row',
        dataset: { id: acc.id, owner: 'true', action: 'navigate' },
        onclick: (e) => {
            if (e.target.closest('button')) return;
            window.location.href = `dettaglio_account_azienda.html?id=${acc.id}&aziendaId=${currentAziendaId}`;
        }
    }, [
        // Swipe Backgrounds (Archive Left, Delete Right) - Swapped vs Private? No, same logic.
        // Private: Left=Delete, Right=Archive based on JS logic onSwipeLeft logic.
        // Here I keep standard: Left Swipe = reveals Right Side (Red/Delete). Right Swipe = reveals Left Side (Amber/Archive).
        // DOM Order: Archive (Left visual), Delete (Right visual).
        createElement('div', { className: 'swipe-action-bg bg-archive' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'archive' })
        ]),
        createElement('div', { className: 'swipe-action-bg bg-delete' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
        ]),

        // Content
        createElement('div', { className: 'swipe-content' }, [
            createElement('div', { className: 'account-card-layout' }, [
                createElement('div', { className: 'account-card-left' }, [
                    createElement('div', { className: 'account-icon-box' }, [
                        createElement('img', { className: 'account-avatar', src: avatar }),
                        createElement('div', { className: `account-badge-dot ${theme.accent}` })
                    ]),
                    createElement('div', { className: 'account-card-info-group' }, [
                        createElement('h3', { className: 'account-card-title' }, [
                            document.createTextNode(acc.nomeAccount || t('without_name'))
                        ]),
                        createElement('p', { className: 'account-card-subtitle', textContent: acc.username || acc.account || '...' })
                    ])
                ]),
                // Right Actions (Pin)
                createElement('div', { className: 'account-card-right' }, [
                    createElement('button', {
                        className: `btn-mini-action ${isPinned ? 'active' : ''}`,
                        onclick: (e) => { e.stopPropagation(); togglePin(acc); }
                    }, [
                        createElement('span', { className: `material-symbols-outlined ${isPinned ? 'filled' : ''}`, style: 'font-size: 18px;', textContent: 'push_pin' })
                    ])
                ])
            ]),
            createElement('div', { className: 'account-data-display' }, [
                acc.username ? createDataRow(t('label_user'), acc.username) : null,
                acc.account ? createDataRow(t('label_account'), acc.account) : null,
                acc.password ? createDataRow(t('label_password'), '••••••••', acc.password, true, acc.id) : null
            ].filter(Boolean))
        ])
    ]);
    return card;
}

function createDataRow(label, displayValue, copyValue = null, isPassword = false, id = null) {
    const rowId = Math.random().toString(36).substr(2, 9);
    return createElement('div', { className: 'account-data-row' }, [
        createElement('span', { className: 'account-data-label', textContent: `${label}:` }),
        createElement('span', {
            className: 'account-data-value',
            id: isPassword ? `pass-val-${rowId}` : undefined,
            textContent: displayValue
        }),
        createElement('div', { className: 'account-card-right' }, [
            isPassword ? createElement('button', {
                className: 'btn-mini-action',
                onclick: (e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`pass-val-${rowId}`);
                    const span = e.currentTarget.querySelector('span');
                    if (el && span) {
                        if (el.textContent === '••••••••') {
                            el.textContent = copyValue;
                            span.textContent = 'visibility_off';
                        } else {
                            el.textContent = '••••••••';
                            span.textContent = 'visibility';
                        }
                    }
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'visibility' })
            ]) : null,
            createElement('button', {
                className: 'btn-mini-action',
                onclick: (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(copyValue || displayValue);
                    showToast(t('copied') || "Copiato!");
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'content_copy' })
            ])
        ].filter(Boolean))
    ]);
}

// --- ACTIONS ---

async function togglePin(acc) {
    if (!currentAziendaId) return;
    try {
        const newVal = !acc.isPinned;
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", acc.id), { isPinned: newVal });
        acc.isPinned = newVal;
        filterAndRender();
    } catch (e) { logError("Pin", e); }
}

async function handleArchive(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;
    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), { isArchived: true });
        showToast(t('success_archived'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Archive", e); }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) {
        filterAndRender(); // Reset swipe
        return;
    }
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
        showToast(t('success_deleted'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Delete", e); }
}
