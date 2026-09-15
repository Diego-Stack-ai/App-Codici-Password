import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('./emulator-cold-sw.js', import.meta.url), 'utf8');
function fixture(origin = 'http://127.0.0.1:4188') {
    const listeners = {}, added = [];
    const cache = {addAll: async paths => added.push(...paths), match: async () => 'cached-static'};
    runInNewContext(source, {URL, self: {location: {origin}, addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: async () => {}, clients: {claim: async () => {}}}, caches: {open: async () => cache}, fetch: async () => 'network-static'});
    return {listeners, added};
}
test('cold laboratory worker rejects nonlocal origin', () => {
    assert.throws(() => fixture('https://appcodici-password.web.app'), /LOCAL_EMULATOR_ONLY/);
});
test('cold laboratory installation caches only the exact static allowlist', async () => {
    const {listeners, added} = fixture();
    let installed;
    listeners.install({waitUntil: promise => { installed = promise; }});
    await installed;
    assert.deepEqual(added, ['/assets/js/vendor/qrcode.min.js', '/', '/emulator.js', '/emulator.css', '/entry-check.mjs', '/symbols.woff2', '/assets/images/google-avatar.png']);
});
test('cold laboratory worker never intercepts API, query, foreign or write requests', async () => {
    const {listeners} = fixture();
    for (const [method, url] of [['POST', 'http://127.0.0.1:4188/'], ['GET', 'http://127.0.0.1:9099/emulator.js'],
        ['GET', 'http://127.0.0.1:4188/emulator.js?token=x'], ['GET', 'http://127.0.0.1:4188/demo-vault-shell/europe-west1/applyPrivateAccountMutation'],
        ['GET', 'http://127.0.0.1:8085/v1/projects/demo-vault-shell/databases/(default)/documents'], ['GET', 'http://127.0.0.1:4188/never-cached']]) {
        listeners.fetch({request: {method, url}, respondWith: () => assert.fail(`intercepted ${method} ${url}`)});
    }
    let response;
    listeners.fetch({request: {method: 'GET', url: 'http://127.0.0.1:4188/'}, respondWith: promise => { response = promise; }});
    assert.equal(await response, 'cached-static');
});
