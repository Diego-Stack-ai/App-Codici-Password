/**
 * LISTA AZIENDE MODULE (V5.0 ADAPTER)
 * Visualizzazione e gestione della lista delle aziende dell'utente.
 * - Entry Point: initListaAziende(user)
 */

import { auth, db } from '../../firebase-config.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let allAziende = [];
let sortOrder = 'asc';
let currentUser = null;

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
export async function initListaAziende(user) {
    console.log("[LISTA-AZIENDE] Init V5.0...");
    if (!user) return;
    currentUser = user;

    initProtocolUI();

    const loadingTimeout = setTimeout(() => {
        const container = document.getElementById('aziende-list-container');
        if (container && container.querySelector('.loading-placeholder')) {
            clearElement(container);
            setChildren(container, [
                createElement('p', {
                    className: 'timeout-text',
                    textContent: "Il caricamento sta impiegando più del previsto. Prova a ricaricare la pagina."
                }),
                createElement('button', {
                    className: 'btn-empty-add',
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
                className: 'error-text',
                textContent: "Errore durante il caricamento. Per favore ricarica la pagina."
            }));
        }
    }
    console.log("[LISTA-AZIENDE] Ready.");
}

async function initProtocolUI() {
    console.log('[lista_aziende] UI inizializzata tramite main.js');

    // Aggiungi pulsante "+" nel footer center
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        const addBtn = createElement('button', {
            id: 'add-azienda-btn',
            className: 'btn-fab-action btn-fab-scadenza',
            title: 'Aggiungi Azienda',
            onclick: () => window.location.replace('aggiungi_nuova_azienda.html')
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [addBtn]));
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
        setChildren(container, createElement('div', { className: 'empty-state' }, [
            createElement('span', { className: 'material-symbols-outlined empty-state-icon', textContent: 'domain_disabled' }),
            createElement('p', {
                className: 'empty-state-text',
                textContent: t('no_companies_found') || 'Nessuna Azienda Trovata'
            }),
            createElement('button', {
                className: 'btn-empty-add',
                onclick: () => window.location.replace('aggiungi_nuova_azienda.html')
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
    const isPinned = !!a.isPinned;

    return createElement('div', {
        className: `azienda-card card-${palKey} border-glow adaptive-shadow`,
        onclick: (e) => {
            if (e.target.closest('button')) return;
            window.location.replace(`account_azienda.html?id=${a.id}`);
        }
    }, [
        // Pin Button
        createElement('button', {
            type: 'button',
            className: `btn-pin-azienda${isPinned ? ' is-pinned' : ''}`,
            onclick: (e) => { e.stopPropagation(); togglePin(a.id); }
        }, [
            createElement('span', {
                className: `material-symbols-outlined ${isPinned ? 'pin-active' : 'pin-inactive'}`,
                style: 'font-size: 24px;',
                textContent: 'push_pin'
            })
        ]),
        // Card Body
        createElement('div', { className: 'card-body' }, [
            createElement('div', { className: 'card-logo-box border-glow' }, [
                a.logo ? createElement('img', {
                    src: a.logo,
                    className: 'card-logo-img',
                    alt: 'Logo'
                }) : createElement('span', {
                    className: 'card-logo-initial',
                    textContent: (a.ragioneSociale || 'A').charAt(0).toUpperCase()
                })
            ]),
            createElement('div', { className: 'card-name-box' }, [
                createElement('h3', {
                    className: 'card-name',
                    textContent: a.ragioneSociale || t('without_name')
                })
            ])
        ]),
        // Footer Actions
        createElement('div', { className: 'card-actions' }, [
            createElement('button', {
                className: 'btn-card-action',
                onclick: (e) => { e.stopPropagation(); window.location.replace(`dati_azienda.html?id=${a.id}`); }
            }, [createElement('span', { textContent: 'Dati Azienda' })]),
            createElement('button', {
                className: 'btn-card-action',
                onclick: (e) => { e.stopPropagation(); window.location.replace(`account_azienda.html?id=${a.id}`); }
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

