// Protezione transitoria contro componenti rimasti in una vecchia cache:
// impedisce che assegnare la versione a <html> cancelli l'intera pagina.
(() => {
    const root = document.documentElement;
    if (new URLSearchParams(window.location.search).get('visual') === 'ab532e2') {
        root.classList.add('legacy-home-comparison');
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
