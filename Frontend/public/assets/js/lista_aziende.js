import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let allAziende = [];
let sortOrder = 'asc';

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

const companyPalettes = [
    { from: '#3b82f6', to: '#1d4ed8', tail: 'blue' },   // Blue
    { from: '#10b981', to: '#047857', tail: 'emerald' }, // Green
    { from: '#8b5cf6', to: '#6d28d9', tail: 'purple' }, // Purple
    { from: '#f59e0b', to: '#b45309', tail: 'amber' },  // Orange
    { from: '#ec4899', to: '#be185d', tail: 'pink' },   // Pink
    { from: '#ef4444', to: '#b91c1c', tail: 'red' },    // Red
    { from: '#06b6d4', to: '#0e7490', tail: 'cyan' },   // Cyan
];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadAziende();
            setupDynamicUI();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Delegation for actions
    document.getElementById('aziende-list-container')?.addEventListener('click', (e) => {
        const btnPin = e.target.closest('.btn-pin-azienda');
        const btnDettagli = e.target.closest('.btn-azienda-dettagli');
        const btnAccount = e.target.closest('.btn-azienda-account');

        if (btnPin) {
            e.stopPropagation();
            togglePin(btnPin.dataset.id);
        } else if (btnDettagli) {
            e.stopPropagation();
            window.location.href = `dati_azienda.html?id=${btnDettagli.dataset.id}`;
        } else if (btnAccount) {
            e.stopPropagation();
            window.location.href = `account_azienda.html?id=${btnAccount.dataset.id}`;
        } else {
            const card = e.target.closest('.azienda-card');
            if (card) window.location.href = `account_azienda.html?id=${card.dataset.id}`;
        }
    });
});

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

function setupDynamicUI() {
    const interval = setInterval(() => {
        const hCenter = document.getElementById('header-center');
        const hRight = document.getElementById('header-right');
        const fCenter = document.getElementById('footer-center-actions');

        if (hCenter && hRight && fCenter) {
            clearInterval(interval);

            hCenter.innerHTML = `<h2 class="header-title" data-t="companies">Aziende</h2>`;

            // Header Actions: Sort
            const sBtn = document.createElement('button');
            sBtn.className = 'btn-icon-header';
            sBtn.innerHTML = '<span class="material-symbols-outlined">sort_by_alpha</span>';
            sBtn.onclick = () => {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                showToast(sortOrder === 'asc' ? 'A-Z' : 'Z-A', 'info');
                renderAziende();
            };
            hRight.prepend(sBtn);

            // Footer actions: Add
            fCenter.innerHTML = `
                <button id="footer-btn-add" class="fab-btn-primary" title="Aggiungi Azienda">
                    <span class="material-symbols-outlined">add</span>
                </button>
            `;
            document.getElementById('footer-btn-add').onclick = () => {
                window.location.href = 'aggiungi_nuova_azienda.html';
            };
        }
    }, 100);
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
        const pal = getPalette(a.ragioneSociale, a.colorIndex);
        const logo = a.logo ? `<img src="${a.logo}" class="size-full object-cover rounded-2xl" />` : `<span class="text-xl font-black">${(a.ragioneSociale || 'A').charAt(0).toUpperCase()}</span>`;

        return `
            <div class="azienda-card glass-card p-5 group flex flex-col gap-5 relative overflow-hidden transition-all active:scale-[0.98]" data-id="${a.id}">
                <!-- Background Accent -->
                <div class="absolute top-0 right-0 size-32 bg-[${pal.from}]/5 blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <!-- Card Header -->
                <div class="flex items-start gap-4 z-10">
                    <div class="size-14 rounded-2xl flex-center border-glow text-white shrink-0 shadow-lg" style="background: linear-gradient(135deg, ${pal.from}, ${pal.to})">
                        ${logo}
                    </div>
                    <div class="flex-1 min-w-0 pr-4">
                        <h3 class="text-base font-black text-white truncate leading-tight">${a.ragioneSociale || 'Senza Nome'}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[9px] font-black text-white/40 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">P.IVA: ${a.partitaIva || '---'}</span>
                        </div>
                    </div>
                    
                    <!-- Pin Button -->
                    <button class="btn-pin-azienda absolute top-4 right-4 text-white/20 hover:text-white transition-all ${a.isPinned ? '!text-amber-500 !opacity-100' : 'opacity-0 group-hover:opacity-100'}" data-id="${a.id}">
                        <span class="material-symbols-outlined text-lg ${a.isPinned ? 'filled rotate-[-45deg]' : ''}">push_pin</span>
                    </button>
                </div>

                <!-- Card Actions -->
                <div class="flex gap-3 z-10">
                    <button class="btn-azienda-dettagli flex-1 h-12 rounded-xl flex-center gap-2 bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold text-xs" data-id="${a.id}">
                        <span class="material-symbols-outlined text-base">domain</span>
                        <span data-t="details">Dettagli</span>
                    </button>
                    <button class="btn-azienda-account flex-1 h-12 rounded-xl flex-center gap-2 text-white hover:brightness-110 transition-all font-bold text-xs" style="background: linear-gradient(135deg, ${pal.from}, ${pal.to}); box-shadow: 0 4px 12px ${pal.from}40;" data-id="${a.id}">
                        <span class="material-symbols-outlined text-base">folder_shared</span>
                        <span>Account</span>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function getPalette(name, idx) {
    if (typeof idx === 'number' && companyPalettes[idx]) return companyPalettes[idx];
    if (!name) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return companyPalettes[Math.abs(hash) % companyPalettes.length];
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
