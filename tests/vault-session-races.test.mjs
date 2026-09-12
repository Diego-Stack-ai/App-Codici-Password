import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../Frontend/public/assets/js/modules/core/', import.meta.url);
const sessionSource = await readFile(new URL('vault-session.js', root), 'utf8');
const securitySource = await readFile(new URL('security-manager.js', root), 'utf8');
const body = source => source.replace(/^import\s+[\s\S]*?;\s*$/gm, '')
    .replace(/^export\s*\{[^}]*\};?/gm, '').replace(/^export /gm, '');
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
function storage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function sessionFixture() {
    const sessionStorage = storage();
    const events = [];
    const subtle = Object.fromEntries(['importKey', 'encrypt', 'decrypt'].map(name => [
        name, (...args) => webcrypto.subtle[name](...args)
    ]));
    const context = vm.createContext({
        sessionStorage, crypto: {subtle, getRandomValues: array => webcrypto.getRandomValues(array)},
        TextEncoder, TextDecoder, Uint8Array, Date,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        Event: class { constructor(type) { this.type = type; } },
        window: {dispatchEvent: event => events.push(event.type)},
        console: {warn() {}}
    });
    vm.runInContext(body(sessionSource), context);
    function pause(name) {
        const entered = deferred(), release = deferred();
        const original = subtle[name];
        subtle[name] = async (...args) => {
            subtle[name] = original;
            entered.resolve();
            await release.promise;
            return original(...args);
        };
        return {entered: entered.promise, release};
    }
    return {context, sessionStorage, events, pause, run: code => vm.runInContext(code, context)};
}

test('cleanup during encryption cannot recreate the stored session or unlock event', async () => {
    const f = sessionFixture(), pause = f.pause('encrypt');
    const saving = f.run("saveVaultSession('fixture-old', 'uid-a')");
    await pause.entered;
    f.run('clearVaultSession()');
    pause.release.resolve();
    assert.equal(await saving, false);
    assert.equal(f.sessionStorage.getItem('vault_session_v1'), null);
    assert.equal(f.sessionStorage.getItem('codex_vault_session_wrapping_key_v1'), null);
    assert.deepEqual(f.events, []);
});

for (const fails of [false, true]) {
    test(`a stale encryption ${fails ? 'failure' : 'completion'} cannot erase/overwrite a newer session`, async () => {
        const f = sessionFixture(), pause = f.pause('encrypt');
        const saving = f.run("saveVaultSession('fixture-old', 'uid-a')");
        await pause.entered;
        f.run('clearVaultSession()');
        assert.equal(await f.run("saveVaultSession('fixture-new', 'uid-b')"), true);
        if (fails) pause.release.reject(new Error('synthetic-crypto-failure'));
        else pause.release.resolve();
        assert.equal(await saving, false);
        assert.equal(await f.run("restoreVaultSession('uid-b')"), 'fixture-new');
        assert.deepEqual(f.events, ['vault-session-unlocked']);
    });
}

test('cleanup during decryption prevents the pending restore from returning key material', async () => {
    const f = sessionFixture();
    await f.run("saveVaultSession('fixture-key', 'uid-a')");
    const pause = f.pause('decrypt');
    const restoring = f.run("restoreVaultSession('uid-a')");
    await pause.entered;
    f.run('clearVaultSession()');
    pause.release.resolve();
    assert.equal(await restoring, null);
});

function securityFixture(overrides = {}) {
    const auth = {currentUser: {uid: 'uid-a'}};
    let authObserver;
    const saves = [];
    const context = vm.createContext({
        localStorage: storage(), auth,
        onAuthStateChanged: (_auth, callback) => { authObserver = callback; },
        clearVaultSession() {},
        restoreVaultSession: async () => null,
        saveVaultSession: async (...args) => { saves.push(args); return true; },
        showToast() {}, passwordPolicyMessage: () => 'fixture-policy',
        console: {warn() {}, error() {}},
        ...overrides
    });
    vm.runInContext(body(securitySource), context);
    authObserver(auth.currentUser);
    return {context, auth, saves, authObserver, run: code => vm.runInContext(code, context)};
}

for (const action of ['softLock()', 'clearSession()', 'resetVault()']) {
    test(`${action} emits a payload-free lock event after clearing the key with the same UID`, async () => {
        const events = [];
        let cleared = false;
        const f = securityFixture({
            Event,
            dispatchEvent: event => {
                assert.equal(f.run('_vaultKeyMaterial'), null);
                assert.equal(cleared, true);
                assert.equal(f.auth.currentUser.uid, 'uid-a');
                events.push(event);
            },
            clearVaultSession: () => { cleared = true; },
            db: {}, doc() {}, updateDoc: async () => {}, setTimeout() {},
        });
        f.run("_vaultKeyMaterial = 'synthetic-key'; clearVaultSession();");
        assert.equal(events.length, 0);
        cleared = false;
        await f.run(action);
        assert.equal(events.length, 1);
        assert.equal(events[0].type, 'vault-session-locked');
        assert.equal(events[0].detail, undefined);
        assert.equal(events[0].uid, undefined);
    });
}

for (const action of ['clearSession()', 'softLock()', 'change-uid', 'auth-logout']) {
    test(`pending session restore is invalidated by ${action}`, async () => {
        const pending = deferred();
        const f = securityFixture({restoreVaultSession: () => pending.promise});
        const result = f.run('ensureVaultKeyMaterial()');
        const rejected = assert.rejects(result, {code: 'vault/session-invalidated'});
        if (action === 'change-uid') {
            f.auth.currentUser = {uid: 'uid-b'};
            f.authObserver(f.auth.currentUser);
        } else if (action === 'auth-logout') {
            f.auth.currentUser = null;
            f.authObserver(null);
        } else f.run(action);
        pending.resolve('fixture-old');
        await rejected;
        assert.equal(f.run('_vaultKeyMaterial'), null);
        assert.equal(f.run('_vaultAutoUnlock'), false);
        assert.deepEqual(f.saves, []);
    });
}

for (const phase of ['biometric', 'password-dialog', 'key-resolution']) {
    test(`logout during ${phase} cannot republish the resolved key`, async () => {
        const entered = deferred(), pending = deferred();
        const f = securityFixture({
            waitForFixture: () => { entered.resolve(); return pending.promise; },
            showInputModal: async () => 'fixture-password'
        });
        f.run('isNewVault = async () => false; verifyMasterPassword = async () => true;');
        if (phase === 'biometric') f.run('tryBiometricUnlock = waitForFixture;');
        if (phase === 'password-dialog') f.context.showInputModal = f.context.waitForFixture;
        if (phase === 'key-resolution') f.run('resolveVaultKey = waitForFixture;');
        const result = f.run('ensureVaultKeyMaterial({promptImmediately: true})');
        const rejected = assert.rejects(result, {code: 'vault/session-invalidated'});
        await entered.promise;
        f.run('clearSession()');
        pending.resolve('fixture-old');
        await rejected;
        assert.equal(f.run('_vaultKeyMaterial'), null);
        assert.deepEqual(f.saves, []);
    });
}

test('a new unlock succeeds while an invalidated unlock is still pending', async () => {
    const old = deferred();
    let calls = 0;
    const f = securityFixture({restoreVaultSession: () => ++calls === 1 ? old.promise : Promise.resolve('fixture-new')});
    const pending = f.run('ensureVaultKeyMaterial()');
    const rejected = assert.rejects(pending, {code: 'vault/session-invalidated'});
    f.run('clearSession()');
    assert.equal(await f.run('ensureVaultKeyMaterial()'), 'fixture-new');
    old.resolve('fixture-old');
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), 'fixture-new');
});

test('Master Password change completing after logout cannot reopen the local Vault', async () => {
    const entered = deferred(), pending = deferred();
    const answers = ['fixture-old', 'fixture-new', 'fixture-new'];
    const f = securityFixture({
        showInputModal: async () => answers.shift(),
        evaluatePassword: () => ({valid: true}),
        unwrapVaultKey: async () => 'fixture-key',
        wrapVaultKey: async () => ({version: 2}),
        createVaultVerifier: async () => ({version: 2}),
        db: {}, doc() {},
        setDoc: () => { entered.resolve(); return pending.promise; }
    });
    f.run('verifyMasterPassword = async () => true; loadVaultEnvelope = async () => ({version: 2});');
    const result = f.run('changeMasterPassword()');
    const rejected = assert.rejects(result, {code: 'vault/session-invalidated'});
    await entered.promise;
    f.run('clearSession()');
    pending.resolve();
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), null);
    assert.deepEqual(f.saves, []);
    assert.equal(f.context.localStorage.getItem('codex_vault_verifier_uid-a'), '{"version":2}');
    assert.equal(f.context.localStorage.getItem('codex_vault_envelope_uid-a'), '{"version":2}');
});

test('session expiry reached during decryption prevents key delivery', async () => {
    const f = sessionFixture();
    f.context.Date = {now: () => 1000};
    await f.run("saveVaultSession('fixture-key', 'uid-a', 2000)");
    const pause = f.pause('decrypt');
    const restoring = f.run("restoreVaultSession('uid-a')");
    await pause.entered;
    f.context.Date = {now: () => 2000};
    pause.release.resolve();
    assert.equal(await restoring, null);
    assert.equal(f.sessionStorage.getItem('vault_session_v1'), null);
});
