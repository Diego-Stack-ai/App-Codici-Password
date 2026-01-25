import { register, resendVerificationEmail } from './auth.js';

/**
 * REGISTRATI.JS - Protocollo Titanium
 * Gestione logica della pagina di registrazione
 */

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const passwordInput = document.getElementById('password');
    const modal = document.getElementById('verification-modal');
    const closeBtn = document.getElementById('close-modal');
    const resendBtn = document.getElementById('resend-btn');

    // 1. Password Strength Logic
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            const bars = [
                document.getElementById('strength-bar-1'),
                document.getElementById('strength-bar-2'),
                document.getElementById('strength-bar-3'),
                document.getElementById('strength-bar-4')
            ];
            const text = document.getElementById('strength-text');

            let strength = 0;
            if (val.length >= 12) strength++;
            if ((val.match(/[A-Z]/g) || []).length >= 3) strength++;
            if ((val.match(/[0-9]/g) || []).length >= 3) strength++; // Uniamo numeri e simboli per la barra
            if ((val.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length >= 3) strength++;

            // Reset bars
            bars.forEach(bar => {
                bar.classList.remove('bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'shadow-[0_0_10px_rgba(239,68,68,0.5)]');
                bar.classList.add('bg-white/10');
            });

            const labels = ['Debole', 'Media', 'Buona', 'Eccellente'];
            const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
            const shadowColors = [
                'shadow-[0_0_10px_rgba(239,68,68,0.5)]',
                'shadow-[0_0_10px_rgba(249,115,22,0.5)]',
                'shadow-[0_0_10px_rgba(234,179,8,0.5)]',
                'shadow-[0_0_10px_rgba(16,185,129,0.5)]'
            ];

            if (val.length > 0) {
                text.textContent = labels[strength - 1] || 'Troppo corta';
                for (let i = 0; i < strength; i++) {
                    bars[i].classList.remove('bg-white/10');
                    bars[i].classList.add(colors[strength - 1], shadowColors[strength - 1]);
                }
            } else {
                text.textContent = 'Sicurezza password';
            }
        });
    }

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
                if (window.showNotification) {
                    window.showNotification('Email di verifica reinviata!', 'success');
                }
            } catch (error) {
                console.error("Errore reinvio email:", error);
            } finally {
                resendBtn.innerText = originalText;
                resendBtn.disabled = false;
            }
        });
    }


});
