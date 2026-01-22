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
    const sortBtn = document.getElementById('sort-btn');

    // TIMEOUT SAFEGUARD
    setTimeout(() => {
        if (allAziende.length === 0 && listContainer && listContainer.querySelector('.animate-spin')) {
            console.warn("Loading timeout reached.");
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-center">
                    <p class="text-orange-500 mb-2">Il caricamento sta impiegando più del previsto.</p>
                    <button onclick="location.reload()" class="text-primary font-bold hover:underline">Ricarica pagina</button>
                </div>`;
        }
    }, 8000); // 8 seconds timeout

    // SORT HANDLER
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            sortBtn.classList.toggle('bg-primary/10', sortOrder === 'desc');
            sortBtn.title = sortOrder === 'asc' ? 'Ordina A-Z' : 'Ordina Z-A';
            showToast(`Ordinamento: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
            renderAziende();
        });
    }

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
            div.className = "animate-fade-in-up bg-white p-4 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.99] transition-all duration-200 relative overflow-hidden group hover:shadow-md hover:border-slate-300";

            // Dynamic Color
            const theme = getCompanyColor(azienda.ragioneSociale, azienda.colorIndex);

            // Card Style: Border colored with theme (30% opacity), subtle background tint (5%)
            div.style.borderColor = `${theme.from}4d`; // 30%
            div.style.backgroundColor = `${theme.from}08`; // ~3% tint

            // Gradient Badge Style
            const gradientStyle = `background: linear-gradient(135deg, ${theme.from}, ${theme.to}); box-shadow: 0 4px 12px ${theme.from}40;`;

            div.innerHTML = `
                <div class="flex flex-col gap-3 relative z-10 w-full">
                    <!-- TOP ROW: Icon + Name + Pin -->
                    <div class="flex items-center gap-4">
                        <!-- Icon / Logo with Gradient Bg -->
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xl shadow-lg transform transition-transform group-hover:scale-105"
                             style="${gradientStyle}">
                            ${azienda.logo
                    ? `<img src="${azienda.logo}" class="w-full h-full object-cover rounded-xl" />`
                    : (azienda.ragioneSociale ? azienda.ragioneSociale.charAt(0).toUpperCase() : 'A')}
                        </div>
                        
                        <div class="flex-1 min-w-0 pr-8"> <!-- pr-8 for pin space -->
                            <h3 class="text-slate-900 font-bold text-base leading-tight truncate mb-0.5">
                                ${azienda.ragioneSociale || 'Senza Nome'}
                            </h3>
                            <div class="flex items-center gap-2 text-xs text-slate-500">
                                <span class="flex items-center gap-1 bg-white/50 px-2 py-0.5 rounded-full border border-gray-100">
                                    <span class="material-symbols-outlined text-[14px]">tag</span>
                                    ${azienda.partitaIva || '-'}
                                </span>
                            </div>
                        </div>

                         <!-- PIN BUTTON (Neutral) -->
                        <button class="btn-pin absolute top-0 right-0 p-2 hover:scale-110 transition-transform ${azienda.isPinned ? 'text-slate-700' : 'text-gray-400 hover:text-slate-600'}" 
                            data-id="${azienda.id}">
                            <span class="material-symbols-outlined text-[20px] ${azienda.isPinned ? 'fill-current' : ''}">push_pin</span>
                        </button>
                    </div>

                    <!-- BOTTOM ROW: ACTIONS -->
                    <div class="flex items-center gap-2 mt-1">
                        <!-- Button: Dettagli (Light Tint of Theme) -->
                         <button onclick="event.stopPropagation(); window.location.href='dati_azienda.html?id=${azienda.id}'"
                            class="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg transition-colors text-sm font-bold shadow-sm"
                            style="background-color: ${theme.from}20; color: ${theme.from}; border: 1px solid ${theme.from}30;">
                            <span class="material-symbols-outlined text-[18px]">business</span>
                            Dettagli
                        </button>

                        <!-- Button: Account (Solid Gradient of Theme) -->
                        <button onclick="event.stopPropagation(); window.location.href='account_azienda.html?id=${azienda.id}'"
                            class="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-white shadow-md transition-transform active:scale-[0.98] text-sm font-bold"
                            style="background: linear-gradient(to right, ${theme.from}, ${theme.to});">
                            <span class="material-symbols-outlined text-[18px]">folder_shared</span>
                            Account
                        </button>
                    </div>
                </div>
                
                <!-- Decorative bg wash (Stronger on hover) -->
                <div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/40 opacity-0 group-hover:opacity-100 transition-opacity z-0 pointer-events-none"></div>
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
