/**
 * TITANIUM CORE ENGINE v1.0
 * Gestione centralizzata di Tema, Font, Protezioni e Meta-tag.
 * Da caricare nell' <head> in modo sincrono.
 */

(function () {
    // 1. CARICAMENTO TEMA (Anti-Flicker - Regola 3)
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (savedTheme === 'auto' && systemDark);

    if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = "#0a0f1e"; // Colore critico immediato
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = "#f0f4f8";
    }

    // 2. INIEZIONE ASSET DINAMICI (Pulizia HTML - Regola 21)
    function injectAssets() {
        const head = document.head;

        // Meta Theme Color (Regola 1)
        const metaTheme = document.createElement('meta');
        metaTheme.name = "theme-color";
        metaTheme.content = isDark ? "#0a0f1e" : "#f0f4f8";
        head.appendChild(metaTheme);

        // Google Fonts (Manrope)
        const fontLink1 = document.createElement('link');
        fontLink1.rel = "preconnect";
        fontLink1.href = "https://fonts.googleapis.com";
        head.appendChild(fontLink1);

        const fontLink2 = document.createElement('link');
        fontLink2.rel = "preconnect";
        fontLink2.href = "https://fonts.gstatic.com";
        fontLink2.crossOrigin = "anonymous";
        head.appendChild(fontLink2);

        const fontMain = document.createElement('link');
        fontMain.rel = "stylesheet";
        fontMain.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap";
        head.appendChild(fontMain);

        // Material Symbols
        const symbols = document.createElement('link');
        symbols.rel = "stylesheet";
        symbols.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
        head.appendChild(symbols);
    }

    // 3. PROTEZIONI UI (Native App Feel - Regola 23)
    function applyProtections() {
        // Disabilita menu contestuale (tasto destro) eccetto su input/textarea
        document.addEventListener('contextmenu', (e) => {
            if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
            }
        }, false);

        // Impedisce il trascinamento delle immagini
        document.addEventListener('dragstart', (e) => {
            if (e.target.tagName === 'IMG') e.preventDefault();
        }, false);
    }

    // Esecuzione immediata per il tema
    // Iniezione asset e protezioni al caricamento del DOM
    // 3. TITANIUM STEALTH (Anti-FOUC & Smooth Reveal)
    const style = document.createElement('style');
    style.innerHTML = `body { opacity: 0; transition: opacity 0.4s ease-out; will-change: opacity; }`;
    document.head.appendChild(style);

    // Funzione di reveal
    const revealContent = () => {
        requestAnimationFrame(() => {
            setTimeout(() => { document.body.style.opacity = '1'; }, 100);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectAssets();
            applyProtections();
            revealContent(); // Reveal
        });
    } else {
        injectAssets();
        applyProtections();
        revealContent(); // Reveal
    }
})();
