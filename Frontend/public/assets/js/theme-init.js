// Anti-flicker & Theme Master (V5.0) - Auto Italy-Time Aware
// Loaded synchronously in <head> to prevent FOUC (Flash of Unstyled Content)

(function () {
    try {
        // Se la pagina richiede il Dark Forzato (es. Login/Registrazione), non toccare nulla
        if (document.documentElement.classList.contains('protocol-forced-dark')) {
            document.documentElement.classList.add('dark');
            return;
        }

        const localTheme = localStorage.getItem('theme') || 'auto';
        let isDark = false;

        if (localTheme === 'dark') {
            isDark = true;
        } else if (localTheme === 'light') {
            isDark = false;
        } else {
            // LOGICA AUTO (Orario Italia)
            // Light dalle 08:00 alle 20:59, Dark altrimenti (Sera/Mattina)
            try {
                const italyTime = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    hour12: false,
                    timeZone: 'Europe/Rome'
                }).format(new Date());

                const hour = parseInt(italyTime);
                // Giorno: 08:00 - 20:59. Sera/Notte: 21:00 - 07:59
                isDark = (hour < 8 || hour >= 21);
            } catch (e) {
                // Fallback se Intl fallisce
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        }

        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch (e) {
        console.warn('Theme init failed', e);
    }
})();
