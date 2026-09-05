/**
 * SET NEW PASSWORD MODULE (V4.1)
 * Gestione finale del reset password o cambio password interno.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/auth/.
 */

import { auth } from '../../firebase-config.js?v=1.2.36';
import { updatePassword, confirmPasswordReset, signOut, verifyPasswordResetCode } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { t, supportedLanguages, applyGlobalTranslations } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { db } from '../../firebase-config.js?v=1.2.36';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ACCOUNT_PASSWORD_POLICY_VERSION, bindPasswordChecklist, evaluatePassword, firstPasswordPolicyError, generateSecurePassword } from '../core/password-policy.js';

export async function initImpostaNuovaPassword() {
    

    try {
        // 1. AppState base
        // 2. SETUP 

        // 3. SETUP 
        setupNewPasswordForm();
        setupLanguageSelector();
        setupPasswordToggle();
        setupPasswordSuggestion();
        bindPasswordChecklist(
            document.getElementById('new-password'),
            document.getElementById('account-password-requirements'),
            'account'
        );
        setupCancelLogic();

        
    } catch (err) {
        console.error("[NEW-PASS] Critical Init Error:", err);
    }
}

/**
 * Form Salvataggio Password
 */

/**
 * Form Salvataggio Password
 */
function setupNewPasswordForm() {
    const form = document.getElementById('new-password-form');
    const submitBtn = document.getElementById('new-pass-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const passInput = document.getElementById('new-password');
        const confirmInput = document.getElementById('confirm-password');
        const newPassword = passInput.value;
        const confirmPassword = confirmInput.value;

        // 1. Policy account centralizzata
        if (!evaluatePassword(newPassword, 'account').valid) {
            showToast(firstPasswordPolicyError(newPassword, 'account'), "warning");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast(t('error_password_mismatch') || "Le password non coincidono!", "error");
            return;
        }

        // 2. Feedback UI
        const originalContent = Array.from(submitBtn.childNodes).map(n => n.cloneNode(true));
        submitBtn.disabled = true;
        clearElement(submitBtn);
        setChildren(submitBtn, [
            createElement('span', { className: 'animate-spin material-symbols-outlined', textContent: 'sync' })
        ]);
        document.body.classList.add('is-auth-progress');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const oobCode = urlParams.get('oobCode');

            if (oobCode) {
                // CASO RESET ESTERNO
                const resetEmail = (await verifyPasswordResetCode(auth, oobCode)).trim().toLowerCase();
                await confirmPasswordReset(auth, oobCode, newPassword);
                localStorage.setItem('codex_password_reset_policy_v1', JSON.stringify({
                    email: resetEmail,
                    version: ACCOUNT_PASSWORD_POLICY_VERSION,
                    completedAt: Date.now()
                }));
                showToast(t('password_success') || "Password ripristinata! Ora puoi accedere.", "success");
            } else if (auth.currentUser) {
                // CASO CAMBIO INTERNO
                await updatePassword(auth.currentUser, newPassword);
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    passwordPolicyVersion: ACCOUNT_PASSWORD_POLICY_VERSION
                }, { merge: true });
                showToast(t('password_success') || "Password di accesso aggiornata. La Master Password della Vault non è cambiata.", "success");
            } else {
                throw new Error("Sessione non valida o link scaduto.");
            }

            // Redirect differenziato
            setTimeout(() => {
                window.location.href = auth.currentUser ? 'home_page.html' : 'login-v115.html';
            }, 2500);

        } catch (err) {
            console.error("[NEW-PASS] Failure:", err);
            submitBtn.disabled = false;
            clearElement(submitBtn);
            setChildren(submitBtn, originalContent);
            document.body.classList.remove('is-auth-progress');

            let msg = t('error_generic') || "Impossibile aggiornare la password.";
            if (err.code === 'auth/requires-recent-login') {
                showToast("Per sicurezza devi accedere di nuovo. Dopo il login tornerai qui.", "warning");
                try {
                    await signOut(auth);
                } finally {
                    window.location.replace('login-v115.html?reauth=password-change');
                }
                return;
            } else if (err.code === 'auth/expired-action-code') {
                msg = t('error_link_expired') || "Il link di recupero è scaduto.";
            }

            showToast(msg, "error");
        }
    });
}

function setupPasswordSuggestion() {
    const button = document.getElementById('suggest-password-btn');
    const password = document.getElementById('new-password');
    const confirmation = document.getElementById('confirm-password');
    if (!button || !password || !confirmation) return;
    button.addEventListener('click', () => {
        const generated = generateSecurePassword();
        password.value = generated;
        confirmation.value = generated;
        password.dispatchEvent(new Event('input', { bubbles: true }));
        password.type = 'text';
        password.focus();
        showToast('Password sicura generata sul dispositivo. Salvala nel gestore password.', 'success');
    });
}

/**
 * Toggle Visibilità
 */
function setupPasswordToggle() {
    const btn = document.getElementById('btn-toggle-password');
    const input = document.getElementById('new-password');
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
 * Logica Annulla
 */
function setupCancelLogic() {
    const cancelBtn = document.getElementById('cancel-password-update');
    if (!cancelBtn) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isRequiredPolicyUpdate = urlParams.has('policyUpdate') || urlParams.has('reauthenticated');
    if (isRequiredPolicyUpdate) cancelBtn.textContent = 'Esci';

    cancelBtn.onclick = async (e) => {
        e.preventDefault();
        const isReset = urlParams.has('oobCode');

        if (isRequiredPolicyUpdate) {
            await signOut(auth);
            window.location.replace('login-v115.html');
            return;
        }

        window.location.href = (auth.currentUser && !isReset) ? 'impostazioni.html' : 'login-v115.html';
    };
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

