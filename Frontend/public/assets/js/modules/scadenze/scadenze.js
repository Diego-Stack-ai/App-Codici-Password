/**
 * SCADENZE MODULE (V4.1)
 * Gestione della pagina scadenze (lista completa) e utility per la home.
 * Refactor: Migrazione sotto modules/scadenze/ e standardizzazione import.
 */

import { auth, db } from '../../firebase-config.js';
import { SwipeList } from '../../swipe-list-v6.js';
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { t } from '../../translations.js';
import { initComponents } from '../../components.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { logError, formatDateToIT } from '../../utils.js';

let currentUser = null;
let allScadenze = [];
let activeFilter = 'Tutte';
let searchQuery = '';
let sortType = 'date-asc';

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    const scadenzeContainer = document.querySelector('#scadenze-list');
    if (!scadenzeContainer) return;

    const searchBarContainer = document.getElementById('search-bar-container');
    const searchInput = document.getElementById('deadline-search');
    const filterChips = document.querySelectorAll('.filter-chip');
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    const sortItems = document.querySelectorAll('.base-dropdown-item');

    // URL Filter
    const urlParams = new URLSearchParams(window.location.search);
    const urlFilter = urlParams.get('filter');
    if (urlFilter === 'urgenti') activeFilter = 'Urgenti';
    else if (urlFilter === 'in_scadenza') activeFilter = 'In scadenza';

    // Sync chips with URL filter
    filterChips.forEach(chip => {
        if (chip.textContent.trim() === activeFilter) chip.classList.add('active');
        else chip.classList.remove('active');
    });



    // Filter Chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.textContent.trim();
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

    // Auth & Load
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadScadenze();
        } else {
            window.location.href = 'index.html';
        }
    });

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

        // Apply Filter
        if (activeFilter !== 'Tutte') {
            filtered = filtered.filter(s => {
                const dueDateValue = s.dueDate || s.date;
                const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
                const expired = dueDate < now;
                const isUpcoming = dueDate >= now && dueDate <= thirtyDaysLater;

                if (activeFilter === 'Urgenti') return expired;
                if (activeFilter === 'In scadenza') return isUpcoming;
                if (activeFilter === 'Completate') return s.completed;
                return true;
            });
        }

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
                    textContent: 'Nessuna scadenza trovata'
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
        if (expired) stateClass = 'deadline-card-expired';
        else if (isUpcoming) stateClass = 'deadline-card-upcoming';

        const card = createElement('div', {
            className: `deadline-card ${stateClass}`,
            dataset: {
                action: 'navigate',
                href: `dettaglio_scadenza.html?id=${scadenza.id}`
            }
        }, [
            createElement('div', { className: 'flex items-start justify-between gap-4' }, [
                createElement('div', { className: 'flex items-center gap-4 min-w-0' }, [
                    createElement('div', { className: 'deadline-icon-box' }, [
                        createElement('span', { className: 'material-symbols-outlined filled text-2xl', textContent: scadenza.icon || 'event_note' })
                    ]),
                    createElement('div', { className: 'flex-col min-w-0' }, [
                        createElement('span', { className: 'deadline-card-category', textContent: scadenza.category || 'SCADENZA' }),
                        createElement('h4', { className: 'deadline-card-title', textContent: scadenza.title }),
                        createElement('p', { className: 'deadline-card-subtitle', textContent: `Ref: ${scadenza.name || 'Generale'}` })
                    ])
                ]),
                createElement('span', {
                    className: 'deadline-date-badge',
                    textContent: dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase()
                })
            ])
        ]);

        card.addEventListener('click', () => {
            window.location.href = card.getAttribute('data-href');
        });

        return card;
    }
});

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

