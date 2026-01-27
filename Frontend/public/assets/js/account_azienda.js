import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentAziendaId = null;
let sortOrder = 'asc';
let currentTheme = { from: '#10b981', to: '#047857', name: 'Green' }; // Default
let currentSwipeList = null;

const companyPalettes = [
    { from: '#10b981', to: '#047857', name: 'Green' },   // Green (Default)
    { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },    // Blue
    { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },  // Purple
    { from: '#f59e0b', to: '#b45309', name: 'Orange' },  // Orange
    { from: '#ec4899', to: '#be185d', name: 'Pink' },    // Pink
    { from: '#ef4444', to: '#b91c1c', name: 'Red' },     // Red
    { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },    // Cyan
];

// --- HELPERS ---
function getCompanyColor(companyName, colorIndex) {
    if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
        return companyPalettes[colorIndex];
    }
    if (!companyName) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % companyPalettes.length;
    return companyPalettes[index];
}

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

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('id');

    if (!currentAziendaId) {
        alert("ID Azienda mancante!");
        window.location.href = 'lista_aziende.html';
        return;
    }

    const btnAdd = document.getElementById('btn-add-account');
    if (btnAdd) {
        btnAdd.href = `aggiungi_account_azienda.html?aziendaId=${currentAziendaId}`;
    }

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // Sort Button
    const sortBtn = document.getElementById('sort-btn');
    if (sortBtn) {
        sortBtn.onclick = toggleSort;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanyInfo();
            await loadAccounts();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Copy Button Delegation
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
});

async function loadCompanyInfo() {
    try {
        const docRef = doc(db, "users", currentUser.uid, "aziende", currentAziendaId);
        const docSnap = await getDoc(docRef);

        const pageTitle = document.getElementById('page-title');

        if (docSnap.exists()) {
            const data = docSnap.data();
            const name = data.ragioneSociale || "Azienda";
            if (pageTitle) pageTitle.textContent = name;

            currentTheme = getCompanyColor(name, data.colorIndex);
            applyTheme(currentTheme);
        } else {
            if (pageTitle) pageTitle.textContent = "Azienda non trovata";
        }
    } catch (e) {
        console.error("Errore caricamento azienda", e);
    }
}

function applyTheme(theme) {
    document.documentElement.style.setProperty('--primary-color', theme.from);
    document.documentElement.style.setProperty('--primary-dark', theme.to);



    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.style.setProperty('--tw-ring-color', theme.from);
    }

    // Dynamic Header Background (Hex Alpha)
    const header = document.getElementById('company-header');
    if (header) {
        // bg-primary/10 equivalent -> opacity ~10% -> 1A
        header.style.backgroundColor = `${theme.from}1a`;
        // border-primary/20 equivalent -> opacity ~20% -> 33
        header.style.borderColor = `${theme.from}33`;
    }

    // Dynamic Footer Background (Hex Alpha)
    const footer = document.getElementById('company-footer');
    if (footer) {
        footer.style.backgroundColor = `${theme.from}1a`;
        footer.style.borderColor = `${theme.from}33`;
    }

    // Colorize Header Icons and Title
    const icons = ['btn-back', 'sort-btn', 'btn-add-account', 'btn-home', 'page-title'];
    icons.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.color = theme.from;
            // Ensure hover state is also themed via CSS variables or just let it darken naturally?
            // Tailwind hover:bg-black/5 handles background. Text stays theme color.
        }
    });
}

async function loadAccounts() {
    const container = document.getElementById('accounts-container');
    try {
        const colRef = collection(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts");
        const snap = await getDocs(colRef);

        allAccounts = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(a => !a.isArchived); // Filter out archived

        filterAndRender();
    } catch (e) {
        console.error(e);
        if (container) container.innerHTML = `<div class="text-center py-10 text-red-500">Errore: ${e.message}</div>`;
    }
}

function toggleSort() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const sortBtn = document.getElementById('sort-btn');
    if (sortBtn) sortBtn.classList.toggle('bg-gray-200', sortOrder === 'desc');
    showToast(`Ordinamento: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
    filterAndRender();
}

function filterAndRender() {
    const searchInput = document.querySelector('input[type="search"]');
    const term = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = allAccounts.filter(acc =>
        (acc.nomeAccount && acc.nomeAccount.toLowerCase().includes(term)) ||
        (acc.utente && acc.utente.toLowerCase().includes(term))
    );

    // Sort: Pinned first, then A-Z
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const nameA = (a.nomeAccount || '').toLowerCase();
        const nameB = (b.nomeAccount || '').toLowerCase();

        if (a.isPinned && b.isPinned) return nameA.localeCompare(nameB);

        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50"><p>Nessun account trovato per questa azienda.</p></div>`;
        return;
    }

    container.innerHTML = list.map(acc => {
        const isPinned = !!acc.isPinned;
        const pinClass = isPinned ? 'text-white rotate-45 opacity-100' : 'text-white/40 hover:text-white';
        const gradientStyle = `background: linear-gradient(to right, ${currentTheme.from}, ${currentTheme.to})`;
        const themeHex = currentTheme.to;

        return `
             <div class="relative overflow-hidden mb-3 select-none swipe-row rounded-xl" 
                 style="touch-action: pan-y;"
                 id="acc-${acc.id}" 
                 data-id="${acc.id}">
              
              <!-- BACKGROUND ACTIONS -->
              <!-- RIGHT SWIPE reveals LEFT BG: DELETE -->
              <div class="absolute inset-y-0 left-0 flex w-full swipe-bg-left opacity-0 transition-opacity z-0">
                 <div class="w-full h-full bg-red-600 flex items-center justify-start pl-6 rounded-xl">
                    <div class="flex flex-col items-center">
                        <span class="material-symbols-outlined text-white text-2xl">delete</span>
                        <span class="text-white text-[10px] font-bold uppercase mt-1">Elimina</span>
                    </div>
                 </div>
              </div>

              <!-- LEFT SWIPE reveals RIGHT BG: ARCHIVE -->
              <div class="absolute inset-y-0 right-0 flex w-full swipe-bg-right opacity-0 transition-opacity z-0">
                 <div class="w-full h-full bg-yellow-500 flex items-center justify-end pr-6 rounded-xl">
                    <div class="flex flex-col items-center">
                        <span class="material-symbols-outlined text-white text-2xl">archive</span>
                        <span class="text-white text-[10px] font-bold uppercase mt-1">Archivia</span>
                    </div>
                 </div>
              </div>

              <!-- FOREGROUND CONTENT: Premium Card -->
              <div class="relative z-10 bg-white rounded-xl transition-transform swipe-content shadow-sm">
                <a href="dettaglio_account_azienda.html?id=${acc.id}&aziendaId=${currentAziendaId}" 
                   draggable="false"
                   class="block mr-8 rounded-xl p-3 shadow-lg active:scale-[0.98] transition-all border border-white/10 overflow-visible"
                   style="${gradientStyle}">
                    <div class="flex items-start space-x-3 text-left">
                        <img class="w-10 h-10 rounded-full object-cover bg-white/20 shadow-sm pointer-events-none" src="${acc.logo || 'assets/images/google-avatar.png'}">
                        <div class="flex-1 min-w-0 pr-0">
                            <div class="flex items-center justify-between mb-0.5">
                                <h3 class="font-bold text-white text-sm whitespace-normal break-words">${acc.nomeAccount || 'Senza Nome'}</h3>
                            </div>
                            <div class="space-y-0.5 text-[12px]">
                                 ${acc.utente ? `
                                    <div class="flex justify-between items-center text-left relative pr-5">
                                        <span class="text-white/60">Utente:</span>
                                        <div class="flex items-center min-w-0">
                                            <span id="user-text-${acc.id}" class="text-white truncate mr-2">********</span>
                                        </div>
                                        <button class="copy-btn-dynamic absolute right-[-5px] p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors" data-copy="${acc.utente.replace(/"/g, '&quot;')}" title="Copia Username">
                                            <span class="material-symbols-outlined text-[19px]">content_copy</span>
                                        </button>
                                    </div>` : ''}
                                ${acc.account ? `
                                    <div class="flex justify-between items-center text-left relative pr-5">
                                        <span class="text-white/60">Account:</span>
                                        <div class="flex items-center min-w-0">
                                            <span id="acc-text-${acc.id}" class="text-white truncate mr-2">********</span>
                                        </div>
                                        <button class="copy-btn-dynamic absolute right-[-5px] p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors" data-copy="${acc.account.replace(/"/g, '&quot;')}" title="Copia Account">
                                            <span class="material-symbols-outlined text-[19px]">content_copy</span>
                                        </button>
                                    </div>` : ''}
                                ${acc.password ? `
                                    <div class="flex justify-between items-center text-left relative pr-5">
                                        <span class="text-white/60">Pass:</span>
                                        <div class="flex items-center min-w-0">
                                            <span id="pass-text-${acc.id}" class="text-white truncate mr-2 font-mono">********</span>
                                        </div>
                                        <button class="copy-btn-dynamic absolute right-[-5px] p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors" data-copy="${acc.password.replace(/"/g, '&quot;')}" title="Copia Password">
                                            <span class="material-symbols-outlined text-[19px]">content_copy</span>
                                        </button>
                                    </div>` : ''}
                            </div>
                        </div>
                    </div>
                </a>
                
                <!-- Helper Buttons Overlay (Pin/Eye) -->
                <div class="absolute top-1.5 right-1.5 z-20 flex flex-col gap-1">
                    <button onclick="event.stopPropagation(); window.togglePin('${acc.id}')" 
                            class="p-0.5 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-sm ${pinClass}" 
                            style="background-color: ${themeHex}80"
                            title="Fissa in alto">
                        <span class="material-symbols-outlined text-[12px] filled">push_pin</span>
                    </button>
                    ${acc.password ? `
                    <button onclick="event.stopPropagation(); window.toggleTripleVisibility('${acc.id}')" 
                            class="p-0.5 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-sm text-white/90" 
                            style="background-color: ${themeHex}80"
                            title="Mostra/Nascondi Dati">
                        <span id="pass-eye-${acc.id}" class="material-symbols-outlined text-[12px]">visibility</span>
                    </button>` : ''}
                </div>

              </div>
            </div>
        `;
    }).join('');

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15, // Lower threshold for mobile/desktop
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

// --- ACTIONS ---

window.togglePin = async (id) => {
    if (!currentUser) return;
    const acc = allAccounts.find(a => a.id === id);
    if (!acc) return;

    const newVal = !acc.isPinned;
    acc.isPinned = newVal;
    filterAndRender();

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), { isPinned: newVal });
    } catch (e) {
        console.error(e);
        acc.isPinned = !newVal; // Revert
        filterAndRender();
        showToast("Errore pin", "error");
    }
};

window.toggleTripleVisibility = (id) => {
    const eye = document.getElementById(`pass-eye-${id}`);
    const userText = document.getElementById(`user-text-${id}`);
    const accText = document.getElementById(`acc-text-${id}`);
    const passText = document.getElementById(`pass-text-${id}`);

    const card = document.getElementById(`acc-${id}`);
    if (!card || !eye) return;

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
        eye.textContent = 'visibility_off';
        if (userText) userText.textContent = userVal;
        if (accText) accText.textContent = accVal;
        if (passText) passText.textContent = passVal;
    } else {
        eye.textContent = 'visibility';
        if (userText) userText.textContent = dots;
        if (accText) accText.textContent = dots;
        if (passText) passText.textContent = dots;
    }
};

async function handleArchive(item) {
    const id = item.dataset.id;
    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), {
            isArchived: true
        });
        showToast("Account archiviato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id); // Remove visual
    } catch (e) {
        console.error(e);
        showToast("Errore durante l'archiviazione", "error");
        filterAndRender(); // Restore position
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (!confirm("Sei sicuro di voler eliminare questo account aziendale?")) {
        filterAndRender(); // Restore
        return;
    }

    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
        showToast("Account eliminato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore eliminazione", "error");
        filterAndRender();
    }
}
