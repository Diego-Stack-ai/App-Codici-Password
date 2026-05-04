const CACHE_NAME = 'codex-v8.2-master';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'manifest.json',
    'favicon.ico',
    'assets/css/core.css?v=5.0',
    'assets/css/core_ui.css?v=5.1',
    'assets/css/core_fonts.css',
    'assets/css/core_fascie.css',
    'assets/js/main.js',
    'assets/js/theme-init.js',
    'assets/js/dom-utils.js',
    'assets/images/app-icon.jpg'
];

// Install Event: Pre-cache essential shell
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Pre-caching app shell');
            for (const asset of ASSETS_TO_CACHE) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.error('[SW] Failed to cache:', asset, err);
                }
            }
        })
    );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
    // 🛡️ PROTOCOLLO SICUREZZA SW: Filtra schemi non supportati (es. chrome-extension, mailto)
    if (!event.request.url.startsWith('http')) return;

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Strategia specifica per le pagine HTML (Network First)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Per tutto il resto: Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Se fallisce il network (offline), restituiamo quello che abbiamo
                    return response;
                });
                return response || fetchPromise;
            });
        })
    );
});

// Listener per messaggi (es. forza aggiornamento)
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
