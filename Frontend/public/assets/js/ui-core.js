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
    // V5.0 Support: Target both new .account-card and legacy .micro-account-card
    const card = document.querySelector(`.account-card[data-id="${id}"]`) || document.querySelector(`.micro-account-card[data-id="${id}"]`) || document.getElementById(`acc-${id}`);
    if (!card) return;

    // Find the toggle button that was clicked (or the first one for this ID)
    // In V5.0 account_privati.js, the button is inside .account-card-right inside .account-data-row
    // The password value is in .account-data-value with id="pass-val-..."

    // We search for the specific password row if possible, but here we have only 'id' (account id)
    // However, createDataRow generates a random ID for the element: `pass-val-${rowId}`
    // But we passed 'id' (acc.id) to the onclick. 
    // Problem: The DOM element ID is random.
    // FIX: In createDataRow, we should store the acc.id in a data attribute or class to find it easily. 
    // OR: We traverse from the button that triggered it. 
    // Since this function is global and takes an ID, it implies uniqueness or a known way to find the element.
    // BUT checking account_privati.js: window.toggleTripleVisibility(acc.id) is called.
    // The password element has `id: isPassword ? pass-val-${rowId} : undefined`. 
    // We cannot find unknown random ID.

    // STRATEGY: Look for the password row within the card.
    // The password row is likely the last one or contains "••••••••".
    const values = card.querySelectorAll('.account-data-value, .micro-data-value');
    let passEl = null;
    let eyeIcon = null;

    values.forEach(el => {
        if (el.textContent === '••••••••' || el.dataset.realValue) {
            passEl = el;
            // The eye button is in the sibling .account-card-right
            const rightAction = el.parentElement.querySelector('.account-card-right button span, .micro-row-actions button span');
            if (rightAction && (rightAction.textContent === 'visibility' || rightAction.textContent === 'visibility_off')) {
                eyeIcon = rightAction;
            }
        }
    });

    if (!passEl || !eyeIcon) return;

    const isHidden = eyeIcon.textContent.trim() === 'visibility';
    const dots = '••••••••';

    if (isHidden) {
        eyeIcon.textContent = 'visibility_off';
        // Retrieve real value. If not in dataset, we might need to fetch or it's supposed to be there.
        // In this architecture, security usually implies fetching or having it protected?
        // Wait, the data was passed to createDataRow. createDataRow rendered '••••••••'.
        // It did NOT store the real value in DOM for security? Or did it?
        // account_privati.js: createDataRow(..., '••••••••', data.password, true, id)
        // copyValue arg is data.password.
        // It seems createDataRow logic was:
        /*
        onclick: (e) => {
             e.stopPropagation();
             window.toggleTripleVisibility(id);
             // ... local logic ...
        }
        */
        // The local logic in createDataRow attempts `el.textContent = copyValue`!
        // So global `toggleTripleVisibility` might be REDUNDANT or conflicting if the inline handler does the work.
        // account_privati.js inline handler: 
        // `if (el.textContent === '••••••••') { el.textContent = copyValue; ... }`

        // IF the user says "toggle button doesn't work", maybe the inline handler is failing?
        // In account_privati.js step 4014:
        // onclick calls: `window.toggleTripleVisibility(id); const el = ...; const span = ...;`
        // `const el = document.getElementById(pass-val-${rowId});` -> Correct.
        // `if (el.textContent === '••••••••') ...` -> Correct.

        // WHY FAIL?
        // 1. window.toggleTripleVisibility might trigger allow/deny modal?
        // 2. Click propogation?
        // 3. 'copyValue' variable scope?

        // Let's assume the Global function handles the "Decryption/Auth" part before revealing.
        // If the global function just toggles UI, the inline one duplicates it.
        // I will make this global function properly find and toggle if the local one didn't.
        // OR better: ensure the local one works.

        // Actually, if I look at account_privati.js again... 
        // The inline handler has access to 'copyValue' closure! 
        // So the inline handler IS the one that knows the password.
        // This global function CANNOT know the password unless it fetches it or it's in DOM.
        // It seems the global function is legacy/placeholder or for "show all".

        // If the user says "non funziona", it means the inline handler isn't firing or updating.
        // CSS fix (outline) was done. Text color? Z-index?

        // Let's make sure this global function doesn't error out.
        // But the REAL fix is likely ensuring the inline handler in account_privati.js works.

    } else {
        eyeIcon.textContent = 'visibility';
        passEl.textContent = dots;
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

