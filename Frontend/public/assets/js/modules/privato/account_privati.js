/**
 * ACCOUNT PRIVATI MODULE (V4.2)
 * Gestione liste account: personali, condivisi, memorandum.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';
import { SwipeList } from '../../swipe-list-v6.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sharedAccountIds = new Set();
let sortOrder = 'asc';

const THEMES = {
    standard: { accent: 'bg-blue-500', text: 'text-blue-400' },
    shared: { accent: 'bg-purple-500', text: 'text-purple-400' },
    memo: { accent: 'bg-amber-500', text: 'text-amber-400' },
    shared_memo: { accent: 'bg-emerald-500', text: 'text-emerald-400' }
};

/**
 * ACCOUNT PRIVATI MODULE (V5.0 ADAPTER)
 * Gestione liste account: personali, condivisi, memorandum.
 * - Entry Point: initAccountPrivati(user)
 */

export async function initAccountPrivati(user) {
    console.log("[ACCOUNTS] Init V5.0...");
    if (!user) return;
    currentUser = user;

    // Nota: initComponents() rimosso (gestito da main.js)

    setupUI();
    await loadAccounts();
    console.log("[ACCOUNTS] Ready.");
}

function setupUI() {
    const searchInput = document.getElementById('account-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // Sort Button Logic (Toggle)
    const sortBtn = document.getElementById('sort-btn');
    const sortLabel = document.getElementById('sort-label');

    if (sortBtn && sortLabel) {
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle Sort Order
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';

            // Update UI
            sortLabel.textContent = (sortOrder === 'asc') ? 'A-Z' : 'Z-A';

            // Re-render
            filterAndRender();
        });
    }

    // Aggiungi pulsanti FAB nel footer center
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        const type = new URLSearchParams(window.location.search).get('type') || 'standard';
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('a', {
                href: 'archivio_account.html',
                className: 'btn-fab-action btn-fab-archive',
                title: t('account_archive') || 'Archivio',
                dataset: { label: t('archive') || 'Archivio' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'inventory_2' })
            ]),
            createElement('button', {
                id: 'add-account-btn',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('add_account') || 'Nuovo Account',
                dataset: { label: t('add_short') || 'Aggiungi' },
                onclick: () => window.location.href = `form_account_privato.html?type=${type}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ])
        ]));
    }
}

/**
 * LOADING ENGINE
 */
async function loadAccounts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let sharedWithMe = [];
        sharedAccountIds.clear();

        // 1. Invitations Accepted
        const invitesQ = query(collection(db, "invites"),
            where("recipientEmail", "==", currentUser.email),
            where("status", "==", "accepted")
        );
        const invitesSnap = await getDocs(invitesQ);
        const invitePromises = invitesSnap.docs.map(async invDoc => {
            const inv = invDoc.data();
            try {
                // FIXED: Use senderId (standard) or fallback to senderUid (legacy)
                const senderId = inv.senderId || inv.senderUid;
                if (!senderId) { console.error("Missing senderId in invite:", inv); return null; }

                const accSnap = await getDoc(doc(db, "users", senderId, "accounts", inv.accountId));
                if (accSnap.exists()) {
                    const d = accSnap.data();
                    sharedAccountIds.add(accSnap.id);
                    return { ...d, id: accSnap.id, isOwner: false, ownerId: senderId, _isGuest: true };
                }
            } catch (e) { logError("LoadShared", e); }
            return null;
        });
        sharedWithMe = (await Promise.all(invitePromises)).filter(Boolean);

        // 2. Own Accounts
        const ownSnap = await getDocs(collection(db, "users", currentUser.uid, "accounts"));
        const ownAccounts = ownSnap.docs.map(d => {
            const data = d.data();
            const isRealOwner = !data.ownerId || data.ownerId === currentUser.uid;
            return {
                ...data,
                id: d.id,
                isOwner: isRealOwner,
                ownerId: data.ownerId || currentUser.uid,
                _isGuest: !isRealOwner
            };
        }).filter(a => !a.isArchived);

        allAccounts = [...ownAccounts, ...sharedWithMe];
        filterAndRender();
    } catch (e) {
        logError("LoadAccounts", e);
        showToast(t('error_generic'), "error");
    }
}

/**
 * FILTER & RENDER
 */
function filterAndRender() {
    const type = new URLSearchParams(window.location.search).get('type') || 'standard';
    const searchVal = document.getElementById('account-search')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        const isMemo = !!acc.hasMemo || acc.type === 'memorandum';
        const isShared = !!acc.shared || !!acc.isMemoShared || acc._isGuest;

        if (type === 'standard') return !isShared && !isMemo;
        if (type === 'shared') return isShared && !isMemo;
        if (type === 'memo') return isMemo && !isShared;
        if (type === 'shared_memo') return isMemo && isShared;
        return true;
    });

    if (searchVal) {
        filtered = filtered.filter(acc =>
            (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
            (acc.username || '').toLowerCase().includes(searchVal)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const nA = (a.nomeAccount || '').toLowerCase();
        const nB = (b.nomeAccount || '').toLowerCase();
        return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;
    clearElement(container);

    if (list.length === 0) {
        const type = new URLSearchParams(window.location.search).get('type') || 'standard';
        setChildren(container, createElement('div', { className: 'text-center py-10' }, [
            createElement('p', { className: 'opacity-40 text-xs uppercase font-black tracking-widest mb-6', textContent: t('no_accounts_found') || 'Nessun account trovato' })
        ]));
        return;
    }

    const cards = list.map(acc => createAccountCard(acc));
    setChildren(container, cards);

    // Re-init Swipe
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleDelete(item),  // Swipe Left <<<< reveals Right (Red/Delete)
        onSwipeRight: (item) => handleArchive(item) // Swipe Right >>>> reveals Left (Amber/Archive)
    });
}

function createAccountCard(acc) {
    const isMemo = !!acc.hasMemo || acc.type === 'memorandum';
    const isShared = !!acc.shared || !!acc.isMemoShared || acc._isGuest;
    const isPinned = !!acc.isPinned;

    let theme = THEMES.standard;
    if (isShared && isMemo) theme = THEMES.shared_memo;
    else if (isShared) theme = THEMES.shared;
    else if (isMemo) theme = THEMES.memo;

    const card = createElement('div', {
        className: 'account-card swipe-row',
        dataset: { id: acc.id, owner: acc.isOwner, action: 'navigate' },
        onclick: () => window.location.href = `dettaglio_account_privato.html?id=${acc.id}${acc.isOwner ? '' : `&ownerId=${acc.ownerId}`}`
    }, [
        // Swipe Backgrounds
        // Swipe Backgrounds (Archive Left, Delete Right)
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
                        createElement('img', { className: 'account-avatar', src: acc.logo || acc.avatar || 'assets/images/google-avatar.png' }),
                        createElement('div', { className: `account-badge-dot ${theme.accent}` })
                    ]),
                    createElement('div', { className: 'account-card-info-group' }, [
                        createElement('h3', { className: 'account-card-title' }, [
                            document.createTextNode(acc.nomeAccount || t('without_name'))
                        ]),
                        createElement('p', { className: 'account-card-subtitle', textContent: acc.username || acc.email || 'Utente Nascosto' })
                    ])
                ]),
                // Right Actions (Pin Only)
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
                            el.textContent = copyValue; // Show password
                            span.textContent = 'visibility_off';
                        } else {
                            el.textContent = '••••••••'; // Hide password
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

/**
 * ACTIONS
 */
async function togglePin(acc) {
    if (!acc.isOwner) { showToast(t('error_only_owner_pin') || "Solo il proprietario può fissare l'account", "info"); return; }
    try {
        const newVal = !acc.isPinned;
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), { isPinned: newVal });
        acc.isPinned = newVal;
        filterAndRender();
    } catch (e) { logError("Pin", e); }
}

async function handleArchive(item) {
    const id = item.dataset.id;
    if (item.dataset.owner !== 'true') { showToast(t('error_only_owner_archive'), "error"); filterAndRender(); return; }
    try {
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isArchived: true });
        showToast(t('success_archived'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Archive", e); }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (item.dataset.owner !== 'true') { showToast(t('error_only_owner_delete'), "error"); filterAndRender(); return; }
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) { filterAndRender(); return; }
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
        showToast(t('success_deleted'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Delete", e); }
}

