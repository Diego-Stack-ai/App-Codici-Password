import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createMemoryVault} from './memory-vault.mjs';
import {createRouter} from './router.mjs';
import {createFixture, decryptRecord} from './fixture.mjs';

function deferred() {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return {promise, resolve};
}
const fakeVault = options => createMemoryVault({unlockKey: async () => ({}), decryptRecord: async () => 'fixture', ...options});

test('synthetic ciphertext is readable across two views with one unlock; key is non-extractable', async () => {
    const f = await createFixture();
    let unlocks = 0;
    const vault = createMemoryVault({unlockKey: async () => {
        unlocks++;
        const key = await f.unlockKey();
        assert.equal(key.extractable, false);
        return key;
    }, decryptRecord});
    const texts = [];
    const router = createRouter({routes: Object.fromEntries(['overview', 'account'].map(name => [name, async () => {
        texts.push(await vault.read('demo-user', f.records[name]));
    }]))});
    await vault.unlock('demo-user');
    await router.navigate('overview');
    await router.navigate('account');
    await router.navigate('overview');
    assert.equal(unlocks, 1);
    assert.match(texts[1], /DEMO-2076/);
    assert.equal(texts[0], texts[2]);
    assert.equal(vault.key, undefined);
});

for (const reason of ['manual', 'logout', 'pagehide', 'pageshow']) {
    test(`${reason} denies subsequent reads and cancels in-flight decryption`, async () => {
        const pending = deferred();
        const vault = fakeVault({decryptRecord: () => pending.promise});
        await vault.unlock('a');
        const reading = vault.read('a', {});
        const rejected = assert.rejects(reading, /VAULT_LOCKED/);
        vault.lock(reason);
        pending.resolve('must-not-return');
        await rejected;
        await assert.rejects(vault.read('a', {}), /VAULT_LOCKED/);
    });
}

test('new document starts locked, even when the previous document was unlocked', async () => {
    const original = fakeVault();
    await original.unlock('a');
    const refreshed = fakeVault();
    assert.equal(refreshed.isUnlocked(), false);
    await assert.rejects(refreshed.read('a', {}), /VAULT_LOCKED/);
});

test('timeout is checked on access and cannot be extended after expiry', async () => {
    let time = 100;
    const vault = fakeVault({now: () => time, timeoutMs: 20});
    await vault.unlock('a');
    time = 120;
    vault.touch();
    assert.equal(vault.isUnlocked(), false);
    await assert.rejects(vault.read('a', {}), /VAULT_LOCKED/);
});

test('changing UID invalidates the old key and pending unlock', async () => {
    const pending = deferred();
    const vault = fakeVault({unlockKey: owner => owner === 'a' ? pending.promise : Promise.resolve({})});
    const unlocking = vault.unlock('a');
    const rejected = assert.rejects(unlocking, /UNLOCK_CANCELLED/);
    await vault.unlock('b');
    pending.resolve({});
    await rejected;
    await assert.rejects(vault.read('a', {}), /VAULT_LOCKED/);
    assert.equal(await vault.read('b', {}), 'fixture');
});

test('route transitions abort listeners and dispose the previous view exactly once', async () => {
    let cleanups = 0, events = 0;
    const target = new EventTarget();
    const mount = ({signal}) => {
        target.addEventListener('change', () => events++, {signal});
        return () => cleanups++;
    };
    const router = createRouter({routes: {overview: mount, account: mount}});
    for (const route of ['overview', 'account', 'overview']) await router.navigate(route);
    target.dispatchEvent(new Event('change'));
    assert.equal(events, 1);
    assert.equal(cleanups, 2);
    router.stop(); router.stop();
    target.dispatchEvent(new Event('change'));
    assert.equal(events, 1);
    assert.equal(cleanups, 3);
});

test('an async view that finishes after navigation is aborted and disposed', async () => {
    const pending = deferred();
    let oldSignal, cleanups = 0;
    const router = createRouter({routes: {
        overview: async ({signal}) => { oldSignal = signal; await pending.promise; return () => cleanups++; },
        account: () => () => {}
    }});
    const navigating = router.navigate('overview');
    await router.navigate('account');
    assert.equal(oldSignal.aborted, true);
    pending.resolve(); await navigating;
    assert.equal(cleanups, 1);
});

test('unknown routes cannot load arbitrary modules or external URLs', async () => {
    let visits = 0;
    const router = createRouter({routes: {overview: () => { visits++; }}});
    await router.navigate('https://example.invalid/');
    await router.navigate('__proto__');
    assert.equal(visits, 2);
});

test('prototype runtime has no storage, network API, real Firebase imports or public-shell integration', async () => {
    for (const name of ['memory-vault.mjs', 'router.mjs', 'fixture.mjs', 'app.mjs']) {
        const source = await readFile(new URL(name, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|\bfetch\s*\(|XMLHttpRequest|WebSocket|firebase-config|security-manager\.js/);
    }
    const publicRoot = new URL('../../Frontend/public/', import.meta.url);
    async function walk(directory) {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            if (entry.name === 'vendor') continue;
            const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
            if (entry.isDirectory()) await walk(url);
            else if (/\.(?:js|html|json)$/.test(entry.name)) {
                assert.doesNotMatch(await readFile(url, 'utf8'), /persistent-vault-shell/, url.pathname);
            }
        }
    }
    await walk(publicRoot);
});
