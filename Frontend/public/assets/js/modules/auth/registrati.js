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

        // 2. TRADUZIONI 
        applyLocalTranslations();

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
 * Traduzioni locali
 */
function applyLocalTranslations() {
    document.querySelectorAll('[data-t], [data-t-placeholder]').forEach(el => {
        const key = el.getAttribute('data-t');
        const placeholderKey = el.getAttribute('data-t-placeholder');

        if (key) {
            const translated = t(key);
            if (translated && translated !== key) {
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
            showToast(t('password_mismatch') || "Le password non coincidono", "error");
            return;
        }

        // 3. Password Strength (Min 6 per Firebase, V4.1 richiede 12 caratteri per sicurezza consigliata)
        if (password.length < 12) {
            showToast("La password deve avere almeno 12 caratteri.", "warning");
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

            showToast(t('verify_email_title') || "Controlla la tua email per verificare l'account.", "success");

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

            let errorMsg = t('error_generic') || "Impossibile completare la registrazione.";
            if (err.code === 'auth/email-already-in-use') {
                errorMsg = "Questa email è già registrata.";
            } else if (err.code === 'auth/invalid-email') {
                errorMsg = "Formato email non valido.";
            }

            showToast(errorMsg, "error");
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

