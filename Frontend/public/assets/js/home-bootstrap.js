// Protezione transitoria contro componenti rimasti in una vecchia cache:
// impedisce che assegnare la versione a <html> cancelli l'intera pagina.
(() => {
    const root = document.documentElement;
    const visualMode = new URLSearchParams(window.location.search).get('visual');
    if (visualMode === 'ab532e2') {
        root.classList.add('legacy-home-comparison');
    }
    if (visualMode === 'fog-v2') {
        root.classList.add('fog-home-comparison');
    }
    if (visualMode === 'ab532e2' || visualMode === 'fog-v2') {
        const comparisonStylesheet = document.createElement('link');
        comparisonStylesheet.rel = 'stylesheet';
        comparisonStylesheet.href = 'assets/css/home_confronto_legacy.css?fix=3';
        document.head.appendChild(comparisonStylesheet);
    }
    const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (!descriptor) return;

    Object.defineProperty(root, 'textContent', {
        configurable: true,
        get() { return descriptor.get.call(root); },
        set(value) {
            if (/^v?\d+\.\d+\.\d+$/.test(String(value).trim())) {
                root.dataset.appVersion = String(value).trim();
                return;
            }
            descriptor.set.call(root, value);
        }
    });
})();
