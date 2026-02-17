import { initComponents } from './components.js';
import { createElement, setChildren, safeSetText } from './dom-utils.js';
import { t } from './translations.js';

/**
 * [CORE UI] INITIALIZATION
 */
function init() {
    // Carica componenti condivisi (Header/Footer) se i placeholder esistono
    initComponents();

    // Inizializza UX bloccata
    initLockedUX();

    // Inizializza Collapsibles (Accordion System V3.9)
    initCollapsibles();
}

// Esegui al caricamento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


/**
 * [POLICY] BLOCCO UX NATIVA (APP BLINDA)
 * Impedisce il menu contestuale e la selezione per simulare un'app nativa.
 * CSP-Safe: Stili spostati in operatore.css tramite [data-lock-ui]
 */
export function initLockedUX() {
    // 1. Blocco Menu Contestuale (App Blinda)
    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        const tag = (target && target.tagName) ? target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea') {
            e.preventDefault();
        }
    });

    // 2. Blocco Selezione Browser (Backup per vecchi motori)
    document.addEventListener('selectstart', (e) => {
        const target = e.target;
        const tag = (target && target.tagName) ? target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea') {
            e.preventDefault();
        }
    });
}

/**
 * [CORE UI] TOAST NOTIFICATION
 * CSP-Safe: Usa classi CSS per stili e animazioni.
 */
export function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');

    if (!toast) {
        if (!document.body) return;
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    // Reset classi e applica contenuto
    toast.className = '';
    const iconColorClass = type === 'error' ? 'text-red-500' : (type === 'info' ? 'text-blue-500' : 'text-green-400');
    const iconName = type === 'error' ? 'error' : (type === 'info' ? 'info' : 'check_circle');

    const content = createElement('div', { className: 'toast-content' }, [
        createElement('span', {
            className: `material-symbols-outlined toast-icon ${iconColorClass}`,
            textContent: iconName
        }),
        createElement('span', {}, [message])
    ]);

    setChildren(toast, content);

    // Trigger Animazione
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);

    // Auto-hide
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

/**
 * [CORE UI] PREMIUM WARNING MODAL
 */
export function showWarningModal(title, message, callback = null) {
    const modalId = 'protocol-warning-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = createElement('div', { id: modalId, className: 'modal-overlay' });

    const btnOk = createElement('button', {
        id: 'modal-ok-btn',
        className: 'btn-modal btn-primary',
        textContent: t('ok') || 'Ho Capito'
    });

    const content = createElement('div', { className: 'modal-box' }, [
        createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'info' }),
        createElement('h3', { className: 'modal-title', textContent: title }),
        createElement('p', { className: 'modal-text', textContent: message }),
        createElement('div', { className: 'modal-actions' }, [btnOk])
    ]);

    modal.appendChild(content);
    document.body.appendChild(modal);

    setTimeout(() => modal.classList.add('active'), 10);

    btnOk.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            if (callback) callback();
        }, 300);
    });
}

window.showToast = showToast;
window.showWarningModal = showWarningModal;

/**
 * [CORE UI] LOGOUT MODAL
 */
export async function showLogoutModal() {
    return new Promise((resolve) => {
        const modalId = 'logout-modal-dynamic';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = createElement('div', { id: modalId, className: 'modal-overlay' });

        const btnCancel = createElement('button', { id: 'btn-cancel-logout', className: 'btn-modal btn-secondary', textContent: t('cancel') || 'Annulla' });
        const btnConfirm = createElement('button', { id: 'btn-confirm-logout', className: 'btn-modal btn-danger', textContent: t('logout') || 'Esci' });

        const content = createElement('div', { className: 'modal-box' }, [
            createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-orange', textContent: 'logout' }),
            createElement('h3', { className: 'modal-title', textContent: t('logout_confirm_title') || 'Vuoi uscire?' }),
            createElement('p', { className: 'modal-text', textContent: t('logout_confirm_msg') || 'Dovrai effettuare nuovamente il login per accedere.' }),
            createElement('div', { className: 'modal-actions' }, [btnCancel, btnConfirm])
        ]);

        modal.appendChild(content);
        document.body.appendChild(modal);

        setTimeout(() => modal.classList.add('active'), 10);

        const closeModal = (confirmed) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(confirmed);
            }, 300);
        };

        btnCancel.addEventListener('click', () => closeModal(false));
        btnConfirm.addEventListener('click', () => {
            setChildren(btnConfirm, createElement('span', { className: 'material-symbols-outlined animate-spin toast-icon', textContent: 'progress_activity' }));
            closeModal(true);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(false); });
    });
}
window.showLogoutModal = showLogoutModal;

/**
 * [CORE UI] CONFIRM MODAL
 */
export async function showConfirmModal(title, message, confirmText = t('confirm') || 'Conferma', cancelText = t('cancel') || 'Annulla') {
    return new Promise((resolve) => {
        const modalId = 'protocol-confirm-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = createElement('div', { id: modalId, className: 'modal-overlay' });

        const btnCancel = createElement('button', { id: 'confirm-cancel-btn', className: 'btn-modal btn-secondary', textContent: cancelText });
        const btnConfirm = createElement('button', { id: 'confirm-ok-btn', className: 'btn-modal btn-primary', textContent: confirmText });

        const content = createElement('div', { className: 'modal-box' }, [
            createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'help_outline' }),
            createElement('h3', { className: 'modal-title', textContent: title }),
            createElement('p', { className: 'modal-text', textContent: message }),
            createElement('div', { className: 'modal-actions' }, [btnCancel, btnConfirm])
        ]);

        modal.appendChild(content);
        document.body.appendChild(modal);

        setTimeout(() => modal.classList.add('active'), 10);

        const closeModal = (val) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(val);
            }, 300);
        };

        btnCancel.addEventListener('click', () => closeModal(false));
        btnConfirm.addEventListener('click', () => closeModal(true));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(false); });
    });
}
window.showConfirmModal = showConfirmModal;

/**
 * [CORE UI] INPUT MODAL
 */
/**
 * [CORE UI] INPUT MODAL
 */
export function showInputModal(title, initialValue = '', placeholder = '') {
    return new Promise((resolve) => {
        const modalId = 'protocol-input-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = createElement('div', { id: modalId, className: 'modal-overlay' });

        const input = createElement('input', {
            type: 'text',
            value: initialValue,
            placeholder: placeholder,
            className: 'glass-field modal-input-glass'
        });

        const btnCancel = createElement('button', { id: 'modal-cancel-btn', className: 'btn-modal btn-secondary', textContent: t('cancel') || 'Annulla' }, []);
        const btnConfirm = createElement('button', { id: 'modal-confirm-btn', className: 'btn-modal btn-primary', textContent: t('confirm') || 'Conferma' }, []);

        // Listener per chiusura
        const closeModal = (val) => {
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
                resolve(val);
            }, 300);
        };

        btnCancel.addEventListener('click', () => closeModal(null));
        btnConfirm.addEventListener('click', () => closeModal(input.value));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') closeModal(input.value);
            if (e.key === 'Escape') closeModal(null);
        });

        const content = createElement('div', { className: 'modal-box' }, [
            createElement('h3', { className: 'modal-title', textContent: title }),
            createElement('div', { className: 'modal-accent-bar' }),
            input,
            createElement('div', { className: 'modal-actions' }, [btnCancel, btnConfirm])
        ]);

        modal.appendChild(content);
        document.body.appendChild(modal);

        setTimeout(() => {
            modal.classList.add('active');
            input.focus();
            if (initialValue && initialValue.length > 0) {
                try { input.setSelectionRange(initialValue.length, initialValue.length); } catch (e) { }
            }
        }, 10);
    });
}
window.showInputModal = showInputModal;

/**
 * [CORE UI] TOGGLE TRIPLE VISIBILITY
 * Gestisce la visibilità delle credenziali nelle liste (User, Account, Password).
 */
export function toggleTripleVisibility(id) {
    const card = document.getElementById(`acc-${id}`) || document.querySelector(`.micro-account-card[data-id="${id}"]`);
    if (!card) return;

    const eye = document.getElementById(`pass-eye-${id}`) || card.querySelector('.btn-toggle-visibility span') || card.querySelector('.micro-btn-utility span');
    const passText = document.getElementById(`pass-text-${id}`) || card.querySelector('[id^="pass-text-"]') || card.querySelector('.micro-data-value:last-child') || card.querySelector('.micro-data-row:last-child .micro-data-value');

    if (!eye || !passText) return;

    const isHidden = eye.textContent.trim() === 'visibility';
    const dots = '••••••••';

    if (isHidden) {
        eye.textContent = 'visibility_off';
        // Se abbiamo salvato il valore nel dataset, usiamolo
        if (passText.dataset.realValue) {
            passText.textContent = passText.dataset.realValue;
        } else {
            // Fallback: prova a cercarlo nei pulsanti copia se non presente nel dataset
            const copyBtn = card.querySelector('.btn-toggle-visibility')?.parentElement?.querySelector('.micro-btn-copy-inline');
            // Nota: questa logica di fallback dipende dalle implementazioni specifiche
        }
    } else {
        eye.textContent = 'visibility';
        if (!passText.dataset.realValue && passText.textContent !== dots) {
            passText.dataset.realValue = passText.textContent;
        }
        passText.textContent = dots;
    }
}

window.toggleTripleVisibility = toggleTripleVisibility;

/**
 * [CORE UI] COLLAPSIBLE SYSTEM (Accordion)
 * Gestisce l'apertura/chiusura delle sezioni con classe .collapsible-header
 */
export function initCollapsibles() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.collapsible-header');
        if (!header) return;

        // Se clicchiamo su un pulsante interno (es. 'Aggiungi'), non chiudiamo/apriamo l'accordion
        if (e.target.closest('button') || e.target.closest('.config-item-actions')) return;

        const targetId = header.dataset.target;
        if (!targetId) return;

        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        // Toggle della sezione
        const isHidden = targetEl.classList.toggle('hidden');

        // Animazione freccia (se presente)
        const arrow = header.querySelector('.arrow-icon');
        if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });
}

/**
 * [CORE UI] GUIDE MODAL
 */
export function showGuideModal(title, steps) {
    const modalId = 'guide-modal';
    let current = document.getElementById(modalId);
    if (current) current.remove();

    const modal = createElement('div', { id: modalId, className: 'modal-overlay' });
    const content = createElement('div', { className: 'modal-box' }, [
        createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'help_outline' }),
        createElement('h3', { className: 'modal-title', textContent: title }),
        createElement('div', { className: 'modal-text text-left w-full mt-4 mb-4 space-y-2' },
            steps.map((step, i) => createElement('p', { className: 'flex items-start text-sm text-secondary' }, [
                createElement('strong', { className: 'text-accent mr-2 min-w-[20px]', textContent: `${i + 1}.` }),
                createElement('span', { textContent: step })
            ]))
        ),
        createElement('div', { className: 'modal-actions' }, [
            createElement('button', {
                className: 'btn-modal btn-primary w-full',
                textContent: t('close') || 'Chiudi',
                onclick: () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
            })
        ])
    ]);

    modal.appendChild(content);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
    modal.onclick = (e) => { if (e.target === modal) modal.querySelector('button').click(); };
}
window.showGuideModal = showGuideModal;

