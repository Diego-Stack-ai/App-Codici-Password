import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { showToast } from './ui-core.js';

// --- TITANIUM STATE (v10.1) ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sharedAccountIds = new Set();
let sortOrder = 'asc';
const TITANIUM_PAGE_ID = "PRIVATO_MATRIX_V10";

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Titanium Module Initialized: ${TITANIUM_PAGE_ID}`);

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadAccounts();
        } else {
            window.location.href = 'index.html';
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
                showToast(newVal ? "Account fissato in alto" : "Fissaggio rimosso", "success");
            } else {
                showToast("Dati condivisi: Pin non persistente", "warning");
            }
        } catch (e) {
            logError("Pin Toggle", e);
            acc.isPinned = !newVal; // Revert
            filterAndRender();
        }
    };

    // Unified Visibility Toggle (Titanium Reveal Strategy)
    window.toggleReveal = (id) => {
        const card = document.getElementById(`acc-${id}`);
        if (!card) return;

        const eye = card.querySelector('.reveal-eye');
        const labels = card.querySelectorAll('[data-reveal]');

        const isHidden = eye.textContent === 'visibility';
        const dots = '••••••••';

        if (isHidden) {
            eye.textContent = 'visibility_off';
            labels.forEach(label => {
                label.textContent = label.getAttribute('data-real-value');
            });
        } else {
            eye.textContent = 'visibility';
            labels.forEach(label => {
                label.textContent = dots;
            });
        }
    };
});

/**
 * DATA LOADING ENGINE
 */
async function loadAccounts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type') || 'standard';

        let sharedWithMeAccounts = [];
        sharedAccountIds.clear();

        // 1. Inizializzazione Firebase
        const colRef = collection(db, "users", currentUser.uid, "accounts");
        const ownSnap = await getDocs(colRef);

        // 2. Load Shared
        try {
            const invitesQ = query(collection(db, "invites"),
                where("recipientEmail", "==", currentUser.email),
                where("status", "==", "accepted")
            );
            const invitesSnap = await getDocs(invitesQ);
            const promises = invitesSnap.docs.map(async invDoc => {
                const invData = invDoc.data();
                try {
                    const accSnap = await getDoc(doc(db, "users", invData.senderUid, "accounts", invData.accountId));
                    if (accSnap.exists()) {
                        sharedAccountIds.add(accSnap.id);
                        return { ...accSnap.data(), id: accSnap.id, isOwner: false, ownerId: invData.senderUid, _isShared: true };
                    }
                } catch (e) { }
                return null;
            });
            sharedWithMeAccounts = (await Promise.all(promises)).filter(a => a !== null);
        } catch (e) { }

        // 3. Merge
        const ownAccounts = ownSnap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            isOwner: true,
            ownerId: currentUser.uid,
            _isMemo: !!doc.data().isMemo || doc.data().type === 'memorandum'
        })).filter(a => !a.isArchived);

        allAccounts = [...ownAccounts, ...sharedWithMeAccounts];
        filterAndRender();

    } catch (error) {
        logError("Accounts Engine", error);
        showToast("Errore sicronizzazione dati", "error");
    }
}

/**
 * FILTERING & SORTING (Titanium Pure)
 */
function filterAndRender() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        if (type === 'standard') return !acc._isShared && !acc._isMemo;
        if (type === 'shared') return acc._isShared;
        if (type === 'memo') return acc._isMemo;
        return true;
    });

    if (searchVal) {
        filtered = filtered.filter(acc =>
            (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
            (acc.username || '').toLowerCase().includes(searchVal)
        );
    }

    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (a.nomeAccount || '').toLowerCase().localeCompare((b.nomeAccount || '').toLowerCase());
    });

    renderList(filtered);
}

/**
 * RENDERING ENGINE (Titanium Matrix V2.0)
 */
function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-30 select-none">
                <span class="material-symbols-outlined text-5xl mb-3">folder_open</span>
                <p class="text-xs uppercase tracking-widest font-bold">Nessun account protetto</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        const isPinned = !!acc.isPinned;
        const dots = '••••••••';

        // Palette Matrix per Categoria
        let matrixClass = 'matrix-blue';
        if (acc._isShared) matrixClass = 'matrix-red';
        if (acc._isMemo) matrixClass = 'matrix-orange';

        return `
            <div class="swipe-row relative group h-full" 
                 id="acc-${acc.id}" 
                 data-id="${acc.id}"
                 data-owner="${acc.isOwner}">
                
                <!-- BACKGROUND ACTIONS (Swipe) -->
                <div class="absolute inset-0 flex transition-opacity pointer-events-none">
                    <div class="w-full flex justify-start items-center bg-red-600/20 pl-8 rounded-[24px]">
                        <span class="material-symbols-outlined text-red-500">delete</span>
                    </div>
                    <div class="w-full flex justify-end items-center bg-amber-600/20 pr-8 rounded-[24px]">
                        <span class="material-symbols-outlined text-amber-500">archive</span>
                    </div>
                </div>

                <!-- FOREGROUND: Titanium Glass Card -->
                <div class="swipe-content relative z-10 bg-[#0a0f1e]/60 backdrop-blur-2xl rounded-[24px] border border-white/5 border-glow hover:-translate-y-1 transition-all duration-300 shadow-2xl overflow-hidden">
                    <div class="saetta opacity-20"></div>
                    
                    <!-- Top Matrix Accent -->
                    <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

                    <div class="p-6">
                        <div class="flex items-start justify-between mb-6">
                            <div class="flex items-center gap-4">
                                <div class="relative">
                                    <img src="${avatar}" class="size-12 rounded-xl object-cover bg-white/5 border border-white/10 p-0.5">
                                    <div class="absolute -bottom-1 -right-1 size-3 rounded-full bg-blue-500 border-2 border-[#0a0f1e]"></div>
                                </div>
                                <div class="flex flex-col">
                                    <h3 class="text-white font-black text-lg leading-tight truncate max-w-[150px]">${acc.nomeAccount || 'Account'}</h3>
                                    <span class="text-[9px] uppercase tracking-widest text-white/30 font-bold">Protetto Titanium</span>
                                </div>
                            </div>

                            <div class="flex items-center gap-2">
                                <button onclick="window.togglePin('${acc.id}', ${acc.isOwner})" 
                                        class="size-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors ${isPinned ? 'text-blue-400' : 'text-white/20'}">
                                    <span class="material-symbols-outlined text-[18px] ${isPinned ? 'filled' : ''}">push_pin</span>
                                </button>
                                <button onclick="window.toggleReveal('${acc.id}')" 
                                        class="size-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/20 hover:text-white">
                                    <span class="material-symbols-outlined text-[18px] reveal-eye">visibility</span>
                                </button>
                            </div>
                        </div>

                        <!-- Data Fields -->
                        <div class="space-y-4">
                            ${acc.username ? renderField("Username", acc.username, "account_circle") : ''}
                            ${acc.password ? renderField("Password", acc.password, "key", true) : ''}
                        </div>

                        <!-- Action Link -->
                        <a href="dettaglio_account_privato.html?id=${acc.id}" class="mt-6 flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group/link">
                            <span class="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover/link:text-white transition-colors">Vedi Dettagli Completi</span>
                            <span class="material-symbols-outlined text-sm text-white/20 group-hover/link:text-blue-400 group-hover/link:translate-x-1 transition-all">chevron_right</span>
                        </a>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Re-init Swipe Logic
    new SwipeList('.swipe-row', {
        threshold: 0.2,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

/**
 * HELPER: RENDERING FIELD (Titanium Style)
 */
function renderField(label, value, icon, isSensitive = false) {
    const displayValue = isSensitive ? '••••••••' : value;
    return `
        <div class="space-y-1.5">
            <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 ml-1">${label}</span>
            <div class="h-12 flex items-center justify-between px-4 bg-black/40 border border-white/5 rounded-2xl relative group/field overflow-hidden">
                <div class="saetta opacity-5"></div>
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <span class="material-symbols-outlined text-white/20 text-[18px]">${icon}</span>
                    <span data-reveal 
                          data-real-value="${value.replace(/"/g, '&quot;')}" 
                          class="text-white text-sm font-bold truncate">
                        ${displayValue}
                    </span>
                </div>
                <button onclick="navigator.clipboard.writeText('${value.replace(/'/g, "\\'")}').then(() => showToast('Copiato nel protocollo', 'success'))"
                        class="size-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/10 hover:text-blue-400 transition-all opacity-0 group-hover/field:opacity-100">
                    <span class="material-symbols-outlined text-[18px]">content_copy</span>
                </button>
            </div>
        </div>`;
}

/**
 * SWIPE ACTIONS
 */
async function handleArchive(item) {
    const id = item.dataset.id;
    if (confirm("Archiviare questo account?")) {
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isArchived: true });
            showToast("Account archiviato", "success");
            loadAccounts();
        } catch (e) { logError("Archive", e); }
    } else {
        renderList(allAccounts); // Reset UI
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (confirm("ELIMINARE DEFINITIVAMENTE l'account?")) {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
            showToast("Protocollo eliminato", "success");
            loadAccounts();
        } catch (e) { logError("Delete", e); }
    } else {
        renderList(allAccounts); // Reset UI
    }
}
