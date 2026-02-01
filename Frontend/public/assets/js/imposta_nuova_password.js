import { auth } from './firebase-config.js';
import { updatePassword, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { t, supportedLanguages } from './translations.js';

/**
 * [SET NEW PASSWORD] MODULE V3.1
 * Gestione finale del reset password o cambio password interno.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[NEW-PASS] Application Boot V3.1...");

    try {
        // 1. AppState base
        window.AppState = window.AppState || {
            user: auth.currentUser,
            theme: 'dark',
            language: localStorage.getItem('app_language') || 'it'
        };

        // 2. TRADUZIONI 
        applyLocalTranslations();

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
            if (window.showToast) window.showToast("Minimo 12 caratteri richiesti!", "error");
            return;
        }

        const upperCount = (newPassword.match(/[A-Z]/g) || []).length;
        const symbolCount = (newPassword.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;

        if (upperCount < 3 || symbolCount < 3) {
            if (window.showToast) window.showToast("Servono almeno 3 MAIUSCOLE e 3 Simboli!", "warning");
            return;
        }

        if (newPassword !== confirmPassword) {
            if (window.showToast) window.showToast("Le password non coincidono!", "error");
            return;
        }

        // 2. Feedback UI
        const originalContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span>';
        document.body.classList.add('is-auth-progress');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const oobCode = urlParams.get('oobCode');

            if (oobCode) {
                // CASO RESET ESTERNO
                await confirmPasswordReset(auth, oobCode, newPassword);
                if (window.showToast) window.showToast("Password ripristinata! Ora puoi accedere.", "success");
            } else if (auth.currentUser) {
                // CASO CAMBIO INTERNO
                await updatePassword(auth.currentUser, newPassword);
                if (window.showToast) window.showToast("Password aggiornata con successo.", "success");
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
            submitBtn.innerHTML = originalContent;
            document.body.classList.remove('is-auth-progress');

            let msg = "Impossibile aggiornare la password.";
            if (err.code === 'auth/requires-recent-login') {
                msg = "Rieffettua il login per motivi di sicurezza.";
            } else if (err.code === 'auth/expired-action-code') {
                msg = "Il link di recupero è scaduto.";
            }

            if (window.showToast) window.showToast(msg, "error");
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
        };
    });
}

