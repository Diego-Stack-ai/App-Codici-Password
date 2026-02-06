import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentAziendaId = null;
let currentCompanyName = '';
let sortOrder = 'asc';
let currentTheme = { from: '#047857', to: '#064e3b', name: 'Green' }; // Default
let currentSwipeList = null;

const companyPalettes = [
    { from: '#047857', to: '#064e3b', name: 'Green' },   // Green (Darker Emerald 700)
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
        if (window.showToast) window.showToast("ID Azienda mancante!", "error");
        window.location.href = 'lista_aziende.html';
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanyInfo(); // Questo setta currentCompanyName
            await loadAccounts();
        } else {
            window.location.href = 'index.html';
        }
    });

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // --- FIX: ROBUST HEADER INJECTION (PROTOCOLLO BASE) ---
    // Gestisce il caso di race condition dove main.js sovrascrive l'header
    function injectHeader() {
        const left = document.getElementById('header-left');
        const center = document.getElementById('header-center');
        const right = document.getElementById('header-right');

        // Se la struttura base non c'è ancora, esci e attendi il prossimo tick/mutation
        if (!left || !center || !right) return;

        // INJECTION IDEMPOTENTE: Esegui solo se i pulsanti non esistono già
        if (!left.querySelector('#btn-back')) {
            left.innerHTML = `
                <button id="btn-back" class="btn-icon-header">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
            `;
            const btnBack = left.querySelector('#btn-back');
            btnBack.addEventListener('click', () => window.history.back());
        }

        if (!center.querySelector('#page-title')) {
            center.innerHTML = `<h1 id="page-title" class="header-title">${currentCompanyName || 'Caricamento...'}</h1>`;
        }

        if (!right.querySelector('#sort-btn')) {
            right.innerHTML = `
                <div class="flex items-center gap-1">
                    <button id="sort-btn" class="btn-icon-header">
                        <span class="material-symbols-outlined">sort_by_alpha</span>
                    </button>
                    <a id="btn-home" href="home_page.html" class="btn-icon-header">
                        <span class="material-symbols-outlined">home</span>
                    </a>
                </div>
            `;
            const btnSort = right.querySelector('#sort-btn');
            btnSort.addEventListener('click', () => toggleSort());
        }

        // Re-apply theme se necessario
        if (currentTheme) applyTheme(currentTheme);
    }

    // 1. Esegui subito (se pronto)
    injectHeader();

    // 2. Osserva cambiamenti nel placeholder (es. caricamento asincrono di main.js/ui-core.js)
    const headerPh = document.getElementById('header-placeholder');
    if (headerPh) {
        const observer = new MutationObserver(() => {
            // Ad ogni cambiamento (es. sovrascrittura innerHTML), tentiamo il ripristino
            injectHeader();
        });
        observer.observe(headerPh, { childList: true, subtree: true });
    } else {
        // Fallback intervallo se il placeholder non è ancora nel DOM (raro)
        setInterval(injectHeader, 500);
    }

    // Copy Button Delegation (Not used since we attach directly in renderList, but kept as reference or for other dynamic elements)
    const container = document.getElementById('accounts-container');
    if (container) {
        container.addEventListener('click', function (e) {
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
        });
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
            currentCompanyName = name; // Update global state

            if (pageTitle) pageTitle.textContent = name;

            currentTheme = getCompanyColor(name, data.colorIndex);
            applyTheme(currentTheme);
        } else {
            currentCompanyName = "Azienda non trovata";
            if (pageTitle) pageTitle.textContent = currentCompanyName;
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
    // Dynamic Header Background (Hex Alpha)
    const header = document.getElementById('company-header');
    if (header) {
        // Light Mode Override: Keep it White/Glass
        if (!document.documentElement.classList.contains('dark')) {
            header.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
            header.style.borderColor = 'rgba(0,0,0,0.05)';
        } else {
            // Default Dark Mode Tint
            header.style.backgroundColor = `${theme.from}1a`;
            header.style.borderColor = `${theme.from}33`;
        }
    }

    // Dynamic Footer Background (Hex Alpha)
    const footer = document.querySelector('.base-footer');
    if (footer) {
        if (!document.documentElement.classList.contains('dark')) {
            footer.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
            footer.style.borderColor = 'rgba(0,0,0,0.05)';
        } else {
            footer.style.backgroundColor = `${theme.from}1a`;
            footer.style.borderColor = `${theme.from}33`;
        }
    }

    // Colorize Header & Footer Icons
    // 1. Header Specific IDs
    const headerIds = ['btn-back', 'sort-btn', 'btn-add-account', 'btn-home', 'page-title'];
    headerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = theme.from;
    });

    // 2. Footer Generic Classes (Settings, Theme Switchers)
    // Target buttons in footer that are standard icons or theme switchers
    const footerIcons = document.querySelectorAll('.base-footer .btn-icon-header, .base-footer .theme-switch-btn');
    footerIcons.forEach(el => {
        el.style.color = theme.from;
        // Optional: Add subtle border color to match
        // el.style.borderColor = `${theme.from}40`; 
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
        // Pin Style: If pinned, colored and rotated. Else faint.
        const pinStyle = isPinned
            ? `color: white; opacity: 1; transform: rotate(-45deg); background-color: ${currentTheme.from};`
            : `color: var(--text-secondary); opacity: 0.3; background-color: rgba(0,0,0,0.05);`;

        // DYNAMIC GRADIENT BACKGROUND
        // Dark Mode: Gradient based on theme color (from -> to)
        // Light Mode: Lighter gradient based on theme color
        let gradientStyle;
        // FIX: Correct detection of Light Mode (Check if NO dark class on HTML)
        const isLightMode = !document.documentElement.classList.contains('dark');

        if (isLightMode) {
            // Light Mode: Very soft gradient from theme color
            gradientStyle = `background: linear-gradient(135deg, ${currentTheme.from}15 0%, ${currentTheme.to}05 100%); border-color: ${currentTheme.from}20;`;
        } else {
            // Dark Mode: Ultra subtle (almost transparent) to maintain dark aesthetics
            gradientStyle = `background: linear-gradient(135deg, ${currentTheme.from}08 0%, ${currentTheme.to}00 100%); border-color: ${currentTheme.from}15;`;
        }
        const themeColor = currentTheme.from;

        return `
            <div class="swipe-row" id="acc-${acc.id}" data-id="${acc.id}">
              
              <!-- BACKGROUND ACTIONS -->
              <div class="swipe-bg-left group-swipe-left">
                 <div style="display: flex; flex-direction: column; align-items: flex-start; color: white;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">delete</span>
                    <span style="font-size: 10px; font-weight: bold;">Elimina</span>
                 </div>
              </div>

              <div class="swipe-bg-right group-swipe-right">
                 <div style="display: flex; flex-direction: column; align-items: flex-end; color: white;">
                    <span class="material-symbols-outlined" style="font-size: 24px;">archive</span>
                    <span style="font-size: 10px; font-weight: bold;">Archivia</span>
                 </div>
              </div>

              <!-- FOREGROUND CONTENT: Card with Dynamic Gradient -->
              <div class="base-card-transparent swipe-content p-0 overflow-hidden border-none bg-transparent card-container" data-id="${acc.id}">
                <a href="dettaglio_account_azienda.html?id=${acc.id}&aziendaId=${currentAziendaId}" 
                   draggable="false"
                   class="account-card-link"
                   style="display: block; padding: 0.75rem; text-decoration: none; position: relative; border-radius: 20px; border: 1px solid; ${gradientStyle}">
                    
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                        <!-- Logo -->
                        <img src="${acc.logo || 'assets/images/google-avatar.png'}" 
                             style="width: 2.5rem; height: 2.5rem; border-radius: 9999px; object-fit: cover; border: 1px solid rgba(0,0,0,0.05); flex-shrink: 0;">
                        
                        <!-- Text Content -->
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                                <h3 style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 80%;">
                                    ${acc.nomeAccount || 'Senza Nome'}
                                </h3>
                            </div>

                            <!-- Details Lines -->
                            <div style="display: flex; flex-direction: column; gap: 0.125rem; font-size: 0.75rem; color: var(--text-secondary);">
                                 ${acc.utente ? `
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="opacity: 0.7;">Utente:</span>
                                        <div style="display: flex; align-items: center;">
                                            <span id="user-text-${acc.id}" style="font-weight: 500; margin-right: 0.5rem; color: var(--text-primary);">********</span>
                                            <button class="copy-btn-dynamic action-btn" data-copy="${acc.utente.replace(/"/g, '&quot;')}" title="Copia Utente">
                                                <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
                                            </button>
                                        </div>
                                    </div>` : ''}
                                
                                ${acc.account ? `
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="opacity: 0.7;">Account:</span>
                                        <div style="display: flex; align-items: center;">
                                            <span id="acc-text-${acc.id}" style="font-weight: 500; margin-right: 0.5rem; color: var(--text-primary);">********</span>
                                            <button class="copy-btn-dynamic action-btn" data-copy="${acc.account.replace(/"/g, '&quot;')}" title="Copia Account">
                                                <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
                                            </button>
                                        </div>
                                    </div>` : ''}
                                
                                ${acc.password ? `
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="opacity: 0.7;">Pass:</span>
                                        <div style="display: flex; align-items: center;">
                                            <span id="pass-text-${acc.id}" style="font-family: monospace; font-weight: 500; margin-right: 0.5rem; color: ${isLightMode ? '#334155' : '#e2e8f0'};">********</span>
                                            <button class="copy-btn-dynamic action-btn" data-copy="${acc.password.replace(/"/g, '&quot;')}" title="Copia Password">
                                                <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
                                            </button>
                                        </div>
                                    </div>` : ''}
                            </div>
                        </div>
                    </div>
                </a>
                
                <!-- Helper Buttons Overlay (Pin/Eye) -->
                <div style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn-pin-toggle action-btn" data-id="${acc.id}"
                            style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: all 0.2s; color: ${currentTheme.from}; ${pinStyle} ${!isPinned ? 'background: rgba(255,255,255,0.25);' : ''}">
                        <span class="material-symbols-outlined ${isPinned ? 'filled' : ''}" style="font-size: 18px;">push_pin</span>
                    </button>
                    ${acc.password ? `
                    <button class="btn-visibility-toggle action-btn" data-id="${acc.id}"
                            style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.2); color: ${currentTheme.from}; cursor: pointer;">
                        <span id="pass-eye-${acc.id}" class="material-symbols-outlined" style="font-size: 18px;">visibility</span>
                    </button>` : ''}
                </div>

              </div>
            </div>
        `;
    }).join('');

    // Attach local listeners
    container.querySelectorAll('.copy-btn-dynamic').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            copyText(btn, btn.dataset.copy);
        });
    });
    container.querySelectorAll('.btn-pin-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            togglePin(btn.dataset.id);
        });
    });
    container.querySelectorAll('.btn-visibility-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            toggleTripleVisibility(btn.dataset.id);
        });
    });

    // Handle Link click carefully if inside swipe
    container.querySelectorAll('.account-card-link').forEach(link => {
        link.addEventListener('click', (e) => {
            // Se lo swipe è attivo o è successo uno scroll, evita il click se necessario
            // In questo caso SwipeList gestisce già gran parte, ma assicuriamoci
        });
    });

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

function copyText(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('span');
        const old = icon.textContent;
        icon.textContent = 'check';
        icon.style.color = '#10b981';
        showToast("Copiato!", "success");
        setTimeout(() => {
            icon.textContent = old;
            icon.style.color = '';
        }, 1500);
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
    const confirmed = await window.showConfirmModal(
        "ELIMINAZIONE ACCOUNT Aziendale",
        "Sei sicuro di voler eliminare questo account aziendale? L'operazione non è reversibile.",
        "ELIMINA",
        "ANNULLA"
    );
    if (!confirmed) {
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
