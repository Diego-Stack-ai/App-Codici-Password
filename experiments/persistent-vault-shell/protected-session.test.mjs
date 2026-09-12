import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtectedSession} from './protected-session.mjs';
import {createMemoryVault} from './memory-vault.mjs';
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture(options = {}) {
    let user = {uid: 'a'}, observer, unsubscribes = 0, vault;
    const contexts = [], states = [];
    const mount = context => { contexts.push(context); return () => {}; };
    const session = createProtectedSession({
        getUser: () => user,
        subscribeUser: fn => { observer = fn; return () => unsubscribes++; },
        createVault: callbacks => vault = createMemoryVault({unlockKey: async () => ({}), decryptRecord: async () => 'fixture-clear', ...options, ...callbacks}),
        routes: {overview: mount, private: mount, company: mount},
        onState: value => states.push(value)
    });
    return {session, contexts, states, get vault() { return vault; }, get unsubscribes() { return unsubscribes; },
        change(uid, notify = true) { user = uid ? {uid} : null; if (notify) observer(user); }};
}

test('one unlock across canonical route changes exposes a scoped reader without a key', async () => {
    let unlocks = 0;
    const f = fixture({unlockKey: async () => { unlocks++; return {}; }});
    await f.session.unlock();
    await f.session.navigate('private'); await f.session.navigate('company');
    assert.equal(unlocks, 1);
    assert.equal(f.contexts[0].signal.aborted, true);
    assert.equal(f.contexts[1].user.uid, 'a');
    assert.equal(f.contexts[1].key, undefined);
    assert.equal(await f.contexts[1].read({}), 'fixture-clear');
    await assert.rejects(f.contexts[0].read({}), /VIEW_DISPOSED/);
});
for (const reason of ['manual', 'pagehide', 'pageshow']) {
    test(`${reason} aborts the mounted view before any pending plaintext can return`, async () => {
        const pending = deferred(); const f = fixture({decryptRecord: () => pending.promise});
        await f.session.unlock(); await f.session.navigate('private');
        const context = f.contexts[0]; const reading = context.read({});
        const rejected = assert.rejects(reading);
        f.session.lock(reason);
        assert.equal(context.signal.aborted, true);
        pending.resolve('must-not-return'); await rejected;
        assert.equal(f.session.check(), false);
    });
}

test('identity changes abort the old view and require a new unlock', async () => {
    const f = fixture(); await f.session.unlock(); await f.session.navigate('private');
    f.change('b');
    assert.equal(f.contexts[0].signal.aborted, true);
    assert.equal(f.session.check(), false);
    await f.session.navigate('company');
    assert.equal(f.contexts[1].user.uid, 'b');
    assert.equal(f.contexts[1].unlocked, false);
    await f.session.unlock(); assert.equal(f.session.check(), true);
});

test('a delayed identity notification is detected before a pending read returns', async () => {
    const pending = deferred(); const f = fixture({decryptRecord: () => pending.promise});
    await f.session.unlock(); await f.session.navigate('private');
    const reading = f.contexts[0].read({}); const rejected = assert.rejects(reading, /AUTH_CHANGED/);
    f.change('b', false); pending.resolve('must-not-return'); await rejected;
    assert.equal(f.contexts[0].signal.aborted, true);
    assert.equal(f.session.check(), false);
});

test('same UID refresh does not close a working session', async () => {
    const f = fixture(); await f.session.unlock(); await f.session.navigate('private');
    f.change('a');
    assert.equal(f.contexts[0].signal.aborted, false);
    assert.equal(f.session.check(), true);
});

test('sign-out locks before invoking the provider and remains locked on failure', async () => {
    const f = fixture(); await f.session.unlock(); await f.session.navigate('private');
    await assert.rejects(f.session.logout(async () => {
        assert.equal(f.contexts[0].signal.aborted, true);
        assert.equal(f.session.check(), false);
        throw new Error('provider fixture');
    }), /provider fixture/);
    assert.equal(f.session.check(), false);
    await f.session.unlock(); assert.equal(f.session.check(), true);
});

test('unlock cannot reopen the Vault while provider sign-out is pending', async () => {
    const pending = deferred(); const f = fixture(); await f.session.unlock();
    const logout = f.session.logout(() => pending.promise);
    await assert.rejects(f.session.unlock(), /LOGOUT_PENDING/);
    f.change(null); pending.resolve(); await logout;
    await assert.rejects(f.session.unlock(), /AUTH_REQUIRED/);
});

test('identity change during unlock cannot report an unlocked session for the new user', async () => {
    const pending = deferred(); const f = fixture({unlockKey: () => pending.promise});
    const unlocking = f.session.unlock(); const rejected = assert.rejects(unlocking);
    f.change('b'); pending.resolve({}); await rejected;
    assert.equal(f.states.some(value => value.state === 'unlocked'), false);
});

test('timeout closes the mounted route when the app resumes checking', async () => {
    let time = 0; const f = fixture({now: () => time, timeoutMs: 60});
    await f.session.unlock(); await f.session.navigate('private'); time = 61;
    assert.equal(f.session.check(), false);
    assert.equal(f.contexts[0].signal.aborted, true);
});

test('dispose clears the route, subscription and future unlock ability once', async () => {
    const f = fixture(); await f.session.unlock(); await f.session.navigate('private');
    f.session.dispose(); f.session.dispose(); f.change('b');
    assert.equal(f.unsubscribes, 1);
    assert.equal(f.contexts[0].signal.aborted, true);
    await assert.rejects(f.session.unlock(), /SESSION_DISPOSED/);
    await f.session.navigate('company'); assert.equal(f.contexts.length, 1);
});
