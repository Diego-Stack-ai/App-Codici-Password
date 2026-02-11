/**
 * REGISTRATION MODULE (V4.1)
 * Gestisce la creazione di utenze e i relativi feedback di sistema.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/auth/.
 */

import { register, resendVerificationEmail } from '../../auth.js';
import { t, supportedLanguages } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[REGISTER] Application Boot V4.1...");

    try {
        // 1. AppState init
        window.AppState = window.AppState || {
            user: null,
            theme: 'dark',
            language: localStorage.getItem('app_language') || 'it'
        };

        // 2. SETUP FUNZIONALITÀ

        // 3. SETUP FUNZIONALITÀ
        setupRegisterForm();
        setupLanguageSelector();
        setupPasswordToggle();

        console.log("[REGISTER] System Ready.");
    } catch (err) {
        console.error("[REGISTER] Critical Init Error:", err);
    }
});

/**
 * Gestione Form Registrazione
 */

/**
 * Gestione Form Registrazione
 */
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    const submitBtn = document.getElementById('register-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('nome').value.trim();
        const cognome = document.getElementById('cognome').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPass = document.getElementById('confirm-password').value;

        // 1. Validazione Campi
        if (!nome || !email || !password) {
            showToast(t('error_missing_fields') || "Campi obbligatori mancanti", "error");
            return;
        }

        // 2. Controllo Corrispondenza Password
        if (password !== confirmPass) {
            showToast(t('error_password_mismatch'), "error");
            return;
        }

        // 3. Password Strength (Min 12 caratteri come da standard sicurezza)
        if (password.length < 12) {
            showToast(t('error_password_too_short'), "warning");
            return;
        }

        // 4. Feedback UI
        const originalContent = Array.from(submitBtn.childNodes).map(n => n.cloneNode(true));
        submitBtn.disabled = true;
        clearElement(submitBtn);
        setChildren(submitBtn, [
            createElement('span', { className: 'animate-spin material-symbols-outlined', textContent: 'sync' })
        ]);
        document.body.classList.add('is-auth-progress');

        try {
            console.log("[REGISTER] Creating account...");
            await register(nome, cognome, email, password);

            showToast(t('success_registration'), "success");

            // Redirect al login dopo successo
            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);

        } catch (err) {
            console.error("[REGISTER] Failure:", err);
            submitBtn.disabled = false;
            clearElement(submitBtn);
            setChildren(submitBtn, originalContent);
            document.body.classList.remove('is-auth-progress');

            let errorKey = 'error_registration_failed';
            if (err.code === 'auth/email-already-in-use') {
                errorKey = 'error_email_in_use';
            } else if (err.code === 'auth/invalid-email') {
                errorKey = 'error_invalid_email';
            }

            showToast(t(errorKey), "error");
        }
    });
}

/**
 * Selettore Lingua
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
 * Toggle Password
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

