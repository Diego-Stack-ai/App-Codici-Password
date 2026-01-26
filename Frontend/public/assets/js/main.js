/**
 * TITANIUM MAIN ENTRY POINT
 * Coordina l'inizializzazione dei moduli UI dell'applicazione.
 */

import { initLockedUX } from './ui-core.js';
import { setupPasswordToggles, setupCopyButtons, setupCallButtons } from './ui-components.js';
import { setupAccountCards, setupEditMode, setupAccountDetailView, setupCopyQrCode } from './ui-pages.js';

/**
 * INITIALIZATION
 * Attiva tutte le funzionalità globali al caricamento del DOM.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showSecuritySetupModal } from './security-setup.js';

/**
 * INITIALIZATION
 * Attiva tutte le funzionalità globali al caricamento del DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Policy UX (Lockdown menu/selezione)
    initLockedUX();

    // 2. Componenti Universali (Toggles, Copy, Call)
    setupPasswordToggles();
    setupCopyButtons();
    setupCallButtons();

    // 3. Logiche specifiche di pagina (Attivate solo se gli elementi esistono)
    setupAccountCards();
    setupEditMode();
    setupAccountDetailView();
    setupCopyQrCode();

    // 4. GLOBAL SECURITY CHECK
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const currentPage = window.location.pathname.split('/').pop();
            // Evitiamo il modal nelle pagine di login/registrazione
            const authPages = ['index.html', 'registrati.html', 'reset_password.html'];
            if (authPages.includes(currentPage) || currentPage === '') return;

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

    console.log("Titanium Framework Initialized (v10.1)");
});
