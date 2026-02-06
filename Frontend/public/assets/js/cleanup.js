
import { t } from './translations.js';

/**
 * PROTOCOLLO PULIZIA & SICUREZZA
 * Centralizza la gestione di eventi e traduzioni per rimuovere script inline e unsafe-inline.
 */
export function initCleanup() {
    initGlobalDelegation();
    initTranslations();
}

/**
 * Gestione centralizzata eventi (sostituisce onclick inline)
 */
function initGlobalDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        // Gestione azioni comuni
        switch (action) {
            case 'navigate':
                if (target.dataset.href) {
                    window.location.href = target.dataset.href;
                }
                break;

            case 'back':
                window.history.back();
                break;

            case 'reload':
                window.location.reload();
                break;

            case 'trigger-click':
                const triggerId = target.dataset.target;
                const element = document.getElementById(triggerId);
                if (element) element.click();
                break;

            case 'toggle-section':
                // Gestita specificamente o aggiungi qui logica generica se necessario
                break;

            case 'edit-section':
                if (typeof window.editSection === 'function') {
                    window.editSection(target.dataset.target);
                }
                break;

            case 'copy-text':
                const text = target.dataset.text;
                if (text) {
                    if (typeof window.copyText === 'function') window.copyText(text);
                    else {
                        navigator.clipboard.writeText(text).then(() => {
                            if (window.showToast) window.showToast("Copiato!", "success");
                        });
                    }
                }
                break;

            case 'make-call':
                const number = target.dataset.number;
                if (number) {
                    window.location.href = `tel:${number.replace(/\s+/g, '')}`;
                }
                break;

            case 'toggle-visibility':
                const input = target.previousElementSibling;
                // Assumes structure: <input> <button> (or similar sibling)
                if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                    const span = target.querySelector('span');

                    // Check if classic password OR shield class
                    // Use dataset flag to remember if it was originally password
                    const isClassicPassword = (input.type === 'password' || input.getAttribute('type') === 'password' || input.dataset.wasPassword === 'true');

                    if (isClassicPassword) {
                        input.dataset.wasPassword = 'true';
                        const isHidden = input.type === 'password';
                        input.type = isHidden ? 'text' : 'password';
                        if (span) span.textContent = isHidden ? 'visibility_off' : 'visibility';
                    } else {
                        // Titanium shield class toggle
                        input.classList.toggle('base-shield');
                        const isMasked = input.classList.contains('base-shield');
                        if (span) span.textContent = isMasked ? 'visibility' : 'visibility_off';
                    }
                }
                break;

            case 'toggle-theme':
                if (window.ProtocolloBaseTheme) {
                    if (typeof window.ProtocolloBaseTheme.setMode === 'function') {
                        window.ProtocolloBaseTheme.setMode(window.ProtocolloBaseTheme.getMode() === 'dark' ? 'light' : 'dark');
                    }
                } else {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('theme', 'light');
                    } else {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('theme', 'dark');
                    }
                }
                break;
        }

        // Stop propagation se richiesto
        if (target.hasAttribute('data-stop-propagation')) {
            e.stopPropagation();
        }
    });

    // Gestione specifica per stop propagation senza action
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-stop-propagation]')) {
            e.stopPropagation();
        }
    }, true); // Capture phase per bloccare subito se necessario
}

/**
 * Sistema di traduzione centralizzato (sostituisce script inline nelle pagine)
 */
function initTranslations() {
    const translate = () => {
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            const translation = t(key);
            if (translation && translation !== key) {
                el.textContent = translation;
            }
        });
    };

    // Esegui subito
    translate();

    // E anche dopo un po' per sicurezza (contenuti dinamici)
    setTimeout(translate, 500);

    // Esergui su richiesta (custom event)
    window.addEventListener('content-updated', translate);
}
