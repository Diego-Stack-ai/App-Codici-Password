import { getScadenze, saveScadenza, deleteScadenza } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('h2');
    const status = document.querySelector('p.text-base.text-red-500');
    const detailsContainer = document.querySelector('.space-y-3');
    const notes = document.querySelector('.bg-white.dark\\:bg-gray-800.rounded-xl.shadow-sm.p-4:nth-child(3) > p');
    const editButton = document.querySelector('button.w-full.h-14.bg-gray-200');
    const markAsPaidButton = document.querySelector('button.w-full.h-14.bg-green-500');
    const backButton = document.querySelector('button[onclick="navigateTo(\'scadenze\')"]');
    const menuButton = document.getElementById('menu-button');
    const menuDropdown = document.getElementById('menu-dropdown');
    const deleteButton = document.getElementById('delete-button');
    const dynamicFieldsContainer = document.createElement('div');
    dynamicFieldsContainer.classList.add('bg-white', 'dark:bg-gray-800', 'rounded-xl', 'shadow-sm', 'p-4');
    const emailRecipientsContainer = document.createElement('div');
    emailRecipientsContainer.classList.add('bg-white', 'dark:bg-gray-800', 'rounded-xl', 'shadow-sm', 'p-4');

    const urlParams = new URLSearchParams(window.location.search);
    const scadenzaId = urlParams.get('id');
    const userId = 'user1'; // Mock user ID

    const scadenze = getScadenze(userId);
    const scadenza = scadenze.find(s => s.id === scadenzaId);

    if (scadenza) {
        title.textContent = scadenza.title;
        const daysRemaining = Math.ceil((new Date(scadenza.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        status.textContent = `Scade tra ${daysRemaining} giorni`;

        detailsContainer.innerHTML = `
            <div class="flex items-center">
                <span class="material-symbols-outlined text-gray-400 mr-3">calendar_today</span>
                <p class="flex-1 text-base">Data Scadenza: <span class="font-semibold">${new Date(scadenza.dueDate).toLocaleDateString('it-IT')}</span></p>
            </div>
            <div class="flex items-center">
                <span class="material-symbols-outlined text-gray-400 mr-3">category</span>
                <p class="flex-1 text-base">Categoria: <span class="font-semibold">${scadenza.category}</span></p>
            </div>
        `;

        if (scadenza.notes) {
            notes.textContent = scadenza.notes;
        }

        if (scadenza.dynamicFields && scadenza.dynamicFields.length > 0) {
            dynamicFieldsContainer.innerHTML = '<h3 class="text-sm font-medium text-gray-500 mb-2">Campi Dinamici</h3>';
            scadenza.dynamicFields.forEach(field => {
                dynamicFieldsContainer.innerHTML += `
                    <div class="flex items-center">
                        <p class="flex-1 text-base">${field.key}: <span class="font-semibold">${field.value}</span></p>
                    </div>
                `;
            });
            detailsContainer.parentElement.appendChild(dynamicFieldsContainer);
        }

        if (scadenza.emailRecipients && scadenza.emailRecipients.length > 0) {
            emailRecipientsContainer.innerHTML = '<h3 class="text-sm font-medium text-gray-500 mb-2">Destinatari Email</h3>';
            scadenza.emailRecipients.forEach(email => {
                emailRecipientsContainer.innerHTML += `
                    <div class="flex items-center">
                        <p class="flex-1 text-base"><span class="font-semibold">${email}</span></p>
                    </div>
                `;
            });
            detailsContainer.parentElement.appendChild(emailRecipientsContainer);
        }

        editButton.addEventListener('click', () => {
            location.href = `aggiungi_scadenza.html?id=${scadenza.id}`;
        });

        markAsPaidButton.addEventListener('click', () => {
            scadenza.status = 'completed';
            saveScadenza(userId, scadenza);
            alert('Scadenza segnata come pagata!');
            location.href = 'scadenze.html';
        });

        menuButton.addEventListener('click', () => {
            menuDropdown.classList.toggle('hidden');
        });

        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Sei sicuro di voler eliminare questa scadenza?')) {
                deleteScadenza(userId, scadenzaId);
                alert('Scadenza eliminata!');
                location.href = 'scadenze.html';
            }
        });

    }

    backButton.onclick = () => location.href = 'scadenze.html';
});
