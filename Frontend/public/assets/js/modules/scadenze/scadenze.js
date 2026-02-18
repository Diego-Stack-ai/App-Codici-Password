/**
 * SCADENZE MODULE (V4.1)
 * Gestione della pagina scadenze (lista completa) e utility per la home.
 * Refactor: Migrazione sotto modules/scadenze/ e standardizzazione import.
 */

import { auth, db } from '../../firebase-config.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t } from '../../translations.js';
import { initComponents } from '../../components.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { logError, formatDateToIT } from '../../utils.js';

let currentUser = null;
let allScadenze = [];
let activeFilter = 'all';
let searchQuery = '';
let sortType = 'date-asc';
let scadenzeContainer = null; // Module-scoped

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

/**
 * SCADENZE MODULE (V5.0 ADAPTER)
 * Gestione della pagina scadenze (lista completa).
 * - Entry Point: initScadenze(user)
 * - Managed by Main Orchestrator
 */

export async function initScadenze(user) {
    console.log("[SCADENZE] Init V5.0...");
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
    new SwipeList('.deadline-card', {
        threshold: 0.25,
        onSwipeRight: (item) => archiveScadenza(item.dataset.id),
        onSwipeLeft: (item) => deleteScadenza(item.dataset.id)
    });

    // FAB Button Setup
    setupFAB();

    console.log("[SCADENZE] Ready.");
}

// --- INTERNAL HELPER FUNCTIONS ---

async function loadScadenze() {
    if (!currentUser) return;
    try {
        allScadenze = await getScadenze(currentUser.uid);
        renderFilteredScadenze();
    } catch (error) {
        logError("Scadenze Page", error);
        if (scadenzeContainer) {
            const p = createElement('p', { className: 'hero-page-subtitle text-center mt-4', textContent: `Errore: ${error.message}` });
            setChildren(scadenzeContainer, p);
        }
    }
}

async function getScadenze(userId) {
    const scadenzeRef = collection(db, "users", userId, "scadenze");
    const querySnapshot = await getDocs(scadenzeRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderFilteredScadenze() {
    if (!scadenzeContainer) return;

    let filtered = [...allScadenze];
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);

    // Apply Filter (SEMPRE APPLICATO ORA)
    filtered = filtered.filter(s => {
        const dueDateValue = s.dueDate || s.date;
        const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
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

        // Se siamo qui e activeFilter == 'all', passa (perché non completata)
        return true;
    });

    // Apply Search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(s =>
            (s.title && s.title.toLowerCase().includes(q)) ||
            (s.category && s.category.toLowerCase().includes(q)) ||
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.veicolo_targa && s.veicolo_targa.toLowerCase().includes(q))
        );
    }

    // Apply Sort
    filtered.sort((a, b) => {
        if (sortType.startsWith('date')) {
            const dateAValue = a.dueDate || a.date;
            const dateBValue = b.dueDate || b.date;
            const dateA = (dateAValue && dateAValue.toDate) ? dateAValue.toDate() : new Date(dateAValue);
            const dateB = (dateBValue && dateBValue.toDate) ? dateBValue.toDate() : new Date(dateBValue);
            return sortType === 'date-asc' ? dateA - dateB : dateB - dateA;
        } else {
            const nameA = (a.title || "").toLowerCase();
            const nameB = (b.title || "").toLowerCase();
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
    const dueDateValue = scadenza.dueDate || scadenza.date;
    const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
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

    // 2. CONTENUTO VISIBILE (Sopra)
    const swipeContent = createElement('div', { className: 'swipe-content' }, [
        createElement('div', { className: 'deadline-card-layout' }, [
            createElement('div', { className: 'deadline-card-left' }, [
                createElement('div', { className: 'deadline-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: scadenza.icon || 'event_note' })
                ]),
                createElement('div', { className: 'deadline-card-info-group' }, [
                    createElement('span', { className: 'deadline-card-category', textContent: (scadenza.category || 'SCADENZA').toUpperCase() }),
                    createElement('h4', { className: 'deadline-card-title', textContent: scadenza.title }),
                    createElement('p', { className: 'deadline-card-subtitle', textContent: `Ref: ${scadenza.name || 'Generale'}` })
                ])
            ]),
            createElement('span', {
                className: 'deadline-date-badge',
                textContent: dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
            })
        ]),


    ]);

    const card = createElement('div', {
        className: `deadline-card ${stateClass}`,
        dataset: {
            id: scadenza.id,
            action: 'navigate',
            href: `dettaglio_scadenza.html?id=${scadenza.id}`
        }
    }, [bgArchive, bgDelete, swipeContent]);

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
        // Qui potresti mettere un confirm, ma lo swipe è un'azione veloce.
        // Se preferisci conferma, scommenta:
        // if(!confirm("Eliminare definitivamente?")) { loadScadenze(); return; }

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
    // Cerca il footer per 2 secondi max
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        const footerCenter = document.getElementById('footer-center-actions');

        if (footerCenter) {
            clearInterval(interval);
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

        if (attempts > 20) clearInterval(interval); // Timeout 2s
    }, 100);
}

// --- UTILITY PER LA HOME PAGE (ESPORTATA) ---

export async function loadUrgentDeadlinesCount(user) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const colRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(colRef);
        const items = [];

        snap.forEach(d => {
            const data = d.data();
            if (data.completed) return;

            if (data.dueDate) {
                const due = new Date(data.dueDate);
                due.setHours(0, 0, 0, 0);
                const days = data.notificationDaysBefore || 7;
                const start = new Date(due);
                start.setDate(start.getDate() - days);

                if (today >= start && today <= due) {
                    items.push({ ...data, id: d.id, due: due });
                }
            }
        });

        items.sort((a, b) => a.due - b.due);

        const badge = document.getElementById('urgent-count-badge');
        const count = document.getElementById('urgent-count');
        if (count) count.textContent = items.length;
        if (badge) {
            badge.classList.remove('loading-pulse');
            if (items.length > 0) {
                badge.classList.add('opacity-100');
                badge.classList.remove('opacity-0');
            } else {
                badge.classList.add('opacity-0');
                badge.classList.remove('opacity-100');
            }
        }

        const list = document.getElementById('deadline-list-container');
        if (list) {
            clearElement(list);
            if (items.length > 0) {
                const listItems = items.map(deadline => {
                    const daysUntil = Math.ceil((deadline.due - today) / (1000 * 60 * 60 * 24));
                    const badgeText = daysUntil < 0 ? 'Scaduto' : (daysUntil === 0 ? 'Oggi' : (daysUntil === 1 ? 'Domani' : `${daysUntil}g`));

                    return createElement('div', { className: 'micro-list-item' }, [
                        createElement('div', { className: 'item-content' }, [
                            createElement('div', { className: 'item-icon-box' }, [
                                createElement('span', { className: 'material-symbols-outlined', textContent: deadline.icon || 'event' })
                            ]),
                            createElement('span', { className: 'item-title', textContent: deadline.title })
                        ]),
                        createElement('span', { className: 'item-badge', textContent: badgeText })
                    ]);
                });
                setChildren(list, listItems);
            }
        }
    } catch (error) {
        logError("Utility Scadenze", error);
        if (error.code === 'permission-denied') {
            console.warn("Permessi insufficienti per leggere le scadenze (REGOLE FIRESTORE?)");
        } else if (error.code === 'unavailable') {
            console.warn("Il database non risponde. Controlla la connessione.");
        }
    }
}

