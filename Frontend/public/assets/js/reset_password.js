import { resetPassword } from './auth.js';
import { t } from './translations.js';

/**
 * RESET_PASSWORD.JS - Protocollo Titanium
 * Gestione logica del recupero credenziali
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
    const resetForm = document.getElementById('reset-form');

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const submitBtn = resetForm.querySelector('button[type="submit"]');

            if (!emailInput || !submitBtn) return;

            const email = emailInput.value.trim();
            const originalContent = submitBtn.innerHTML;

            // UI Loading State
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin">refresh</span>
                    <span class="tracking-widest uppercase text-[10px]">Invio in corso...</span>
                </div>
            `;

            try {
                // Esecuzione reset password tramite Firebase
                await resetPassword(email);

                // Feedback visivo è già gestito da resetPassword in auth.js via Toast
                // ma possiamo aggiungere una pulizia campo qui
                emailInput.value = '';

            } catch (err) {
                console.error("Reset Error:", err);
                if (window.showToast) window.showToast("Impossibile inviare email (Verifica l'indirizzo)", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
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
