/**
 * TITANIUM UI COMPONENTS
 * Gestisce la logica dei componenti riutilizzabili (Pulsanti, Toggles, Icone)
 */

/**
 * [FACTORY] GENERAZIONE INCONA ACCOUNT
 * Crea l'HTML per un'icona di default moderna.
 */
export function getAccountIcon(name, sizeClass = 'h-10 w-10') {
    const nameClean = name || 'Account';
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-purple-500 to-indigo-600',
        'from-orange-500 to-red-600',
        'from-pink-500 to-rose-600',
        'from-cyan-500 to-blue-600',
        'from-indigo-500 to-violet-600'
    ];

    let hash = 0;
    for (let i = 0; i < nameClean.length; i++) {
        hash = nameClean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradient = gradients[Math.abs(hash) % gradients.length];
    const initial = nameClean.charAt(0).toUpperCase();

    const isSmall = sizeClass.includes('h-8') || sizeClass.includes('h-6');
    const fontSize = isSmall ? 'text-[12px]' : 'text-[16px]';

    return `
        <div class="${sizeClass} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-sm border border-white/20 overflow-hidden shrink-0">
            <span class="${fontSize} uppercase tracking-tighter">${initial}</span>
        </div>`;
}

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

            // 1. Supporto Titanium Shield (Standard Moderno)
            if (input.classList.contains('titanium-shield') || input.id === 'password' || input.id === 'account-password') {
                input.classList.toggle('titanium-shield');
                const isShielded = input.classList.contains('titanium-shield');
                if (icon) icon.textContent = isShielded ? 'visibility' : 'visibility_off';
                return;
            }

            // 2. Fallback per type="password" (Standard Legacy)
            if (input.type === 'password' || input.type === 'text') {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                if (icon) icon.textContent = isPassword ? 'visibility' : 'visibility_off';
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
                            if (window.showToast) window.showToast('Copiato!');
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
            const sourceId = this.getAttribute('data-call-source');
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
window.getAccountIcon = getAccountIcon;
window.setupPasswordToggles = setupPasswordToggles;
window.setupCopyButtons = setupCopyButtons;
