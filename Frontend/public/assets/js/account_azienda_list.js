// ACCOUNT AZIENDA LIST JS
// Logic for account_azienda.html

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

console.log("Script Account Azienda List Caricato");

// STATE
let allAccounts = [];
let companyData = null;
let sortOrder = 'asc'; // 'asc' | 'desc'
let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const companyId = urlParams.get('id');

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

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-full', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.querySelector('.flex.flex-col.gap-4.mt-2');
    const sortBtn = document.getElementById('sort-btn');
    const headerTitle = document.querySelector('header h1');
    const headerLogoText = document.querySelector('header .text-white.font-bold'); // "TS"
    const searchInput = document.querySelector('input[type="text"]');

    if (!companyId) {
        alert("ID Azienda mancante");
        window.location.href = 'lista_aziende.html';
        return;
    }

    // SORT HANDLER
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';

            sortBtn.classList.toggle('bg-primary/10', sortOrder === 'desc');
            sortBtn.title = sortOrder === 'asc' ? 'Ordina A-Z' : 'Ordina Z-A';

            showToast(`Ordinamento: ${sortOrder === 'asc' ? 'A-Z' : 'Z-A'}`);
            renderAccounts();
        });
    }

    // SEARCH HANDLER
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderAccounts();
        });
    }

    // AUTH & LOAD
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Logged in:", user.uid);
            await loadCompanyAndAccounts();
        } else {
            console.log("User not logged in");
            if (listContainer) {
                listContainer.innerHTML = `<p class="text-center py-10 opacity-50">Effettua il login.</p>`;
            }
        }
    });

    async function loadCompanyAndAccounts() {
        if (!currentUser || !listContainer) return;

        try {
            // 1. Fetch Company Data
            const companyDoc = await getDoc(doc(db, "users", currentUser.uid, "aziende", companyId));
            if (!companyDoc.exists()) {
                alert("Azienda non trovata");
                window.location.href = 'lista_aziende.html';
                return;
            }
            companyData = { id: companyDoc.id, ...companyDoc.data() };

            // Render Header Info
            if (headerTitle) headerTitle.textContent = companyData.ragioneSociale || 'Azienda';
            if (headerLogoText) headerLogoText.textContent = (companyData.ragioneSociale || 'A').substring(0, 2).toUpperCase();

            // 2. Fetch Accounts (Type 'azienda')
            // Note: Optimally we should query by 'companyId', but demo data uses 'company' name.
            // We fetch all 'azienda' accounts and filter client-side for flexibility.
            const accountsQ = query(collection(db, "users", currentUser.uid, "accounts"), where("type", "==", "azienda"));
            const snapshot = await getDocs(accountsQ);

            const rawAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter: Match by ID OR Name
            allAccounts = rawAccounts.filter(acc => {
                return (acc.companyId === companyId) || (acc.company === companyData.ragioneSociale);
            });

            renderAccounts();

        } catch (error) {
            console.error("Errore caricamento:", error);
            listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Errore: ${error.message}</p>`;
        }
    }

    // RENDER
    window.renderAccounts = function () {
        if (!listContainer) return;

        const term = searchInput ? searchInput.value.toLowerCase() : '';

        let filtered = allAccounts.filter(acc => {
            if (!term) return true;
            return (acc.nomeAccount || acc.title || '').toLowerCase().includes(term) ||
                (acc.username || '').toLowerCase().includes(term);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 opacity-50">
                    <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">folder_off</span>
                    <p class="text-sm font-medium text-slate-500">Nessun account trovato.</p>
                </div>
            `;
            return;
        }

        // Sorting Logic
        filtered.sort((a, b) => {
            // 1. Pinned always first
            const pinA = !!a.isPinned;
            const pinB = !!b.isPinned;
            if (pinA && !pinB) return -1;
            if (!pinA && pinB) return 1;

            const nameA = (a.nomeAccount || a.title || '').toLowerCase();
            const nameB = (b.nomeAccount || b.title || '').toLowerCase();

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

        listContainer.innerHTML = '';
        filtered.forEach(acc => {
            listContainer.appendChild(createAccountCard(acc));
        });
    }

    function createAccountCard(acc) {
        // NOTE: account_azienda.html design is "Card List" (similar to Privati LIST style but white bg?)
        // The original HTML had a progress spinner. 
        // Based on `account_privati.html`, it's a gradient card.
        // But `lista_aziende` uses white cards. 
        // `account_azienda.html` body is white/dark.
        // Let's use a nice card design consistent with "Company View".

        const div = document.createElement('div');
        div.className = "relative group"; // For pin positioning

        // Dynamic Color or just White Surface?
        // Demo shows "TechSolutions" in header.
        // Let's use the Private Account Card style (Gradient) but maybe different palette due to Business?
        // Or keep it white/clean as generally Business views are cleaner.
        // Let's us the 'Clean' card style from the Company List but adapted for Account.

        const isPinned = !!acc.isPinned;
        const pinClass = isPinned ? 'text-primary fill-current rotate-45' : 'text-slate-300 hover:text-primary';

        // Link to Detail
        const detailLink = `dettaglio_account_azienda.html?id=${acc.id}&ownerId=${currentUser.uid}`;

        div.innerHTML = `
            <a href="${detailLink}" class="block bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                         <div class="size-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                            <span class="material-symbols-outlined">${getIconForCategory(acc.category)}</span>
                         </div>
                         <div>
                             <h3 class="font-bold text-slate-900 text-sm">${acc.nomeAccount || acc.title || 'Senza Nome'}</h3>
                             <p class="text-xs text-slate-500">${acc.category || 'Generico'}</p>
                         </div>
                    </div>
                </div>
                <div class="mt-2 text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg truncate">
                    ${acc.username || 'Nessun username'}
                </div>
            </a>
            <!-- PIN BUTTON -->
            <button class="btn-pin absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 transition-colors ${pinClass}" 
                data-id="${acc.id}">
                <span class="material-symbols-outlined text-[20px]">push_pin</span>
            </button>
        `;

        return div;
    }

    function getIconForCategory(cat) {
        if (!cat) return 'folder';
        const c = cat.toLowerCase();
        if (c.includes('banca')) return 'account_balance';
        if (c.includes('carta')) return 'credit_card';
        if (c.includes('fisco')) return 'receipt_long';
        if (c.includes('servizi')) return 'cloud';
        if (c.includes('pec')) return 'mail';
        return 'folder';
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
        const item = allAccounts.find(a => a.id === id);
        if (!item) return;

        if (!item.isPinned) {
            const count = allAccounts.filter(a => a.isPinned).length;
            if (count >= 3) {
                showToast("Massimo 3 account fissati.", "error");
                return;
            }
        }

        const newState = !item.isPinned;

        // Optimistic
        item.isPinned = newState;
        renderAccounts();

        try {
            await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), {
                isPinned: newState
            });
            showToast(newState ? "Account fissato" : "Pin rimosso");
        } catch (err) {
            console.error(err);
            showToast("Errore salvataggio pin", "error");
            item.isPinned = !newState;
            renderAccounts();
        }
    }
});
