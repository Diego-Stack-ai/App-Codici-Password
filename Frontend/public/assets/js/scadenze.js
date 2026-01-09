import { getScadenze } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const scadenzeContainer = document.querySelector('.flex.flex-col.gap-3.px-4.pb-24.flex-1.overflow-y-auto');
    const filterButtons = document.querySelectorAll('.flex.gap-2.px-4.py-3 button');
    const floatingActionButton = document.querySelector('.absolute.bottom-24.right-4.z-20 button');

    // Mock user ID
    const userId = 'user1';

    let allScadenze = getScadenze(userId);

    function renderScadenze(filter = 'Tutte') {
        scadenzeContainer.innerHTML = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thisWeekEnd = new Date(today);
        thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - today.getDay()));
        thisWeekEnd.setHours(23, 59, 59, 999);

        let filteredScadenze = allScadenze;

        if (filter !== 'Tutte') {
            filteredScadenze = allScadenze.filter(s => {
                if (filter === 'Urgenti') return s.status === 'urgent';
                if (filter === 'In scadenza') return s.status === 'due';
                if (filter === 'Completate') return s.status === 'completed';
                return false;
            });
        }

        const scadenzeOggi = filteredScadenze.filter(s => new Date(s.dueDate).toDateString() === today.toDateString());
        const scadenzeSettimana = filteredScadenze.filter(s => {
            const dueDate = new Date(s.dueDate);
            return dueDate > today && dueDate <= thisWeekEnd;
        });
        const scadenzeFuture = filteredScadenze.filter(s => new Date(s.dueDate) > thisWeekEnd);

        if (scadenzeOggi.length > 0) {
            scadenzeContainer.innerHTML += `<p class="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-2 mb-1">Oggi</p>`;
            scadenzeOggi.forEach(scadenza => {
                scadenzeContainer.innerHTML += createScadenzaCard(scadenza);
            });
        }

        if (scadenzeSettimana.length > 0) {
            scadenzeContainer.innerHTML += `<p class="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-1">Questa Settimana</p>`;
            scadenzeSettimana.forEach(scadenza => {
                scadenzeContainer.innerHTML += createScadenzaCard(scadenza);
            });
        }

        if (scadenzeFuture.length > 0) {
            scadenzeContainer.innerHTML += `<p class="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-1">Prossimamente</p>`;
            scadenzeFuture.forEach(scadenza => {
                scadenzeContainer.innerHTML += createScadenzaCard(scadenza);
            });
        }
    }

    function createScadenzaCard(scadenza) {
        let avatarOrIcon;
        if (scadenza.avatar) {
            avatarOrIcon = `<img alt="Avatar" class="h-full w-full object-cover" src="${scadenza.avatar}"/>`;
        } else {
            avatarOrIcon = `<div class="h-12 w-12 flex items-center justify-center shrink-0 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                <span class="material-symbols-outlined">${scadenza.icon || 'receipt_long'}</span>
                            </div>`;
        }

        let statusBadge;
        if (scadenza.status === 'urgent') {
            statusBadge = `<span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 ring-1 ring-inset ring-red-500/20">Oggi</span>
                           <span class="material-symbols-outlined text-red-500 filled text-lg icon-filled">priority_high</span>`;
        } else if (scadenza.status === 'completed') {
            statusBadge = `<span class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-500/10 px-2 py-1 text-xs font-bold text-green-600 dark:text-green-400 ring-1 ring-inset ring-green-500/20">Fatto</span>`;
        } else if (scadenza.time) {
            statusBadge = `<p class="text-sm font-semibold text-primary">${scadenza.time}</p>`;
        } else {
            const dueDate = new Date(scadenza.dueDate);
            statusBadge = `<span class="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20">${dueDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>`;
        }

        return `
            <div class="group relative flex flex-col gap-2 rounded-xl bg-white dark:bg-[#1E252B] p-4 shadow-sm border border-slate-200 dark:border-slate-800 active:scale-[0.98] transition-transform duration-200 ${scadenza.status === 'completed' ? 'opacity-60' : ''}" onclick="location.href='dettaglio_scadenza.html?id=${scadenza.id}'">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-center gap-3">
                        ${avatarOrIcon}
                        <div class="flex flex-col">
                            <p class="text-base font-bold text-slate-900 dark:text-white leading-tight ${scadenza.status === 'completed' ? 'line-through' : ''}">${scadenza.title}</p>
                            <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">${scadenza.category}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        ${statusBadge}
                    </div>
                </div>
            </div>
        `;
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
                btn.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-300', 'dark:hover:bg-slate-700');
            });
            button.classList.add('bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
            button.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-300', 'dark:hover:bg-slate-700');
            renderScadenze(button.textContent.trim());
        });
    });

    floatingActionButton.addEventListener('click', () => {
        location.href = 'aggiungi_scadenza.html';
    });

    renderScadenze();
});
