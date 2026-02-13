// Anti-flicker & Theme Master (V3.9) - Forced Dark Awareness
// Loaded synchronously in <head> to prevent FOUC (Flash of Unstyled Content)

(function () {
    try {
        // Se la pagina richiede il Dark Forzato (es. Login/Registrazione), non toccare nulla
        if (document.documentElement.classList.contains('protocol-forced-dark')) {
            document.documentElement.classList.add('dark'); // Assicura che sia presente
            return; // Esci e ignora preferenze utente
        }

        // Logica standard per le altre pagine (Home, Impostazioni, etc.)
        const localTheme = localStorage.getItem('theme');
        const sysTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (localTheme === 'dark' || (!localTheme && sysTheme)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch (e) {
        console.warn('Theme init failed', e);
    }
})();
