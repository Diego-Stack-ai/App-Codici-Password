// Protezione transitoria contro componenti rimasti in una vecchia cache:
// impedisce che assegnare la versione a <html> cancelli l'intera pagina.
(() => {
    const root = document.documentElement;
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
