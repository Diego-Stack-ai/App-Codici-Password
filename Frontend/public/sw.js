const CACHE_NAME = 'codex-shell-v1.2.5';
const APP_CACHE_PREFIX = 'codex-';

// Shell minima coerente con la release corrente. Le pagine visitate e i
// relativi asset vengono aggiunti a runtime, senza toccare IndexedDB/Firestore.
const APP_SHELL = [
    'login-v115.html',
    'home_page.html',
    'manifest.json?v=5.0',
    'assets/images/app-icon.jpg',
    'assets/css/core.css?v=5.1',
    'assets/css/core_ui.css?v=5.1',
    'assets/css/core_fonts.css',
    'assets/css/core_fascie.css',
    'assets/css/core_pagine.css?v=5.0',
    'assets/css/home_page.css?v=5.0',
    'assets/css/accesso.css?v=5.0',
    'assets/js/theme-init.js',
    'assets/js/login-entry.js?v=1.3.2',
    'assets/js/main-v129.js',
    'assets/js/components-v129.js',
    'assets/js/ui-core-v129.js',
    'assets/js/env-v126.js',
    'assets/js/firebase-config.js?v=1.1.8',
    'assets/js/auth.js?v=1.3.2',
    'assets/js/modules/auth/login.js?v=1.3.2',
    'assets/js/modules/core/mfa-manager.js',
    'assets/js/modules/core/security-manager.js',
    'assets/js/modules/core/security-setup.js',
    'assets/js/modules/core/vault-session.js',
    'assets/js/modules/core/webauthn-manager.js',
    'assets/js/modules/core/crypto-utils.js',
    'assets/js/modules/core/password-policy.js',
    'assets/js/inactivity-timer.js',
    'assets/js/pages-init.js?v=1.2.5',
    'assets/js/modules/home/home.js?v=1.2.5',
    'assets/js/translations.js',
    'assets/js/dom-utils.js',
    'assets/js/logger.js',
    'assets/js/footer-state.js',
    'assets/js/ui-components.js',
    'assets/js/ui-pages.js',
    'assets/js/cleanup.js',
    'assets/js/utils.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(APP_SHELL.map(async (asset) => {
            const response = await fetch(asset, { cache: 'reload' });
            if (response.ok) await cache.put(asset, response);
        }));
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith(APP_CACHE_PREFIX) && name !== CACHE_NAME)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

async function fetchAndCache(request) {
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    }
    return response;
}

async function navigationFallback(request) {
    const cache = await caches.open(CACHE_NAME);
    const exact = await cache.match(request);
    if (exact) return exact;

    const url = new URL(request.url);
    const isHome = url.pathname === '/home' || url.pathname.endsWith('/home_page.html');
    return (await cache.match(isHome ? 'home_page.html' : 'login-v115.html')) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // HTML: sempre rete prima; offline usa la pagina esatta o la shell corretta.
    if (request.mode === 'navigate') {
        event.respondWith(fetchAndCache(request).catch(() => navigationFallback(request)));
        return;
    }

    // Codice e stili: rete prima, fallback solo sulla stessa URL completa.
    // Non usiamo ignoreSearch: una query diversa identifica una release diversa.
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(fetchAndCache(request).catch(async () => {
            return (await caches.match(request)) || Response.error();
        }));
        return;
    }

    // Immagini e manifest: cache prima con aggiornamento in background.
    event.respondWith((async () => {
        const cached = await caches.match(request);
        const network = fetchAndCache(request).catch(() => null);
        return cached || (await network) || Response.error();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
