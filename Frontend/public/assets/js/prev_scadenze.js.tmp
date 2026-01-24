import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, query, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let currentUser = null;
let allScadenze = [];

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    const scadenzeContainer = document.querySelector('#scadenze-list');
    const searchInput = document.getElementById('deadline-search');
    const sortSelect = document.getElementById('deadline-sort');
    const filterChips = document.querySelectorAll('.filter-chip');
    const toggleSearchBtn = document.getElementById('toggle-search');
    const searchBarContainer = document.getElementById('search-bar-container');

    let activeFilter = 'Tutte';
    let searchQuery = '';
    let sortType = 'date-asc';

    // Toggle Search Bar
    if (toggleSearchBtn && searchBarContainer) {
        toggleSearchBtn.onclick = () => {
            const isHidden = searchBarContainer.classList.contains('-translate-y-full');
            if (isHidden) {
                searchBarContainer.classList.remove('-translate-y-full', 'opacity-0');
                searchBarContainer.classList.add('translate-y-0', 'opacity-100');
                if (searchInput) searchInput.focus();
            } else {
                searchBarContainer.classList.add('-translate-y-full', 'opacity-0');
                searchBarContainer.classList.remove('translate-y-0', 'opacity-100');
            }
        };
    }

    // Initialize Auth Listener
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
            console.error("Errore recupero scadenze:", error);
            if (scadenzeContainer) scadenzeContainer.innerHTML = `<p class="text-center p-4 text-red-500">Errore: ${error.message}</p>`;
        }
    }

    async function getScadenze(userId) {
        // Correct path: users/{userId}/scadenze
        const scadenzeRef = collection(db, "users", userId, "scadenze");
        const querySnapshot = await getDocs(scadenzeRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function renderFilteredScadenze() {
        if (!scadenzeContainer) return;

        let filtered = [...allScadenze];

        // 1. Filter by status
        const now = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(now.getDate() + 30);

        if (activeFilter !== 'Tutte') {
            filtered = filtered.filter(s => {
                const dueDateValue = s.dueDate || s.date; // Support both just in case
                const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
                const expired = dueDate < now;
                const isUpcoming = dueDate >= now && dueDate <= thirtyDaysLater;

                if (activeFilter === 'Urgenti') return expired;
                if (activeFilter === 'In scadenza') return isUpcoming;
                if (activeFilter === 'Completate') return s.completed;
                return true;
            });
        }

        // 2. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                (s.title && s.title.toLowerCase().includes(q)) ||
                (s.category && s.category.toLowerCase().includes(q)) ||
                (s.name && s.name.toLowerCase().includes(q)) ||
                (s.veicolo_targa && s.veicolo_targa.toLowerCase().includes(q))
            );
        }

        // 3. Sort
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

        // 4. Render
        if (filtered.length === 0) {
            scadenzeContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 opacity-30">
                    <span class="material-symbols-outlined text-6xl mb-4">event_busy</span>
                    <p class="text-white font-bold uppercase tracking-widest text-xs">Nessuna scadenza trovata</p>
                </div>`;
            document.getElementById('deadline-count').textContent = '0';
            return;
        }

        document.getElementById('deadline-count').textContent = filtered.length;
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

        let statusClasses = '';
        let cardBaseGradient = '';
        let glowColor = 'rgba(37, 99, 235, 0.3)'; // Default Blue Glow

        if (expired) {
            statusClasses = 'bg-red-500/20 text-red-500 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
            cardBaseGradient = 'linear-gradient(135deg, #7f1d1d 0%, #1e0707 100%)';
            glowColor = 'rgba(239, 68, 68, 0.3)';
        } else if (isUpcoming) {
            statusClasses = 'bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.4)]';
            cardBaseGradient = 'linear-gradient(135deg, #f59e0b 0%, #92400e 100%)';
            glowColor = 'rgba(245, 158, 11, 0.3)';
        } else {
            statusClasses = 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]';
            cardBaseGradient = 'linear-gradient(135deg, #1e40af 0%, #0f172a 100%)';
            glowColor = 'rgba(37, 99, 235, 0.3)';
        }

        const avatarOrIcon = `
            <div class="h-12 w-12 flex items-center justify-center shrink-0 overflow-hidden rounded-xl bg-white/10 border border-white/20 text-white shadow-lg backdrop-blur-md">
                <span class="material-symbols-outlined text-2xl !text-white">${scadenza.icon || 'event_note'}</span>
            </div>`;

        return `
            <div class="flex flex-col gap-3 rounded-[24px] p-4 border border-white/20 active:scale-[0.98] transition-all duration-300 hover:-translate-y-1 cursor-pointer backdrop-blur-[18px] group overflow-hidden relative shadow-[0_15px_35px_rgba(0,0,0,0.5)]" 
                 style="background: 
                    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 60%),
                    radial-gradient(circle at 0% 50%, ${glowColor} 0%, transparent 60%),
                    radial-gradient(circle at 100% 50%, ${glowColor} 0%, transparent 60%),
                    linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.10) 49%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.10) 51%, transparent 58%),
                    ${cardBaseGradient};
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);"
                 onclick="location.href='dettaglio_scadenza.html?id=${scadenza.id}'">
                
                <div class="flex items-center justify-between gap-3 relative z-10">
                    <div class="flex items-center gap-3 min-w-0">
                        ${avatarOrIcon}
                        <div class="flex flex-col min-w-0">
                            <p class="text-[9px] font-bold uppercase text-blue-300 tracking-widest mb-0.5 opacity-80">${scadenza.category || 'SCADENZA'}</p>
                            <h3 class="text-base font-bold text-white leading-tight group-hover:text-blue-300 transition-colors">${scadenza.title}</h3>
                            <p class="text-[11px] text-white/50 truncate mt-0.5">Ref: ${scadenza.name || 'Generale'}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                        <span class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-tight ${statusClasses} border backdrop-blur-md transition-transform group-hover:scale-110">
                            ${dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase()}
                        </span>
                    </div>
                </div>

                ${scadenza.veicolo_targa ? `
                <div class="mt-1 pt-2 border-t border-white/10 flex items-center justify-end relative z-10">
                    <div class="flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                        <span class="material-symbols-outlined text-[14px] text-white/40">directions_car</span>
                        <span class="text-[10px] font-bold text-white/70 tracking-widest uppercase">${scadenza.veicolo_targa}</span>
                    </div>
                </div>` : ''}
            </div>`;
    }

    // listeners
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            renderFilteredScadenze();
        };
    }

    if (sortSelect) {
        sortSelect.onchange = (e) => {
            sortType = e.target.value;
            renderFilteredScadenze();
        };
    }

    filterChips.forEach(chip => {
        chip.onclick = () => {
            filterChips.forEach(c => {
                c.classList.remove('active', 'bg-primary', 'text-white', 'font-black', 'shadow-lg', 'shadow-primary/20');
                c.classList.add('bg-[#0a192f]/40', 'text-white/40', 'font-bold');
            });
            chip.classList.add('active', 'bg-primary', 'text-white', 'font-black', 'shadow-lg', 'shadow-primary/20');
            chip.classList.remove('bg-[#0a192f]/40', 'text-white/40', 'font-bold');
            activeFilter = chip.textContent.trim();
            renderFilteredScadenze();
        };
    });
});
