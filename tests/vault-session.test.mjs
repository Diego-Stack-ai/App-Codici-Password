import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-session.js', import.meta.url), 'utf8');
const legacy = ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry'];
function fixture(storage = new Map(), overrides = {}) {
    const warnings = [], events = [], writes = [];
    const subtle = Object.fromEntries(['generateKey', 'encrypt', 'decrypt'].map(name => [name, (...args) => webcrypto.subtle[name](...args)]));
    const context = vm.createContext({
        crypto: {subtle, getRandomValues: a => webcrypto.getRandomValues(a)},
        sessionStorage: {getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => {writes.push(key); storage.set(key, value);},
            removeItem: key => storage.delete(key), ...overrides},
        TextEncoder, TextDecoder, Uint8Array, Date, Event,
        btoa: v => Buffer.from(v, 'binary').toString('base64'),
        atob: v => Buffer.from(v, 'base64').toString('binary'),
        window: {dispatchEvent: e => events.push(e.type)},
        console: {warn: (...args) => warnings.push(args)}
    });
    vm.runInContext(source.replace(/^export /gm, ''), context);
    return {context, storage, subtle, events, warnings, writes, run: code => vm.runInContext(code, context)};
}

test('same-document UID, cleanup and unlock event remain functional without storage writes', async () => {
    const f = fixture();
    assert.equal(await f.run("saveVaultSession('SYNTHETIC-KEY', 'a')"), true);
    assert.equal(await f.run("restoreVaultSession('a')"), 'SYNTHETIC-KEY');
    assert.equal(await f.run("restoreVaultSession('b')"), null);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.events, ['vault-session-unlocked']);
    for (const name of legacy) assert.equal(f.storage.has(name), false);
});

test('copying all browser storage cannot unlock a fresh document', async () => {
    const storage = new Map([['preference', 'keep']]);
    const first = fixture(storage);
    await first.run("saveVaultSession('SYNTHETIC-KEY', 'a')");
    const second = fixture(new Map(storage));
    assert.equal(await second.run("restoreVaultSession('a')"), null);
    assert.equal(await first.run("restoreVaultSession('a')"), 'SYNTHETIC-KEY');
    first.run('clearVaultSession()');
    assert.equal(await first.run("restoreVaultSession('a')"), null);
    assert.equal(first.run('wrappingKey'), null);
    assert.equal(first.run('sessionPayload'), null);
    assert.equal(second.storage.get('preference'), 'keep');
});

test('all legacy key/payload aliases are purged at initialization, never imported', async () => {
    const f = fixture(new Map(legacy.map(k => [k, 'SYNTHETIC-OLD-SECRET'])));
    assert.equal(await f.run("restoreVaultSession('a')"), null);
    for (const name of legacy) assert.equal(f.storage.has(name), false);
});

test('failed purge still attempts every alias and refuses initialization', () => {
    const calls = [];
    assert.throws(() => fixture(new Map(), {removeItem(key) {
        calls.push(key);
        if (key === legacy[0]) throw new Error('blocked');
    }}), /blocked/);
    assert.deepEqual(calls, legacy);
});

test('RAM expiry preserves the inactivity contract', async () => {
    const f = fixture();
    await f.run("saveVaultSession('SYNTHETIC-KEY', 'a', Date.now() - 1)");
    assert.equal(await f.run("restoreVaultSession('a')"), null);
    await f.run("saveVaultSession('SYNTHETIC-KEY', 'a')");
    f.run('touchVaultSession(60000)');
    assert.ok(f.run('getVaultSessionExpiry()') > Date.now());
    assert.deepEqual(f.writes, []);
});

for (const phase of ['encrypt', 'decrypt']) test(phase + ' failure clears state and logs only a stable label', async () => {
    const f = fixture();
    if (phase === 'decrypt') await f.run("saveVaultSession('SYNTHETIC-KEY', 'a')");
    f.subtle[phase] = async () => {throw Object.assign(new Error('SYNTHETIC-SECRET'), {code:'permission-denied'});};
    const result = await f.run(phase === 'encrypt' ? "saveVaultSession('SYNTHETIC-KEY', 'a')" : "restoreVaultSession('a')");
    assert.equal(result, phase === 'encrypt' ? false : null);
    assert.equal(f.warnings[0][1], 'permission-denied');
    assert.doesNotMatch(JSON.stringify(f.warnings), /SYNTHETIC/);
    assert.equal(await f.run("restoreVaultSession('a')"), null);
});

test('sensitive codes and throwing getters cannot leak through diagnostic labels', () => {
    const f = fixture();
    f.context.error = {code: 'SYNTHETIC_SECRET_PASSWORD'};
    assert.equal(f.run('logErrorLabel(error)'), 'Error');
    Object.defineProperty(f.context.error, 'code', {get(){throw new Error('SYNTHETIC');}});
    assert.equal(f.run('logErrorLabel(error)'), 'Error');
});
