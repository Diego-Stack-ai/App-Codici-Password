import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-controller.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
function fixture({keyPending = null, decryptPending = null, confirmation = true} = {}) {
    const listeners = new Map(), clicks = new Map(), dialogs = [], calls = [];
    const trigger = {disabled: false, classList: {add() {}, remove() {}}, querySelector: () => null,
        setAttribute() {}, removeAttribute() {},
        addEventListener: (type, callback) => clicks.set(type, callback),
        removeEventListener: (type, callback) => {if (clicks.get(type) === callback) clicks.delete(type);}};
    const auth = {currentUser: {uid: 'synthetic-owner'}};
    let key = 'synthetic-key', authListener = () => {};
    const addEventListener = (type, cb) => {if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(cb);};
    const removeEventListener = (type, cb) => listeners.get(type)?.delete(cb);
    const window = {addEventListener, removeEventListener, setTimeout() {}};
    const context = vm.createContext({vaultFrameClient: {isChild: () => false}, window, addEventListener, removeEventListener, auth,
        onAuthStateChanged: (_auth, cb) => {authListener = cb; return () => {authListener = () => {};};},
        document: {querySelector: () => true, getElementById: () => trigger},
        location: {pathname: '/home_page.html'}, navigator: {onLine: true}, console,
        fetch: async () => ({ok: false}), getCurrentLanguage: () => 'it', t: value => value,
        getOfflineReadiness: () => ({complete: true}),
        ensureVaultKeyMaterial: async () => {calls.push('unlock'); if (keyPending) return keyPending.promise; if (!key) throw new Error('LOCKED'); return key;},
        loadVaultSearchRecords: async () => [{id: 'synthetic-record'}],
        VaultConversationEngine: class {ask(value) {return value;} clear() {calls.push('clear');} removeRecord() {}},
        createAssistantUI: options => {const ui = {options, destroy() {calls.push('destroy-ui');}}; dialogs.push(ui); return ui;},
        decryptIfPossible: async (value, material) => {calls.push(['decrypt', material]); if (decryptPending) return decryptPending.promise; return material ? value : Promise.reject(new Error('LOCKED'));},
        showConfirmModal: async () => confirmation, archiveConfirmMessage: () => 'Confirm',
        archiveAccount: async () => {calls.push('archive'); return {status: 'archived'};}, showToast() {}
    });
    vm.runInContext(source, context);
    return {calls, dialogs, auth, trigger, open: () => clicks.get('click')?.(),
        init: () => context.initVaultAssistant({uid: 'synthetic-owner'}),
        unlock() {key = 'new-synthetic-key';},
        pagehide() {for (const cb of [...listeners.get('pagehide') || []]) cb();},
        lock() {key = null; for (const cb of [...listeners.get('vault-session-locked') || []]) cb();},
        switchUser() {auth.currentUser = {uid: 'other-owner'}; authListener(auth.currentUser);}};
}

test('Search cannot reuse a prepared key after a non-navigation Vault lock', async () => {
    const f = fixture(); await f.init(); await f.open();
    const previous = f.dialogs[0].options;
    assert.equal(await previous.resolveCredential('synthetic-secret'), 'synthetic-secret');
    f.lock();
    await assert.rejects(async () => previous.resolveCredential('synthetic-secret'));
    await f.open();
    assert.equal(f.dialogs.length, 1, 'locked reopening cannot create another dialog from the old promise');
    assert.equal(f.calls.filter(value => value === 'unlock').length, 2);
});

test('same-UID unlock creates a fresh dialog without reauthorizing old resolvers', async () => {
    const f = fixture(); await f.init(); await f.open();
    const old = f.dialogs[0].options;
    f.lock(); f.unlock(); await f.open();
    assert.equal(f.dialogs.length, 2);
    assert.equal(await f.dialogs[1].options.resolveCredential('new-secret'), 'new-secret');
    await assert.rejects(async () => old.resolveCredential('old-secret'));
    f.dialogs[1].options.onClose(); await f.open();
    await assert.rejects(async () => f.dialogs[1].options.resolveCredential('closed-secret'));
    assert.equal(await f.dialogs[2].options.resolveCredential('current-secret'), 'current-secret');
    f.pagehide();
    await assert.rejects(async () => f.dialogs[2].options.resolveCredential('hidden-secret'));
});

test('lock during decryption rejects the late plaintext result', async () => {
    const pending = deferred(), f = fixture({decryptPending: pending});
    await f.init(); await f.open();
    const result = f.dialogs[0].options.resolveCredential('cipher');
    f.lock(); pending.resolve('late-plaintext');
    await assert.rejects(result);
});

test('lock during archive confirmation prevents the later mutation', async () => {
    const pending = deferred(), f = fixture({confirmation: pending.promise});
    await f.init(); await f.open();
    const result = f.dialogs[0].options.onArchive({id: 'synthetic-record', archiveAction: {id: 'record'}});
    f.lock(); pending.resolve(true);
    assert.equal(await result, false);
    assert.equal(f.calls.includes('archive'), false);
});

test('a key preparation that completes after lock is discarded', async () => {
    const pending = deferred(), f = fixture({keyPending: pending});
    const controller = await f.init();
    const ready = controller.prepare();
    f.lock(); pending.resolve('late-synthetic-key');
    await assert.rejects(ready);
    assert.equal(f.dialogs.length, 0);
});

test('UID changes invalidate retained credential and archive callbacks', async () => {
    const f = fixture(); await f.init(); await f.open();
    const previous = f.dialogs[0].options;
    f.switchUser();
    await assert.rejects(async () => previous.resolveCredential('synthetic-secret'));
    await previous.onArchive({id: 'synthetic-record', archiveAction: {id: 'record'}});
    assert.equal(f.calls.includes('archive'), false);
});

test('ordinary search opening and explicit teardown preserve the control workflow', async () => {
    const f = fixture(); const controller = await f.init(); await f.open();
    assert.equal(await f.dialogs[0].options.onAsk('search'), 'search');
    await f.dialogs[0].options.onArchive({id: 'synthetic-record', archiveAction: {id: 'record'}});
    assert.equal(f.calls.includes('archive'), true);
    controller.destroy();
    await assert.rejects(async () => f.dialogs[0].options.resolveCredential('synthetic-secret'));
});
