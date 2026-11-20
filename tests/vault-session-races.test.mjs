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
    const subtle = Object.fromEntries(['generateKey', 'importKey', 'encrypt', 'decrypt'].map(name => [
        name, (...args) => webcrypto.subtle[name](...args)
    ]));
    const context = vm.createContext({
        vaultFrameClient: {isChild: () => false, onClear() {}},
        window: {addEventListener() {}},
        sessionStorage, crypto: {subtle, getRandomValues: array => webcrypto.getRandomValues(array)},
        TextEncoder, TextDecoder, Uint8Array, Date,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        Event: class { constructor(type) { this.type = type; } },
        window: {addEventListener() {}, dispatchEvent: event => events.push(event.type)},
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
        vaultFrameClient: {isChild: () => false, onClear() {}},
        window: {addEventListener() {}}, localStorage: storage(), auth,
        onAuthStateChanged: (_auth, callback) => { authObserver = callback; },
        frameMediaLifetime: () => ({valid: () => true, dispose() {}, signal: undefined}), confirmFrameAction: async () => undefined,
        clearVaultSession() {}, getVaultSessionExpiry: () => null,
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

function freshBiometricFixture(overrides = {}) {
    const calls = {prf: [], restore: 0, master: 0, success: 0};
    const f = securityFixture({
        restoreVaultSession: async () => {calls.restore++; return 'fixture-restored';},
        getPrfOutput: async (...args) => {calls.prf.push(args); return 'fixture-prf';},
        deriveHkdfKey: async () => 'fixture-aes',
        decryptVaultSecret: async () => 'fixture-fresh',
        showInputModal: async () => {calls.master++; return 'fixture-password';},
        showToast: (_text, kind) => {if (kind === 'success') calls.success++;},
        logErrorLabel: () => 'fixture-error',
        fixtureVerify: async () => true,
        ...overrides
    });
    f.run("verifyMasterPassword = fixtureVerify; isNewVault = async () => false; resolveVaultKey = async () => 'fixture-master'; _vaultKeyMaterial = 'fixture-cached';");
    f.context.localStorage.setItem(f.run("getStorageKey('uid-a')"), JSON.stringify({version: 2,
        credentialId: 'fixture-id', prfSalt: 'fixture-salt', hkdfSalt: 'fixture-hkdf',
        encryptedVaultKey: 'fixture-ciphertext', iv: 'fixture-iv'}));
    f.context.freshOptions = {forceReload: true, promptImmediately: true, allowBiometricForReload: true};
    return {...f, calls, fresh: () => f.run('ensureVaultKeyMaterial(freshOptions)')};
}

test('fresh export confirmation performs a new PRF ceremony despite cached Vault material', async () => {
    const f = freshBiometricFixture();
    const controller = new AbortController();
    f.context.freshOptions.signal = controller.signal;
    assert.equal(await f.fresh(), 'fixture-fresh');
    assert.equal(await f.fresh(), 'fixture-fresh');
    assert.equal(f.calls.prf.length, 2);
    assert.equal(f.calls.prf[0][3].signal, controller.signal);
    assert.equal(f.calls.restore, 0);
    assert.equal(f.calls.master, 0);
    assert.equal(f.saves.length, 2);
});

for (const flag of [undefined, false]) test(`forced confirmation preserves Master Password default with biometric flag ${flag}`, async () => {
    const f = freshBiometricFixture();
    f.context.freshOptions.allowBiometricForReload = flag;
    assert.equal(await f.fresh(), 'fixture-master');
    assert.equal(f.calls.prf.length, 0);
    assert.equal(f.calls.restore, 0);
    assert.equal(f.calls.master, 1);
});

for (const condition of ['unconfigured', 'prf-error', 'wrong-master', 'cancel-master']) {
    test(`fresh export ${condition} requires the complete Master Password alternative`, async () => {
        const f = freshBiometricFixture({getPrfOutput: async () => {throw Error('fixture-prf-unavailable');}});
        if (condition === 'unconfigured') f.context.localStorage.removeItem(f.run("getStorageKey('uid-a')"));
        if (condition === 'wrong-master') f.run('verifyMasterPassword = async () => false');
        if (condition === 'cancel-master') f.context.showInputModal = async () => {f.calls.master++; return null;};
        if (condition === 'wrong-master' || condition === 'cancel-master') {
            await assert.rejects(f.fresh());
            assert.equal(f.saves.length, 0);
            assert.equal(f.run('_vaultKeyMaterial'), 'fixture-cached');
        } else {
            assert.equal(await f.fresh(), 'fixture-master');
            assert.equal(f.saves.length, 1);
        }
        assert.equal(f.calls.master, 1);
        assert.equal(f.calls.restore, 0);
    });
}

test('fresh PRF confirmation cannot return material after lock during session save', async () => {
    const entered = deferred(), pending = deferred();
    const f = freshBiometricFixture({saveVaultSession: () => {entered.resolve(); return pending.promise;}});
    const rejected = assert.rejects(f.fresh(), {code: 'vault/session-invalidated'});
    await entered.promise;
    const successesBeforeLock = f.calls.success;
    f.run('clearSession()'); pending.resolve(true);
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), null);
    assert.equal(f.calls.master, 0); assert.equal(f.calls.success, successesBeforeLock);
});

test('already aborted fresh export never opens WebAuthn or Master Password', async () => {
    const f = freshBiometricFixture(), controller = new AbortController();
    controller.abort(); f.context.freshOptions.signal = controller.signal;
    await assert.rejects(f.fresh(), {name: 'AbortError'});
    assert.equal(f.calls.prf.length, 0); assert.equal(f.calls.master, 0);
    assert.equal(f.saves.length, 0); assert.equal(f.calls.success, 0);
});

for (const phase of ['getPrfOutput', 'deriveHkdfKey', 'decryptVaultSecret'])
for (const invalidation of ['abort', 'clearSession()', 'softLock()', 'change-uid', 'auth-logout']) {
    test(`fresh PRF ${phase} ignores a late result after ${invalidation}`, async () => {
        const entered = deferred(), pending = deferred(), controller = new AbortController();
        const f = freshBiometricFixture({[phase]: () => {entered.resolve(); return pending.promise;}});
        f.context.freshOptions.signal = controller.signal;
        const rejected = assert.rejects(f.fresh(), invalidation === 'abort'
            ? {name: 'AbortError'} : {code: 'vault/session-invalidated'});
        await entered.promise;
        if (invalidation === 'abort') controller.abort();
        else if (invalidation === 'change-uid') {f.auth.currentUser = {uid: 'uid-b'}; f.authObserver(f.auth.currentUser);}
        else if (invalidation === 'auth-logout') {f.auth.currentUser = null; f.authObserver(null);}
        else f.run(invalidation);
        pending.resolve('fixture-late');
        await rejected;
        assert.equal(f.saves.length, 0); assert.equal(f.calls.success, 0); assert.equal(f.calls.master, 0);
        assert.equal(f.run('_vaultKeyMaterial'), invalidation === 'abort' ? 'fixture-cached' : null);
    });
}

test('read-only unlock predicate requires current identity, RAM key and unexpired unlocked session', () => {
    let expiry = null;
    const f = securityFixture({getVaultSessionExpiry: () => expiry});
    assert.equal(f.run('isVaultUnlocked()'), false);
    f.run("_vaultKeyMaterial = 'synthetic-key'");
    assert.equal(f.run('isVaultUnlocked()'), true);
    expiry = Date.now() - 1;
    assert.equal(f.run('isVaultUnlocked()'), false);
    expiry = Date.now() + 60000;
    assert.equal(f.run('isVaultUnlocked()'), true);
    f.auth.currentUser = {uid: 'uid-b'};
    assert.equal(f.run('isVaultUnlocked()'), false);
    f.auth.currentUser = {uid: 'uid-a'};
    f.run('_isSoftLocked = true');
    assert.equal(f.run('isVaultUnlocked()'), false);
    assert.equal(f.saves.length, 0);
});

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

function pendingFrameSecurity(phase) {
    const paused = deferred(), entered = deferred(), listeners = new Map();
    let reads = 0, checks = 0, locks = 0, requests = 0, transportGeneration = 0;
    const client = {isChild: () => true, onClear() {}, generation: () => transportGeneration,
        isUnlocked: () => true,
        request: async () => ({kind: 'key', material: 'synthetic-frame-' + (++requests)}),
        lock: () => {locks++;}};
    const f = securityFixture({vaultFrameClient: client,
        window: {addEventListener: (name, callback) => listeners.set(name, callback)},
        authSessionFence: {
            readPermit: () => {
                if (phase === 'readPermit' && ++reads === 1) {entered.resolve(); return paused.promise;}
                return Promise.resolve({});
            },
            isCurrent: () => {
                if (phase === 'isCurrent' && ++checks === 1) {entered.resolve(); return paused.promise;}
                return Promise.resolve(true);
            }, isLocallyCurrent: () => true
        }});
    return {...f, paused, entered: entered.promise, locks: () => locks,
        pagehide() {listeners.get('pagehide')(); transportGeneration++;}};
}

for (const phase of ['readPermit', 'isCurrent']) for (const finish of ['resolve', 'reject'])
for (const invalidation of ['pagehide', 'uid'])
test(`stale frame ${phase} ${finish} after ${invalidation} cannot lock a newer session`, async () => {
    const f = pendingFrameSecurity(phase);
    const old = f.run('ensureVaultKeyMaterial()');
    const rejected = assert.rejects(old);
    await f.entered;
    if (invalidation === 'pagehide') f.pagehide();
    else {f.auth.currentUser = {uid: 'uid-b'}; f.authObserver(f.auth.currentUser);}
    const material = await f.run('ensureVaultKeyMaterial()'), locks = f.locks();
    assert.equal(f.run('isVaultUnlocked()'), true);
    if (finish === 'reject') f.paused.reject(Error('synthetic-old-frame-failure'));
    else f.paused.resolve(phase === 'readPermit' ? {} : true);
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), material, 'old failure must not erase the newer key');
    assert.equal(f.run('isVaultUnlocked()'), true);
    assert.equal(f.locks(), locks, 'old failure must not notify a new owner lock');
    assert.deepEqual(f.saves, [], 'frame key remains RAM only');
});

for (const phase of ['readPermit', 'isCurrent'])
test(`superseded frame ${phase} failure cannot lock a completed fresh confirmation`, async () => {
    const f = pendingFrameSecurity(phase);
    const old = f.run('ensureVaultKeyMaterial()'), rejected = assert.rejects(old);
    await f.entered;
    const material = await f.run('ensureVaultKeyMaterial({forceReload: true})');
    f.paused.reject(Error('synthetic-superseded-frame-failure'));
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), material);
    assert.equal(f.run('isVaultUnlocked()'), true);
    assert.equal(f.locks(), 0);
});

for (const phase of ['readPermit', 'isCurrent'])
test(`current frame ${phase} failure still revokes the session`, async () => {
    const f = pendingFrameSecurity(phase);
    const current = f.run('ensureVaultKeyMaterial()'), rejected = assert.rejects(current);
    await f.entered;
    f.paused.reject(Error('synthetic-current-frame-failure'));
    await rejected;
    assert.equal(f.run('_vaultKeyMaterial'), null);
    assert.equal(f.locks(), 1);
    assert.equal(f.run('isVaultUnlocked()'), false);
});

for (const change of ['uid', 'fence', 'generation']) test(`real manager refuses frame adoption after changed ${change}`, async () => {
    const pause = deferred(); let generation = 0, fence = true, locks = 0;
    const client = {isChild: () => true, onClear() {}, generation: () => generation,
        isUnlocked: () => true, request: () => pause.promise, lock: () => {locks++;}};
    const f = securityFixture({vaultFrameClient: client,
        authSessionFence: {readPermit: async () => ({}), isCurrent: async () => fence}});
    const unlocking = f.run('ensureVaultKeyMaterial()');
    await new Promise(resolve => setImmediate(resolve));
    if (change === 'uid') f.auth.currentUser = {uid: 'uid-b'};
    if (change === 'fence') fence = false;
    if (change === 'generation') generation++;
    pause.resolve({kind: 'key', material: 'synthetic-frame-material'});
    await assert.rejects(unlocking);
    assert.equal(f.run('_vaultKeyMaterial'), null); assert.equal(f.saves.length, 0); assert.equal(locks, 1);
});
test('real manager routes forceReload to fresh owner confirmation and stores the frame copy only in RAM', async () => {
    const commands = [];
    const client = {isChild: () => true, onClear() {}, generation: () => 0, isUnlocked: () => true,
        request: async command => {commands.push(command);return {kind: 'key', material: 'synthetic-frame-material'};}};
    const f = securityFixture({vaultFrameClient: client,
        authSessionFence: {readPermit: async () => ({}), isCurrent: async () => true}});
    assert.equal(await f.run('ensureVaultKeyMaterial()'), 'synthetic-frame-material');
    assert.equal(await f.run('ensureVaultKeyMaterial({forceReload: true})'), 'synthetic-frame-material');
    assert.deepEqual(commands, ['key', 'rekey']); assert.equal(f.saves.length, 0);
});

test('real manager cached frame key denies an already pending tombstone without an event', async () => {
    const fenceSource = await readFile(new URL('../../auth-session-fence.js', root), 'utf8');
    const {createAuthSessionFence} = await import(`data:text/javascript;base64,${Buffer.from(fenceSource).toString('base64')}`);
    let state = {revision:1,nonce:'synthetic-fence',denied:false}; const pending = new Set();
    const fence = createAuthSessionFence({transact: async change => (state=change(state)), pending: () => [...pending]});
    const commands = [];
    const client = {isChild: () => true, onClear() {}, generation: () => 0, isUnlocked: () => true, lock() {},
        request: async command => {commands.push(command);return {kind:'key',material:'synthetic-frame-material'};}};
    const f = securityFixture({vaultFrameClient: client, authSessionFence: fence});
    await f.run('ensureVaultKeyMaterial()'); await f.run('ensureVaultKeyMaterial()'); assert.equal(commands.length, 1);
    pending.add('synthetic-logout');
    await assert.rejects(f.run('ensureVaultKeyMaterial()'));
    assert.equal(f.run('_vaultKeyMaterial'), null); assert.equal(commands.length, 1);
});

for (const interrupt of [false,true]) test(`master change revalidates before write and revokes frame material (${interrupt})`,async()=>{
 let active=true,prompts=0,writes=0,fresh=0,locks=0;
 const lifetime={valid:()=>active,dispose(){active=false;},signal:new AbortController().signal};
 const f=securityFixture({frameMediaLifetime:()=>lifetime,
  vaultFrameClient:{isChild:()=>true,onClear(){},lock(){locks++;}},confirmFrameAction:async()=>{fresh++;},
  showInputModal:async()=>{prompts++;if(interrupt&&prompts===2)active=false;return prompts===1?'old':'new-password';},
  evaluatePassword:()=>({valid:true}),unwrapVaultKey:async()=> 'synthetic-key',wrapVaultKey:async()=>({synthetic:true}),createVaultVerifier:async()=> 'synthetic-verifier',
  doc:()=>({}),db:{},setDoc:async()=>{writes++;}});
 f.run('verifyMasterPassword=async()=>true;loadVaultEnvelope=async()=>({synthetic:true});');
 if(interrupt)await assert.rejects(f.run('changeMasterPassword()'),/FRAME_CONFIRMATION_REQUIRED/);
 else assert.equal(await f.run('changeMasterPassword()'),true);
 assert.equal(writes,interrupt?0:1);assert.equal(fresh,interrupt?0:1);assert.equal(prompts,interrupt?2:3);
 if(!interrupt){assert.equal(locks,1);assert.equal(f.run('_vaultKeyMaterial'),null);}
});
