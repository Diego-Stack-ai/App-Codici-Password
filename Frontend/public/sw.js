const CACHE_NAME = 'codex-shell-v1.2.83';
const APP_CACHE_PREFIX = 'codex-';

importScripts('./offline-assets.js');

// Manifest generato dalla build: tutte le pagine e dipendenze statiche della
// release sono disponibili senza richiedere che l'utente le visiti prima.
const APP_SHELL = self.__OFFLINE_ASSETS || [];
const APP_SHELL_PATHS = new Set(APP_SHELL.map(asset => `/${asset.replace(/^\.\//, '')}`));

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(APP_SHELL.map(async (asset) => {
            const response = await fetch(asset, { cache: 'reload' });
            if (!response.ok) throw new Error(`Risorsa offline non disponibile: ${asset}`);
            await cache.put(asset, response);
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
    const exact = await cache.match(request) || await cache.match(new URL(request.url).pathname.slice(1));
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

    // I contenuti protetti e aggiornabili non devono mai essere conservati
    // nella cache della PWA. La richiesta mantiene così Authorization e
    // raggiunge sempre l'endpoint, che restituisce Cache-Control: no-store.
    if (url.pathname === '/protected-media/presentation') return;

    // Solo le risorse dichiarate nella shell possono entrare nella Cache API.
    // Evita di conservare accidentalmente future risposte private same-origin.
    if (!APP_SHELL_PATHS.has(url.pathname)) return;

    // HTML: sempre rete prima; offline usa la pagina esatta o la shell corretta.
    if (request.mode === 'navigate') {
        event.respondWith(fetchAndCache(request).catch(() => navigationFallback(request)));
        return;
    }

    // Codice e stili: rete prima, fallback solo sulla stessa URL completa.
    // Non usiamo ignoreSearch: una query diversa identifica una release diversa.
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(fetchAndCache(request).catch(async () => {
            return (await caches.match(request)) ||
                (await caches.match(url.pathname.slice(1))) || Response.error();
        }));
        return;
    }

    // Immagini e manifest: cache prima con aggiornamento in background.
    event.respondWith((async () => {
        const cached = await caches.match(request) || await caches.match(url.pathname.slice(1));
        const network = fetchAndCache(request).catch(() => null);
        return cached || (await network) || Response.error();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
