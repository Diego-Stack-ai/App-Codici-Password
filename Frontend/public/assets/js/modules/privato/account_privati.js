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

// --- INITIALIZATION ---
observeAuth(async (user) => {
    if (user) {
        currentUser = user;

        // Inizializza Header e Footer secondo Protocollo Base
        await initComponents();

        setupUI();
        await loadAccounts();
    }
});

function setupUI() {
    const searchInput = document.getElementById('account-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
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
        setChildren(container, createElement('div', { className: 'text-center py-10 opacity-50' }, [
            createElement('p', { textContent: t('no_accounts_found') || 'Nessun account trovato' })
        ]));
        return;
    }

    const cards = list.map(acc => createAccountCard(acc));
    setChildren(container, cards);

    // Re-init Swipe
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
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
        className: 'micro-account-card swipe-row cursor-pointer hover:bg-white/5 transition-all active:scale-95',
        dataset: { id: acc.id, owner: acc.isOwner, action: 'navigate' },
        onclick: () => window.location.href = `dettaglio_account_privato.html?id=${acc.id}${acc.isOwner ? '' : `&ownerId=${acc.ownerId}`}`
    }, [
        // Swipe Backgrounds
        createElement('div', { className: 'swipe-backgrounds' }, [
            createElement('div', { className: 'swipe-bg-left' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]),
            createElement('div', { className: 'swipe-bg-right' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'archive' })])
        ]),
        // Content
        createElement('div', { className: 'relative z-10 swipe-content' }, [
            createElement('div', { className: 'micro-account-content' }, [
                createElement('div', { className: 'micro-account-avatar-box' }, [
                    createElement('img', { className: 'micro-account-avatar', src: acc.logo || acc.avatar || 'assets/images/google-avatar.png' }),
                    createElement('div', { className: `micro-item-badge-dot ${theme.accent}` })
                ]),
                createElement('div', { className: 'micro-account-info' }, [
                    createElement('h3', { className: 'micro-account-name', textContent: acc.nomeAccount || t('without_name') })
                ]),
                createElement('div', { className: 'micro-account-top-actions' }, [
                    acc.password ? createElement('button', {
                        className: `micro-btn-utility ${theme.text}`,
                        onclick: (e) => { e.stopPropagation(); window.toggleTripleVisibility(acc.id); }
                    }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'visibility' })
                    ]) : null,
                    createElement('button', {
                        className: `micro-btn-utility ${isPinned ? 'text-blue-400' : 'text-white/20'}`,
                        onclick: (e) => { e.stopPropagation(); togglePin(acc); }
                    }, [
                        createElement('span', { className: `material-symbols-outlined ${isPinned ? 'filled' : ''}`, textContent: 'push_pin' })
                    ])
                ])
            ]),
            createElement('div', { className: 'micro-data-display' }, [
                acc.username ? createDataRow(t('label_user'), acc.username) : null,
                acc.account ? createDataRow(t('label_account'), acc.account) : null,
                acc.password ? createDataRow(t('label_password'), '••••••••', acc.password) : null
            ].filter(Boolean))
        ])
    ]);
    return card;
}

function createDataRow(label, displayValue, copyValue = null) {
    return createElement('div', { className: 'micro-data-row' }, [
        createElement('span', { className: 'micro-data-label', textContent: `${label}:` }),
        createElement('span', { className: 'micro-data-value', textContent: displayValue }),
        createElement('button', {
            className: 'micro-btn-copy-inline relative z-10',
            onclick: (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(copyValue || displayValue);
                showToast(t('copied') || "Copiato!");
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'content_copy' })
        ])
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

