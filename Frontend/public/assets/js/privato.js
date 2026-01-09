import { getUsers } from './db.js';

document.addEventListener('DOMContentLoaded', function() {

    // --- SIMULATE LOGIN ---
    // Get the hardcoded user and set the session
    const testUser = getUsers()[0];
    if (testUser) {
        sessionStorage.setItem('loggedInUser', JSON.stringify({
            email: testUser.email,
            nome: testUser.nome
        }));
    }

    // --- ROUTING ---
    const pagePath = window.location.pathname;
    if (pagePath.includes('account_privati.html')) {
        renderPrivateAccounts();
    } else if (pagePath.includes('dati_anagrafici_privato.html')) {
        setupDatiAnagrafici();
    }

    // --- RENDER FUNCTIONS ---
    function renderPrivateAccounts() {
        const container = document.getElementById('private-accounts-list');
        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        if (!container || !loggedInUser) return;

        const user = getUsers().find(u => u.email === loggedInUser.email);
        const accounts = user && user.accounts ? user.accounts : [];

        container.innerHTML = accounts.map(acc => `
            <div class="account-card bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-lg">${acc.nomeAccount}</h3>
                        <p class="text-sm text-gray-500">${acc.username}</p>
                    </div>
                    <a href="#" class="text-primary">Dettagli</a>
                </div>
            </div>`).join('');
    }

    function setupDatiAnagrafici() {
        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        if (!loggedInUser) return;
        const user = getUsers().find(u => u.email === loggedInUser.email);

        if (user) {
            // Populate user data on the anagrafici page
            document.getElementById('user-name').textContent = `${user.nome} ${user.cognome}`;
            document.getElementById('codice-fiscale').textContent = user.codiceFiscale;
            document.getElementById('email-view').textContent = user.email;
            document.getElementById('phone-view').textContent = user.telefono;
            document.getElementById('address-view').textContent = user.indirizzo;
            document.getElementById('iban-view').textContent = user.iban;
        }
    }
});
