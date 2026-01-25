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

    console.log("Titanium Framework Initialized (v10.0)");
});
