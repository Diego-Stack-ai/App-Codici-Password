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
        const tag = e.target.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
            e.preventDefault();
        }
    });

    // 3. Blocco Selezione Browser (Backup per vecchi motori)
    document.addEventListener('selectstart', (e) => {
        const tag = e.target.tagName.toLowerCase();
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
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }

    // Reset classi e stile base (Titanium Style)
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
 * Mostra un popup centrale in stile Titanium.
 */
export function showWarningModal(title, message, callback = null) {
    const modalId = 'titanium-warning-modal';
    let modal = document.getElementById(modalId);

    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: var(--surface-vault);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid var(--border-color);
        border-radius: 24px;
        padding: 2.5rem 2rem;
        max-width: 320px;
        width: 90%;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        transform: scale(0.9);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    content.innerHTML = `
        <div style="width: 60px; height: 60px; background: rgba(37, 99, 235, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
            <span class="material-symbols-outlined" style="font-size: 2rem; color: #3b82f6;">info</span>
        </div>
        <h3 style="color: var(--text-primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.02em;">${title}</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">${message}</p>
        <button id="modal-ok-btn" style="
            width: 100%;
            padding: 1rem;
            background: var(--primary-blue);
            color: white;
            border: none;
            border-radius: 16px;
            font-weight: 700;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            cursor: pointer;
            transition: all 0.2s;
        ">Ho Capito</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Animazione ingresso
    setTimeout(() => {
        modal.style.opacity = '1';
        content.style.transform = 'scale(1)';
    }, 10);

    const closeBtn = content.querySelector('#modal-ok-btn');
    closeBtn.onclick = () => {
        modal.style.opacity = '0';
        content.style.transform = 'scale(0.9)';
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
 * [CORE UI] CONFIRM MODAL
 * Sostituto Premium di confirm(). Restituisce una Promise<boolean>.
 */
window.showConfirmModal = function (title, message, confirmText = 'Conferma', cancelText = 'Annulla') {
    return new Promise((resolve) => {
        const modalId = 'titanium-confirm-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999999; opacity: 0; transition: opacity 0.3s ease;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--surface-vault);
            border: 1px solid var(--border-color); border-radius: 24px;
            padding: 2.5rem 2rem; width: 90%; max-width: 360px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        content.innerHTML = `
            <div style="width: 60px; height: 60px; background: rgba(37, 99, 235, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                <span class="material-symbols-outlined" style="font-size: 2rem; color: #3b82f6;">help_outline</span>
            </div>
            <h3 style="color: var(--text-primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">${title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2.5rem; line-height: 1.5;">${message}</p>
            
            <div style="display: flex; gap: 0.75rem;">
                <button id="confirm-cancel-btn" style="
                    flex: 1; padding: 1rem; background: var(--surface-sub);
                    border: 1px solid var(--border-color); color: var(--text-secondary);
                    border-radius: 16px; font-weight: 600; cursor: pointer;
                    text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem;
                ">${cancelText}</button>
                <button id="confirm-ok-btn" style="
                    flex: 1; padding: 1rem; background: var(--primary-blue);
                    border: none; color: white; border-radius: 16px;
                    font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
                    text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem;
                ">${confirmText}</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Animazione
        setTimeout(() => {
            modal.style.opacity = '1';
            content.style.transform = 'scale(1)';
        }, 10);

        const closeModal = (val) => {
            modal.style.opacity = '0';
            content.style.transform = 'scale(0.9)';
            setTimeout(() => {
                modal.remove();
                resolve(val);
            }, 300);
        };

        content.querySelector('#confirm-cancel-btn').onclick = () => closeModal(false);
        content.querySelector('#confirm-ok-btn').onclick = () => closeModal(true);
    });
};

/**
 * [CORE UI] INPUT MODAL
 * Sostituto Premium di prompt(). Restituisce una Promise.
 * Risolve con value (stringa) se confermato, null se annullato.
 */
window.showInputModal = function (title, initialValue = '', placeholder = '') {
    return new Promise((resolve) => {
        const modalId = 'titanium-input-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999999; opacity: 0; transition: opacity 0.3s ease;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--surface-vault);
            border: 1px solid var(--border-color); border-radius: 24px;
            padding: 2rem; width: 90%; max-width: 360px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: flex; flex-direction: column; gap: 1.25rem;
        `;

        content.innerHTML = `
            <div>
                <h3 style="color: var(--text-primary); font-size: 1.1rem; font-weight: 800; margin-bottom: 0.25rem;">${title}</h3>
                <div style="height: 2px; width: 40px; background: var(--primary-blue); border-radius: 2px;"></div>
            </div>
            
            <input type="text" value="${initialValue}" placeholder="${placeholder}" style="
                width: 100%; background: var(--surface-sub);
                border: 1px solid var(--border-color); border-radius: 12px;
                padding: 1rem; color: var(--text-primary); font-size: 1rem; outline: none;
                transition: border-color 0.2s;
            " onfocus="this.style.borderColor = 'var(--primary-blue)'" onblur="this.style.borderColor = 'var(--border-color)'">

            <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
                <button id="modal-cancel-btn" style="
                    flex: 1; padding: 0.8rem; background: var(--surface-sub);
                    border: 1px solid var(--border-color); color: var(--text-secondary);
                    border-radius: 14px; font-weight: 600; cursor: pointer;
                ">Annulla</button>
                <button id="modal-confirm-btn" style="
                    flex: 1; padding: 0.8rem; background: var(--primary-blue);
                    border: none; color: white; border-radius: 14px;
                    font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
                ">Conferma</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const input = content.querySelector('input');
        const cancelBtn = content.querySelector('#modal-cancel-btn');
        const confirmBtn = content.querySelector('#modal-confirm-btn');

        // Animazione
        setTimeout(() => {
            modal.style.opacity = '1';
            content.style.transform = 'scale(1)';
            input.focus();
            // Sposta cursore alla fine se c'è valore
            if (initialValue) input.setSelectionRange(initialValue.length, initialValue.length);
        }, 10);

        const closeModal = (val) => {
            modal.style.opacity = '0';
            content.style.transform = 'scale(0.9)';
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
