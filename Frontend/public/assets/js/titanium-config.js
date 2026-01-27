/**
 * TITANIUM CONFIG
 * Questo file DEVE essere caricato PRIMA del CDN di Tailwind.
 * Serve a forzare la modalità 'class' impedendo a Tailwind di 
 * applicare automaticamente il tema del sistema operativo.
 */
window.tailwind = {
    config: {
        darkMode: 'class', // BLINDATURA: Ignora preferenza sistema, usa solo classi HTML
        theme: {
            extend: {
                colors: {
                    // Qui potremmo estendere la palette Titanium se necessario
                }
            }
        }
    }
};
