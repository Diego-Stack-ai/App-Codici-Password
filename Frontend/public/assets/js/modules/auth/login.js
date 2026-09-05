/**
 * LOGIN MODULE (V4.1)
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 * Refactor: Rimozione innerHTML, uso dom-utils.js, modularizzazione.
 */

import { login, completeTotpLogin, checkAuthState } from '../../auth.js?v=1.2.40';
import { initComponents } from '../../components-v129.js?v=1.2.40';
import { t, supportedLanguages, applyGlobalTranslations } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showInputModal } from '../../ui-core-v129.js?v=1.2.40';
import { recoverTotpAccess } from '../core/mfa-manager.js';

/**
 * LOGIN MODULE (V5.0 ADAPTER)
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 * - Entry Point: initLogin() (chiamato da main.js)
 */

export async function initLogin() {
    

    try {
        // 1. AppState di base (Local Scope o Global se necessario per compatibilità)
        let savedLang = 'it';
        try { savedLang = localStorage.getItem('app_language') || 'it'; } catch (e) { }

        // window.AppState legacy support (se altri moduli lo usano)
        // 2. INIZIALIZZAZIONE COMPONENTI UI
        // initComponents() è già stato chiamato da main.js, ma per sicurezza su auth pages:
        // (Nota: main.js salta setupPasswordToggles su auth pages, quindi qui dobbiamo attivarli specificamente per il login)

        // 3. CHECK AUTH STATE (Redirect se già loggato)
        checkAuthState(); // Importato da auth.js

        // 4. SETUP FUNZIONALITÀ PAGINA
        setupLoginForm();
        setupLanguageSelector();
        setupPasswordToggle(); // Funzione locale definita sotto

        
    } catch (err) {
        console.error("[LOGIN] Init Error:", err);
    }
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
                window.location.reload(); // Forza reload per coerenza globale
            }
        }, [
            createElement('span', { className: 'flag', textContent: lang.flag }),
            document.createTextNode(` ${lang.name}`)
        ]);

        const currentLang = localStorage.getItem('app_language') || 'it';
        if (lang.code === currentLang) opt.classList.add('active');

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

    // 🛡️ Throttle progressivo: conta i tentativi falliti e applica backoff esponenziale
    let failedAttempts = 0;
    let throttleTimer = null;
    let awaitingTotp = false;
    let pendingEmail = '';
    let usingRecoveryCode = false;

    document.getElementById('btn-use-recovery-code')?.addEventListener('click', () => {
        usingRecoveryCode = true;
        document.getElementById('totp-form-group')?.classList.add('hidden');
        document.getElementById('recovery-form-group')?.classList.remove('hidden');
        document.getElementById('recovery-code')?.focus();
    });

    function applyThrottle() {
        const delays = [1, 2, 4, 8, 16, 30]; // secondi
        const waitSec = delays[Math.min(failedAttempts - 1, delays.length - 1)];
        let remaining = waitSec;

        submitBtn.disabled = true;

        throttleTimer = setInterval(() => {
            const icon = createElement('span', { className: 'material-symbols-outlined', textContent: 'lock_clock' });
            clearElement(submitBtn);
            setChildren(submitBtn, [icon, document.createTextNode(` Attendi ${remaining}s`)]);
            remaining--;

            if (remaining < 0) {
                clearInterval(throttleTimer);
                submitBtn.disabled = false;
                clearElement(submitBtn);
                setChildren(submitBtn, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'login' }),
                    document.createTextNode(t('auth_button') || ' Accedi')
                ]);
            }
        }, 1000);
    }

    // 🛡️ Submit nativo: supporta click, tasto Invio e password manager.
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Blocca click se throttle attivo
        if (submitBtn.disabled) return;

        const emailEl = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        const email = emailEl.value.trim();
        const password = passwordEl.value;
        const rememberDevice = document.getElementById('remember-device')?.checked !== false;
        const totpCode = document.getElementById('totp-code')?.value.trim() || '';

        // 1. Validazione Campi
        if ((!email || !password) && !awaitingTotp) {
            showToast(t('error_missing_fields') || "Campi obbligatori mancanti", "error");
            return;
        }

        // 2. Validazione Formato Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) && !email.includes('@')) {
            showToast(t('error_invalid_email') || "Inserisci un'email valida", "error");
            return;
        }

        if (!navigator.onLine) {
            showToast('Per effettuare un nuovo accesso o verificare la 2FA è necessaria una connessione. Se questo dispositivo era già autenticato, riapri l’app senza eseguire il logout.', 'warning');
            return;
        }

        // 3. Feedback UI caricamento
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
            if (awaitingTotp) {
                if (usingRecoveryCode) {
                    const recoveryCode = document.getElementById('recovery-code')?.value.trim() || '';
                    await recoverTotpAccess(pendingEmail, password, recoveryCode);
                    passwordEl.value = '';
                    document.getElementById('recovery-code').value = '';
                    showToast('Accesso recuperato. La 2FA è stata disattivata: accedi di nuovo e riconfigurala.', 'success');
                    setTimeout(() => window.location.reload(), 1800);
                    return;
                }
                if (!/^\d{6}$/.test(totpCode)) {
                    throw new Error("Inserisci il codice Authenticator di 6 cifre.");
                }
                await completeTotpLogin(totpCode, pendingEmail);
            } else {
                const result = await login(email, password, rememberDevice);
                if (result?.mfaRequired) {
                    awaitingTotp = true;
                    pendingEmail = email;
                    document.getElementById('totp-form-group')?.classList.remove('hidden');
                    document.getElementById('remember-device-row')?.classList.add('hidden');
                    emailEl.disabled = true;
                    passwordEl.disabled = true;
                    const codeInput = document.getElementById('totp-code');
                    if (codeInput) codeInput.focus();
                    clearElement(submitBtn);
                    setChildren(submitBtn, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'verified_user' }),
                        document.createTextNode(' Verifica codice')
                    ]);
                    submitBtn.disabled = false;
                    document.body.classList.remove('is-auth-progress');
                    showToast("Inserisci il codice generato dalla tua app Authenticator.", "info");
                    return;
                }
            }

            // Login riuscito: azzera contatore tentativi
            failedAttempts = 0;
            showToast(t('success_auth') || "Accesso autorizzato!", "success");

            // Navigazione esplicita: non dipende dall'evento auth globale e resta
            // affidabile anche se la shell offline ha mostrato il login sotto un URL protetto.
            const reauthFlow = new URLSearchParams(window.location.search).get('reauth');
            if (reauthFlow === 'password-change') {
                window.location.replace('imposta_nuova_password.html?reauthenticated=1');
            } else if (reauthFlow === 'security-settings') {
                window.location.replace('impostazioni.html');
            } else {
                window.location.replace('home_page.html');
            }

        } catch (err) {
            failedAttempts++;

            clearElement(submitBtn);
            setChildren(submitBtn, [
                createElement('span', { className: 'material-symbols-outlined', textContent: originalIcon }),
                document.createTextNode(originalText)
            ]);
            document.body.classList.remove('is-auth-progress');

            let errorMsg = t('error_auth_failed') || "Credenziali non valide.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                errorMsg = "Email o Password errati.";
            } else if (err.code === 'auth/too-many-requests') {
                errorMsg = "Troppi tentativi falliti. Riprova più tardi.";
                failedAttempts = 5; // Forza attesa massima se Firebase blocca
            } else if (err.code === 'auth/invalid-verification-code') {
                errorMsg = "Codice Authenticator errato o scaduto.";
            } else if (err.message) {
                errorMsg = err.message;
            }

            showToast(errorMsg, "error");

            // Applica throttle progressivo
            applyThrottle();
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

        const isPassword = input.type === 'password';
        
        if (isPassword) {
            input.type = 'text';
            input.classList.remove('base-shield');
        } else {
            input.type = 'password';
            input.classList.add('base-shield');
        }

        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = isPassword ? 'visibility_off' : 'visibility';
        }
    });
}
