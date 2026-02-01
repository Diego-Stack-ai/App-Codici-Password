import { resetPassword } from './auth.js';
import { t, supportedLanguages } from './translations.js';

/**
 * [RESET PASSWORD] MODULE V3.1
 * Gestisce l'invio delle istruzioni di recupero credenziali.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[RESET] Application Boot V3.1...");

    try {
        // 1. AppState base
        window.AppState = window.AppState || {
            user: null,
            theme: 'dark',
            language: localStorage.getItem('app_language') || 'it'
        };

        // 2. TRADUZIONI 
        applyLocalTranslations();

        // 3. SETUP 
        setupResetForm();
        setupLanguageSelector();

        console.log("[RESET] System Ready.");
    } catch (err) {
        console.error("[RESET] Critical Init Error:", err);
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
 * Gestione Form Recupero
 */
function setupResetForm() {
    const form = document.getElementById('reset-form');
    const submitBtn = document.getElementById('reset-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailEl = document.getElementById('email');
        const email = emailEl.value.trim();

        // 1. Validazione base
        if (!email || !email.includes('@')) {
            if (window.showToast) window.showToast(t('error_invalid_email') || "Inserisci un'email valida.", "error");
            return;
        }

        // 2. UI Feedback
        const originalContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin material-symbols-outlined">sync</span>';
        document.body.classList.add('is-auth-progress');

        try {
            console.log("[RESET] Sending recovery email to:", email);
            await resetPassword(email);

            if (window.showToast) window.showToast(t('success_reset_sent') || "Istruzioni inviate! Controlla la tua email.", "success");

            emailEl.value = '';

            // Redirect opzionale al login dopo successo
            setTimeout(() => {
                window.location.href = "index.html";
            }, 5000);

        } catch (err) {
            console.error("[RESET] Failure:", err);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
            document.body.classList.remove('is-auth-progress');

            let errorMsg = t('error_auth_failed') || "Impossibile inviare l'email di recupero.";
            if (err.code === 'auth/user-not-found') {
                errorMsg = "Nessun account associato a questa email.";
            }

            if (window.showToast) window.showToast(errorMsg, "error");
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

