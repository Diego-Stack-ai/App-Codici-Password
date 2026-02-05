import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { t } from './translations.js';
import { initComponents } from './components.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sharedAccountIds = new Set();
let sortOrder = 'asc';
const APP_VERSION = "v1.2 (Swipe Fix)";

const logDebug = (msg) => console.log(`[${APP_VERSION}] ${msg}`);

const THEMES = {
    standard: {
        accent: 'rgba(80, 150, 255, 0.6)'
    },
    shared: {
        accent: 'rgba(147, 51, 234, 0.6)'
    },
    memo: {
        accent: 'rgba(245, 158, 11, 0.6)'
    },
    shared_memo: {
        accent: 'rgba(16, 185, 129, 0.6)'
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // 1. Init UI (Protocol Standard)
        await initProtocolUI();
        // 2. Load Data
        await loadAccounts();
    } else {
        setTimeout(() => window.location.href = 'index.html', 1000);
    }
});

async function initProtocolUI() {
    await initComponents();

    // Header Setup
    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';

    if (hLeft) {
        hLeft.innerHTML = `<button onclick="window.location.href='area_privata.html'" class="btn-icon-header"><span class="material-symbols-outlined">arrow_back</span></button>`;
    }
    if (hCenter) {
        let titleKey = "section_personal_accounts";
        if (type === 'shared') titleKey = "section_shared_accounts";
        else if (type === 'memo') titleKey = "section_note";
        else if (type === 'shared_memo') titleKey = "section_shared_note";
        hCenter.innerHTML = `<h2 class="header-title" data-t="${titleKey}">${t(titleKey)}</h2>`;
    }
    if (hRight) {
        hRight.innerHTML = `
            <div class="flex items-center gap-2">
                <button id="sort-btn" class="btn-icon-header" title="Ordina">
                    <span class="material-symbols-outlined">sort_by_alpha</span>
                </button>
                <a href="home_page.html" class="btn-icon-header">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
        document.getElementById('sort-btn').onclick = toggleSort;
    }

    // Footer Functional Center: Add Button
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        const theme = THEMES[type] || THEMES.standard;
        fCenter.innerHTML = `
            <button onclick="window.location.href='aggiungi_account_privato.html?type=${type}'" 
                    id="add-account-btn" 
                    class="btn-icon-header" 
                    style="background: ${theme.accent}; color: white; border-radius: 50%; width: 50px; height: 50px; margin-top: -30px; border: 2px solid white; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                <span class="material-symbols-outlined">add</span>
            </button>
        `;
    }

    // Apply translations to everything
    const searchInput = document.getElementById('account-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }
}
window.togglePin = async (id, isOwner, ownerId) => {
    if (!currentUser) return;
    const acc = allAccounts.find(a => a.id === id);
    if (!acc) return;

    const newVal = !acc.isPinned;
    acc.isPinned = newVal;
    filterAndRender();

    try {
        if (isOwner) {
            await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isPinned: newVal });
        } else {
            showToast("Pin su condivisi non persistente (Demo)", "info");
        }
    } catch (e) {
        logError("Pin Toggle", e);
        acc.isPinned = !newVal; // Revert
        filterAndRender();
        showToast("Errore nel modificare lo stato Pin", "error");
    }
};

// Password Visibility Toggle
window.toggleTripleVisibility = (id) => {
    const eye = document.getElementById(`pass-eye-${id}`);
    const passText = document.getElementById(`pass-text-${id}`);
    const card = document.getElementById(`acc-${id}`);

    if (!card || !eye || !passText) return;

    // Recupera la password dal pulsante copia
    let passVal = '••••••••';
    const copyBtns = card.querySelectorAll('.copy-btn-dynamic');
    copyBtns.forEach(btn => {
        const title = (btn.getAttribute('title') || '').toLowerCase();
        if (title.includes('password')) {
            passVal = btn.getAttribute('data-copy') || passVal;
        }
    });

    const isHidden = eye.textContent.trim() === 'visibility';
    const dots = '••••••••';

    if (isHidden) {
        // Mostra password
        eye.textContent = 'visibility_off';
        passText.textContent = passVal;
    } else {
        // Nascondi password
        eye.textContent = 'visibility';
        passText.textContent = dots;
    }
};


async function loadAccounts() {
    try {
        logDebug("Caricamento unificato account...");
        const urlParams = new URLSearchParams(window.location.search);

        let sharedWithMeAccounts = [];
        sharedAccountIds.clear();

        // 1. LOAD SHARED WITH ME (First to identify IDs)
        try {
            const invitesQ = query(collection(db, "invites"),
                where("recipientEmail", "==", currentUser.email),
                where("status", "==", "accepted")
            );
            const invitesSnap = await getDocs(invitesQ);
            const promises = invitesSnap.docs.map(async invDoc => {
                const invData = invDoc.data();
                const ownerId = invData.senderUid;
                const accountId = invData.accountId;
                try {
                    const accRef = doc(db, "users", ownerId, "accounts", accountId);
                    const accSnap = await getDoc(accRef);
                    if (accSnap.exists()) {
                        const d = accSnap.data();
                        sharedAccountIds.add(accSnap.id); // Track ID
                        return {
                            ...d,
                            id: accSnap.id,
                            isOwner: false,
                            ownerId: ownerId,
                            isSharedWithMe: true,
                            _isMemo: !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum',
                            _isShared: true,
                            _isGuest: true
                        };
                    }
                } catch (err) {
                    console.warn("Account condiviso non trovato o errore permessi:", err);
                }
                return null;
            });
            sharedWithMeAccounts = (await Promise.all(promises)).filter(a => a !== null);
        } catch (e) {
            logError("Shared Accounts Load", e);
        }

        // 2. LOAD OWN ACCOUNTS
        const colRef = collection(db, "users", currentUser.uid, "accounts");
        const ownSnap = await getDocs(colRef);
        const ownAccounts = ownSnap.docs
            .map(doc => {
                const d = doc.data();
                // ROBUSTNESS: Check if this "own" account is actually a legacy shared copy
                const isRealOwner = !d.ownerId || d.ownerId === currentUser.uid;

                return {
                    ...d,
                    id: doc.id,
                    isOwner: isRealOwner,
                    ownerId: d.ownerId || currentUser.uid,
                    _isMemo: !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum',
                    _isShared: !!d.shared || !!d.isMemoShared,
                    _isGuest: !isRealOwner // Mark as guest if ownerId differs
                };
            })
            // FILTER ARCHIVED AND LEGACY GHOST SHARES
            .filter(a => !a.isArchived);

        allAccounts = [...ownAccounts, ...sharedWithMeAccounts];
        logDebug(`Caricati ${allAccounts.length} account totali (Condivisi: ${sharedWithMeAccounts.length})`);
        filterAndRender();

    } catch (error) {
        logError("Accounts Master Load", error);
        showToast("Errore caricamento dati.", "error");
    }
}

function filterAndRender() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';
    const pageTitle = document.getElementById('page-title');

    let filtered = allAccounts.filter(acc => {
        // 1. Type Filter
        if (type === 'standard') {
            if (pageTitle) pageTitle.textContent = "Account Privati";

            // EXCLUDE SHARED (Robust logic)
            if (acc.isSharedWithMe) return false;
            // NEW: Exclude legacy ghost copies (where ownerId != uid)
            if (acc._isGuest) return false;
            if (sharedAccountIds.has(acc.id)) return false; // Exclude checking ID vs Shared Set

            if (acc._isShared) return false;
            if (acc._isMemo) return false;
            return true;
        }
        else if (type === 'shared') {
            if (pageTitle) pageTitle.textContent = "Account Condivisi";
            if (acc._isMemo) return false;
            return (acc._isShared || acc.isSharedWithMe || sharedAccountIds.has(acc.id));
        }
        else if (type === 'memo') {
            if (pageTitle) pageTitle.textContent = "Memorandum";
            if (acc.isSharedWithMe) return false;
            // Exclude shared IDs from memo too if they are shared!
            if (sharedAccountIds.has(acc.id)) return false;

            if (acc._isShared) return false;
            return acc._isMemo;
        }
        else if (type === 'shared_memo') {
            if (pageTitle) pageTitle.textContent = "Memo Condivisi";
            if (!acc._isMemo) return false;
            return (acc._isShared || acc.isSharedWithMe || sharedAccountIds.has(acc.id));
        }
        return true;
    });

    // 2. Search Filter
    if (searchVal) {
        filtered = filtered.filter(acc =>
            (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
            (acc.username || '').toLowerCase().includes(searchVal)
        );
    }

    // 3. Sort
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const nA = (a.nomeAccount || '').toLowerCase();
        const nB = (b.nomeAccount || '').toLowerCase();

        if (sortOrder === 'desc') {
            return nB.localeCompare(nA);
        }
        return nA.localeCompare(nB);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50"><p>${t('no_accounts_found')}</p></div>`;
        return;
    }

    container.innerHTML = list.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        const idSafe = encodeURIComponent(acc.id);

        const isMemo = acc._isMemo;
        const isShared = acc._isShared || acc.isSharedWithMe || sharedAccountIds.has(acc.id);

        let accentColor = 'rgba(80, 150, 255, 0.6)'; // Blue
        if (isShared && isMemo) accentColor = 'rgba(16, 185, 129, 0.6)'; // Emerald
        else if (isShared) accentColor = 'rgba(147, 51, 234, 0.6)'; // Purple
        else if (isMemo) accentColor = 'rgba(245, 158, 11, 0.6)'; // Amber

        const isPinned = !!acc.isPinned;
        const pinIcon = 'push_pin';
        const pinStyle = isPinned ? 'opacity: 1; color: var(--text-primary);' : 'opacity: 0.3;';
        const dots = '••••••••';

        return `
            <div class="micro-account-card swipe-row" id="acc-${acc.id}" 
                 data-id="${acc.id}" data-owner="${acc.isOwner}" data-owner-id="${acc.ownerId || ''}">
              
              <!-- BACKGROUND ACTIONS -->
              <div class="swipe-backgrounds">
                 <div class="swipe-bg-left">
                    <span class="material-symbols-outlined text-white">delete</span>
                 </div>
                 <div class="swipe-bg-right">
                    <span class="material-symbols-outlined text-white">archive</span>
                 </div>
              </div>

              <!-- FOREGROUND CONTENT: Compact Glass Card -->
              <div class="relative z-10 swipe-content">
                <div class="micro-account-content">
                    <!-- Avatar Micro -->
                    <div class="micro-account-avatar-box">
                        <img class="micro-account-avatar" src="${avatar}" alt="">
                        <div class="micro-account-badge" style="background: ${accentColor}"></div>
                    </div>

                    <!-- Info Testuali -->
                    <div class="micro-account-info" onclick="window.location.href='dettaglio_account_privato.html?id=${idSafe}${acc.isOwner ? '' : `&ownerId=${acc.ownerId}`}'">
                        <h3 class="micro-account-name">${acc.nomeAccount || t('without_name')}</h3>
                    </div>

                    <!-- Azioni in alto a destra (Solo Occhio e Puntina) -->
                    <div class="micro-account-top-actions">
                        ${acc.password ? `
                        <button onclick="event.stopPropagation(); window.toggleTripleVisibility('${acc.id}')" 
                                class="micro-btn-utility" style="color: ${accentColor};">
                            <span id="pass-eye-${acc.id}" class="material-symbols-outlined text-[16px]">visibility</span>
                        </button>` : ''}

                        <button onclick="event.stopPropagation(); window.togglePin('${acc.id}', ${acc.isOwner}, '${acc.ownerId}')" 
                                class="micro-btn-utility" style="${pinStyle}">
                            <span class="material-symbols-outlined text-[16px] ${isPinned ? 'filled' : ''}">push_pin</span>
                        </button>
                    </div>
                </div>

                <!-- Dati visibili con pulsanti copia inline -->
                <div class="micro-data-display">
                    ${acc.username ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_user')}:</span>
                        <span class="micro-data-value">${acc.username}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline" 
                                data-copy="${acc.username.replace(/"/g, '&quot;')}" title="${t('copy_username')}">
                            <span class="material-symbols-outlined text-[14px]">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.account ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_account')}:</span>
                        <span class="micro-data-value">${acc.account}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline" 
                                data-copy="${acc.account.replace(/"/g, '&quot;')}" title="${t('copy_account')}">
                            <span class="material-symbols-outlined text-[14px]">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.password ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_password')}:</span>
                        <span class="micro-data-value" id="pass-text-${acc.id}">${dots}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline" 
                                data-copy="${acc.password.replace(/"/g, '&quot;')}" title="${t('copy_password')}">
                            <span class="material-symbols-outlined text-[14px]">content_copy</span>
                        </button>
                    </div>` : ''}
                </div>
              </div>
            </div>
            `;
    }).join('');

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

// --- ACTIONS ---

async function handleArchive(item) {
    const id = item.dataset.id;
    const isOwner = item.dataset.owner === 'true';

    if (!isOwner) {
        showToast(t('error_only_owner_archive'), "error");
        setTimeout(() => filterAndRender(), 500);
        return;
    }

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), {
            isArchived: true
        });
        showToast(t('success_archived'), "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
    } catch (e) {
        logError("Archive Account", e);
        showToast(t('error_generic'), "error");
        filterAndRender();
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    const isOwner = item.dataset.owner === 'true';

    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) {
        filterAndRender();
        return;
    }

    try {
        if (isOwner) {
            await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
            showToast(t('success_deleted'), "success");
            allAccounts = allAccounts.filter(a => a.id !== id);
            filterAndRender();
        } else {
            showToast(t('error_only_owner_delete'), "error");
            filterAndRender();
        }
    } catch (e) {
        logError("Delete Account", e);
        showToast(t('error_generic'), "error");
        filterAndRender();
    }
}

function toggleSort() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const sortBtn = document.getElementById('sort-btn');
    if (sortBtn) {
        const icon = sortBtn.querySelector('span');
        if (icon) icon.textContent = sortOrder === 'asc' ? 'sort_by_alpha' : 'text_rotation_down';
    }
    showToast(`${t('sort_label')}: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
    filterAndRender();
}
