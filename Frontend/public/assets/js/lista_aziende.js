// LISTA AZIENDE JS - Refactored for Firebase Modular SDK (v11)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

console.log("Script Lista Aziende Caricato (Modular)");

// STATE
let allAziende = [];
let sortOrder = 'asc'; // 'asc' | 'desc'
let currentUser = null;

// --- UI HELPERS ---
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');

    let bgClass = 'bg-gray-800 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'success') bgClass = 'bg-green-500 text-white';

    toast.className = `${bgClass} px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-full opacity-0 pointer-events-auto`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-full', 'opacity-0');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // UPDATED SELECTOR (Match ID added in HTML)
    const listContainer = document.getElementById('aziende-list-container') || document.querySelector('main .flex.flex-col.gap-4');
    // --- UI SETUP (Header & Footer Injection) ---
    const setupSharedComponents = () => {
        const checkInterval = setInterval(() => {
            const hCenter = document.getElementById('header-center');
            const hLeft = document.getElementById('header-left');
            const hRight = document.getElementById('header-right');
            const fRight = document.getElementById('footer-actions-right');

            if (hCenter && hLeft && hRight && fRight) {
                clearInterval(checkInterval);

                // --- HEADER ---

                // 1. Title
                hCenter.innerHTML = '<h1 class="header-title">Aziende</h1>';

                // 2. Back Button
                hLeft.innerHTML = `
                    <button onclick="window.location.href='home_page.html'" class="btn-icon-header">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                `;

                // 3. Header Actions (Sort + Home)
                hRight.innerHTML = '';

                // Sort Button (View Action -> Header)
                const sortBtn = document.createElement('button');
                sortBtn.className = 'btn-icon-header';
                sortBtn.innerHTML = '<span class="material-symbols-outlined">sort_by_alpha</span>';
                sortBtn.onclick = () => {
                    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                    showToast(`Ordinamento: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
                    renderAziende();
                };
                hRight.appendChild(sortBtn);

                // Home Button (Protocol Requirement)
                const homeBtn = document.createElement('a');
                homeBtn.href = 'home_page.html';
                homeBtn.className = 'btn-icon-header';
                homeBtn.style.marginLeft = '0.5rem';
                homeBtn.innerHTML = '<span class="material-symbols-outlined">home</span>';
                hRight.appendChild(homeBtn);

                // --- FOOTER ---

                // Add Button (Primary Action -> Footer)
                // Check if already added to avoid duplicates
                if (!document.getElementById('add-company-btn')) {
                    const addBtn = document.createElement('a');
                    addBtn.id = 'add-company-btn';
                    addBtn.href = 'aggiungi_nuova_azienda.html';
                    addBtn.className = 'btn-icon-header';
                    addBtn.style.marginRight = '1rem'; // Space from Settings
                    addBtn.innerHTML = '<span class="material-symbols-outlined" style="color: var(--accent-blue); font-size: 28px;">add_circle</span>';

                    // Prepend to Footer Right (Before Settings)
                    fRight.prepend(addBtn);
                }

                console.log("UI Setup Complete [Header & Footer Compliance]");
            }
        }, 100);

        // Safety timeout
        setTimeout(() => clearInterval(checkInterval), 5000);
    };

    setupSharedComponents();

    // AUTH & LOAD
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Logged in:", user.uid);
            await loadAziende();
        } else {
            console.log("User not logged in");
            if (listContainer) {
                listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <p class="text-slate-500">Effettua il login per vedere le aziende.</p>
                </div>`;
            }
        }
    });

    // LOAD DATA
    async function loadAziende() {
        if (!currentUser || !listContainer) return;

        try {
            console.log("Fetching collection: users/" + currentUser.uid + "/aziende");
            // Modular SDK: collection(db, path...)
            const colRef = collection(db, "users", currentUser.uid, "aziende");
            const snapshot = await getDocs(colRef);

            if (snapshot.empty) {
                console.log("Snapshot empty");
                allAziende = [];
            } else {
                console.log("Docs found:", snapshot.size);
                allAziende = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }

            renderAziende();

        } catch (error) {
            console.error("Errore caricamento aziende:", error);
            listContainer.innerHTML = `
                <div class="text-center py-10 text-red-500 p-4 bg-red-50 rounded-lg border border-red-100 mx-4">
                    <p class="font-bold">Si è verificato un errore</p>
                    <p class="text-xs mt-1">${error.message}</p>
                </div>`;
        }
    }

    // RENDER FUNCTION
    window.renderAziende = function () { // Exposed for manual triggering if needed
        if (!listContainer) return;

        if (allAziende.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <span class="material-symbols-outlined text-3xl text-slate-400">domain_disabled</span>
                    </div>
                    <h3 class="text-lg font-medium text-slate-900 mb-1">Nessuna azienda</h3>
                    <p class="text-slate-500 max-w-xs mx-auto">
                        Aggiungi la tua prima azienda.
                    </p>
                </div>
            `;
            return;
        }

        // Sorting Logic: Pinned Static A-Z, Others Dynamic
        const localList = [...allAziende];
        localList.sort((a, b) => {
            // 1. Pinned always first
            const pinA = !!a.isPinned;
            const pinB = !!b.isPinned;
            if (pinA && !pinB) return -1;
            if (!pinA && pinB) return 1;

            const nameA = (a.ragioneSociale || '').toLowerCase();
            const nameB = (b.ragioneSociale || '').toLowerCase();

            // If both Pinned, ALWAYS A-Z
            if (pinA && pinB) {
                return nameA.localeCompare(nameB);
            }

            // Otherwise obey sortOrder
            if (sortOrder === 'asc') {
                return nameA.localeCompare(nameB);
            } else {
                return nameB.localeCompare(nameA);
            }
        });

        renderList(localList);
    }

    // --- COLOR PALETTE (Pastel / Material-ish Gradients) ---
    const companyPalettes = [
        { from: '#10b981', to: '#047857', name: 'Green' },   // Green (Default)
        { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },    // Blue
        { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },  // Purple
        { from: '#f59e0b', to: '#b45309', name: 'Orange' },  // Orange
        { from: '#ec4899', to: '#be185d', name: 'Pink' },    // Pink
        { from: '#ef4444', to: '#b91c1c', name: 'Red' },     // Red
        { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },    // Cyan
    ];

    function getCompanyColor(companyName, colorIndex) {
        // 1. Prefer Stored Index
        if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
            return companyPalettes[colorIndex];
        }
        // 2. Fallback to Name Hash
        if (!companyName) return companyPalettes[0];
        let hash = 0;
        for (let i = 0; i < companyName.length; i++) {
            hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % companyPalettes.length;
        return companyPalettes[index];
    }

    async function renderList(aziende) {
        const listContainer = document.getElementById('aziende-list-container');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (aziende.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
                    <div class="bg-slate-100 p-4 rounded-full mb-4 shadow-sm">
                        <span class="material-symbols-outlined text-slate-400 text-4xl">domain_disabled</span>
                    </div>
                    <h3 class="text-slate-900 text-lg font-bold mb-1">Nessuna azienda</h3>
                    <p class="text-slate-500 text-sm max-w-[200px]">
                        Non hai ancora aggiunto nessuna azienda.
                    </p>
                </div>
            `;
            return;
        }

        aziende.forEach((azienda, index) => {
            const div = document.createElement('div');
            // Stagger animation
            div.style.animationDelay = `${index * 50}ms`;
            div.className = "titanium-card border-glow adaptive-shadow animate-fade-in-up relative overflow-hidden group transition-all duration-200 cursor-pointer";
            div.style.padding = "1.5rem";

            // Dynamic Color
            const theme = getCompanyColor(azienda.ragioneSociale, azienda.colorIndex);

            // Card Style & Visibility Logic
            const isLightMode = !document.documentElement.classList.contains('dark') || document.body.classList.contains('titanium-light-bg');

            if (isLightMode) {
                // LIGHT MODE: White background, visible colored border (solid)
                // "delimitare le card con un piccolo margine del colore della ditta"
                div.style.backgroundColor = '#ffffff';
                div.style.border = `1px solid ${theme.from}`;
                div.style.boxShadow = `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`;
            } else {
                // DARK MODE (Titanium Standard): Transparent/Tinted background, subtle border
                div.style.borderColor = `${theme.from}4d`; // 30%
                div.style.backgroundColor = `${theme.from}08`; // ~3% tint
            }

            // Gradient Badge Style
            const gradientStyle = `background: linear-gradient(135deg, ${theme.from}, ${theme.to}); box-shadow: 0 4px 12px ${theme.from}40;`;

            div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 1.25rem; position: relative; z-index: 10; width: 100%;">
                    
                    <!-- TOP ROW: Icon + Name + Pin -->
                    <div style="display: flex; align-items: flex-start; gap: 1rem; position: relative;">
                        
                        <!-- Icon / Logo (Fixed 56px) -->
                        <div style="width: 3.5rem; height: 3.5rem; border-radius: 1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 700; font-size: 1.5rem; color: white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); ${gradientStyle}">
                            ${azienda.logo
                    ? `<img src="${azienda.logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 1rem;" />`
                    : (azienda.ragioneSociale ? azienda.ragioneSociale.charAt(0).toUpperCase() : 'A')}
                        </div>
                        
                        <!-- Text Content -->
                        <div style="flex: 1; min-width: 0; padding-top: 0.125rem;">
                            <h3 style="font-weight: 700; font-size: 1.125rem; line-height: 1.25; margin-bottom: 0.375rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">
                                ${azienda.ragioneSociale || 'Senza Nome'}
                            </h3>
                            <div style="display: flex; align-items: center;">
                                <span style="display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.625rem; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.05); background-color: rgba(0,0,0,0.2);">
                                    <span style="font-size: 0.65rem; opacity: 0.7; color: var(--text-secondary);">#</span>
                                    <span style="font-size: 0.75rem; font-family: monospace; letter-spacing: 0.025em; opacity: 0.9; color: var(--text-secondary);">
                                        ${azienda.partitaIva || '00000000000'}
                                    </span>
                                </span>
                            </div>
                        </div>

                         <!-- PIN BUTTON (Absolute Top Right) -->
                        <button class="btn-pin"
                            style="position: absolute; top: -0.5rem; right: -0.5rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border-radius: 50%; border: none; cursor: pointer; color: ${azienda.isPinned ? theme.from : 'var(--text-secondary)'}; opacity: ${azienda.isPinned ? '1' : '0.5'}; transition: all 0.2s;"
                            onclick="event.stopPropagation(); window.togglePin('${azienda.id}')"
                            data-id="${azienda.id}">
                            <span class="material-symbols-outlined" style="font-size: 20px; ${azienda.isPinned ? 'transform: rotate(-45deg);' : ''} ${azienda.isPinned ? 'font-variation-settings: \'FILL\' 1;' : ''}">push_pin</span>
                        </button>
                    </div>

                    <!-- BOTTOM ROW: ACTIONS -->
                    <div style="display: flex; align-items: center; gap: 0.75rem; width: 100%;">
                        
                        <!-- Button: Dettagli -->
                         <button onclick="event.stopPropagation(); window.location.href='dati_azienda.html?id=${azienda.id}'"
                            style="flex: 1; height: 48px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background-color: rgba(255,255,255,0.03); border: 1px solid ${theme.from}40; color: ${theme.from};">
                            <span class="material-symbols-outlined" style="font-size: 20px;">domain</span>
                            Dettagli
                        </button>

                        <!-- Button: Account -->
                        <button onclick="event.stopPropagation(); window.location.href='account_azienda.html?id=${azienda.id}'"
                            style="flex: 1; height: 48px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; color: white; background: linear-gradient(135deg, ${theme.from}, ${theme.to}); box-shadow: 0 4px 12px ${theme.from}40; border: none;">
                            <span class="material-symbols-outlined" style="font-size: 20px;">folder_shared</span>
                            Account
                        </button>
                    </div>
                </div>
                
                <!-- Decorative bg wash -->
                <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent); opacity: 0; transition: opacity 0.3s; pointer-events: none;" class="group-hover:opacity-100"></div>
            `;

            div.onclick = (e) => {
                // Card check handled by buttons
            };

            listContainer.appendChild(div);
        });
    }

    // PIN HANDLER (Delegation)
    listContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-pin');
        if (btn) {
            e.preventDefault(); e.stopPropagation();
            const id = btn.dataset.id;
            await togglePin(id);
        }
    });

    async function togglePin(id) {
        const item = allAziende.find(a => a.id === id);
        if (!item) return;

        if (!item.isPinned) {
            const count = allAziende.filter(a => a.isPinned).length;
            if (count >= 5) {
                showToast("Massimo 5 aziende fissate.", "error");
                return;
            }
        }

        const newState = !item.isPinned;

        // Optimistic
        item.isPinned = newState;
        renderAziende();

        try {
            // Modular SDK: updateDoc(doc(...))
            const docRef = doc(db, "users", currentUser.uid, "aziende", id);
            await updateDoc(docRef, { isPinned: newState });

            showToast(newState ? "Azienda fissata in alto" : "Azienda rimossa dai fissati");
        } catch (err) {
            console.error(err);
            showToast("Errore salvataggio pin", "error");
            item.isPinned = !newState;
            renderAziende();
        }
    }
});
