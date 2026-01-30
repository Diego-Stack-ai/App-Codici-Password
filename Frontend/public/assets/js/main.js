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
import { initInactivityTimer } from './inactivity-timer.js';

// Inizializza il controllo inattività globalmente (SOSPESO TEMPORANEAMENTE PER SVILUPPO)
// initInactivityTimer();

/**
 * INITIALIZATION
 * Attiva tutte le funzionalità globali al caricamento del DOM.
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Policy UX (Lockdown menu/selezione)
    initLockedUX();

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

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    // Skip on Home Page to avoid race condition with home.js which loads them independently
    const pathName = window.location.pathname;
    const isHomePage = pathName.endsWith('home_page.html') || pathName.endsWith('/');
    if (!pathName.includes('home_page.html')) {
        loadSharedComponents();
    }

    console.log("Titanium Framework Initialized (v10.1)");
});

// --- HELPER: COMPONENT LOADER ---
async function loadSharedComponents() {
    const headerPh = document.getElementById('header-placeholder');
    if (headerPh) {
        try {
            const res = await fetch('assets/components/header.html');
            if (res.ok) {
                headerPh.innerHTML = await res.text();

                // AUTO-POPULATE HEADER if empty
                const headerContent = document.getElementById('header-content');
                if (headerContent && !headerContent.hasChildNodes()) {
                    const pageTitle = document.title.replace(' - App', '') || 'Titanium';
                    headerContent.innerHTML = `
                        <div class="flex items-center justify-between w-full h-16 px-4 relative">
                            <!-- Sinistra: Back -->
                            <div class="z-10">
                                <button onclick="window.history.back()" 
                                    class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10 text-white shadow-sm">
                                    <span class="material-symbols-outlined">arrow_back</span>
                                </button>
                            </div>

                            <!-- Centro: Titolo -->
                            <h1 class="absolute inset-0 flex items-center justify-center text-lg font-bold text-white tracking-wide pointer-events-none px-20 text-center truncate">
                                ${pageTitle}
                            </h1>

                            <!-- Destra: Home -->
                            <div class="z-10">
                                <a href="home_page.html" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all border border-white/10 text-white shadow-sm">
                                    <span class="material-symbols-outlined">home</span>
                                </a>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) { console.warn("Header load error", e); }
    }

    const footerPh = document.getElementById('footer-placeholder');
    if (footerPh) {
        try {
            const res = await fetch('assets/components/footer.html');
            if (res.ok) footerPh.innerHTML = await res.text();
        } catch (e) { console.warn("Footer load error", e); }
    }
}
