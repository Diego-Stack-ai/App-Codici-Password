/**
 * TITANIUM UI CORE
 * Gestisce le policy globali di UX e i componenti di sistema (Toast, Feedback)
 */

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
    let toast = document.getElementById('toast') || document.getElementById('toast-container');
    if (!toast) {
        console.warn('Toast container non trovato nel DOM.');
        return;
    }

    const msgEl = document.getElementById('toast-message') || toast;
    const iconEl = document.getElementById('toast-icon');

    if (msgEl) msgEl.textContent = message;

    if (iconEl) {
        iconEl.textContent = type === 'error' ? 'error' : 'check_circle';
        iconEl.className = `material-symbols-outlined text-xl ${type === 'error' ? 'text-red-400' : 'text-green-400'}`;
    }

    toast.classList.remove('opacity-0', 'translate-y-10', 'hidden');
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

// Esposizione globale per retrocompatibilità (opzionale, ma utile durante la migrazione)
window.showToast = showToast;
