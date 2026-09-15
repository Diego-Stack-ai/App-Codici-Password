// Disposable laboratory only: exact static assets, never Auth/Firestore,
// callable responses, decrypted records or Vault material.
if (self.location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
const cacheName = 'synthetic-vault-cold-assets-v1';
const assets = ['/', '/emulator.js', '/emulator.css', '/entry-check.mjs', '/symbols.woff2', '/assets/images/google-avatar.png'];
self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets);
    await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !assets.includes(url.pathname)) return;
    event.respondWith((async () => (await (await caches.open(cacheName)).match(event.request)) || fetch(event.request))());
});
