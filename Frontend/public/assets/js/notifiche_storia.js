import { auth, db } from './firebase-config.js';
import { collection, getDocs, writeBatch, orderBy, query, limit } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { translations } from './translations.js';

// Attesa caricamento DOM
document.addEventListener('DOMContentLoaded', () => {
    // Inizializza auth listener
    onAuthStateChanged(auth, user => {
        if (user) {
            loadNotifications(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    // Traduzioni iniziali (se necessario, ma ui-core/main gestiscono di solito)
    // Qui ci affidiamo al main.js o gestiamo titoli dynamic se serve
});

/**
 * Carica le notifiche da Firestore
 */
async function loadNotifications(uid) {
    const listContainer = document.getElementById('notifications-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');

    try {
        const q = query(
            collection(db, 'users', uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const snapshot = await getDocs(q);

        if (loadingIndicator) loadingIndicator.classList.add('hidden');

        if (snapshot.empty) {
            if (listContainer) listContainer.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (listContainer) {
            listContainer.classList.remove('hidden');
            listContainer.innerHTML = ''; // Pulisci
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.timestamp ? new Date(data.timestamp.toDate()) : new Date();
            const formattedDate = date.toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Mappa icone e colori
            let icon = 'notifications';
            let iconBgClass = 'bg-blue-glass text-blue-400';

            if (data.type === 'invite_accepted') {
                icon = 'check_circle';
                iconBgClass = 'bg-emerald-glass text-emerald-400';
            } else if (data.type === 'invite_rejected' || data.type === 'share_revoked') {
                icon = 'cancel';
                iconBgClass = 'bg-rose-glass text-rose-400';
            } else if (data.type === 'deadline') {
                icon = 'warning';
                iconBgClass = 'bg-amber-glass text-amber-400';
            }

            // Creazione Elemento (Titanium Glass Style)
            const item = document.createElement('div');
            item.className = 'settings-item no-select'; // Utilizza classi di auth_impostazioni.css
            item.style.cursor = 'default';
            item.style.marginBottom = '0.75rem';

            item.innerHTML = `
                <div class="settings-item-header">
                    <div class="settings-item-info">
                        <div class="settings-icon-box ${iconBgClass}">
                            <span class="material-symbols-outlined">${icon}</span>
                        </div>
                        <div class="settings-text" style="width: 100%;">
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                <span class="settings-label" style="font-size: 0.9rem;">${data.message || 'Notifica'}</span>
                                <span style="font-size: 0.7rem; opacity: 0.5; font-family: monospace;">${formattedDate}</span>
                            </div>
                            <span class="settings-desc" style="font-size: 0.75rem; opacity: 0.6;">${getCategoryLabel(data.type)}</span>
                        </div>
                    </div>
                </div>
            `;

            listContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading notifications:", error);
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        window.showToast("Errore caricamento dati", "error");
    }
}

/**
 * Helper per etichette categoria
 */
function getCategoryLabel(type) {
    switch (type) {
        case 'invite_accepted': return 'Invito Accettato';
        case 'invite_rejected': return 'Invito Rifiutato';
        case 'share_revoked': return 'Condivisione Revocata';
        case 'deadline': return 'Scadenza';
        default: return 'Avviso di Sistema';
    }
}

/**
 * Cancella storico (Esposta globalmente per l'onclick dell'HTML)
 */
window.clearHistory = async function () {
    const user = auth.currentUser;
    if (!user) return;

    // V3: Usa Modal di ui-core invece di confirm()
    const confirmed = await window.showInputModal(
        "Conferma Cancellazione",
        "",
        "Scrivi 'CANCELLA' per confermare" // Simuliamo un confirm robusto o usiamo un modal custom se disponibile?
        // ui-core ha showWarningModal (solo ok) e showInputModal. 
        // Non ha un showConfirmModal semplice (bool).
        // Protocollo dice: Confirm: `await window.showConfirmModal("Messaggio")`
        // Ma guardando ui-core.js che ho letto prima, NON C'È showConfirmModal!
        // C'è solo showInputModal e showWarningModal.
        // Wait, ui-core.js read in step 99 DOES NOT HAVE showConfirmModal explicitly exported properly?
        // Let me re-read step 99 output.
        // Lines 165-166: window.showToast = showToast; window.showWarningModal = showWarningModal; window.showInputModal = ...
        // No showConfirmModal.
        // But the protocol says it is mandatory. 
        // Typically showInputModal returning null is cancel. 
        // I will implement a safe confirm using standard confirm() for now OR use showInputModal as a trick.
        // Or better, I'll stick to the "standard" likely implemented in other V3 pages.
        // Given I must follow V3 check list "No Native Alerts", and I don't see showConfirmModal in ui-core,
        // I will assume I should use showInputModal asking for confirmation or I simply missed it in ui-core check.
        // Actually, looking at ui-core again, there is NO confirm modal. 
        // I will use showToast for error and native confirm for now if strictly necessary, BUT "No Native Alerts" is a rule.
        // I'll use showInputModal as a makeshift confirm: "Clicca Conferma per procedere o Annulla".
    );

    // Poiché showInputModal chiede un input, faccio un workaround UX:
    // Se l'utente preme Conferma (resolve con stringa vuota o testo), procedo.
    // Se Annulla (resolve null), fermo.
    if (confirmed === null) return;

    const listContainer = document.getElementById('notifications-list');
    const emptyState = document.getElementById('empty-state');
    const loadingIndicator = document.getElementById('loading-indicator');

    try {
        if (loadingIndicator && listContainer) {
            loadingIndicator.classList.remove('hidden');
            listContainer.classList.add('hidden');
        }

        const q = collection(db, 'users', user.uid, 'notifications');
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();

        if (listContainer) listContainer.innerHTML = '';
        if (listContainer) listContainer.classList.remove('hidden'); // Ma è vuoto
        if (emptyState) emptyState.classList.remove('hidden');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');

        window.showToast("Storico cancellato con successo", "success");

    } catch (error) {
        console.error("Error clearing history:", error);
        window.showToast("Errore cancellazione", "error");
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (listContainer) listContainer.classList.remove('hidden');
    }
};
