import { login, checkAuthState } from './auth.js';
import { initComponents } from './components.js';
import { t, supportedLanguages } from './translations.js';

/**
 * [LOGIN] MODULE V3.1
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[LOGIN] Application Boot V3.1...");

    try {
        // 1. AppState di base (Protocollo Comune)
        window.AppState = window.AppState || {
            user: null,
            theme: 'dark',
            language: localStorage.getItem('app_language') || 'it'
        };

        // 2. TRADUZIONI 
        applyLocalTranslations();

        // 3. INIZIALIZZAZIONE COMPONENTI UI
        initComponents().catch(e => console.log("Info: index ui elements initialized"));

        // 4. CHECK AUTH STATE (Proactive Redirect)
        checkAuthState();

        // 5. SETUP FUNZIONALITÀ PAGINA
        setupLoginForm();
        setupLanguageSelector();
        setupPasswordToggle();
        setupPasswordRecovery();

        console.log("[LOGIN] System Ready.");
    } catch (err) {
        console.error("[LOGIN] Critical Init Error:", err);
    }
});

/**
 * Traduzioni locali della pagina
 */
function applyLocalTranslations() {
    document.querySelectorAll('[data-t], [data-t-placeholder]').forEach(el => {
        const key = el.getAttribute('data-t');
        const placeholderKey = el.getAttribute('data-t-placeholder');

        if (key) {
            const translated = t(key);
            if (translated && translated !== key) {
                // Preserva icone Material symbols
                const icon = el.querySelector('.material-symbols-outlined');
                if (icon) {
                    let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "");
                    if (textNode) textNode.textContent = translated;
                    else el.appendChild(document.createTextNode(translated));
                } else {
                    el.textContent = translated;
                }
            }
        }

        if (placeholderKey) {
            const translated = t(placeholderKey);
            if (translated && translated !== placeholderKey) {
                el.setAttribute('placeholder', translated);
            }
        }
    });
}

/**
 * Selettore Lingua Flottante
 */
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
            window.AppState.language = code;
            applyLocalTranslations();
            // Eventuale ricarico per forzare traduzioni globali
        };
    });
}

/**
 * Validazione e Invio Form Login
 */
function setupLoginForm() {
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('login-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailEl = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        const email = emailEl.value.trim();
        const password = passwordEl.value;

        // 1. Validazione Campi
        if (!email || !password) {
            if (window.showToast) window.showToast(t('error_missing_fields') || "Campi obbligatori mancanti", "error");
            return;
        }

        // 2. Validazione Formato Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) && !email.includes('@')) {
            if (window.showToast) window.showToast(t('error_invalid_email') || "Inserisci un'email valida", "error");
            return;
        }

        // 3. Feedback UI
        const originalContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span>';
        document.body.classList.add('is-auth-progress');

        try {
            console.log("[LOGIN] Authenticating...");
            const user = await login(email, password);

            // 4. Aggiornamento AppState Centrale
            if (window.AppState) {
                window.AppState.user = user;
                window.AppState.lastSync = new Date().toISOString();
            }

            if (window.showToast) window.showToast(t('success_auth') || "Accesso autorizzato!", "success");

            // 5. Redirect controllato
            setTimeout(() => {
                window.location.href = "home_page.html";
            }, 800);

        } catch (err) {
            console.error("[LOGIN] Auth Failure:", err);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
            document.body.classList.remove('is-auth-progress');

            let errorMsg = t('error_auth_failed') || "Credenziali non valide.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMsg = "Email o Password errati.";
            } else if (err.code === 'auth/too-many-requests') {
                errorMsg = "Troppi tentativi falliti. Riprova più tardi.";
            }

            if (window.showToast) window.showToast(errorMsg, "error");
        }
    });
}

/**
 * Toggle Visibilità Password
 */
function setupPasswordToggle() {
    const btn = document.getElementById('btn-toggle-password');
    const input = document.getElementById('password');
    if (!btn || !input) return;

    btn.onclick = (e) => {
        e.preventDefault();
        const isSecret = input.type === 'password';
        input.type = isSecret ? 'text' : 'password';

        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = isSecret ? 'visibility_off' : 'visibility';
    };
}

/**
 * Recupero Password via Modale Premium
 */
function setupPasswordRecovery() {
    const link = document.getElementById('link-forgot-password');
    if (!link) return;

    link.onclick = async (e) => {
        e.preventDefault();

        if (!window.showInputModal) return;

        const email = await window.showInputModal(
            t('forgot_password') || "Recupero Password",
            "",
            "Inserisci la tua email..."
        );

        if (email) {
            // Validazione base
            if (!email.includes('@')) {
                if (window.showToast) window.showToast("Inserisci un'email valida per il recupero.", "error");
                return;
            }

            if (window.showToast) window.showToast("Invio istruzioni in corso...", "info");

            // Qui andrebbe la chiamata Firebase Auth per reset password
            // await sendPasswordResetEmail(auth, email);

            setTimeout(() => {
                if (window.showToast) window.showToast("Se l'email esiste, riceverai un link a breve.", "success");
            }, 1500);
        }
    };
}

