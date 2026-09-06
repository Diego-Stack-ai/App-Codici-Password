const frame = document.getElementById('legacy-home-frame');

frame?.addEventListener('load', () => {
    try {
        const frameDocument = frame.contentDocument;
        if (!frameDocument || frameDocument.querySelector('[data-legacy-bars-comparison]')) return;

        const stylesheet = frameDocument.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = 'assets/css/home_confronto_legacy.css';
        stylesheet.dataset.legacyBarsComparison = 'ab532e2';
        frameDocument.head.appendChild(stylesheet);
    } catch (error) {
        console.error('[Confronto Home] Impossibile applicare lo stile storico.', error);
    }
});
