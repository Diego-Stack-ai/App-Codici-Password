import { resetPassword } from './auth.js';

/**
 * RESET_PASSWORD.JS - Protocollo Titanium
 * Gestione logica del recupero credenziali
 */

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
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
});
