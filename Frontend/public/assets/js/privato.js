import { getAccounts } from './db.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Privato] Caricamento v1.2...");
    // alert("[DEBUG] Script Account caricato con successo (v1.2)");
    const accountsContainer = document.getElementById('accounts-container');
    const searchInput = document.querySelector('input[type="search"]');

    let currentUser = null;
    let allAccounts = [];

    // Initialize Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Update UI/Header with user info if needed
            // const userNameDisplay = document.getElementById('user-name-display');
            // if(userNameDisplay) userNameDisplay.textContent = user.displayName;

            await loadAccounts();
        } else {
            console.log("No user logged in, redirecting...");
            // Optionally redirect to index.html, but main.js or auth.js
            // window.location.href = 'index.html'; 
        }
    });
    async function loadAccounts() {
        if (!currentUser) return;

        try {
            // 'privato' matches the type we look for.
            allAccounts = await getAccounts(currentUser.uid, 'privato');

            // Initial Filter & Render
            filterAndRender();
        } catch (error) {
            console.error("Error loading accounts:", error);
            if (accountsContainer) {
                accountsContainer.innerHTML = '<div class="text-center py-10 text-red-500">Errore caricamento accounts.</div>';
            }
        }
    }

    console.log("[Privato] Version: 1.2 - Fix Navigation & Quotes - Time:", new Date().toLocaleTimeString());

    // FILTER LOGIC
    function filterAndRender() {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type') || 'standard';
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const pageTitle = document.querySelector('h1');

        console.log(`[Filter] Type: ${type}, Search: "${searchTerm}"`);
        console.log(`[Filter] Total Accounts Fetched: ${allAccounts.length}`);

        if (pageTitle) pageTitle.textContent = `Account (${allAccounts.length})`;

        // Debug first account structure if exists
        if (allAccounts.length > 0) {
            console.log('[Filter] Sample Account:', allAccounts[0]);
            console.log(`[Filter] Sample Shared: ${allAccounts[0].shared}, Memo: ${allAccounts[0].hasMemo}`);
        }

        // Update Title (User requested fixed "Account" title)
        /*
        if (pageTitle) {
            switch (type) {
                case 'shared': pageTitle.textContent = 'Account Condivisi'; break;
                case 'memo': pageTitle.textContent = 'Memorandum'; break;
                case 'shared_memo': pageTitle.textContent = 'Memorandum Condivisi'; break;
                default: pageTitle.textContent = 'I Miei Account'; break;
            }
        }
        */

        // 1. Filter by Type
        let filtered = allAccounts.filter(acc => {
            // Ensure strict boolean check only if properties exist, otherwise treat as false
            const isShared = !!acc.shared; // Convert truthy/falsy to strict boolean
            const isMemo = !!acc.hasMemo;

            switch (type) {
                case 'shared': return isShared && !isMemo;
                case 'memo': return !isShared && isMemo;
                case 'shared_memo': return isShared && isMemo;
                case 'standard': default: return !isShared && !isMemo;
            }
        });

        console.log(`[Filter] After Type Filter: ${filtered.length}`);

        // 2. Filter by Search
        if (searchTerm) {
            filtered = filtered.filter(acc =>
                acc.nomeAccount.toLowerCase().includes(searchTerm) ||
                (acc.username && acc.username.toLowerCase().includes(searchTerm))
            );
        }

        console.log(`[Filter] Final Render Count: ${filtered.length}`);
        renderAccounts(filtered);
    }

    function renderAccounts(accounts) {
        if (!accountsContainer) return;

        if (accounts.length === 0) {
            accountsContainer.innerHTML = `
                <div class="text-center py-10 opacity-60">
                    <span class="material-symbols-outlined text-4xl mb-2 text-gray-400">no_accounts</span>
                    <p class="text-gray-500">Nessun account trovato.</p>
                </div>`;
            return;
        }

        accountsContainer.innerHTML = accounts.map(account => createAccountCard(account)).join('');

        // Re-attach event listeners for the new DOM elements
        // We can use a global delegate or re-run setup functions from main.js if they are exposed
        // Since main.js runs on DOMContentLoaded, new elements won't have listeners.
        // We need to manually initialize card toggles for these new elements.
        initializeCardInteractions();
    }

    function createAccountCard(account) {
        // Fallback for avatar
        const avatarSrc = account.avatar || '/Frontend/public/assets/images/google-avatar.png'; // Default placeholder
        const accountId = account.id || account.uid || account._id;

        if (!accountId) {
            console.error("[Card] Missing ID for account:", account.nomeAccount, account);
            return '';
        }

        console.log(`[Card] Creating card for ${account.nomeAccount} with ID: ${accountId}`);

        return `
            <a href="dettaglio_account_privato.html?id=${encodeURIComponent(accountId)}" 
               class="account-card block bg-gradient-to-r from-primary to-blue-600 rounded-xl shadow-lg shadow-blue-500/10 p-4 mb-3 cursor-pointer active:scale-[0.99] transition-all border border-blue-400/20">
                <div class="flex items-start space-x-4">
                    <img class="w-12 h-12 rounded-xl object-cover bg-white/20 backdrop-blur-sm shadow-sm border border-white/30" src="${avatarSrc}" alt="${account.nomeAccount} Logo" />
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="font-bold text-white truncate text-base text-left">${account.nomeAccount}</h3>
                            <div class="flex items-center gap-2">
                                 ${account.shared ? '<span class="material-symbols-outlined text-white/80 text-lg" title="Condiviso">group</span>' : ''}
                                 ${account.hasMemo ? '<span class="material-symbols-outlined text-white/80 text-lg" title="Memorandum">description</span>' : ''}
                                 <span class="material-symbols-outlined text-white/60">chevron_right</span>
                            </div>
                        </div>
                        
                        <div class="space-y-1">
                            ${account.username ? `
                                <div class="flex items-center justify-between group/row">
                                    <div class="flex items-center min-w-0 flex-1 text-sm">
                                        <span class="text-white/60 w-16 shrink-0 underline decoration-white/20 text-left">Utente:</span>
                                        <span class="text-white truncate text-left">${account.username}</span>
                                    </div>
                                    <div class="copy-btn-wrapper">
                                        <button class="copy-btn-dynamic p-1 text-white/50 hover:text-white transition-colors" 
                                                data-copy="${account.username.replace(/"/g, '&quot;')}">
                                            <span class="material-symbols-outlined text-lg">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${account.codice ? `
                                <div class="flex items-center justify-between group/row">
                                    <div class="flex items-center min-w-0 flex-1 text-sm">
                                        <span class="text-white/60 w-16 shrink-0 underline decoration-white/20 text-left">Account:</span>
                                        <span class="text-white truncate text-left">${account.codice}</span>
                                    </div>
                                    <div class="copy-btn-wrapper">
                                        <button class="copy-btn-dynamic p-1 text-white/50 hover:text-white transition-colors" 
                                                data-copy="${account.codice.replace(/"/g, '&quot;')}">
                                            <span class="material-symbols-outlined text-lg">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${account.password ? `
                                <div class="flex items-center justify-between group/row">
                                    <div class="flex items-center min-w-0 flex-1 text-sm">
                                        <span class="text-white/60 w-16 shrink-0 underline decoration-white/20 text-left">Pass:</span>
                                        <span class="font-mono text-white truncate text-left">${account.password}</span>
                                    </div>
                                    <div class="copy-btn-wrapper">
                                        <button class="copy-btn-dynamic p-1 text-white/50 hover:text-white transition-colors" 
                                                data-copy="${account.password.replace(/"/g, '&quot;')}">
                                            <span class="material-symbols-outlined text-lg">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    function initializeCardInteractions() {
        // Event delegation for copy buttons to avoid inline JS escaping issues
        if (accountsContainer) {
            // Remove previous listener if any (simplified)
            accountsContainer.onclick = function (e) {
                const btn = e.target.closest('.copy-btn-dynamic');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();

                    const text = btn.getAttribute('data-copy');
                    if (text) {
                        navigator.clipboard.writeText(text).then(() => {
                            const icon = btn.querySelector('span');
                            const original = icon.textContent;
                            icon.textContent = 'check';
                            setTimeout(() => icon.textContent = original, 1500);
                        });
                    }
                }
            };
        }
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterAndRender();
        });
    }
});
