import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';
const site = new URL('./dist/site/', import.meta.url);
const expected = ['app.mjs', 'assets/images/google-avatar.png', 'fixture.mjs', 'index.html', 'memory-vault.mjs', 'real-lists.mjs', 'router.mjs', 'style.css', 'sw.js', 'symbols.woff2'].sort();

test('Hosting preview includes exactly ten fixture files and no backend configuration', async () => {
    async function walk(directory, prefix = '') {
        const groups = await Promise.all((await readdir(directory, {withFileTypes: true})).map(entry => {
            const name = prefix + entry.name;
            return entry.isDirectory() ? walk(new URL(entry.name + '/', directory), name + '/') : [name];
        }));
        return groups.flat();
    }
    assert.deepEqual((await walk(site)).sort(), expected);
    const config = JSON.parse(await readFile(new URL('./firebase.preview.json', import.meta.url), 'utf8'));
    assert.deepEqual(Object.keys(config), ['hosting']);
    assert.equal(config.hosting.public, 'dist/site');
    const bundle = await readFile(new URL('real-lists.mjs', site), 'utf8');
    assert.doesNotMatch(bundle, /appcodici-password|firebaseapp\.com|firestore\.googleapis|firebase-config/);
});

test('worker precaches only fixture assets and ignores POST, foreign origins and API requests', async () => {
    const handlers = {}, stored = [];
    const context = vm.createContext({
        URL,
        self: {location: {origin: 'https://preview.invalid'}, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {}, clients: {claim() {}}},
        caches: {open: async () => ({addAll: async files => stored.push(...files), match: async path => 'cached:' + path})},
        fetch() { throw new Error('Network must not be used for cached assets'); }
    });
    vm.runInContext(await readFile(new URL('sw.js', site), 'utf8'), context);
    let installing;
    handlers.install({waitUntil: promise => { installing = promise; }});
    await installing;
    assert.deepEqual(stored.sort(), expected.filter(name => name !== 'sw.js').map(name => '/' + name).sort());
    for (const [url, method] of [
        ['https://other.invalid/index.html', 'GET'], ['https://preview.invalid/api/accounts', 'GET'],
        ['https://preview.invalid/app.mjs', 'POST'], ['https://preview.invalid/?secret=test', 'GET']
    ]) {
        handlers.fetch({request: {url, method}, respondWith() { assert.fail('Unexpected intercepted request'); }});
    }
    let response;
    handlers.fetch({request: {url: 'https://preview.invalid/', method: 'GET'}, respondWith: promise => { response = promise; }});
    assert.equal(await response, 'cached:/index.html');
});
