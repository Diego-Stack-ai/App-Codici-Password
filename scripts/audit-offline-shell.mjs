import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicDir = path.join(root, 'Frontend', 'public');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
}

const files = await walk(publicDir);
const textFiles = files.filter(file => /\.(?:html|js|css|json)$/i.test(file));
const offlineSource = await readFile(path.join(publicDir, 'offline-assets.js'), 'utf8');
const assets = JSON.parse(offlineSource.match(/=\s*(\[[\s\S]*\]);?\s*$/)?.[1] || '[]');
const assetSet = new Set(assets);
const serviceWorker = await readFile(path.join(publicDir, 'sw.js'), 'utf8');
const loginEntry = await readFile(path.join(publicDir, 'assets/js/login-entry.js'), 'utf8');

assert.ok(assets.length >= 150, `Shell offline incompleta: solo ${assets.length} risorse`);
for (const file of files) {
  const relative = path.relative(publicDir, file).replaceAll('\\', '/');
  if (/\.(?:html|js|css|json|png|jpe?g|svg|webp|woff2)$/i.test(relative) && relative !== 'sw.js') {
    assert.ok(assetSet.has(relative), `Risorsa statica non precaricata: ${relative}`);
  }
}

for (const file of textFiles.filter(file => !file.includes(`${path.sep}vendor${path.sep}`))) {
  const source = await readFile(file, 'utf8');
  assert.doesNotMatch(source, /https:\/\/www\.gstatic\.com\/firebasejs\//,
    `Dipendenza Firebase remota in ${path.relative(root, file)}`);
  if (file.endsWith('.js') && !file.endsWith('offline-firestore.js')) {
    assert.doesNotMatch(source, /import\s*\{[^}]*\bgetDocs?\b[^}]*\}\s*from\s*["']\/assets\/js\/vendor\/firebase-runtime\.js["']/,
      `Lettura Firestore senza percorso cache-first in ${path.relative(root, file)}`);
  }
}

assert.ok((await stat(path.join(publicDir, 'assets/js/vendor/firebase-runtime.js'))).size > 500_000,
  'Runtime Firebase browser locale assente o incompleto');
assert.ok((await stat(path.join(publicDir, 'assets/js/vendor/firebase-sw-runtime.js'))).size > 50_000,
  'Runtime Firebase del Service Worker assente o incompleto');
assert.match(serviceWorker, /importScripts\('\.\/assets\/js\/vendor\/firebase-sw-runtime\.js'\)/);
assert.match(serviceWorker, /Promise\.all\(APP_SHELL/);
assert.match(serviceWorker, /APP_SHELL_PATHS\.has\(url\.pathname\)/);
assert.match(serviceWorker, /protected-media\/presentation/);
assert.match(loginEntry, /serviceWorker\.register\('\.\/sw\.js'\)/);
assert.ok(assetSet.has('assets/js/offline-firestore.js'), 'Adattatore Firestore offline non precaricato');

console.log(`Shell offline verificata: ${assets.length} risorse locali, nessuna dipendenza Firebase CDN.`);
