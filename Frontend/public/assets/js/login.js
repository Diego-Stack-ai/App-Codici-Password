import { login, checkAuthState } from './auth.js';
import { initComponents } from './components.js';
import { t, supportedLanguages } from './translations.js';

/**
 * LOGIN PAGE MODULE
 * Gestisce l'autenticazione e l'inizializzazione della pagina index.html
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[LOGIN] DOM Loaded. Initializing...");

    try {
        // 1. TRADUZIONI (Immediata)
        updatePageTranslations();

        // 2. INIZIALIZZAZIONE COMPONENTI (Regola 17) - Solo se necessario
        // Non blocchiamo il login se i componenti falliscono (spesso index.html non ha placeholder)
        initComponents().catch(e => console.log("Info: index components not injected"));

        // 3. CHECK AUTH (Redirect se già loggato)
        checkAuthState();

        // 4. SETUP FORM
        setupLoginForm();

        // 5. SETUP LANGUAGE SELECTOR
        setupLanguageSelector();

        // 6. SETUP PASSWORD TOGGLE (Specifico per Login per massima stabilità)
        setupLocalPasswordToggle();

        console.log("[LOGIN] Setup complete.");
    } catch (err) {
        console.error("[LOGIN] Initialization Error:", err);
    }
});

function updatePageTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const translated = t(key);
        if (!translated || translated === key) return;

        if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', translated);
        } else {
            // Preserva icone se presenti
            const icon = el.querySelector('.material-symbols-outlined');
            if (icon) {
                // Sostituiamo o aggiungiamo solo il testo
                let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "");
                if (textNode) {
                    textNode.textContent = translated;
                } else {
                    el.appendChild(document.createTextNode(translated));
                }
            } else {
                el.textContent = translated;
            }
        }
    });
}

function setupLanguageSelector() {
    const btn = document.getElementById('lang-toggle-btn');
    const dropdown = document.getElementById('lang-dropdown');
    if (!btn || !dropdown) return;

    dropdown.innerHTML = supportedLanguages.map(lang => `
        <button class="lang-option" data-code="${lang.code}">
            <span class="flag">${lang.flag}</span> ${lang.name}
        </button>
    `).join('');

    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    };

    document.addEventListener('click', () => dropdown.classList.remove('show'));

    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.onclick = () => {
            const code = opt.getAttribute('data-code');
            localStorage.setItem('app_language', code);
            updatePageTranslations();
        };
    });
}

function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("[LOGIN] Form submit triggered");

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            if (window.showToast) window.showToast(t('error_missing_fields') || "Campi mancanti", "warning");
            return;
        }

        // Feedback visivo immediato
        document.body.classList.add('is-auth-loading');
        const btn = loginForm.querySelector('[data-login-submit]');
        const originalContent = btn ? btn.innerHTML : "Accedi";

        // Pre-validation logging
        console.log("[LOGIN] Input validation: email length", email.length);

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span>';
            }

            console.log("[LOGIN] Attempting login for:", email);
            await login(email, password);
            console.log("[LOGIN] Login call finished successfully.");

            // Forced fallback redirect if auth.js timeout fails
            setTimeout(() => {
                console.log("[LOGIN] Forced redirect fallback triggered");
                window.location.href = "home_page.html";
            }, 500);

        } catch (err) {
            console.error("[LOGIN] Error during authentication:", err);

            // Ripristino in caso di errore
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
            document.body.classList.remove('is-auth-loading');

            // Se logError in auth.js non è sufficiente, diamo un feedback qui
            const msg = (err.code === 'auth/invalid-credential') ? "Email o password errati." : "Impossibile accedere. Riprova.";
            if (window.showToast) window.showToast(msg, "error");
        }
    });
}

/**
 * Gestione visibilità password locale per la pagina login
 * Questo evita conflitti con main.js
 */
function setupLocalPasswordToggle() {
    const toggleBtn = document.querySelector('.toggle-password');
    const passInput = document.getElementById('password');

    if (toggleBtn && passInput) {
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';

            const icon = toggleBtn.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = isPassword ? 'visibility_off' : 'visibility';
            }
        };
    }
}
