const CACHE_NAME = 'codex-v1.2.7-device-recovery';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'manifest.json',
    'assets/css/core.css?v=5.1',
    'assets/css/core_ui.css?v=5.1',
    'assets/css/core_fonts.css',
    'assets/css/core_fascie.css',
    'assets/css/core_pagine.css?v=5.0',
    'assets/css/home_page.css?v=5.0',
    'assets/css/accesso.css?v=5.0',
    'assets/js/main.js',
    'assets/js/main.js?v=1.1.4',
    'assets/js/env.js',
    'assets/js/components.js',
    'assets/js/auth.js',
    'assets/js/modules/auth/login.js',
    'assets/js/modules/core/mfa-manager.js',
    'assets/js/theme-init.js',
    'assets/js/modules/core/security-manager.js',
    'assets/js/modules/core/vault-session.js',
    'assets/js/inactivity-timer.js',
    'assets/js/modules/core/webauthn-manager.js',
    'assets/js/modules/core/crypto-utils.js',
    'assets/js/firebase-config.js',
    'assets/js/ui-core.js',
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

    // ⚡ Skip richieste verso domini esterni (CDN, Firebase SDK, Google APIs)
    // Il SW gestisce solo asset locali — i CDN hanno propria cache HTTP
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // Strategia specifica per le pagine HTML (Network First)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return networkResponse;
            }).catch(async () => {
                return await caches.match(event.request) || await caches.match('index.html');
            })
        );
        return;
    }

    // Gli asset eseguibili e gli stili devono essere coerenti con l'HTML appena pubblicato.
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
                }
                return networkResponse;
            }).catch(async () => {
                return await caches.match(event.request) || await caches.match(event.request, { ignoreSearch: true });
            })
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
