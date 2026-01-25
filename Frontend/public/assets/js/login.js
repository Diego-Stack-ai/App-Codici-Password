import { login, checkAuthState } from './auth.js';
import { initComponents } from './components.js';

/**
 * LOGIN PAGE MODULE
 * Gestisce l'autenticazione e l'inizializzazione della pagina index.html
 */

// 1. Inizializzazione Componenti Standard (Regola 17)
initComponents();

// 2. Controllo stato autenticazione (Redirect se già loggato)
checkAuthState();

// 3. Gestione Form di Login
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // SEMAforo ENTERPRISE: Hook di stato globale (Regola 10/10)
            document.body.classList.add('is-auth-loading');

            // Fix per evitare zoom tastiera su iOS e pulire la vista
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            if (emailInput) emailInput.blur();
            if (passwordInput) passwordInput.blur();
            window.scrollTo(0, 0);

            const email = emailInput.value;
            const password = passwordInput.value;

            // Selezione Semantica (Regola 22)
            const btn = loginForm.querySelector('[data-login-submit]');
            const originalContent = btn.innerHTML;

            try {
                // Feedback visivo caricamento
                btn.disabled = true;
                btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span>';

                // Tentativo di Login
                await login(email, password);

            } catch (err) {
                // Ripristino in caso di errore (incluso email non verificata)
                btn.disabled = false;
                btn.innerHTML = originalContent;
                document.body.classList.remove('is-auth-loading');

                // Se l'errore è la verifica email, la notifica è già inviata da auth.js via Toast o Alert
                console.error("Login Flow Interrupted:", err);
            }
        });
    }

    // Nota: Il Toggle visibilità password è ora gestito globalmente da ui-components.js
});
