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

test('encryption requires the unlocked owner, a nonempty string and an explicit capability', async () => {
    let calls = 0;
    const vault = fakeVault({encryptValue: async (_, value) => { calls++; return `cipher:${value}`; }});
    await assert.rejects(vault.encrypt('a', 'fixture'), /VAULT_LOCKED/);
    await vault.unlock('a');
    await assert.rejects(vault.encrypt('b', 'fixture'), /VAULT_LOCKED/);
    for (const value of ['', null, undefined, 0, {}]) await assert.rejects(vault.encrypt('a', value), /PLAINTEXT_REQUIRED/);
    assert.equal(calls, 0);
    assert.equal(await vault.encrypt('a', 'fixture'), 'cipher:fixture');
    assert.equal(calls, 1); assert.equal(vault.key, undefined);
    const readerOnly = fakeVault(); await readerOnly.unlock('a');
    await assert.rejects(readerOnly.encrypt('a', 'fixture'), /ENCRYPTION_UNAVAILABLE/);
});

for (const reason of ['manual', 'logout', 'new-unlock', 'timeout']) {
    test(`encryption completion after ${reason} cannot return ciphertext from the old key context`, async () => {
        let now = 0;
        const pending = deferred(), vault = fakeVault({now: () => now, timeoutMs: 10, encryptValue: () => pending.promise});
        await vault.unlock('a');
        const operation = vault.encrypt('a', 'fixture');
        const rejected = assert.rejects(operation, /VAULT_LOCKED/);
        if (reason === 'timeout') now = 10;
        else if (reason === 'new-unlock') await vault.unlock('b');
        else vault.lock(reason);
        pending.resolve('old-ciphertext'); await rejected;
    });
}

test('an expired Vault never invokes encryption and invalid dependency outputs are rejected', async () => {
    let now = 0, calls = 0;
    const vault = fakeVault({now: () => now, timeoutMs: 10, encryptValue: async () => { calls++; return null; }});
    await vault.unlock('a'); now = 10;
    await assert.rejects(vault.encrypt('a', 'fixture'), /VAULT_LOCKED/);
    assert.equal(calls, 0);
    await vault.unlock('a');
    await assert.rejects(vault.encrypt('a', 'fixture'), /CIPHERTEXT_REQUIRED/);
});

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

test('lock aborts the active unlock dependency and an older completion cannot detach a newer signal', async () => {
    const jobs = [];
    const vault = fakeVault({unlockKey: (uid, {signal}) => {
        const pending = deferred(); jobs.push({signal, ...pending}); return pending.promise;
    }});
    const first = vault.unlock('a');
    const cancelled = assert.rejects(first, /UNLOCK_CANCELLED/);
    const second = vault.unlock('a');
    assert.equal(jobs[0].signal.aborted, true);
    jobs[0].resolve({}); await cancelled;
    vault.lock();
    assert.equal(jobs[1].signal.aborted, true);
    const secondCancelled = assert.rejects(second, /UNLOCK_CANCELLED/);
    jobs[1].resolve({}); await secondCancelled;
    assert.equal(vault.isUnlocked(), false);
});

test('cleanup failure aborts navigation, reports once and permits a later safe mount', async () => {
    let mounts = 0, reports = 0, signal;
    const router = createRouter({onError: () => { reports++; router.stop(); }, routes: {
        overview: context => { signal = context.signal; return () => { throw new Error('cleanup fixture'); }; },
        account: () => { mounts++; }
    }});
    await router.navigate('overview');
    await router.navigate('account');
    assert.equal(signal.aborted, true);
    assert.equal(reports, 1);
    assert.equal(mounts, 0);
    await router.navigate('account');
    assert.equal(mounts, 1);
});

test('late asynchronous cleanup failures are reported instead of silently ignored', async () => {
    const pending = deferred(); let reports = 0;
    const router = createRouter({onError: () => reports++, routes: {
        overview: async () => { await pending.promise; return () => { throw new Error('late fixture'); }; },
        account: () => {}
    }});
    const old = router.navigate('overview');
    await router.navigate('account');
    pending.resolve(); await old;
    assert.equal(reports, 1);
});
