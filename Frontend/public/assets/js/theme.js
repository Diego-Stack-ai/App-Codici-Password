/**
 * THEME MANAGER MODULE
 * Gestisce il tema (light/dark) dell'applicazione in modo centralizzato.
 */

/**
 * Applica il tema basandosi sulle preferenze salvate o di sistema.
 */
export function applyTheme() {
    const pref = localStorage.getItem('theme');
    // Logica: se 'dark', OPPURE (non è 'light' E la preferenza di sistema è dark)
    const isDark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/**
 * Imposta manualmente il tema e lo salva nel localStorage.
 * @param {string} mode - 'light' o 'dark'
 */
export function setTheme(mode) {
    localStorage.setItem('theme', mode);
    applyTheme();
}

// Auto-run immediata per evitare FOUC (Flash of Unstyled Content) se importato come modulo
// Nota: Funziona meglio se lo script è nel <head> o subito all'inizio del body.
applyTheme();
