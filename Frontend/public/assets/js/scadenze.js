import { getScadenze, deleteScadenza } from './db.js';
import { showNotification } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!loggedInUser || !loggedInUser.id) {
        console.error("User not logged in or user ID is missing.");
        window.location.href = 'index.html';
        return;
    }
    const userId = loggedInUser.id;

    const listContainer = document.querySelector('.flex-col.gap-3.px-4');
    const filterButtons = document.querySelectorAll('.flex.gap-2.px-4 button');
    const addButton = document.querySelector('.absolute.bottom-24.right-4 button');

    let currentFilter = 'Tutte';
    let allScadenze = [];

    // --- RENDER FUNCTION ---
    function renderScadenze(filter = 'Tutte') {
        listContainer.innerHTML = ''; // Clear existing list
        const now = new Date();

        const filteredScadenze = allScadenze.filter(scadenza => {
            const scadenzaDate = new Date(scadenza.data);
            const diffDays = Math.ceil((scadenzaDate - now) / (1000 * 60 * 60 * 24));

            if (filter === 'Tutte') return true;
            if (filter === 'Urgenti') return diffDays >= 0 && diffDays <= 3;
            if (filter === 'In scadenza') return diffDays > 3 && diffDays <= 15;
            if (filter === 'Completate') return scadenza.stato === 'completata';
            return false;
        });

        if (filteredScadenze.length === 0) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 mt-8">Nessuna scadenza trovata.</p>`;
            return;
        }

        filteredScadenze.forEach(scadenza => {
            const card = createScadenzaCard(scadenza);
            listContainer.appendChild(card);
        });
    }

    // --- CARD CREATION ---
    function createScadenzaCard(scadenza) {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 flex items-center space-x-4';

        const iconClass = getStatusIcon(scadenza.stato, new Date(scadenza.data));

        card.innerHTML = `
            <div class="flex-shrink-0">
                <div class="w-12 h-12 rounded-full ${iconClass.bgColor} flex items-center justify-center">
                    <span class="material-symbols-outlined text-2xl ${iconClass.textColor}">${iconClass.icon}</span>
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-lg font-bold truncate">${scadenza.oggetto_email}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${getRelativeDate(scadenza.data)}</p>
            </div>
            <button class="delete-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" data-id="${scadenza.id}">
                <span class="material-symbols-outlined text-red-500">delete</span>
            </button>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn')) {
                 window.location.href = `dettaglio_scadenza.html?id=${scadenza.id}`;
            }
        });

        const deleteButton = card.querySelector('.delete-btn');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Sei sicuro di voler eliminare questa scadenza?')) {
                deleteScadenza(userId, scadenza.id);
                loadScadenze(); // Reload and re-render
                showNotification('Scadenza eliminata con successo.', 'success');
            }
        });

        return card;
    }

    // --- UTILITY FUNCTIONS ---
    function getStatusIcon(stato, dataScadenza) {
        const now = new Date();
        const diffDays = Math.ceil((dataScadenza - now) / (1000 * 60 * 60 * 24));

        if (stato === 'completata') {
            return { icon: 'task_alt', bgColor: 'bg-green-100 dark:bg-green-900', textColor: 'text-green-500' };
        }
        if (diffDays < 0) {
            return { icon: 'error', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-500' }; // Scaduta
        }
        if (diffDays <= 3) {
            return { icon: 'warning', bgColor: 'bg-red-100 dark:bg-red-900', textColor: 'text-red-500' }; // Urgente
        }
        if (diffDays <= 15) {
            return { icon: 'hourglass_top', bgColor: 'bg-yellow-100 dark:bg-yellow-900', textColor: 'text-yellow-500' }; // In scadenza
        }
        return { icon: 'event', bgColor: 'bg-blue-100 dark:bg-blue-900', textColor: 'text-blue-500' }; // Normale
    }

    function getRelativeDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

        if (diffDays < -1) return `Scaduta da ${Math.abs(diffDays)} giorni`;
        if (diffDays === -1) return 'Scaduta ieri';
        if (diffDays === 0) return 'Scade oggi';
        if (diffDays === 1) return 'Scade domani';
        return `Scade tra ${diffDays} giorni`;
    }

    // --- EVENT LISTENERS ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white', 'font-semibold');
                btn.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'font-medium');
            });
            button.classList.add('bg-primary', 'text-white', 'font-semibold');
            button.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'font-medium');

            currentFilter = button.textContent.trim();
            renderScadenze(currentFilter);
        });
    });

    addButton.addEventListener('click', () => {
        window.location.href = 'dettaglio_scadenza.html';
    });

    // --- INITIAL LOAD ---
    function loadScadenze() {
        allScadenze = getScadenze(userId);
        renderScadenze(currentFilter);
    }

    loadScadenze();
});
