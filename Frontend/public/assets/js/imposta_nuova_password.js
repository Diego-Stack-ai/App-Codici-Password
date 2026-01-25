import { register, login, logout, resetPassword, checkAuthState } from './auth.js';

/**
 * IMPOSTA_NUOVA_PASSWORD.JS - Protocollo Titanium
 * Gestione della fase finale del reset password (inserimento nuova password)
 */

document.addEventListener('DOMContentLoaded', () => {
    const updateForm = document.getElementById('update-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (updateForm) {
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const submitBtn = updateForm.querySelector('button[type="submit"]');

            // 1. Validazione Protocollo 12-3-3
            if (newPassword.length < 12) {
                window.showToast?.("Minimo 12 caratteri!", "error");
                return;
            }

            const upperCount = (newPassword.match(/[A-Z]/g) || []).length;
            if (upperCount < 3) {
                window.showToast?.("Servono almeno 3 MAIUSCOLE!", "error");
                return;
            }

            const symbolCount = (newPassword.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;
            if (symbolCount < 3) {
                window.showToast?.("Servono almeno 3 Simboli!", "error");
                return;
            }

            // 2. Controllo Corrispondenza
            if (newPassword !== confirmPassword) {
                window.showToast?.("Le password non coincidono!", "error");
                return;
            }

            // UI Loading State
            const originalContent = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin">refresh</span>
                    <span class="tracking-widest uppercase text-[10px]">Aggiornamento...</span>
                </div>
            `;

            try {
                // Nota: In Firebase il reset password finale avviene solitamente tramite confirmPasswordReset(auth, oobCode, newPassword)
                // Qui usiamo il modulo auth.js centralizzato
                // Verrà implementata la logica specifica per il parametro oobCode dall'URL

                // Per ora simuliamo il successo per il framework UI
                console.log("Tentativo di aggiornamento password...");
                window.showToast?.("Password aggiornata con successo!", "success");

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);

            } catch (err) {
                console.error("Errore aggiornamento password:", err);
                window.showToast?.("Errore durante l'aggiornamento.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
});
