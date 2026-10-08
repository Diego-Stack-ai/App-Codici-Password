import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import './build.mjs';

// Only the explicitly listed fixture assets may enter the Hosting preview.
const files = new Map(['index.html', 'style.css', 'app.mjs', 'memory-vault.mjs', 'router.mjs', 'fixture.mjs'].map(name => [name, name]));
files.set('real-lists.mjs', 'dist/real-lists.mjs');
files.set('symbols.woff2', '../../Frontend/public/assets/fonts/material-symbols/material-symbols-0.woff2');
files.set('assets/images/google-avatar.png', '../../Frontend/public/assets/images/google-avatar.png');
const hash = createHash('sha256');
for (const [name, source] of files) {
    const data = await readFile(new URL(source, import.meta.url));
    const target = new URL(`dist/site/${name}`, import.meta.url);
    await mkdir(new URL('./', target), {recursive: true});
    await writeFile(target, data);
    hash.update(name).update(data);
}
const cache = `vault-shell-lab-${hash.digest('hex').slice(0, 16)}`;
const worker = `const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify([...files.keys()].map(name => '/' + name))};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('vault-shell-lab-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !FILES.includes(path)) return;
    event.respondWith(caches.open(CACHE).then(cache => cache.match(path)).then(response => response || fetch(event.request)));
});
`;
await writeFile(new URL('dist/site/sw.js', import.meta.url), worker);
console.log(`Anteprima pronta: nove asset fittizi + worker, cache ${cache}. Nessun deploy eseguito.`);
