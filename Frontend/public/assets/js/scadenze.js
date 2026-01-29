/**
 * SCADENZE MODULE
 * Gestione della pagina scadenze (lista completa) e utility per la home
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, query, getDocs, orderBy, addDoc, Timestamp, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import {
    EMAILS,
    VEHICLES,
    DEADLINE_RULES,
    buildEmailBody,
    buildEmailSubject
} from './scadenza_templates.js';

// --- LOGICA PER LA PAGINA SCADENZE.HTML ---

let currentUser = null;
let allScadenze = [];
let dynamicConfig = { deadlineTypes: [], models: [], plates: [], emailTemplates: [], names: [] };
let unifiedConfigs = { automezzi: null, documenti: null, generali: null };
let currentMode = 'automezzi';
let currentRule = null;

document.addEventListener('DOMContentLoaded', () => {
    const scadenzeContainer = document.querySelector('#scadenze-list');
    if (!scadenzeContainer) return;

    const searchInput = document.getElementById('deadline-search');
    const filterChips = document.querySelectorAll('.filter-chip');
    const toggleSearchBtn = document.getElementById('toggle-search');
    const searchBarContainer = document.getElementById('search-bar-container');

    let activeFilter = 'Tutte';
    let searchQuery = '';
    let sortType = 'date-asc';

    if (toggleSearchBtn && searchBarContainer) {
        toggleSearchBtn.onclick = () => {
            searchBarContainer.classList.toggle('active');
            if (searchBarContainer.classList.contains('active')) {
                if (searchInput) searchInput.focus();
            }
        };
    }

    // Filter Chips logic update for Titanium
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.textContent.trim();
            renderFilteredScadenze();
        });
    });

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
            if (scadenzeContainer) scadenzeContainer.innerHTML = `<p class="text-center p-4 text-red-500">Errore: ${error.message}</p>`;
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

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                (s.title && s.title.toLowerCase().includes(q)) ||
                (s.category && s.category.toLowerCase().includes(q)) ||
                (s.name && s.name.toLowerCase().includes(q)) ||
                (s.veicolo_targa && s.veicolo_targa.toLowerCase().includes(q))
            );
        }

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

        if (filtered.length === 0) {
            scadenzeContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-30">
                    <span class="material-symbols-outlined text-6xl mb-4">event_busy</span>
                    <p class="font-bold uppercase tracking-widest text-xs">Nessuna scadenza trovata</p>
                </div>`;
            const countEl = document.getElementById('deadline-count');
            if (countEl) countEl.textContent = '0';
            return;
        }

        const countEl = document.getElementById('deadline-count');
        if (countEl) countEl.textContent = filtered.length;
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

        let accentColor = 'var(--accent-blue)';
        let glassBg = 'bg-blue-glass';
        if (expired) {
            accentColor = 'var(--accent-red)';
            glassBg = 'bg-red-glass';
        } else if (isUpcoming) {
            accentColor = 'var(--accent-amber)';
            glassBg = 'bg-amber-glass';
        }

        return `
            <div class="settings-item" style="border-left: 4px solid ${accentColor}; cursor: pointer; margin-bottom: 0.75rem;" 
                 onclick="location.href='dettaglio_scadenza.html?id=${scadenza.id}'">
                <div class="settings-item-header" style="position: relative;">
                    <div class="settings-item-info" style="width: 100%;">
                        <div class="settings-icon-box ${glassBg}">
                            <span class="material-symbols-outlined filled">${scadenza.icon || 'event_note'}</span>
                        </div>
                        <div class="settings-text">
                            <span class="settings-label" style="font-size: 0.65rem; opacity: 0.6;">${scadenza.category || 'SCADENZA'}</span>
                            <span class="settings-label" style="font-size: 1rem; margin: 2px 0;">${scadenza.title}</span>
                            <span class="settings-desc">Ref: ${scadenza.name || 'Generale'}</span>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white" 
                          style="position: absolute; top: 0; right: 0;">
                        ${dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </span>
                </div>
            </div>`;
    }

    const sortTrigger = document.getElementById('sort-trigger');
    const sortMenu = document.getElementById('sort-menu');
    const sortItems = document.querySelectorAll('.titanium-dropdown-item');
    const currentSortLabel = document.getElementById('current-sort');

    if (sortTrigger && sortMenu) {
        sortTrigger.onclick = (e) => {
            e.stopPropagation();
            sortMenu.classList.toggle('show');
        };

        sortItems.forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const val = item.getAttribute('data-value');
                sortType = val;

                // Update UI
                sortItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (currentSortLabel) currentSortLabel.textContent = item.textContent;

                sortMenu.classList.remove('show');
                renderFilteredScadenze();
            };
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            sortMenu.classList.remove('show');
        });
    }

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            renderFilteredScadenze();
        };
    }
});


// --- UTILITY PER LA HOME PAGE (ESPORTATA) ---

export async function loadUrgentDeadlinesCount(user) {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const colRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(colRef);
        const items = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.completed) return;
            if (data.dueDate) {
                const due = new Date(data.dueDate); due.setHours(0, 0, 0, 0);
                const days = data.notificationDaysBefore || 7;
                const start = new Date(due); start.setDate(start.getDate() - days);
                if (today >= start && today <= due) {
                    items.push({ ...data, id: d.id, due: due });
                }
            }
        });
        items.sort((a, b) => a.due - b.due);

        const badge = document.getElementById('urgent-count-badge');
        const count = document.getElementById('urgent-count');
        if (count) count.textContent = items.length;
        if (badge) badge.style.opacity = items.length > 0 ? "" : "0";

        const list = document.getElementById('deadline-list-container');
        if (list) {
            if (items.length === 0) list.innerHTML = '';
            else {
                list.innerHTML = items.map(deadline => {
                    const daysUntil = Math.ceil((deadline.due - today) / (1000 * 60 * 60 * 24));
                    const matrixClass = daysUntil < 0 ? 'matrix-red' : 'matrix-orange';
                    const badgeText = daysUntil < 0 ? 'Scaduto' : (daysUntil === 0 ? 'Oggi' : (daysUntil === 1 ? 'Domani' : `${daysUntil}g`));

                    return `
                    <a href="scadenze.html" class="titanium-interactive border-glow dynamic-card ${matrixClass}">
                        <div class="card-shine"></div>
                        <div class="card-content">
                            <div class="icon-circle">
                                <span class="material-symbols-outlined" style="font-size: 20px;">${deadline.icon || 'event'}</span>
                            </div>
                            <div class="card-text">
                                <div class="card-title" style="font-size: 0.85rem; color: inherit;">${deadline.title}</div>
                            </div>
                            <div class="flex flex-col items-end shrink-0">
                                <span class="font-bold" style="font-size: 0.7rem;">${badgeText}</span>
                            </div>
                        </div>
                    </a>`;
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
