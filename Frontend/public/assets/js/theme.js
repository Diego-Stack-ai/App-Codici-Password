/**
 * THEME MANAGER MODULE (Wrapper)
 * Delega tutta la logica a titanium-core.js v2.2
 */

export function applyTheme() {
    // La logica è automatica in titanium-core.js
    if (window.TitaniumTheme) {
        window.TitaniumTheme.applyLogic();
    }
}

export function setTheme(mode) {
    if (window.TitaniumTheme) {
        window.TitaniumTheme.setMode(mode);
    } else {
        // Fallback nel caso titanium-core non sia caricato (non dovrebbe succedere)
        localStorage.setItem('theme', mode);
        location.reload();
    }
}
