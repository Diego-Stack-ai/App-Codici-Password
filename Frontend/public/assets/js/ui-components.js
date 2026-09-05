/**
 * PROTOCOLLO BASE UI COMPONENTS
 * Gestisce la logica dei componenti riutilizzabili (Pulsanti, Toggles, Icone)
 */

import { showToast } from './ui-core-v129.js';

/**
 * [LOGIC] SETUP PASSWORD TOGGLES
 * Attiva la funzionalità mostra/nascondi password sui tasti con classe .toggle-password
 */
export function setupPasswordToggles() {
    const buttons = document.querySelectorAll('.toggle-password');
    buttons.forEach(button => {
        button.addEventListener('click', function () {
            const input = this.closest('.relative')?.querySelector('input') || this.previousElementSibling;
            if (!input) return;

            const icon = this.querySelector('.material-symbols-outlined');
            const isPasswordType = input.type === 'password' || input.type === 'text';

            if (isPasswordType) {
                const isNowVisible = input.type === 'text';
                input.type = isNowVisible ? 'password' : 'text';
                if (icon) icon.textContent = isNowVisible ? 'visibility' : 'visibility_off';

                // Rimuovi anche base-shield se presente per evitare conflitti
                input.classList.remove('base-shield');
            } else if (input.classList.contains('base-shield')) {
                // Fallback Legacy per chi usa solo base-shield CSS
                input.classList.toggle('base-shield');
                const isShielded = input.classList.contains('base-shield');
                if (icon) icon.textContent = isShielded ? 'visibility' : 'visibility_off';
            }
        });
    });
}

/**
 * [LOGIC] SETUP COPY BUTTONS
 * Attiva la copia negli appunti per pulsanti con data-copy-target
 */
export function setupCopyButtons() {
    const buttons = document.querySelectorAll('.copy-button, .copy-btn');
    buttons.forEach(button => {
        button.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();

            const targetId = this.dataset.copyTarget;
            if (targetId) {
                const target = document.getElementById(targetId);
                if (target) {
                    const text = target.value || target.textContent;
                    if (text && text !== '-') {
                        try {
                            await navigator.clipboard.writeText(text);
                            // Feedback visivo
                            const icon = this.querySelector('.material-symbols-outlined');
                            if (icon) {
                                const oldIcon = icon.textContent;
                                icon.textContent = 'done';
                                setTimeout(() => icon.textContent = oldIcon, 1500);
                            }
                            showToast('Copiato!');
                        } catch (err) {
                            console.error('Copy failed', err);
                        }
                    }
                }
            }
        });
    });
}

/**
 * [LOGIC] SETUP CALL BUTTONS
 * Attiva la funzione telefona su pulsanti con data-call-source
 */
export function setupCallButtons() {
    const buttons = document.querySelectorAll('.call-button');
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const sourceId = button.getAttribute('data-call-source');
            const sourceEl = document.getElementById(sourceId);
            if (sourceEl) {
                const phone = sourceEl.textContent.trim();
                if (phone && phone !== '-') {
                    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
                }
            }
        });
    });
}

// Esposizione globale per retrocompatibilità
