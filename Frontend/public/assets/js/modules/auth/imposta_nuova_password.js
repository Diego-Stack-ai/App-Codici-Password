/**
 * SET NEW PASSWORD MODULE (V4.1)
 * Gestione finale del reset password o cambio password interno.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/auth/.
 */

import { auth } from '../../firebase-config.js';
import { updatePassword, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { t, supportedLanguages } from '../../translations.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[NEW-PASS] Application Boot V4.1...");

    try {
        // 1. AppState base
        window.AppState = window.AppState || {
            user: auth.currentUser,
            theme: 'dark',
            language: localStorage.getItem('app_language') || 'it'
        };

        // 2. TRADUZIONI 
        applyLocalTranslations();
        document.documentElement.setAttribute("data-i18n", "ready");

        // 3. SETUP 
        setupNewPasswordForm();
        setupLanguageSelector();
        setupPasswordToggle();
        setupCancelLogic();

        console.log("[NEW-PASS] System Ready.");
    } catch (err) {
        console.error("[NEW-PASS] Critical Init Error:", err);
    }
});

/**
 * Traduzioni locali
 */
function applyLocalTranslations() {
    document.querySelectorAll('[data-t], [data-t-placeholder], [data-t-aria]').forEach(el => {
        const key = el.getAttribute('data-t');
        const placeholderKey = el.getAttribute('data-t-placeholder');
        const ariaKey = el.getAttribute('data-t-aria');

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

        if (ariaKey) {
            const translated = t(ariaKey);
            if (translated && translated !== ariaKey) {
                el.setAttribute('aria-label', translated);
            }
        }
    });
}

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

        // 1. Validazione Protocollo 12-3-3 (Regola Sicurezza)
        if (newPassword.length < 12) {
            showToast(t('error_password_too_short') || "Minimo 12 caratteri richiesti!", "error");
            return;
        }

        const upperCount = (newPassword.match(/[A-Z]/g) || []).length;
        const symbolCount = (newPassword.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;

        if (upperCount < 3 || symbolCount < 3) {
            showToast(t('error_weak_pass_complex') || "Servono almeno 3 MAIUSCOLE e 3 Simboli!", "warning");
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
                await confirmPasswordReset(auth, oobCode, newPassword);
                showToast(t('password_success') || "Password ripristinata! Ora puoi accedere.", "success");
            } else if (auth.currentUser) {
                // CASO CAMBIO INTERNO
                await updatePassword(auth.currentUser, newPassword);
                showToast(t('password_success') || "Password aggiornata con successo.", "success");
            } else {
                throw new Error("Sessione non valida o link scaduto.");
            }

            // Redirect differenziato
            setTimeout(() => {
                window.location.href = auth.currentUser ? 'home_page.html' : 'index.html';
            }, 2500);

        } catch (err) {
            console.error("[NEW-PASS] Failure:", err);
            submitBtn.disabled = false;
            clearElement(submitBtn);
            setChildren(submitBtn, originalContent);
            document.body.classList.remove('is-auth-progress');

            let msg = t('error_generic') || "Impossibile aggiornare la password.";
            if (err.code === 'auth/requires-recent-login') {
                msg = t('error_reauth_required') || "Rieffettua il login per motivi di sicurezza.";
            } else if (err.code === 'auth/expired-action-code') {
                msg = t('error_link_expired') || "Il link di recupero è scaduto.";
            }

            showToast(msg, "error");
        }
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

    cancelBtn.onclick = (e) => {
        e.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const isReset = urlParams.has('oobCode');

        window.location.href = (auth.currentUser && !isReset) ? 'impostazioni.html' : 'index.html';
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

