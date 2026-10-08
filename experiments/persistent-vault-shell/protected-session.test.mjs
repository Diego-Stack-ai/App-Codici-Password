import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtectedSession} from './test-support/protected-session.mjs';
import {createMemoryVault} from './memory-vault.mjs';
import {createSyntheticTestAdmission} from './test-support/synthetic-admission.mjs';
import {createProtectedSession as createAdmissionSession} from './protected-session.mjs';
import {createRestoreStageReader} from './restore-stage-reader.mjs';
import {createRestoreStageClient} from './restore-stage-client.mjs';

test('view signal aborts pending stage client fetch on session lock', async t => {
    let context, readyResolve;
    const ready = new Promise(resolve => {readyResolve = resolve;});
    const session = createProtectedSession({getUser: () => ({uid: 'a'}),
        subscribeUser: () => () => {}, routes: {attachments: value => {context = value;}},
        createVault: callbacks => createMemoryVault({...callbacks, unlockKey: async () => ({}), decryptRecord: async () => ''})});
    t.after(() => session.dispose()); await session.unlock(); await session.navigate('attachments');
    const client = createRestoreStageClient({endpoint: 'http://127.0.0.1:4188/download', origin: 'http://127.0.0.1:4188',
        signal: context.signal, isActive() {try {context.assertUnlocked(); return true;} catch {return false;}},
        getCredentials: async () => ({idToken: 'synthetic', appCheckToken: 'synthetic'}),
        fetchImpl: (_url, {signal}) => new Promise((_resolve, reject) => {
            assert.equal(signal, context.signal);
            signal.addEventListener('abort', () => reject(new Error('FETCH_ABORTED')), {once: true}); readyResolve();
        })});
    const pending = client({stageId: 'a'.repeat(64)}), rejected = assert.rejects(pending, /FETCH_ABORTED/);
    await ready; session.lock(); await rejected; assert.equal(context.signal.aborted, true);
});

test('stage reader bound to route cannot deliver after lock and same-owner unlock', async t => {
    let context, resolve;
    const session = createProtectedSession({getUser: () => ({uid: 'a'}),
        subscribeUser: () => () => {}, routes: {attachments: value => {context = value;}},
        createVault: callbacks => createMemoryVault({...callbacks, unlockKey: async () => ({}), decryptRecord: async () => ''})});
    t.after(() => session.dispose());
    await session.unlock(); await session.navigate('attachments');
    const oldContext = context;
    const reader = createRestoreStageReader({isActive() {
        try {oldContext.assertUnlocked(); return true;} catch {return false;}
    }, readPublished: () => new Promise(yes => {resolve = yes;})});
    const pending = reader.read('a'.repeat(64));
    session.lock(); await session.unlock(); await session.navigate('attachments');
    assert.notEqual(context, oldContext); context.assertUnlocked();
    const bytes = new Uint8Array([1, 2]);
    resolve({bytes, size: 2, generation: '1', sha256: 'b'.repeat(64)});
    await assert.rejects(pending, /INACTIVE/);
    assert.deepEqual([...bytes], [0, 0]);
    await assert.rejects(reader.read('a'.repeat(64)), /INACTIVE/);
});

test('admission cleanup failure cannot retain Vault keys or skip physical teardown', async () => {
    const getUser = () => ({uid: 'a'}), events = [];
    const authority = createSyntheticTestAdmission({getUser});
    let failCleanup = false, vault;
    const session = createAdmissionSession({...authority, getUser,
        admission: {...authority.admission,
            invalidate() {authority.admission.invalidate(); if (failCleanup) throw new Error('invalidate-failed');},
            dispose() {events.push('admission'); authority.admission.dispose(); throw new Error('dispose-failed');}},
        subscribeUser: () => () => events.push('unsubscribe'), routes: {},
        createVault: callbacks => {
            vault = createMemoryVault({...callbacks, unlockKey: async () => ({}), decryptRecord: async () => ''});
            return {...vault, dispose() {events.push('vault');}};
        }});
    await session.unlock(); failCleanup = true;
    assert.throws(() => session.dispose(), /dispose-failed/);
    assert.equal(vault.isUnlocked(), false);
    assert.deepEqual(events, ['admission', 'vault', 'unsubscribe']);
    assert.equal(session.check(), false);
    await assert.rejects(session.unlock(), /SESSION_DISPOSED/);
    session.dispose();
});

test('identity reader failure closes an already unlocked Vault before propagating', async () => {
    let broken = false, vault;
    const failure = new Error('synthetic-identity-unavailable');
    const getUser = () => {if (broken) throw failure; return {uid: 'a'};};
    const session = createAdmissionSession({...createSyntheticTestAdmission({getUser}), getUser,
        subscribeUser: () => () => {}, routes: {},
        createVault: callbacks => vault = createMemoryVault({...callbacks, unlockKey: async () => ({}), decryptRecord: async () => ''})});
    await session.unlock(); assert.equal(vault.isUnlocked(), true);
    broken = true;
    assert.throws(() => session.check(), error => error === failure);
    assert.equal(vault.isUnlocked(), false);
    session.dispose();
});

test('core requires admission; lock during admission prevents physical unlock', async () => {
    assert.throws(() => createAdmissionSession({}), /INVALID_ADMISSION_DEPENDENCY/);
    let resolve, unlocks = 0;
    const authority = createSyntheticTestAdmission({getUser: () => ({uid: 'a'})});
    const session = createAdmissionSession({...authority, getUser: () => ({uid: 'a'}),
        subscribeUser: () => () => {}, routes: {},
        admission: {...authority.admission, check: () => new Promise(yes => {resolve = yes;})},
        createVault: callbacks => createMemoryVault({...callbacks, unlockKey: async () => {unlocks++; return {};}, decryptRecord: async () => ''})});
    const pending = session.unlock(), rejected = assert.rejects(pending, /ATTEMPT_OBSOLETE/);
    await assert.rejects(session.unlock(), /UNLOCK_PENDING/);
    session.lock(); resolve({ok: true, uid: 'a'}); await rejected;
    assert.equal(unlocks, 0); assert.equal(session.check(), false); session.dispose();
});

test('integrated admission navigation is latest-wins and refusal physically locks', async () => {
    const pending = [], mounted = [];
    const authority = createSyntheticTestAdmission({getUser: () => ({uid: 'a'})});
    let defer = false;
    const session = createAdmissionSession({...authority, getUser: () => ({uid: 'a'}),
        subscribeUser: () => () => {}, routes: {a: () => {mounted.push('a');}, b: () => {mounted.push('b');}},
        admission: {...authority.admission, check: args => defer ? new Promise(resolve => pending.push(resolve)) : authority.admission.check(args)},
        createVault: callbacks => createMemoryVault({...callbacks, unlockKey: async () => ({}), decryptRecord: async () => ''})});
    await session.unlock(); defer = true;
    const first = session.navigate('a'), last = session.navigate('b');
    pending[1]({ok: true, uid: 'a'}); await last;
    pending[0]({ok: true, uid: 'a'}); await first;
    assert.deepEqual(mounted, ['b']);
    const denied = session.navigate('a'), rejected = assert.rejects(denied, /ADMISSION_REFUSED/);
    pending[2]({ok: false}); await rejected;
    assert.equal(session.check(), false); session.dispose();
});

test('explicit synthetic admission cannot revive an observed A/B/A ticket or forged ticket', async () => {
    let user = {uid: 'a'};
    const fixture = createSyntheticTestAdmission({getUser: () => user});
    const a = fixture.getTicket();
    assert.equal((await fixture.admission.check({ticket: a})).ok, true);
    assert.equal((await fixture.admission.check({ticket: {}})).ok, false);
    user = {uid: 'b'};
    assert.equal(fixture.isTicketActive(a), false);
    user = {uid: 'a'};
    assert.equal(fixture.isTicketActive(a), false);
    const fresh = fixture.getTicket();
    fixture.admission.invalidate();
    assert.equal(fixture.isTicketActive(fresh), false);
    fixture.admission.dispose();
    assert.equal(fixture.getTicket(), null);
    assert.equal((await fixture.admission.check({ticket: a})).ok, false);
});

test('synthetic admission rejects identity-reader reentrant disposal', async () => {
    let disposeDuringRead = false, fixture;
    fixture = createSyntheticTestAdmission({getUser() {
        if (disposeDuringRead) fixture.admission.dispose();
        return {uid: 'a'};
    }});
    const ticket = fixture.getTicket();
    disposeDuringRead = true;
    assert.equal((await fixture.admission.check({ticket})).ok, false);
    assert.equal(fixture.getTicket(), null);
});
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };

test('failed authentication subscription releases the Vault created during bootstrap', () => {
    const events = [], failure = new Error('synthetic-subscribe-failed');
    assert.throws(() => createProtectedSession({getUser: () => ({uid: 'a'}), routes: {},
        subscribeUser() {throw failure;},
        createVault: () => ({lock: reason => events.push(reason), dispose: () => events.push('disposed')})
    }), error => error === failure);
    assert.deepEqual(events, ['bootstrap-failed', 'disposed']);
});

test('failed unlocked notification clears the real memory Vault before rejecting', async () => {
    let vault;
    const failure = new Error('synthetic-render-failed');
    const session = createProtectedSession({
        getUser: () => ({uid: 'synthetic-a'}), subscribeUser: () => () => {}, routes: {},
        createVault: callbacks => vault = createMemoryVault({unlockKey: async () => ({}),
            decryptRecord: async () => 'synthetic', ...callbacks}),
        onState({state}) {if (state === 'unlocked') throw failure;}
    });
    await assert.rejects(session.unlock(), error => error === failure);
    assert.equal(vault.isUnlocked(), false);
    assert.equal(session.check(), false);
    session.dispose();
});

test('physical unlock stays single-flight through lock until the old attempt settles', async () => {
    const pending = deferred(); let calls = 0;
    const f = fixture({unlockKey: () => {calls++; return calls === 1 ? pending.promise : Promise.resolve({});}});
    const first = f.session.unlock();
    const cancelled = assert.rejects(first, /UNLOCK_CANCELLED/);
    await assert.rejects(f.session.unlock(), /UNLOCK_PENDING/);
    assert.equal(calls, 1);
    f.session.lock();
    await assert.rejects(f.session.unlock(), /UNLOCK_PENDING/);
    assert.equal(calls, 1);
    pending.resolve({}); await cancelled;
    assert.equal(f.session.check(), false);
    await f.session.unlock();
    assert.equal(calls, 2); assert.equal(f.session.check(), true);
    f.session.dispose();
});

test('failed unlock releases physical single-flight for an explicit retry', async () => {
    let reject, calls = 0;
    const pending = new Promise((_, no) => {reject = no;});
    const f = fixture({unlockKey: () => {calls++; return calls === 1 ? pending : Promise.resolve({});}});
    const first = f.session.unlock(); const failed = assert.rejects(first, /synthetic-failure/);
    reject(new Error('synthetic-failure')); await failed;
    await f.session.unlock();
    assert.equal(calls, 2); assert.equal(f.session.check(), true);
    f.session.dispose();
});
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

test('live authorization for legacy plaintext rejects expired and disposed route contexts', async () => {
    let now = 0;
    const f = fixture({now: () => now, timeoutMs: 10});
    await f.session.unlock(); await f.session.navigate('private');
    const context = f.contexts.at(-1);
    context.assertUnlocked(); now = 11;
    assert.throws(() => context.assertUnlocked(), /VAULT_LOCKED/);
    assert.equal(context.signal.aborted, true);
    assert.throws(() => context.assertUnlocked(), /VIEW_DISPOSED/);
    f.session.dispose();
});

test('live authorization detects an identity change even before the Auth notification', async () => {
    const f = fixture(); await f.session.unlock(); await f.session.navigate('private');
    const context = f.contexts.at(-1); f.change('other', false);
    assert.throws(() => context.assertUnlocked(), /AUTH_CHANGED/);
    f.session.dispose();
});

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

test('encryption is a view-scoped capability with no key or unlocked state bypass', async () => {
    const f = fixture({encryptValue: async (_, value) => `cipher:${value}`});
    await f.session.navigate('private');
    await assert.rejects(f.contexts[0].encrypt('fixture'), /VAULT_LOCKED/);
    await f.session.unlock(); await f.session.navigate('private');
    const context = f.contexts.at(-1);
    assert.equal(await context.encrypt('fixture'), 'cipher:fixture');
    assert.equal(context.key, undefined); assert.equal(context.vault, undefined);
    await f.session.navigate('company');
    await assert.rejects(context.encrypt('fixture'), /VIEW_DISPOSED/);
    assert.equal(await f.contexts.at(-1).encrypt('fixture'), 'cipher:fixture');
});

for (const boundary of ['lock', 'logout', 'uid-change', 'delayed-auth', 'navigation', 'dispose']) {
    test(`pending encryption cannot escape its ${boundary} boundary`, async () => {
        const pending = deferred();
        const f = fixture({encryptValue: () => pending.promise});
        await f.session.unlock(); await f.session.navigate('private');
        const context = f.contexts[0], operation = context.encrypt('fixture');
        const rejected = assert.rejects(operation, /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        if (boundary === 'lock') f.session.lock();
        else if (boundary === 'logout') await f.session.logout(async () => f.change(null));
        else if (boundary === 'uid-change') f.change('b');
        else if (boundary === 'delayed-auth') f.change('b', false);
        else if (boundary === 'navigation') await f.session.navigate('company');
        else f.session.dispose();
        pending.resolve('stale-ciphertext'); await rejected;
        await assert.rejects(context.encrypt('again'), /VIEW_DISPOSED/);
    });
}
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
