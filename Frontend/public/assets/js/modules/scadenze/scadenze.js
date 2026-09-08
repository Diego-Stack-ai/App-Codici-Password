/**
 * SCADENZE MODULE (V4.1)
 * Gestione della pagina scadenze (lista completa) e utility per la home.
 * Refactor: Migrazione sotto modules/scadenze/ e standardizzazione import.
 */

import { db } from '../../firebase-config.js?v=1.2.59';
import { getFooterReady } from '../../footer-state.js';
import { showToast } from '../../ui-core-v129.js';
import { LOG } from '../../logger.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { updateDoc, deleteDoc, doc } from "/assets/js/vendor/firebase-runtime.js";
import { deadlineDate, deadlinePresentation } from './deadline-model.js';
import { t } from '../../translations.js';
import { initComponents } from '../../components-v129.js?v=1.2.59';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { logError, formatDateToIT } from '../../utils.js';
import {listDeadlines, listReceivedDeadlines} from '../data/vault-repository.js';

let currentUser = null;
let allScadenze = [];
let activeFilter = 'all';
let searchQuery = '';
let sortType = 'date-asc';
let scadenzeContainer = null; // Module-scoped


/**
 * SCADENZE MODULE (V5.0 ADAPTER)
 * Gestione della pagina scadenze (lista completa).
 * - Entry Point: initScadenze(user)
 * - Managed by Main Orchestrator
 */

export async function initScadenze(user) {
    
    if (!user) return;
    currentUser = user;

    scadenzeContainer = document.querySelector('#scadenze-list');
    if (!scadenzeContainer) return; // Se non siamo nella pagina scadenze, stop

    // Nota: initComponents() rimosso (gestito da main.js)

    const searchBarContainer = document.getElementById('search-bar-container');
    const searchInput = document.getElementById('deadline-search');
    const filterChips = document.querySelectorAll('.filter-chip');
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    const sortItems = document.querySelectorAll('.base-dropdown-item');

    // URL Filter
    const urlParams = new URLSearchParams(window.location.search);
    const urlFilter = urlParams.get('filter');
    if (urlFilter === 'urgenti') activeFilter = 'urgent';
    else if (urlFilter === 'in_scadenza') activeFilter = 'expiring';

    // Sync chips with URL filter
    filterChips.forEach(chip => {
        if (chip.dataset.filter === activeFilter) chip.classList.add('active');
        else chip.classList.remove('active');
    });

    // Filter Chips Events
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.filter;
            renderFilteredScadenze();
        });
    });

    // Sort Dropdown
    if (sortBtn && sortMenu) {
        const handleSortToggle = (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('show');
        };

        sortBtn.addEventListener('click', handleSortToggle);

        sortItems.forEach(item => {
            const handleSortItemClick = (e) => {
                e.stopPropagation();
                sortType = item.getAttribute('data-value');
                sortItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                sortMenu.classList.remove('show');
                renderFilteredScadenze();
            };
            item.addEventListener('click', handleSortItemClick);
        });

        document.addEventListener('click', () => sortMenu.classList.remove('show'));
    }

    // Search Input
    if (searchInput) {
        const handleSearchInput = (e) => {
            searchQuery = e.target.value;
            renderFilteredScadenze();
        };
        searchInput.addEventListener('input', handleSearchInput);
    }

    // Load Data
    await loadScadenze();

    // Inizializzazione SwipeList (V6)
    new SwipeList('.deadline-card-owned', {
        threshold: 0.25,
        onSwipeRight: (item) => archiveScadenza(item.dataset.id),
        onSwipeLeft: (item) => deleteScadenza(item.dataset.id)
    });

    // FAB Button Setup
    setupFAB();

    
}

// --- INTERNAL HELPER FUNCTIONS ---

async function loadScadenze() {
    if (!currentUser) return;
    try {
        const [owned, received] = await Promise.all([
            listDeadlines(currentUser.uid),
            listReceivedDeadlines(currentUser.uid)
        ]);
        allScadenze = [
            ...owned.map(item => ({ ...item, received: false })),
            ...received.map(item => ({ ...item, received: true }))
        ];
        renderFilteredScadenze();
    } catch (error) {
        logError("Scadenze Page", error);
        if (scadenzeContainer) {
            const p = createElement('p', { className: 'hero-page-subtitle deadline-error-message', textContent: `Errore: ${error.message}` });
            setChildren(scadenzeContainer, p);
        }
    }
}

function renderFilteredScadenze() {
    if (!scadenzeContainer) return;

    let filtered = [...allScadenze];
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    // Apply Filter (SEMPRE APPLICATO ORA)
    filtered = filtered.filter(s => {
        const dueDate = deadlineDate(s);
        if (!dueDate) return activeFilter === 'completed' && s.completed;
        const expired = dueDate < now;
        const isUpcoming = dueDate >= now && dueDate <= thirtyDaysLater;

        // CASO SPECIFICO: COMPLETATE
        if (activeFilter === 'completed') {
            return s.completed;
        }

        // PER TUTTI GLI ALTRI CASI (Tutte, Urgenti, In Scadenza)
        // ESCLUDI LE COMPLETATE
        if (s.completed) return false;

        if (activeFilter === 'urgent') return expired;
        if (activeFilter === 'expiring') return isUpcoming;

        // Se siamo qui e activeFilter == 'all', passa (perch� non completata)
        return true;
    });

    // Apply Search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(s => {
            const presentation = deadlinePresentation(s);
            return [
                presentation.title, presentation.category, presentation.owner,
                presentation.vehicle, s.veicolo_targa, s.ownerLabel
            ]
                .some(value => String(value || '').toLowerCase().includes(q));
        });
    }

    // Apply Sort
    filtered.sort((a, b) => {
        if (sortType.startsWith('date')) {
            const dateA = deadlineDate(a) || new Date(0);
            const dateB = deadlineDate(b) || new Date(0);
            return sortType === 'date-asc' ? dateA - dateB : dateB - dateA;
        } else {
            const nameA = deadlinePresentation(a).title.toLowerCase();
            const nameB = deadlinePresentation(b).title.toLowerCase();
            return sortType === 'name-asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
    });

    // Update Count
    const countEl = document.getElementById('deadline-count');
    if (countEl) countEl.textContent = filtered.length;

    // Render
    clearElement(scadenzeContainer);
    if (filtered.length === 0) {
        const empty = createElement('div', { className: 'archive-empty-state' }, [
            createElement('span', { className: 'material-symbols-outlined archive-empty-icon', textContent: 'event_busy' }),
            createElement('p', {
                className: 'archive-empty-text',
                dataset: { t: 'no_deadlines_found' },
                textContent: t('no_deadlines_found') || 'Nessuna scadenza trovata'
            })
        ]);
        scadenzeContainer.appendChild(empty);
        return;
    }

    const cards = filtered.map(s => createScadenzaCard(s));
    setChildren(scadenzeContainer, cards);
}

function createScadenzaCard(scadenza) {
    const dueDate = deadlineDate(scadenza) || new Date(0);
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    const expired = dueDate < now;
    const isUpcoming = dueDate >= now && dueDate <= thirtyDaysLater;

    let stateClass = 'deadline-card-info';

    if (scadenza.completed) {
        stateClass = 'deadline-card-completed';
    } else if (expired) {
        stateClass = 'deadline-card-expired';
    } else if (isUpcoming) {
        stateClass = 'deadline-card-upcoming';
    }

    // 1. BACKGROUND AZIONI (Sotto la card)
    const bgArchive = createElement('div', { className: 'swipe-action-bg bg-restore' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'archive' })
    ]);

    const bgDelete = createElement('div', { className: 'swipe-action-bg bg-delete' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
    ]);

    const presentation = deadlinePresentation(scadenza);
    const cardOwner = scadenza.received
        ? `Ricevuta da ${scadenza.ownerLabel || 'un utente'}`
        : presentation.owner;
    const cardCategory = presentation.category;
    const permissionLabel = scadenza.permission === 'manage' ? 'Puoi gestire' : 'Solo avviso';
    const cardVehicle = scadenza.received
        ? [presentation.vehicle, permissionLabel].filter(Boolean).join(' · ')
        : presentation.vehicleLabel;

    // 2. CONTENUTO VISIBILE (Sopra)
    const swipeContent = createElement('div', { className: 'swipe-content' }, [
        createElement('div', { className: 'deadline-card-layout' }, [
            createElement('div', { className: 'deadline-card-left' }, [
                createElement('div', { className: 'deadline-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: scadenza.icon || 'event_note' })
                ]),
                createElement('div', { className: 'deadline-card-info-group' }, [
                    createElement('span', { className: 'deadline-card-category', textContent: cardOwner.toUpperCase() }),
                    createElement('h4', { className: 'deadline-card-title', textContent: cardCategory }),
                    createElement('p', { className: 'deadline-card-subtitle', textContent: cardVehicle })
                ])
            ]),
            createElement('span', {
                className: 'deadline-date-badge',
                textContent: dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
            })
        ]),


    ]);

    const card = createElement('div', {
        className: `deadline-card ${scadenza.received ? 'deadline-card-received' : 'deadline-card-owned'} ${stateClass}`,
        dataset: {
            id: scadenza.id,
            action: 'navigate',
            href: scadenza.received
                ? `dettaglio_scadenza.html?received=${encodeURIComponent(scadenza.id)}`
                : `dettaglio_scadenza.html?id=${encodeURIComponent(scadenza.id)}`
        }
    }, scadenza.received ? [swipeContent] : [bgArchive, bgDelete, swipeContent]);

    card.onclick = () => {
        window.location.href = card.dataset.href;
    };

    return card;
}

// --- ACTIONS HANDLERS ---
async function toggleCompleted(id, newStatus) {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "scadenze", id);
        await updateDoc(docRef, { completed: newStatus });

        const idx = allScadenze.findIndex(s => s.id === id);
        if (idx !== -1) allScadenze[idx].completed = newStatus;

        renderFilteredScadenze();
        showToast(newStatus ? 'Completata' : 'Riaperta', 'success');
    } catch (error) {
        console.error(error);
        showToast("Errore aggiornamento", "error");
    }
}

async function archiveScadenza(id) {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "scadenze", id);
        // Archivio nel contesto scadenza significa completata e tolta dalla vista principale
        await updateDoc(docRef, { completed: true });

        const idx = allScadenze.findIndex(s => s.id === id);
        if (idx !== -1) {
            allScadenze[idx].completed = true;
        }
        showToast("Scadenza archiviata", "success");
        // Nota: Rerender post-animazione
        setTimeout(() => renderFilteredScadenze(), 400);
    } catch (error) {
        console.error(error);
        showToast("Errore archiviazione", "error");
    }
}

async function deleteScadenza(id) {
    if (!currentUser) return;
    try {
        // Qui potresti mettere un confirm, ma lo swipe � un'azione veloce.
        // Se preferisci conferma, scommenta:

        const docRef = doc(db, "users", currentUser.uid, "scadenze", id);
        await deleteDoc(docRef);

        allScadenze = allScadenze.filter(s => s.id !== id);
        showToast("Scadenza eliminata", "error");
        setTimeout(() => renderFilteredScadenze(), 400);
    } catch (error) {
        console.error(error);
        showToast("Errore eliminazione", "error");
    }
}

// --- FAB (Add Button) ---

function setupFAB() {
    function initFABFromFooter(detail) {
        const { center: footerCenter } = detail;
        if (!footerCenter) return;
        clearElement(footerCenter);

        // Crea il pulsante Aggiungi (+)
        const addBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('add_deadline') || 'Aggiungi Scadenza',
            dataset: { label: t('add_short') || 'Aggiungi' },
            onclick: () => window.location.href = 'aggiungi_scadenza.html'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
        ]);

        const fabGroup = createElement('div', { className: 'fab-group' }, [addBtn]);
        footerCenter.appendChild(fabGroup);

        // Animazione Entrata (Home Page Style)
        addBtn.animate([
            { transform: 'scale(0) translateY(20px)', opacity: 0 },
            { transform: 'scale(1) translateY(0)', opacity: 1 }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'forwards'
        });
    }

    // V6.1: Late-subscriber safe � se il footer � gi� pronto, inizializza subito
    const _footerState = getFooterReady();
    if (_footerState) {
        initFABFromFooter(_footerState);
    } else {
        document.addEventListener('footer:ready', (e) => initFABFromFooter(e.detail), { once: true });
    }
}
