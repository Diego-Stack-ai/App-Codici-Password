import { getScadenze, saveScadenza } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const pageTitle = document.querySelector('h1');
    const dynamicFieldsContainer = document.getElementById('dynamic-fields-container');
    const addDynamicFieldButton = document.getElementById('add-dynamic-field');
    const emailRecipientsContainer = document.getElementById('email-recipients-container');
    const addEmailRecipientButton = document.getElementById('add-email-recipient');
    const saveButton = document.getElementById('save-button');
    const titleInput = document.getElementById('title');
    const dueDateInput = document.getElementById('dueDate');
    const categoryInput = document.getElementById('category');
    const notesInput = document.getElementById('notes');

    const urlParams = new URLSearchParams(window.location.search);
    const scadenzaId = urlParams.get('id');
    const userId = 'user1'; // Mock user ID

    let isEditMode = false;
    let existingScadenza = null;

    if (scadenzaId) {
        isEditMode = true;
        pageTitle.textContent = 'Modifica Scadenza';
        const scadenze = getScadenze(userId);
        existingScadenza = scadenze.find(s => s.id === scadenzaId);

        if (existingScadenza) {
            titleInput.value = existingScadenza.title;
            dueDateInput.value = new Date(existingScadenza.dueDate).toISOString().split('T')[0];
            categoryInput.value = existingScadenza.category;
            notesInput.value = existingScadenza.notes;

            if (existingScadenza.dynamicFields) {
                existingScadenza.dynamicFields.forEach(field => {
                    const newField = document.createElement('div');
                    newField.classList.add('flex', 'gap-2');
                    newField.innerHTML = `
                        <input type="text" placeholder="Nome Campo" class="w-1/2 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary" value="${field.key}">
                        <input type="text" placeholder="Valore" class="w-1/2 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary" value="${field.value}">
                        <button class="text-red-500 remove-dynamic-field">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                    `;
                    dynamicFieldsContainer.appendChild(newField);
                });
            }

            if (existingScadenza.emailRecipients) {
                existingScadenza.emailRecipients.forEach(email => {
                    const newRecipient = document.createElement('div');
                    newRecipient.classList.add('flex', 'gap-2');
                    newRecipient.innerHTML = `
                        <input type="email" placeholder="email@esempio.com" class="w-full bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary" value="${email}">
                        <button class="text-red-500 remove-email-recipient">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                    `;
                    emailRecipientsContainer.appendChild(newRecipient);
                });
            }
        }
    }


    addDynamicFieldButton.addEventListener('click', () => {
        const newField = document.createElement('div');
        newField.classList.add('flex', 'gap-2');
        newField.innerHTML = `
            <input type="text" placeholder="Nome Campo" class="w-1/2 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary">
            <input type="text" placeholder="Valore" class="w-1/2 bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary">
            <button class="text-red-500 remove-dynamic-field">
                <span class="material-symbols-outlined">remove</span>
            </button>
        `;
        dynamicFieldsContainer.appendChild(newField);
    });

    addEmailRecipientButton.addEventListener('click', () => {
        const newRecipient = document.createElement('div');
        newRecipient.classList.add('flex', 'gap-2');
        newRecipient.innerHTML = `
            <input type="email" placeholder="email@esempio.com" class="w-full bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:ring-0 focus:border-primary">
            <button class="text-red-500 remove-email-recipient">
                <span class="material-symbols-outlined">remove</span>
            </button>
        `;
        emailRecipientsContainer.appendChild(newRecipient);
    });

    dynamicFieldsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-dynamic-field')) {
            e.target.closest('.flex.gap-2').remove();
        }
    });

    emailRecipientsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-email-recipient')) {
            e.target.closest('.flex.gap-2').remove();
        }
    });

    saveButton.addEventListener('click', () => {
        const dynamicFields = [];
        dynamicFieldsContainer.querySelectorAll('.flex.gap-2').forEach(field => {
            const key = field.querySelector('input:nth-child(1)').value;
            const value = field.querySelector('input:nth-child(2)').value;
            if (key && value) {
                dynamicFields.push({ key, value });
            }
        });

        const emailRecipients = [];
        emailRecipientsContainer.querySelectorAll('.flex.gap-2').forEach(recipient => {
            const email = recipient.querySelector('input').value;
            if (email) {
                emailRecipients.push(email);
            }
        });

        const newScadenza = {
            id: isEditMode ? scadenzaId : Date.now().toString(),
            title: titleInput.value,
            dueDate: new Date(dueDateInput.value),
            category: categoryInput.value,
            notes: notesInput.value,
            dynamicFields,
            emailRecipients,
            status: isEditMode ? existingScadenza.status : 'due'
        };

        saveScadenza(userId, newScadenza);
        alert('Scadenza salvata!');
        location.href = 'scadenze.html';
    });
});
