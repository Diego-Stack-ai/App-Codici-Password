/**
 * SCADENZE MODULE (PROTOCOLLO BASE V3.6)
 * Gestione della pagina scadenze (lista completa) e utility per la home
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';

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

    // Footer Actions Injection
    const injectFooterActions = () => {
        const footerCenter = document.getElementById('footer-center-actions');
        const footerRight = document.getElementById('footer-right-actions');

        if (footerCenter) {
            footerCenter.innerHTML = `
                <button id="toggle-search" class="btn-icon-header">
                    <span class="material-symbols-outlined">search</span>
                </button>
            `;
            const toggleBtn = document.getElementById('toggle-search');
            if (toggleBtn && searchBarContainer) {
                function handleSearchToggle() {
                    searchBarContainer.classList.toggle('active');
                    if (searchBarContainer.classList.contains('active') && searchInput) {
                        searchInput.focus();
                    }
                }
                toggleBtn.addEventListener('click', handleSearchToggle);
            }
        }

        if (footerRight) {
            const addBtn = document.createElement('a');
            addBtn.href = 'aggiungi_scadenza.html';
            addBtn.className = 'btn-icon-header';
            addBtn.innerHTML = '<span class="material-symbols-outlined">add</span>';
            footerRight.prepend(addBtn);
        }
    };

    setTimeout(injectFooterActions, 500);

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
        function handleSortToggle(e) {
            e.stopPropagation();
            sortMenu.classList.toggle('show');
        }

        sortBtn.addEventListener('click', handleSortToggle);

        sortItems.forEach(item => {
            function handleSortItemClick(e) {
                e.stopPropagation();
                sortType = item.getAttribute('data-value');
                sortItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                sortMenu.classList.remove('show');
                renderFilteredScadenze();
            }
            item.addEventListener('click', handleSortItemClick);
        });

        document.addEventListener('click', () => sortMenu.classList.remove('show'));
    }

    // Search Input
    if (searchInput) {
        function handleSearchInput(e) {
            searchQuery = e.target.value;
            renderFilteredScadenze();
        }
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
                scadenzeContainer.innerHTML = `<p class="text-center p-4 text-red-500">Errore: ${error.message}</p>`;
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
        if (filtered.length === 0) {
            scadenzeContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-30">
                    <span class="material-symbols-outlined text-6xl mb-4">event_busy</span>
                    <p class="font-bold uppercase tracking-widest text-xs" data-t="no_deadlines_found">Nessuna scadenza trovata</p>
                </div>`;
            return;
        }

        scadenzeContainer.innerHTML = filtered.map(s => createScadenzaCard(s)).join('');
    }

    function createScadenzaCard(scadenza) {
        const dueDateValue = scadenza.dueDate || scadenza.date;
        const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
        const now = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(now.getDate() + 30);
        const expired = dueDate < now;
        const isUpcoming = dueDate >= now && dueDate <= thirtyDaysLater;

        let borderColor = 'border-blue-500/30';
        let bgColor = 'bg-blue-500/5';
        let iconColor = 'text-blue-400';

        if (expired) {
            borderColor = 'border-red-500/30';
            bgColor = 'bg-red-500/5';
            iconColor = 'text-red-400';
        } else if (isUpcoming) {
            borderColor = 'border-amber-500/30';
            bgColor = 'bg-amber-500/5';
            iconColor = 'text-amber-400';
        }

        const dateStr = dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase();

        return `
            <div class="glass-card p-4 border-l-4 ${borderColor} ${bgColor} cursor-pointer hover:bg-white/5 transition-all active:scale-95 animate-in slide-in-from-bottom-2 duration-300"
                 data-action="navigate" data-href="dettaglio_scadenza.html?id=${scadenza.id}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-4 min-w-0">
                        <div class="size-12 rounded-2xl ${bgColor} border ${borderColor} ${iconColor} flex-center shrink-0">
                            <span class="material-symbols-outlined filled text-2xl">${scadenza.icon || 'event_note'}</span>
                        </div>
                        <div class="flex-col min-w-0">
                            <span class="text-[9px] font-black uppercase text-white/20 tracking-widest">${scadenza.category || 'SCADENZA'}</span>
                            <h4 class="text-sm font-black text-white uppercase tracking-wider truncate">${scadenza.title}</h4>
                            <p class="text-[10px] font-medium text-white/40 uppercase">Ref: ${scadenza.name || 'Generale'}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-lg ${bgColor} border ${borderColor} text-[10px] font-black uppercase tracking-widest ${iconColor} shrink-0">
                        ${dateStr}
                    </span>
                </div>
            </div>`;
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
            badge.style.opacity = items.length > 0 ? "1" : "0";
        }

        const list = document.getElementById('deadline-list-container');
        if (list) {
            if (items.length === 0) {
                list.innerHTML = '';
            } else {
                list.innerHTML = items.map(deadline => {
                    const daysUntil = Math.ceil((deadline.due - today) / (1000 * 60 * 60 * 24));
                    const badgeText = daysUntil < 0 ? 'Scaduto' : (daysUntil === 0 ? 'Oggi' : (daysUntil === 1 ? 'Domani' : `${daysUntil}g`));

                    return `
                    <div class="micro-list-item">
                        <div class="item-content">
                            <div class="item-icon-box">
                                <span class="material-symbols-outlined">${deadline.icon || 'event'}</span>
                            </div>
                            <span class="item-title">${deadline.title}</span>
                        </div>
                        <span class="item-badge">${badgeText}</span>
                    </div>`;
                }).join('');
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
