import { register, resendVerificationEmail } from './auth.js';
import { t } from './translations.js';

/**
 * REGISTRATI.JS - Protocollo Titanium
 * Gestione logica della pagina di registrazione
 */

// Traduzione statica immediata
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', t(key));
        } else {
            el.textContent = t(key);
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const passwordInput = document.getElementById('password');
    const modal = document.getElementById('verification-modal');
    const closeBtn = document.getElementById('close-modal');
    const resendBtn = document.getElementById('resend-btn');

    // 1. Password Strength Logic
    // 1. Password Strength Logic (Removed as per V6.0 Pure CSS Protocol)

    // 2. Form Submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;

            // UI Loading State
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin">refresh</span>
                    <span class="tracking-widest uppercase text-[10px]">Elaborazione...</span>
                </div>
            `;

            const nome = document.getElementById('nome').value;
            const cognome = document.getElementById('cognome').value || "";
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const success = await register(nome, cognome, email, password);
                if (success) {
                    if (modal) modal.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Errore durante la registrazione:", error);
                if (window.showToast) window.showToast("Errore durante la registrazione: " + (error.message || "Riprova"), "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }

    // 3. Modal Controls
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
            window.location.href = 'index.html';
        });
    }

    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const originalText = resendBtn.innerText;
            resendBtn.innerText = 'Invio in corso...';
            resendBtn.disabled = true;

            try {
                await resendVerificationEmail();
                await resendVerificationEmail();
                if (window.showToast) {
                    window.showToast('Email di verifica reinviata!', 'success');
                }
            } catch (error) {
                console.error("Errore reinvio email:", error);
            } finally {
                resendBtn.innerText = originalText;
                resendBtn.disabled = false;
            }
        });
    }


    // Setup Language Selector
    setupLanguageSelector();
});

import { supportedLanguages } from './translations.js';

function setupLanguageSelector() {
    const btn = document.getElementById('lang-toggle-btn');
    const dropdown = document.getElementById('lang-dropdown');

    if (!btn || !dropdown) return;

    dropdown.innerHTML = supportedLanguages.map(lang => `
        <button class="lang-option" data-code="${lang.code}" style="display:flex; align-items:center;">
            <span class="flag" style="margin-right:8px;">${lang.flag}</span> ${lang.name}
        </button>
    `).join('');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const code = opt.getAttribute('data-code');
            localStorage.setItem('app_language', code);
            window.location.reload();
        });
    });
}
