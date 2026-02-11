/**
 * PROTOCOLLO BASE MAIN ENTRY POINT (V4.4)
 * Coordina l'inizializzazione dei moduli UI dell'applicazione.
 * Refactor: Rimozione innerHTML, uso dom-utils.js, centralizzazione in components.js.
 */

// Conditional console override
(function () {
    try {
        const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) || window.NODE_ENV || document.documentElement.dataset.env || 'production';
        const originalConsoleLog = console.log && console.log.bind(console) || function () { };

        if (env === 'production') {
            window.LOG = function () { };
        } else {
            window.LOG = (...args) => originalConsoleLog(...args);
        }

        console.log = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.info = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.debug = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.trace = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.group = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.groupEnd = (...args) => { try { window.LOG(...args); } catch (e) { } };

        window.__APP_ENV = env;
    } catch (e) {
        window.LOG = function () { };
    }
})();

import { initLockedUX } from './ui-core.js';
import { setupPasswordToggles, setupCopyButtons, setupCallButtons } from './ui-components.js';
import { setupAccountCards, setupEditMode, setupAccountDetailView, setupCopyQrCode } from './ui-pages.js';
import { initCleanup } from './cleanup.js';
import { initComponents } from './components.js'; // Imports components system

/**
 * INITIALIZATION
 * Attiva tutte le funzionalità globali al caricamento del DOM.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';
import { createElement } from './dom-utils.js';
import { t, applyGlobalTranslations } from './translations.js';
import { showSecuritySetupModal } from './modules/core/security-setup.js';
import { initInactivityTimer } from './inactivity-timer.js';

// Inizializza il controllo inattività globalmente (SOSPESO TEMPORANEAMENTE PER SVILUPPO)
// initInactivityTimer();

document.addEventListener('DOMContentLoaded', () => {

    // 1. Policy UX (Lockdown menu/selezione)
    initLockedUX();
    initCleanup();

    // 2. Componenti Universali (Toggles, Copy, Call) - SALTA SU PAGINE AUTH
    const path = window.location.pathname.toLowerCase();
    const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
    const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

    if (!isAuthPage) {
        setupPasswordToggles();
        setupCopyButtons();
        setupCallButtons();
    }

    // 3. Logiche specifiche di pagina (Attivate solo se gli elementi esistono)
    setupAccountCards();
    setupEditMode();
    setupAccountDetailView();
    setupCopyQrCode();

    // 4. GLOBAL SECURITY & INVITE CHECK
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
        const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        if (isAuthPage) return;

        if (user) {
            try {
                // Security Check
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!userData?.security_setup_done) {
                        // showSecuritySetupModal(user, userData); // Temporarily disabled or handled elsewhere
                    }
                }

                // INVITE CHECK (GLOBAL)
                checkForPendingInvites(user.email);

            } catch (error) {
                console.error("Global Check Error:", error);
            }
        }
    });

    /**
     * INVITE SYSTEM (Global Receiver)
     */
    async function checkForPendingInvites(email) {
        if (!email) return;

        try {
            const q = query(collection(db, "invites"),
                where("recipientEmail", "==", email),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Processing one invite at a time
                const inviteDoc = snap.docs[0];
                const inviteData = inviteDoc.data();
                showInviteModal(inviteDoc.id, inviteData);
            }
        } catch (e) { console.error("CheckInvites", e); }
    }

    function showInviteModal(inviteId, data) {
        if (document.getElementById('invite-modal')) return;

        const modal = createElement('div', { id: 'invite-modal', className: 'modal-overlay active' }, [
            createElement('div', { className: 'modal-box' }, [
                createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-purple', textContent: 'mail' }),
                createElement('h3', { className: 'modal-title', textContent: t('invite_received_title') || 'Nuovo Invito' }),
                createElement('p', { className: 'modal-text', textContent: `${data.senderEmail} ${t('invite_received_msg') || 'ha condiviso un account con te:'}` }),
                createElement('p', { className: 'text-sm font-bold text-white mt-2 mb-4', textContent: data.accountName }),
                createElement('div', { className: 'modal-actions' }, [
                    createElement('button', {
                        className: 'btn-modal btn-secondary',
                        textContent: t('invite_reject') || 'Rifiuta',
                        onclick: () => handleInviteResponse(inviteId, 'rejected')
                    }),
                    createElement('button', {
                        className: 'btn-modal btn-primary',
                        textContent: t('invite_accept') || 'Accetta',
                        onclick: () => handleInviteResponse(inviteId, 'accepted')
                    })
                ])
            ])
        ]);
        document.body.appendChild(modal);
    }

    async function handleInviteResponse(inviteId, status) {
        const modal = document.getElementById('invite-modal');
        if (modal) modal.remove();

        try {
            await updateDoc(doc(db, "invites", inviteId), { status: status, respondedAt: new Date().toISOString() });
            showToast(status === 'accepted' ? "Invito accettato!" : "Invito rifiutato", status === 'accepted' ? 'success' : 'info');

            if (status === 'accepted') {
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (e) { console.error("InviteResponse", e); showToast(t('error_generic'), 'error'); }
    }

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    // Utilizziamo initComponents che gestisce Auth/App logic internamente
    // Skip on Home Page to avoid double loading if home.js does it (home.js actually relies on main usually, but initComponents handles checks)
    const pathName = window.location.pathname;
    const isHomePage = pathName.endsWith('home_page.html') || pathName.endsWith('/');

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    initComponents();

    // 6. TRADUZIONE & REVEAL (V3.9 Protocol)
    // Applica le traduzioni a tutti i data-t e imposta data-i18n="ready"
    applyGlobalTranslations();

    console.log("PROTOCOLLO BASE Initialized (v4.4)");

    // Force reveal content to avoid black screen (Backup Safety)
    setTimeout(() => document.body.classList.add('revealed'), 100);
});
