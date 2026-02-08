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
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showSecuritySetupModal } from './modules/core/security-setup.js';
import { initInactivityTimer } from './inactivity-timer.js';

// Inizializza il controllo inattività globalmente (SOSPESO TEMPORANEAMENTE PER SVILUPPO)
// initInactivityTimer();

document.addEventListener('DOMContentLoaded', () => {

    // 1. Policy UX (Lockdown menu/selezione)
    initLockedUX();
    initCleanup();

    // 2. Componenti Universali (Toggles, Copy, Call) - SALTA SU PAGINE AUTH
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
    const isAuthPage = authPages.includes(currentPage);

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

    // 4. GLOBAL SECURITY CHECK
    onAuthStateChanged(auth, async (user) => {
        if (isAuthPage) return; // Non eseguire logiche app-wide su index/registrati

        if (user) {
            const currentPage = window.location.pathname.split('/').pop();
            const excludePages = ['index.html', 'registrati.html', 'reset_password.html'];
            if (excludePages.includes(currentPage) || currentPage === '') return;

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!userData.security_setup_done) {
                        showSecuritySetupModal(user, userData);
                    }
                }
            } catch (error) {
                console.error("Global Security Check Error:", error);
            }
        }
    });

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    // Utilizziamo initComponents che gestisce Auth/App logic internamente
    // Skip on Home Page to avoid double loading if home.js does it (home.js actually relies on main usually, but initComponents handles checks)
    const pathName = window.location.pathname;
    const isHomePage = pathName.endsWith('home_page.html') || pathName.endsWith('/');

    // initComponents handles checks for existing placeholders.
    // However, if home.js handles heavily custom header logic, we might need coordination.
    // Based on previous code, main.js was responsible for loading components unless specifically excluded.
    // We entrust initComponents to do the right thing based on placeholder existence.
    initComponents();

    console.log("PROTOCOLLO BASE Initialized (v4.4)");
});
