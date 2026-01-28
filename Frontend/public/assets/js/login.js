import { login, checkAuthState } from './auth.js';
import { initComponents } from './components.js';
import { t, supportedLanguages } from './translations.js';

/**
 * LOGIN PAGE MODULE
 * Gestisce l'autenticazione e l'inizializzazione della pagina index.html
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. TRADUZIONI (Immediata)
    updatePageTranslations();

    // 2. INIZIALIZZAZIONE COMPONENTI (Regola 17)
    initComponents();

    // 3. CHECK AUTH (Redirect se già loggato)
    checkAuthState();

    // 4. SETUP FORM
    setupLoginForm();

    // 5. SETUP TOGGLE PASSWORD (Locale e blindato)
    setupPasswordToggle();

    // 6. SETUP LANGUAGE SELECTOR
    setupLanguageSelector();
});

function updatePageTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', t(key));
        } else {
            el.textContent = t(key); // Ricarica il testo
        }
    });
}

/**
 * Gestione Selettore Lingua Login
 */
function setupLanguageSelector() {
    const btn = document.getElementById('lang-toggle-btn');
    const dropdown = document.getElementById('lang-dropdown');

    if (!btn || !dropdown) return;

    // Popola Opzioni
    dropdown.innerHTML = supportedLanguages.map(lang => `
        <button class="lang-option" data-code="${lang.code}">
            <span class="flag">${lang.flag}</span> ${lang.name}
        </button>
    `).join('');

    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // Chiudi cliccando fuori
    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    // Selezione Lingua
    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const code = opt.getAttribute('data-code');
            localStorage.setItem('app_language', code);

            // Aggiorna traduzioni al volo
            updatePageTranslations();
        });
    });
}

/**
 * Gestione logica del form di login
 */
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

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
            // Ripristino in caso di errore
            btn.disabled = false;
            btn.innerHTML = originalContent;
            document.body.classList.remove('is-auth-loading');
            console.error("Login Flow Interrupted:", err);

            // Protocollo V3: Feedback Utente
            const errorMsg = t('login_error') || "Credenziali non valide o errore di connessione.";
            if (window.showToast) window.showToast(errorMsg, 'error');
            else alert(errorMsg); // Fallback estremo
        }
    });
}

/**
 * Gestione visibilità password per pagina Auth
 */
function setupPasswordToggle() {
    const toggleBtn = document.querySelector('.toggle-password');
    const passInput = document.getElementById('password');

    if (toggleBtn && passInput) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Previene submit accidentali
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            // Cambio icona Google Material (visibility / visibility_off)
            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
            }
        });
    }
}
