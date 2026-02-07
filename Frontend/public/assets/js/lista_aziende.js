import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';
import { initComponents } from './components.js';
import { t } from './translations.js';

let allAziende = [];
let sortOrder = 'asc';

const companyPalettes = [
    { key: 'blue', label: 'Blue' },
    { key: 'green', label: 'Green' },
    { key: 'orange', label: 'Orange' },
    { key: 'amber', label: 'Amber' },
    { key: 'red', label: 'Red' },
    { key: 'purple', label: 'Purple' },
    { key: 'cyan', label: 'Cyan' },
    { key: 'pink', label: 'Pink' },
    { key: 'emerald', label: 'Emerald' }
];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Inizializzazione Componenti (Header/Footer Protocol)
            await initProtocolUI();

            // 2. Caricamento Dati
            await loadAziende();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Delegation for actions
    document.getElementById('aziende-list-container')?.addEventListener('click', (e) => {
        const btnDettagli = e.target.closest('.btn-azienda-dettagli');
        const btnAccount = e.target.closest('.btn-azienda-account');
        const btnPin = e.target.closest('.btn-pin-azienda');
        const card = e.target.closest('.matrix-card');

        if (btnPin) {
            e.stopPropagation();
            const id = btnPin.getAttribute('data-id');
            togglePin(id);
        } else if (btnDettagli) {
            e.stopPropagation();
            const id = btnDettagli.getAttribute('data-id');
            window.location.href = `modifica_azienda.html?id=${id}`;
        } else if (btnAccount) {
            e.stopPropagation();
            const id = btnAccount.getAttribute('data-id');
            window.location.href = `account_azienda.html?id=${id}`;
        } else if (card) {
            // Se si clicca sulla card ma non sui bottoni specifici, vai agli account (o dettagli?) 
            // Default behavior: go to accounts for ease of access
            const id = card.getAttribute('data-id');
            window.location.href = `account_azienda.html?id=${id}`;
        }
    });
});

/**
 * PROTOCOLLO UI: Gestione Header Balanced e Footer Placeholder
 */
async function initProtocolUI() {
    await initComponents();

    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `
            <button id="btn-back" class="btn-icon-header">
                <span class="material-symbols-outlined">arrow_back</span>
            </button>
        `;
        document.getElementById('btn-back')?.addEventListener('click', () => window.location.href = 'home_page.html');
    }

    if (hCenter) {
        hCenter.innerHTML = `
             <h2 class="header-title uppercase tracking-widest text-shadow-glow">LE MIE AZIENDE</h2>
        `;
    }

    if (hRight) {
        hRight.innerHTML = `
            <a href="aggiungi_nuova_azienda.html" class="btn-icon-header text-accent-green" title="Aggiungi Azienda">
                <span class="material-symbols-outlined">add_business</span>
            </a>
        `;
    }

    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        fCenter.innerHTML = `
            <a href="home_page.html" class="btn-icon-header" title="Home">
                <span class="material-symbols-outlined">home</span>
            </a>
        `;
    }
}

async function loadAziende() {
    try {
        const colRef = collection(db, "users", auth.currentUser.uid, "aziende");
        const snap = await getDocs(colRef);
        allAziende = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAziende();
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
    }
}

function renderAziende() {
    const container = document.getElementById('aziende-list-container');
    if (!container) return;

    if (allAziende.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex-center-col py-20 opacity-20">
                <span class="material-symbols-outlined text-4xl">domain_disabled</span>
                <p class="text-[10px] font-black uppercase tracking-widest mt-4">Nessuna Azienda Trovata</p>
            </div>
        `;
        return;
    }

    const sorted = [...allAziende].sort((a, b) => {
        const pinA = !!a.isPinned;
        const pinB = !!b.isPinned;
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;
        const nameA = (a.ragioneSociale || '').toLowerCase();
        const nameB = (b.ragioneSociale || '').toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    container.innerHTML = sorted.map((a, idx) => {
        const palKey = getPaletteKey(a.ragioneSociale, a.colorIndex);
        const logo = a.logo ? `<img src="${a.logo}" class="size-full object-cover rounded-xl" />` : `<span class="text-xl font-black">${(a.ragioneSociale || 'A').charAt(0).toUpperCase()}</span>`;

        return `
            <div class="matrix-card card-${palKey} border-glow adaptive-shadow group flex flex-col relative overflow-hidden transition-all active:scale-[0.98] p-4 cursor-pointer min-h-[160px]" data-id="${a.id}">
                
                <!-- Pin Button (Top Right Absolute) -->
                <button type="button" class="btn-pin-azienda absolute top-3 right-3 z-30 w-8 h-8 p-0 flex items-center justify-center bg-transparent border-none outline-none transition-all ${a.isPinned ? 'text-amber-400 opacity-100' : 'text-white/30 hover:text-white opacity-0 group-hover:opacity-100'}" data-id="${a.id}" onclick="event.stopPropagation()">
                    <span class="material-symbols-outlined text-2xl drop-shadow-md select-none ${a.isPinned ? 'filled rotate-[-45deg]' : ''}" style="font-variation-settings: 'FILL' ${a.isPinned ? 1 : 0}, 'wght' 600;">push_pin</span>
                </button>

                <!-- Card Body (Flex Grow to push actions down) -->
                <div class="flex-1 flex items-center gap-4 z-10 w-full mb-4 px-1">
                    <!-- Logo Box -->
                    <div class="size-16 rounded-2xl flex items-center justify-center border-glow text-primary shrink-0 shadow-lg bg-surface-field overflow-hidden">
                        ${logo}
                    </div>
                    
                    <!-- Text Box -->
                    <div class="flex-1 min-w-0 flex items-center">
                        <h3 class="text-base font-black text-primary truncate leading-snug w-full pr-8">${a.ragioneSociale || 'Senza Nome'}</h3>
                    </div>
                </div>

                <!-- Footer Quick Actions (Pushed Bottom) -->
                <div class="grid grid-cols-2 gap-3 z-10 w-full mt-auto">
                    <button class="btn-azienda-dettagli btn-ghost-adaptive w-full h-12 rounded-xl flex-center shadow-sm transition-all font-bold text-xs uppercase tracking-wider backdrop-blur-sm" data-id="${a.id}">
                        <span>Dettaglio</span>
                    </button>
                    <button class="btn-azienda-account btn-ghost-adaptive w-full h-12 rounded-xl flex-center shadow-sm transition-all font-bold text-xs uppercase tracking-wider backdrop-blur-sm" data-id="${a.id}">
                        <span>Account</span>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function getPaletteKey(name, idx) {
    if (typeof idx === 'number' && companyPalettes[idx]) return companyPalettes[idx].key;
    if (!name) return companyPalettes[0].key;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return companyPalettes[Math.abs(hash) % companyPalettes.length].key;
}

async function togglePin(id) {
    const item = allAziende.find(x => x.id === id);
    if (!item) return;

    if (!item.isPinned && allAziende.filter(x => x.isPinned).length >= 8) {
        showToast("Limite pin raggiunto", "error");
        return;
    }

    const state = !item.isPinned;
    item.isPinned = state;
    renderAziende();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid, "aziende", id), { isPinned: state });
        showToast(state ? "Fissata in alto" : "Rimossa dai fissati", "success");
    } catch (e) {
        console.error(e);
        item.isPinned = !state;
        renderAziende();
    }
}
