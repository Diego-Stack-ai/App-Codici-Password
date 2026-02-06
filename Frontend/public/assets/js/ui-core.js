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
 */
export function initLockedUX() {
    // 1. Policy Semantica: Gli elementi con data-lock-ui non permettono selezione
    document.querySelectorAll('[data-lock-ui]').forEach(el => {
        el.style.userSelect = 'none';
        el.style.webkitUserSelect = 'none';
    });

    // 2. Blocco Menu Contestuale (App Blinda)
    document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        const tag = (target && target.tagName) ? target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea') {
            e.preventDefault();
        }
    });

    // 3. Blocco Selezione Browser (Backup per vecchi motori)
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
 * Mostra un feedback temporaneo all'utente.
 */
export function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');

    // Auto-creazione o reset se mancante
    if (!toast) {
        if (!document.body) return; // Protezione se chiamato troppo presto
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    // Reset classi e stile base (PROTOCOLLO BASE Style)
    toast.className = 'fixed left-1/2 -translate-x-1/2 bg-white text-[#0a0f1e] px-6 py-3 rounded-full text-sm font-bold shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-none';
    toast.style.bottom = '120px';
    toast.style.zIndex = '999999';
    toast.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';

    // Gestione contenuto
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-symbols-outlined" style="font-size:1.2rem; color:${type === 'error' ? '#ef4444' : (type === 'info' ? '#3b82f6' : '#22c55e')}">
                ${type === 'error' ? 'error' : (type === 'info' ? 'info' : 'check_circle')}
            </span>
            <span>${message}</span>
        </div>
    `;

    // Trigger Animazione (Timeout più affidabile di RAF in alcuni contesti)
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
    }, 50);

    // Auto-hide
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
    }, 3000);
}

/**
 * [CORE UI] PREMIUM WARNING MODAL
 * Mostra un popup centrale in stile PROTOCOLLO BASE.
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
        <span class="material-symbols-outlined modal-icon icon-box-blue">info</span>
        <h3 class="modal-title">${title}</h3>
        <p class="modal-text">${message}</p>
        <div class="modal-actions">
            <button id="modal-ok-btn" class="btn-modal btn-primary">Ho Capito</button>
        </div>
    `;

    modal.appendChild(content);

    if (document.body) {
        document.body.appendChild(modal);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
    }

    // Animazione ingresso
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);

    const closeBtn = content.querySelector('#modal-ok-btn');
    closeBtn.onclick = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            if (callback) callback();
        }, 300);
    };
}

// Esposizione globale (già gestita via window.X = X per i nuovi moduli)
window.showToast = showToast;
window.showWarningModal = showWarningModal;

/**
 * [CORE UI] LOGOUT MODAL
 * Modale specifico per il logout con stile Danger.
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
            <span class="material-symbols-outlined modal-icon icon-box-orange">logout</span>
            <h3 class="modal-title">Vuoi uscire?</h3>
            <p class="modal-text">Dovrai effettuare nuovamente il login per accedere.</p>
            <div class="modal-actions">
                <button id="btn-cancel-logout" class="btn-modal btn-secondary">Annulla</button>
                <button id="btn-confirm-logout" class="btn-modal btn-danger">Esci</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Animazione
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

        btnCancel.onclick = () => closeModal(false);

        btnConfirm.onclick = () => {
            // Mostra spinner
            btnConfirm.innerHTML = '<span class="material-symbols-outlined animate-spin" style="font-size: 1.2rem;">progress_activity</span>';
            closeModal(true);
        };

        // Chiudi su click fuori
        modal.onclick = (e) => {
            if (e.target === modal) closeModal(false);
        };
    });
};

/**
 * [CORE UI] CONFIRM MODAL
 * Sostituto Premium di confirm(). Restituisce una Promise<boolean>.
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
            <span class="material-symbols-outlined modal-icon icon-box-blue">help_outline</span>
            <h3 class="modal-title">${title}</h3>
            <p class="modal-text">${message}</p>
            
            <div class="modal-actions">
                <button id="confirm-cancel-btn" class="btn-modal btn-secondary">${cancelText}</button>
                <button id="confirm-ok-btn" class="btn-modal btn-primary">${confirmText}</button>
            </div>
        `;

        modal.appendChild(content);
        if (document.body) {
            document.body.appendChild(modal);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
        }

        // Animazione
        setTimeout(() => modal.classList.add('active'), 10);

        const closeModal = (val) => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(val);
            }, 300);
        };

        content.querySelector('#confirm-cancel-btn').onclick = () => closeModal(false);
        content.querySelector('#confirm-ok-btn').onclick = () => closeModal(true);

        // Chiudi su click fuori
        modal.onclick = (e) => {
            if (e.target === modal) closeModal(false);
        };
    });
};

/**
 * [CORE UI] INPUT MODAL
 * Sostituto Premium di prompt(). Restituisce una Promise.
 * Risolve con value (stringa) se confermato, null se annullato.
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
            <div style="height: 2px; width: 40px; background: #3b82f6; border-radius: 2px; margin: 0 auto 1.5rem auto;"></div>
            
            <input type="text" value="${initialValue}" placeholder="${placeholder}" class="glass-field" style="width: 100%; margin-bottom: 1.5rem; text-align: center;">

            <div class="modal-actions">
                <button id="modal-cancel-btn" class="btn-modal btn-secondary">Annulla</button>
                <button id="modal-confirm-btn" class="btn-modal btn-primary">Conferma</button>
            </div>
        `;

        modal.appendChild(content);
        if (document.body) {
            document.body.appendChild(modal);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
        }

        const input = content.querySelector('input');
        const cancelBtn = content.querySelector('#modal-cancel-btn');
        const confirmBtn = content.querySelector('#modal-confirm-btn');

        // Animazione
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

        cancelBtn.onclick = () => closeModal(null);
        confirmBtn.onclick = () => closeModal(input.value);

        // Enter key per conferma
        input.onkeydown = (e) => {
            if (e.key === 'Enter') closeModal(input.value);
            if (e.key === 'Escape') closeModal(null);
        };
    });
};
