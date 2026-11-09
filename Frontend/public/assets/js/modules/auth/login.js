/**
 * LOGIN MODULE (V4.1)
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 * Refactor: Rimozione innerHTML, uso dom-utils.js, modularizzazione.
 */

import {
    login, completeTotpLogin, checkAuthState, logout,
    resendVerificationEmail, refreshEmailVerification
} from '../../auth.js?v=1.2.266';
import { initComponents } from '../../components-v129.js?v=1.2.266';
import { t, supportedLanguages, applyGlobalTranslations } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showAlertModal } from '../../ui-core-v129.js?v=1.2.266';
import { openInitialLanguageDialog, rememberUserLanguage, setLanguagePreference } from '../settings/first-configuration.js';
import {COMPLETE_RECOVERY_ENABLED, COMPLETE_RECOVERY_LOGIN_PATH, COMPLETE_RECOVERY_PATH, hasCompleteRecoveryIntent} from '../../app-env.js';

/**
 * LOGIN MODULE (V5.0 ADAPTER)
 * Gestisce l'autenticazione e l'interfaccia della pagina di accesso.
 * - Entry Point: initLogin() (chiamato da main.js)
 */

export async function initLogin() {
    

    try {
        await openInitialLanguageDialog({ required: false });
        // 1. AppState di base (Local Scope o Global se necessario per compatibilità)
        let savedLang = 'it';
        try { savedLang = localStorage.getItem('app_language') || 'it'; } catch (e) { }

        // window.AppState legacy support (se altri moduli lo usano)
        // 2. INIZIALIZZAZIONE COMPONENTI UI
        // initComponents() è già stato chiamato da main.js, ma per sicurezza su auth pages:
        // (Nota: main.js salta setupPasswordToggles su auth pages, quindi qui dobbiamo attivarli specificamente per il login)

        setupEmailVerificationGate();

        // 3. CHECK AUTH STATE (Redirect se già loggato)
        checkAuthState(); // Importato da auth.js

        // 4. SETUP FUNZIONALITÀ PAGINA
        setupLoginForm();
        if (COMPLETE_RECOVERY_ENABLED) document.getElementById('login-form')?.appendChild(createElement('a', {
            href: COMPLETE_RECOVERY_LOGIN_PATH, textContent: t('recovery_entry')}));
        setupLanguageSelector();
        setupPasswordToggle(); // Funzione locale definita sotto

        
    } catch (err) {
        console.error("[LOGIN] Init Error:", err);
    }
}

function setupEmailVerificationGate() {
    const form = document.getElementById('login-form');
    const panel = document.getElementById('email-verification-panel');
    if (!form || !panel) return;

    const show = () => {
        form.classList.add('hidden');
        panel.classList.remove('hidden');
        document.getElementById('btn-email-verified')?.focus();
    };
    window.addEventListener('codex:email-verification-required', show);

    document.getElementById('btn-email-verified')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            if (await refreshEmailVerification()) {
                showToast(t('auth_email_verified'), 'success');
                window.location.replace(hasCompleteRecoveryIntent(window.location) ? COMPLETE_RECOVERY_PATH : 'home_page.html');
            } else {
                showToast(t('auth_email_verification_pending'), 'warning');
            }
        } catch {
            showToast(t('auth_email_verification_error'), 'error');
        } finally {
            button.disabled = false;
        }
    });
    document.getElementById('btn-resend-verification')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await resendVerificationEmail(); }
        finally { button.disabled = false; }
    });
    document.getElementById('btn-change-verification-email')?.addEventListener('click', async () => {
        await logout();
        window.location.replace(hasCompleteRecoveryIntent(window.location) ? COMPLETE_RECOVERY_LOGIN_PATH : 'login.html');
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
                setLanguagePreference(code, { explicit: true });
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

    document.getElementById('btn-use-recovery-code')?.addEventListener('click', () => {
        document.getElementById('password').value = '';
        showAlertModal(t('auth_use_recovery'), t('auth_recovery_help'), t('close'));
    });

    function applyThrottle() {
        const delays = [1, 2, 4, 8, 16, 30]; // secondi
        const waitSec = delays[Math.min(failedAttempts - 1, delays.length - 1)];
        let remaining = waitSec;

        submitBtn.disabled = true;

        throttleTimer = setInterval(() => {
            const icon = createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'lock_clock' });
            clearElement(submitBtn);
            setChildren(submitBtn, [icon, document.createTextNode(` ${t('auth_wait_seconds').replace('{seconds}', remaining)}`)]);
            remaining--;

            if (remaining < 0) {
                clearInterval(throttleTimer);
                submitBtn.disabled = false;
                clearElement(submitBtn);
                setChildren(submitBtn, [
                    createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'login' }),
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
        const password = awaitingTotp ? '' : passwordEl.value;
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
            showToast(t('auth_offline_required'), 'warning');
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
            createElement('span', { className: 'animate-spin material-symbols-outlined notranslate', textContent: 'sync' })
        ]);
        document.body.classList.add('is-auth-progress');

        try {
            let result = null;
            if (awaitingTotp) {
                if (!/^\d{6}$/.test(totpCode)) {
                    throw new Error(t('auth_totp_invalid'));
                }
                result = await completeTotpLogin(totpCode, pendingEmail);
            } else {
                result = await login(email, password, rememberDevice);
                if (result?.emailVerificationRequired) {
                    window.dispatchEvent(new CustomEvent('codex:email-verification-required'));
                    submitBtn.disabled = false;
                    document.body.classList.remove('is-auth-progress');
                    return;
                }
                if (result?.mfaRequired) {
                    passwordEl.value = '';
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
                        createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'verified_user' }),
                        document.createTextNode(` ${t('auth_verify_code')}`)
                    ]);
                    submitBtn.disabled = false;
                    document.body.classList.remove('is-auth-progress');
                    showToast(t('auth_totp_prompt'), "info");
                    return;
                }
            }
            rememberUserLanguage(result?.user?.uid, result?.profileData);

            // Login riuscito: azzera contatore tentativi
            failedAttempts = 0;
            showToast(t('success_auth') || "Accesso autorizzato!", "success");

            // Navigazione esplicita: non dipende dall'evento auth globale e resta
            // affidabile anche se la shell offline ha mostrato il login sotto un URL protetto.
            const reauthFlow = new URLSearchParams(window.location.search).get('reauth');
            if (hasCompleteRecoveryIntent(window.location)) {
                window.location.replace(COMPLETE_RECOVERY_PATH);
            } else if (reauthFlow === 'password-change') {
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
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: originalIcon }),
                document.createTextNode(originalText)
            ]);
            document.body.classList.remove('is-auth-progress');

            let errorMsg = t('error_auth_failed') || "Credenziali non valide.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                errorMsg = t('auth_invalid_credentials');
            } else if (err.code === 'auth/too-many-requests') {
                errorMsg = t('auth_too_many_attempts');
                failedAttempts = 5; // Forza attesa massima se Firebase blocca
            } else if (err.code === 'auth/invalid-verification-code') {
                errorMsg = t('auth_totp_error');
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
