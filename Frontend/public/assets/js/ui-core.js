import { initComponents } from './components.js';

/**
 * [CORE UI] INITIALIZATION
 */
function init() {
    // Carica componenti condivisi (Header/Footer) se i placeholder esistono
    initComponents();

    // Inizializza UX bloccata
    initLockedUX();
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

    toast.innerHTML = `
        <div class="toast-content">
            <span class="material-symbols-outlined toast-icon ${iconColorClass}">${iconName}</span>
            <span>${message}</span>
        </div>
    `;

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

    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-box';

    content.innerHTML = `
        <span class="material-symbols-outlined modal-icon icon-accent-blue">info</span>
        <h3 class="modal-title">${title}</h3>
        <p class="modal-text">${message}</p>
        <div class="modal-actions">
            <button id="modal-ok-btn" class="btn-modal btn-primary">Ho Capito</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    setTimeout(() => modal.classList.add('active'), 10);

    const closeBtn = content.querySelector('#modal-ok-btn');
    closeBtn.addEventListener('click', () => {
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
window.showLogoutModal = function () {
    return new Promise((resolve) => {
        const modalId = 'logout-modal-dynamic';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';

        const content = document.createElement('div');
        content.className = 'modal-box';

        content.innerHTML = `
            <span class="material-symbols-outlined modal-icon icon-accent-orange">logout</span>
            <h3 class="modal-title">Vuoi uscire?</h3>
            <p class="modal-text">Dovrai effettuare nuovamente il login per accedere.</p>
            <div class="modal-actions">
                <button id="btn-cancel-logout" class="btn-modal btn-secondary">Annulla</button>
                <button id="btn-confirm-logout" class="btn-modal btn-danger">Esci</button>
            </div>
        `;

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

        const btnConfirm = content.querySelector('#btn-confirm-logout');
        const btnCancel = content.querySelector('#btn-cancel-logout');

        btnCancel.addEventListener('click', () => closeModal(false));
        btnConfirm.addEventListener('click', () => {
            btnConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin toast-icon">progress_activity</span>';
            closeModal(true);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(false); });
    });
};

/**
 * [CORE UI] CONFIRM MODAL
 */
window.showConfirmModal = function (title, message, confirmText = 'Conferma', cancelText = 'Annulla') {
    return new Promise((resolve) => {
        const modalId = 'protocol-confirm-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';

        const content = document.createElement('div');
        content.className = 'modal-box';

        content.innerHTML = `
            <span class="material-symbols-outlined modal-icon icon-accent-blue">help_outline</span>
            <h3 class="modal-title">${title}</h3>
            <p class="modal-text">${message}</p>
            <div class="modal-actions">
                <button id="confirm-cancel-btn" class="btn-modal btn-secondary">${cancelText}</button>
                <button id="confirm-ok-btn" class="btn-modal btn-primary">${confirmText}</button>
            </div>
        `;

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

        content.querySelector('#confirm-cancel-btn').addEventListener('click', () => closeModal(false));
        content.querySelector('#confirm-ok-btn').addEventListener('click', () => closeModal(true));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(false); });
    });
};

/**
 * [CORE UI] INPUT MODAL
 */
window.showInputModal = function (title, initialValue = '', placeholder = '') {
    return new Promise((resolve) => {
        const modalId = 'protocol-input-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';

        const content = document.createElement('div');
        content.className = 'modal-box';

        content.innerHTML = `
            <h3 class="modal-title">${title}</h3>
            <div class="modal-accent-bar"></div>
            <input type="text" value="${initialValue}" placeholder="${placeholder}" class="glass-field modal-input-glass">
            <div class="modal-actions">
                <button id="modal-cancel-btn" class="btn-modal btn-secondary">Annulla</button>
                <button id="modal-confirm-btn" class="btn-modal btn-primary">Conferma</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const input = content.querySelector('input');
        setTimeout(() => {
            modal.classList.add('active');
            input.focus();
            if (initialValue) input.setSelectionRange(initialValue.length, initialValue.length);
        }, 10);

        const closeModal = (val) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(val);
            }, 300);
        };

        content.querySelector('#modal-cancel-btn').addEventListener('click', () => closeModal(null));
        content.querySelector('#modal-confirm-btn').addEventListener('click', () => closeModal(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') closeModal(input.value);
            if (e.key === 'Escape') closeModal(null);
        });
    });
};
