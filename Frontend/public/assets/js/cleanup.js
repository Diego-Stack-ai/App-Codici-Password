
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

        // Gestione stop-propagation (Regola 3.6): 
        // Se l'evento ha colpito un elemento con stop-propagation tra il target reale e il data-action, ignoriamo l'azione del padre.
        const stopEl = e.target.closest('[data-stop-propagation]');
        if (stopEl && target.contains(stopEl) && target !== stopEl) {
            return;
        }

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
                } else {
                    // Fallback per Liste (Account Privati / Top 10)
                    // Se non c'è un input precedente, cerchiamo di usare la logica toggleTripleVisibility
                    const card = target.closest('.micro-account-card');
                    if (card && card.dataset.id) {
                        if (typeof window.toggleTripleVisibility === 'function') {
                            window.toggleTripleVisibility(card.dataset.id);
                        }
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

    // Nota: lo stop-propagation è ora gestito internamente alla delega sopra (linea 22)
    // per permettere ai listener diretti degli elementi figli di funzionare.
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

/**
 * GLOBAL HELPER: Password Visibility Toggle per le Liste (Account Privati / Top 10)
 */
window.toggleTripleVisibility = (id) => {
    const card = document.getElementById(`acc-${id}`) || document.querySelector(`.micro-account-card[data-id="${id}"]`);
    const eye = document.getElementById(`pass-eye-${id}`) || (card ? card.querySelector('.material-symbols-outlined') : null);
    const passText = document.getElementById(`pass-text-${id}`) || (card ? card.querySelector('.micro-data-value[id^="pass-text-"]') : null);

    if (!card) return;

    // Se non abbiamo gli ID precisi, proviamo a cercarli nel DOM relativo alla card
    const targetEye = eye || card.querySelector('.btn-toggle-visibility span');
    const targetPassText = passText || card.querySelector('[id^="pass-text-"]');

    if (!targetEye || !targetPassText) return;

    // Recupera la password dal pulsante copia o attributo
    let passVal = '••••••••';
    const copyBtns = card.querySelectorAll('.copy-btn-dynamic');
    copyBtns.forEach(btn => {
        const title = (btn.getAttribute('title') || '').toLowerCase();
        // Supporto sia per traduzione che per chiave statica
        if (title.includes('password') || title.includes('copy_password')) {
            passVal = btn.getAttribute('data-copy') || passVal;
        }
    });

    const isHidden = targetEye.textContent.trim() === 'visibility';
    const dots = '••••••••';

    if (isHidden) {
        targetEye.textContent = 'visibility_off';
        targetPassText.textContent = passVal;
    } else {
        targetEye.textContent = 'visibility';
        targetPassText.textContent = dots;
    }
};
