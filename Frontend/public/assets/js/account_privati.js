import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
// Track IDs of shared accounts to exclude them from standard list
let sharedAccountIds = new Set();
let sortOrder = 'asc'; // Restored state
const APP_VERSION = "v1.2 (Swipe Fix)";

const logDebug = (msg) => console.log(`[${APP_VERSION}] ${msg}`);

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let bgClass = 'bg-gray-800 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'success') bgClass = 'bg-green-500 text-white';
    toast.className = `${bgClass} px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-full opacity-0 pointer-events-auto`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const THEMES = {
    standard: {
        fabBg: ['bg-blue-600', 'hover:bg-blue-700', 'shadow-[0_0_15px_rgba(37,99,235,0.4)]', 'text-white'],
        cardBorder: 'border-blue-500/30',
        glowDetails: 'shadow-blue-500/20'
    },
    shared: {
        fabBg: ['bg-purple-600', 'hover:bg-purple-700', 'shadow-[0_0_15px_rgba(147,51,234,0.4)]', 'text-white'],
        cardBorder: 'border-purple-500/30',
        glowDetails: 'shadow-purple-500/20'
    },
    memo: {
        fabBg: ['bg-amber-600', 'hover:bg-amber-700', 'shadow-[0_0_15px_rgba(217,119,6,0.4)]', 'text-white'],
        cardBorder: 'border-amber-500/30',
        glowDetails: 'shadow-amber-500/20'
    },
    shared_memo: {
        fabBg: ['bg-emerald-600', 'hover:bg-emerald-700', 'shadow-[0_0_15px_rgba(5,150,105,0.4)]', 'text-white'],
        cardBorder: 'border-emerald-500/30',
        glowDetails: 'shadow-emerald-500/20'
    }
};

function applyTheme(type) {
    const theme = THEMES[type] || THEMES.standard;

    // Helper to swap classes
    const updateClasses = (id, classKeys) => {
        const el = document.getElementById(id);
        if (!el) return;

        // Remove old theme classes
        Object.values(THEMES).forEach(t => {
            if (t.fabBg) el.classList.remove(...t.fabBg);
        });

        // Add new theme classes
        if (classKeys === 'fabBg' && theme.fabBg) el.classList.add(...theme.fabBg);
    };

    updateClasses('add-account-btn', 'fabBg');
    // Header remains neutral (Titanium Standard) - No JS modification needed for header/title
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("App Version:", APP_VERSION);

    // Apply Theme immediately
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';
    applyTheme(type);

    // Visual Version Indicator (Temporary for debugging)
    const title = document.getElementById('page-title');
    if (title) title.setAttribute('title', APP_VERSION);

    const searchInput = document.querySelector('input[type="search"]');
    const sortBtn = document.getElementById('sort-btn');

    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    if (sortBtn) {
        sortBtn.onclick = toggleSort;
    }

    const container = document.getElementById('accounts-container');
    if (container) {
        container.onclick = function (e) {
            const btn = e.target.closest('.copy-btn-dynamic');
            if (btn) {
                e.preventDefault(); e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(() => {
                    const icon = btn.querySelector('span');
                    const old = icon.textContent; icon.textContent = 'check';
                    setTimeout(() => icon.textContent = old, 1500);
                    showToast("Copiato negli appunti!");
                });
            }
        };
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            logDebug("User loggato: " + user.email);
            await loadAccounts();
        } else {
            logDebug("User non loggato. Reindirizzo...");
            setTimeout(() => window.location.href = 'index.html', 1000);
        }
    });

    // Global Pin/Unpin function
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

    // Unified Visibility Toggle (User, Account, Password)
    window.toggleTripleVisibility = (id) => {
        const eye = document.getElementById(`pass-eye-${id}`);
        const userText = document.getElementById(`user-text-${id}`);
        const accText = document.getElementById(`acc-text-${id}`);
        const passText = document.getElementById(`pass-text-${id}`);

        const card = document.getElementById(`acc-${id}`);
        if (!card || !eye) return;

        // Retrieve real values from copy buttons in the same card
        const copyBtns = card.querySelectorAll('.copy-btn-dynamic');
        let userVal = '', accVal = '', passVal = '';

        copyBtns.forEach(btn => {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const val = btn.getAttribute('data-copy') || '';
            if (title.includes('username') || title.includes('utente')) userVal = val;
            else if (title.includes('account')) accVal = val;
            else if (title.includes('password')) passVal = val;
        });

        const isHidden = eye.textContent === 'visibility';
        const dots = '********';

        if (isHidden) {
            eye.textContent = 'visibility_off'; // Show "Hide" icon
            if (userText) userText.textContent = userVal;
            if (accText) accText.textContent = accVal;
            if (passText) passText.textContent = passVal;
        } else {
            eye.textContent = 'visibility'; // Show "Show" icon
            if (userText) userText.textContent = dots;
            if (accText) accText.textContent = dots;
            if (passText) passText.textContent = dots;
        }
    };
});

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
        container.innerHTML = `<div class="text-center py-10 opacity-50"><p>Nessun account trovato.</p></div>`;
        return;
    }

    container.innerHTML = list.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        const idSafe = encodeURIComponent(acc.id);

        const isMemo = acc._isMemo;
        const isShared = acc._isShared || acc.isSharedWithMe || sharedAccountIds.has(acc.id);

        let accentColor = 'rgba(80, 150, 255, 0.6)'; // Default Blue
        if (isShared && isMemo) accentColor = 'rgba(16, 185, 129, 0.6)'; // Emerald
        else if (isShared) accentColor = 'rgba(147, 51, 234, 0.6)'; // Purple
        else if (isMemo) accentColor = 'rgba(245, 158, 11, 0.6)'; // Amber

        const isPinned = !!acc.isPinned;
        const pinIcon = isPinned ? 'push_pin' : 'push_pin';
        const pinClass = isPinned ? 'text-white' : 'text-white/40 group-hover:text-white/80';
        const pinTitle = isPinned ? 'Rimuovi dai fissati' : 'Fissa in alto';

        const dots = '********';

        return `
            <div class="relative overflow-hidden select-none swipe-row rounded-2xl h-full shadow-lg border-glow saetta transition-all duration-300 hover:-translate-y-1 group" 
                 style="touch-action: pan-y;"
                 id="acc-${acc.id}" 
                 data-id="${acc.id}"
                 data-owner="${acc.isOwner}"
                 data-owner-id="${acc.ownerId || ''}">
              
              <!-- BACKGROUND ACTIONS -->
              <div class="absolute inset-y-0 left-0 flex w-full swipe-bg-left opacity-0 transition-opacity z-0">
                 <div class="w-full h-full bg-red-600/80 flex items-center justify-start pl-8 rounded-2xl">
                    <div class="flex flex-col items-center">
                        <span class="material-symbols-outlined text-white text-2xl">delete</span>
                        <span class="view-label text-white mt-1">Elimina</span>
                    </div>
                 </div>
              </div>

              <div class="absolute inset-y-0 right-0 flex w-full swipe-bg-right opacity-0 transition-opacity z-0">
                 <div class="w-full h-full bg-amber-600/80 flex items-center justify-end pr-8 rounded-2xl">
                    <div class="flex flex-col items-center">
                        <span class="material-symbols-outlined text-white text-2xl">archive</span>
                        <span class="view-label text-white mt-1">Archivia</span>
                    </div>
                 </div>
              </div>

              <!-- FOREGROUND CONTENT: Titanium Glass Card -->
              <div class="relative z-10 bg-slate-500/5 backdrop-blur-sm rounded-2xl swipe-content h-full overflow-hidden border border-white/5">
                
                <!-- INTERNAL BEACON GLOW -->
                <div class="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 blur-md rounded-full"></div>
                <div class="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full blur-xl" style="background: ${accentColor}"></div>

                <a href="dettaglio_account_privato.html?id=${idSafe}${acc.isOwner ? '' : `&ownerId=${acc.ownerId}`}" 
                   draggable="false"
                   class="block p-5 active:scale-[0.98] transition-all duration-300 h-full flex flex-col relative">
                    
                    <div class="flex items-start space-x-4">
                        <div class="relative shrink-0">
                            <img class="w-12 h-12 rounded-xl object-cover bg-white/5 border border-white/10 shadow-sm pointer-events-none" src="${avatar}">
                            <div class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a0f1e]" style="background: ${accentColor}"></div>
                        </div>
                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-bold text-white text-base truncate leading-tight">${acc.nomeAccount || 'Senza Nome'}</h3>
                            </div>

                            <div class="space-y-3">
                                ${acc.username ? `
                                <div class="relative">
                                    <div class="view-label text-white/40 mb-1">Utente</div>
                                    <div class="flex items-center justify-between bg-black/20 rounded-lg px-3 h-9 border border-white/5">
                                        <span id="user-text-${acc.id}" class="text-white text-sm truncate pr-8">${dots}</span>
                                        <button class="copy-btn-dynamic absolute right-1 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white transition-colors" 
                                                data-copy="${acc.username.replace(/"/g, '&quot;')}" title="Copia Username">
                                            <span class="material-symbols-outlined text-[18px]">content_copy</span>
                                        </button>
                                    </div>
                                </div>` : ''}

                                ${acc.account ? `
                                <div class="relative">
                                    <div class="view-label text-white/40 mb-1">Account</div>
                                    <div class="flex items-center justify-between bg-black/20 rounded-lg px-3 h-9 border border-white/5">
                                        <span id="acc-text-${acc.id}" class="text-white text-sm truncate pr-8">${dots}</span>
                                        <button class="copy-btn-dynamic absolute right-1 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white transition-colors" 
                                                data-copy="${acc.account.replace(/"/g, '&quot;')}" title="Copia Account">
                                            <span class="material-symbols-outlined text-[18px]">content_copy</span>
                                        </button>
                                    </div>
                                </div>` : ''}

                                ${acc.password ? `
                                <div class="relative">
                                    <div class="view-label text-white/40 mb-1">Password</div>
                                    <div class="flex items-center justify-between bg-black/20 rounded-lg px-3 h-9 border border-white/5">
                                        <span id="pass-text-${acc.id}" class="text-white text-sm truncate pr-8 font-mono tracking-wider">${dots}</span>
                                        <button class="copy-btn-dynamic absolute right-1 p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white transition-colors" 
                                                data-copy="${acc.password.replace(/"/g, '&quot;')}" title="Copia Password">
                                            <span class="material-symbols-outlined text-[18px]">content_copy</span>
                                        </button>
                                    </div>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>
                </a>

                <!-- UTILITY BUTTONS -->
                <div class="absolute top-4 right-4 z-20 flex items-center gap-1.5">
                    <button onclick="event.stopPropagation(); window.togglePin('${acc.id}', ${acc.isOwner}, '${acc.ownerId}')" 
                            class="flex size-8 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-90 ${pinClass}" 
                            title="${pinTitle}">
                        <span class="material-symbols-outlined text-[16px] ${isPinned ? 'filled' : ''}">${pinIcon}</span>
                    </button>
                    ${acc.password ? `
                    <button onclick="event.stopPropagation(); window.toggleTripleVisibility('${acc.id}')" 
                            class="flex size-8 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all active:scale-90" 
                            title="Mostra/Nascondi Dati">
                        <span id="pass-eye-${acc.id}" class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>` : ''}
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
        showToast("Solo il proprietario può archiviare.", "error");
        setTimeout(() => filterAndRender(), 500);
        return;
    }

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), {
            isArchived: true
        });
        showToast("Account archiviato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
    } catch (e) {
        logError("Archive Account", e);
        showToast("Errore durante l'archiviazione", "error");
        filterAndRender();
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    const isOwner = item.dataset.owner === 'true';

    if (!confirm("Sei sicuro di voler eliminare definitivamente questo account?")) {
        filterAndRender();
        return;
    }

    try {
        if (isOwner) {
            await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
            showToast("Account eliminato", "success");
            allAccounts = allAccounts.filter(a => a.id !== id);
            filterAndRender();
        } else {
            showToast("Impossibile eliminare account condivisi.", "error");
            filterAndRender();
        }
    } catch (e) {
        logError("Delete Account", e);
        showToast("Errore eliminazione", "error");
        filterAndRender();
    }
}

function toggleSort() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const sortBtn = document.getElementById('sort-btn');
    if (sortBtn) {
        sortBtn.classList.toggle('bg-gray-200', sortOrder === 'desc');
    }
    showToast(`Ordinamento: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
    filterAndRender();
}
