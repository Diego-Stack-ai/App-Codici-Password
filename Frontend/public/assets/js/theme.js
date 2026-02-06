/**
 * THEME MANAGER MODULE (Wrapper)
 * Delega tutta la logica a core.js v2.2
 */

export function applyTheme() {
    // La logica è automatica in core.js
    if (window.ProtocolloBaseTheme) {
        window.ProtocolloBaseTheme.applyLogic();
    }
}

export function setTheme(mode) {
    if (window.ProtocolloBaseTheme) {
        window.ProtocolloBaseTheme.setMode(mode);
    } else {
        // Fallback nel caso titanium-core non sia caricato (non dovrebbe succedere)
        localStorage.setItem('theme', mode);
        location.reload();
    }
}
