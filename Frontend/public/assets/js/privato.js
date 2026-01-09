import { getUsers } from './db.js';

document.addEventListener('DOMContentLoaded', function() {

    // Simulate Login
    const testUser = getUsers()[0];
    if (testUser) {
        sessionStorage.setItem('loggedInUser', JSON.stringify({
            email: testUser.email,
            nome: testUser.nome
        }));
    }

    // Routing
    const pagePath = window.location.pathname;
    if (pagePath.includes('account_privati.html')) {
        renderPrivateAccounts();
    } else if (pagePath.includes('dati_anagrafici_privato.html')) {
        setupDatiAnagrafici();
    }

    // Render Functions
    function renderPrivateAccounts() {
        const container = document.getElementById('private-accounts-list');
        const user = getUsers()[0]; // Directly use the seeded user
        if (!container || !user) return;

        const accounts = user.accounts || [];
        container.innerHTML = accounts.map(acc => `
            <div class="account-card bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <h3 class="font-bold text-lg">${acc.nomeAccount}</h3>
                <p class="text-sm text-gray-500">${acc.username}</p>
            </div>`).join('');
    }

    function setupDatiAnagrafici() {
        const user = getUsers()[0]; // Directly use the seeded user
        if (user) {
            document.getElementById('user-name').textContent = `${user.nome} ${user.cognome}`;
            document.getElementById('codice-fiscale').textContent = user.codiceFiscale;
            document.getElementById('email-view').textContent = user.email;
            document.getElementById('phone-view').textContent = user.telefono;
            document.getElementById('address-view').textContent = user.indirizzo;
            document.getElementById('iban-view').textContent = user.iban;
        }
    }
});
