/**
 * LISTA AZIENDE MODULE (V4.1)
 * Visualizzazione e gestione della lista delle aziende dell'utente.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
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

// --- INITIALIZATION ---
observeAuth(async (user) => {
    if (user) {
        await initComponents();
        initProtocolUI();

        const loadingTimeout = setTimeout(() => {
            const container = document.getElementById('aziende-list-container');
            if (container && container.querySelector('.animate-pulse')) {
                clearElement(container);
                setChildren(container, [
                    createElement('p', {
                        className: 'text-center text-amber-500 py-10 px-4 text-xs font-bold uppercase',
                        textContent: "Il caricamento sta impiegando più del previsto. Prova a ricaricare la pagina."
                    }),
                    createElement('button', {
                        className: 'btn-ghost-adaptive mx-auto mt-4 px-6 h-10 rounded-lg',
                        textContent: 'Ricarica Ora',
                        onclick: () => window.location.reload()
                    })
                ]);
            }
        }, 8000);

        try {
            await loadAziende(user.uid);
            clearTimeout(loadingTimeout);
        } catch (error) {
            logError("Initialization", error);
            clearTimeout(loadingTimeout);
            const container = document.getElementById('aziende-list-container');
            if (container) {
                clearElement(container);
                setChildren(container, createElement('p', {
                    className: 'text-center text-red-500 py-10',
                    textContent: "Errore durante il caricamento. Per favore ricarica la pagina."
                }));
            }
        }
    } else {
        window.location.href = 'index.html';
    }
});

async function initProtocolUI() {
    console.log('[lista_aziende] UI inizializzata tramite main.js');

    // Aggiungi pulsante "+" nel footer center
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('button', {
            id: 'add-azienda-btn',
            className: 'btn-floating-add bg-accent-blue',
            title: 'Aggiungi Azienda',
            onclick: () => window.location.href = 'aggiungi_nuova_azienda.html'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
        ]));
    }
}

async function loadAziende(uid) {
    try {
        const colRef = collection(db, "users", uid, "aziende");
        const snap = await getDocs(colRef);
        allAziende = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAziende();
    } catch (e) {
        logError("LoadAziende", e);
        throw e;
    }
}

function renderAziende() {
    const container = document.getElementById('aziende-list-container');
    if (!container) return;

    clearElement(container);

    if (allAziende.length === 0) {
        setChildren(container, createElement('div', { className: 'col-span-full flex-center-col py-20' }, [
            createElement('span', { className: 'material-symbols-outlined text-4xl opacity-20', textContent: 'domain_disabled' }),
            createElement('p', {
                className: 'text-[10px] font-black uppercase tracking-widest mt-4 opacity-40',
                textContent: t('no_companies_found') || 'Nessuna Azienda Trovata'
            }),
            createElement('button', {
                className: 'btn-ghost-adaptive mt-6 px-8 h-12 rounded-xl text-xs font-black uppercase tracking-wider',
                onclick: () => window.location.href = 'aggiungi_nuova_azienda.html'
            }, [createElement('span', { textContent: 'Aggiungi Ora' })])
        ]));
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

    const cards = sorted.map(a => createAziendaCard(a));
    setChildren(container, cards);
}

function createAziendaCard(a) {
    const palKey = getPaletteKey(a.ragioneSociale, a.colorIndex);

    return createElement('div', {
        className: `matrix-card card-${palKey} border-glow adaptive-shadow group flex flex-col relative overflow-hidden transition-all active:scale-[0.98] p-4 cursor-pointer min-h-[160px]`,
        onclick: (e) => {
            if (e.target.closest('button')) return;
            window.location.href = `account_azienda.html?id=${a.id}`;
        }
    }, [
        // Pin Button
        createElement('button', {
            type: 'button',
            className: `btn-pin-azienda absolute top-3 right-3 z-30 w-8 h-8 p-0 flex items-center justify-center bg-transparent border-none outline-none transition-all ${a.isPinned ? 'text-amber-400 opacity-100' : 'text-white/30 hover:text-white opacity-40 hover:opacity-100'}`,
            onclick: (e) => { e.stopPropagation(); togglePin(a.id); }
        }, [
            createElement('span', {
                className: `material-symbols-outlined text-2xl drop-shadow-md select-none ${a.isPinned ? 'pin-active rotate-neg-45' : 'pin-inactive'}`,
                textContent: 'push_pin'
            })
        ]),
        // Card Body
        createElement('div', { className: 'flex-1 flex items-center gap-4 z-10 w-full mb-4 px-1' }, [
            createElement('div', { className: 'size-16 rounded-2xl flex items-center justify-center border-glow text-primary shrink-0 shadow-lg bg-surface-field overflow-hidden' }, [
                a.logo ? createElement('img', {
                    src: a.logo,
                    className: 'size-full object-cover rounded-xl',
                    alt: 'Logo'
                }) : createElement('span', {
                    className: 'text-xl font-black',
                    textContent: (a.ragioneSociale || 'A').charAt(0).toUpperCase()
                })
            ]),
            createElement('div', { className: 'flex-1 min-w-0 flex items-center' }, [
                createElement('h3', {
                    className: 'text-base font-black text-primary truncate leading-snug w-full pr-8',
                    textContent: a.ragioneSociale || t('without_name')
                })
            ])
        ]),
        // Footer Actions
        createElement('div', { className: 'grid grid-cols-2 gap-3 z-10 w-full mt-auto' }, [
            createElement('button', {
                className: 'btn-ghost-adaptive w-full h-12 rounded-xl flex-center shadow-sm transition-all font-bold text-xs uppercase tracking-wider backdrop-blur-sm',
                onclick: (e) => { e.stopPropagation(); window.location.href = `dati_azienda.html?id=${a.id}`; }
            }, [createElement('span', { textContent: 'Dati Azienda' })]),
            createElement('button', {
                className: 'btn-ghost-adaptive w-full h-12 rounded-xl flex-center shadow-sm transition-all font-bold text-xs uppercase tracking-wider backdrop-blur-sm',
                onclick: (e) => { e.stopPropagation(); window.location.href = `account_azienda.html?id=${a.id}`; }
            }, [createElement('span', { textContent: 'Account' })])
        ])
    ]);
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
        showToast(t('limit_pin_reached') || "Limite pin raggiunto", "error");
        return;
    }

    const state = !item.isPinned;
    item.isPinned = state;
    renderAziende();

    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid, "aziende", id), { isPinned: state });
        showToast(state ? (t('pinned_to_top') || "Fissata in alto") : (t('removed_from_pinned') || "Rimossa dai fissati"), "success");
    } catch (e) {
        logError("TogglePin", e);
        item.isPinned = !state;
        renderAziende();
    }
}

