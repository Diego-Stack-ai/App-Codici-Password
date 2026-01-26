import { auth } from './firebase-config.js';
import { updatePassword, confirmPasswordReset, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { showToast } from './ui-core.js';
import { t } from './translations.js';

/**
 * IMPOSTA_NUOVA_PASSWORD.JS - Protocollo Titanium
 * Gestione della fase finale del reset password (inserimento nuova password)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Traduzione DOM
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        el.textContent = t(key);
    });

    const updateForm = document.getElementById('update-password-form');
    const cancelBtn = document.getElementById('cancel-password-update');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // --- LOGICA ANNULLA ---
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const isReset = urlParams.has('oobCode');
            // Se è loggato e non è un reset -> torna a impostazioni
            // Se è un reset o non è loggato -> torna a login
            if (auth.currentUser && !isReset) {
                window.location.href = 'impostazioni.html';
            } else {
                window.location.href = 'index.html';
            }
        });
    }

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
                // 3. DETERMINA IL TIPO DI AZIONE (Reset esterno vs Cambio interno)
                const urlParams = new URLSearchParams(window.location.search);
                const oobCode = urlParams.get('oobCode');

                if (oobCode) {
                    // CASO A: RESET ESTERNO (Da Email)
                    await confirmPasswordReset(auth, oobCode, newPassword);
                    showToast("Password ripristinata! Ora puoi accedere.", "success");
                } else if (auth.currentUser) {
                    // CASO B: CAMBIO INTERNO (Da Impostazioni)
                    await updatePassword(auth.currentUser, newPassword);
                    showToast("Password aggiornata con successo!", "success");
                } else {
                    throw new Error("Nessuna sessione attiva e nessun codice di reset trovato.");
                }

                setTimeout(() => {
                    window.location.href = auth.currentUser ? 'home_page.html' : 'index.html';
                }, 2000);

            } catch (err) {
                console.error("Errore password update:", err);
                if (err.code === 'auth/requires-recent-login') {
                    showToast("Per sicurezza, devi rieffettuare il login per cambiare la password.", "warning");
                    setTimeout(() => window.location.href = 'index.html', 3000);
                } else if (err.code === 'auth/expired-action-code') {
                    showToast("Il link di recupero è scaduto.", "error");
                } else {
                    showToast("Errore: " + (err.message || "Operazione non riuscita"), "error");
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
});
