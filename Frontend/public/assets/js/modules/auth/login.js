/**
 * LOGIN MODULE (V4.1)
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 * Refactor: Rimozione innerHTML, uso dom-utils.js, modularizzazione.
 */

import { login, checkAuthState } from '../../auth.js';
import { initComponents } from '../../components.js';
import { t, supportedLanguages } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showInputModal } from '../../ui-core.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[LOGIN] Application Boot V4.1...");

    try {
        // 1. AppState di base (Protocollo Comune)
        let savedLang = 'it';
        try { savedLang = localStorage.getItem('app_language') || 'it'; } catch (e) { }

        const path = window.location.pathname.toLowerCase();
        const isAuthPage = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'].some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        window.AppState = window.AppState || {
            user: null,
            theme: 'dark',
            language: savedLang,
            isAuthPage: isAuthPage
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

        console.log("[LOGIN] System Ready.");
    } catch (err) {
        console.error("[LOGIN] Critical Init Error:", err);
    }
});

/**
 * Traduzioni locali della pagina
 */
function applyLocalTranslations() {
    document.querySelectorAll('[data-t], [data-t-placeholder], [data-t-aria]').forEach(el => {
        const key = el.getAttribute('data-t');
        const placeholderKey = el.getAttribute('data-t-placeholder');
        const ariaKey = el.getAttribute('data-t-aria');

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

        if (ariaKey) {
            const translated = t(ariaKey);
            if (translated && translated !== ariaKey) {
                el.setAttribute('aria-label', translated);
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

    clearElement(dropdown);
    supportedLanguages.forEach(lang => {
        const opt = createElement('button', {
            className: 'lang-option',
            dataset: { code: lang.code },
            onclick: () => {
                const code = lang.code;
                localStorage.setItem('app_language', code);
                if (window.AppState) window.AppState.language = code;
                applyLocalTranslations();
                dropdown.classList.remove('show');
            }
        }, [
            createElement('span', { className: 'flag', textContent: lang.flag }),
            document.createTextNode(` ${lang.name}`)
        ]);

        dropdown.appendChild(opt);
    });

    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    };

    document.addEventListener('click', () => dropdown.classList.remove('show'));
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
            showToast(t('error_missing_fields') || "Campi obbligatori mancanti", "error");
            return;
        }

        // 2. Validazione Formato Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) && !email.includes('@')) {
            showToast(t('error_invalid_email') || "Inserisci un'email valida", "error");
            return;
        }

        // 3. Feedback UI
        const originalIcon = submitBtn.querySelector('.material-symbols-outlined')?.textContent || 'login';
        const originalText = Array.from(submitBtn.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .join(' ') || t('auth_button') || 'Accedi';

        submitBtn.disabled = true;
        clearElement(submitBtn);
        setChildren(submitBtn, [
            createElement('span', { className: 'animate-spin material-symbols-outlined', textContent: 'sync' })
        ]);

        document.body.classList.add('is-auth-progress');

        try {
            console.log("[LOGIN] Authenticating...");
            const user = await login(email, password);

            // 4. Aggiornamento AppState Centrale
            if (window.AppState) {
                window.AppState.user = user;
                window.AppState.lastSync = new Date().toISOString();
            }

            showToast(t('success_auth') || "Accesso autorizzato!", "success");

            // Il redirect viene gestito centralmente da checkAuthState() in auth.js
            // per garantire coerenza tra tutti i dispositivi.
        } catch (err) {
            console.error("[LOGIN] Auth Failure:", err);
            submitBtn.disabled = false;
            clearElement(submitBtn);
            setChildren(submitBtn, [
                createElement('span', { className: 'material-symbols-outlined', textContent: originalIcon }),
                document.createTextNode(originalText)
            ]);

            document.body.classList.remove('is-auth-progress');

            let errorMsg = t('error_auth_failed') || "Credenziali non valide.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                errorMsg = "Email o Password errati.";
            } else if (err.code === 'auth/too-many-requests') {
                errorMsg = "Troppi tentativi falliti. Riprova più tardi.";
            }

            showToast(errorMsg, "error");
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

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isSecret = input.type === 'password' || input.classList.contains('base-shield');

        if (isSecret) {
            input.type = 'text';
            input.classList.remove('base-shield');
        } else {
            input.type = 'password';
            // Non aggiungiamo base-shield qui se è di tipo password, il browser lo maschera già
        }

        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) {
            // Se lo rendiamo visibile (text), mostriamo occhio sbarrato per "nascondi"
            // Se lo rendiamo segreto (password), mostriamo occhio aperto per "mostra"
            icon.textContent = isSecret ? 'visibility_off' : 'visibility';
        }
    });
}



