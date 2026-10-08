import test from 'node:test';
import assert from 'node:assert/strict';
import {bindBrowserSession, clearLegacyUnlock} from './browser-session-boundary.mjs';
import {createProtectedSession} from './test-support/protected-session.mjs';
import {createMemoryVault} from './memory-vault.mjs';
import {createAdmissionGate} from './admission-gate.mjs';
import {createFirebaseAdmission} from './firebase-admission.mjs';
import {createAdmissionCoordinator} from './admission-coordinator.mjs';
import {createLocalPresentation} from './local-presentation.mjs';
import {createPrivateGatePresentation} from './private-gate-presentation.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function realPresentationGate() {
    const body = {hidden: true, inert: true}, redirects = [];
    const window = {addEventListener() {}, dispatchEvent() {}, location: {replace: value => redirects.push(value), reload() {}}};
    runInNewContext(readFileSync(new URL('../../Frontend/public/assets/js/private-auth-gate.js', import.meta.url), 'utf8'), {
        window, document: {body}, sessionStorage: {getItem: () => null, removeItem() {}},
        Event, setTimeout: () => 1, clearTimeout() {}
    });
    return {gate: window.privateAuthGate, body, redirects};
}

test('real private gate bridge revokes held tickets without weakening terminal block', () => {
    const {gate, body, redirects} = realPresentationGate();
    let user = null;
    const p = createPrivateGatePresentation({gate, getUser: () => user});
    assert.equal(p.beginIdentity(), null);
    user = {uid: 'a', emailVerified: true};
    const first = p.beginIdentity();
    assert.equal(p.acceptIdentity(first, user), true);
    assert.equal(body.hidden, false);
    p.invalidate();
    assert.equal(gate.active(first), true);
    assert.equal(p.active(first), false);
    assert.equal(p.acceptIdentity(first, user), false);
    const second = p.beginIdentity();
    assert.notEqual(second, first);
    gate.block();
    assert.equal(body.hidden, true);
    assert.equal(p.active(second), false);
    assert.equal(p.beginIdentity(), null);
    assert.ok(redirects.length);
    p.dispose();
    assert.throws(() => p.beginIdentity(), /DISPOSED/);
});

test('real private gate bridge rejects observed A/B/A and unverified identity', () => {
    const {gate} = realPresentationGate();
    let user = {uid: 'a', emailVerified: true};
    const p = createPrivateGatePresentation({gate, getUser: () => user});
    const a = p.beginIdentity();
    user = {uid: 'b', emailVerified: true};
    assert.equal(p.active(a), false);
    user = {uid: 'a', emailVerified: true};
    assert.equal(p.active(a), false);
    const next = p.beginIdentity();
    user.emailVerified = false;
    assert.equal(p.acceptIdentity(next, {uid: 'a', emailVerified: true}), false);
    user.emailVerified = true;
    assert.equal(p.acceptIdentity(next, user), true);
    user = {uid: 'b', emailVerified: true};
    assert.equal(p.beginIdentity(), null); // Existing gate requires a new document.
});

test('bridge cannot publish a ticket after reentrant dispose on second identity read', () => {
    const {gate} = realPresentationGate();
    let p, reads = 0;
    p = createPrivateGatePresentation({gate, getUser: () => {
        if (++reads === 2) p.dispose();
        return {uid: 'a', emailVerified: true};
    }});
    assert.equal(p.beginIdentity(), null);
    assert.equal(p.getTicket(), null);
});

test('bridge retains newer begin across throwing obsolete begin and checks gate reentrancy', () => {
    const {gate: real} = realPresentationGate();
    let action = () => {}, p;
    const gate = {begin(uid) {action(); return real.begin(uid);},
        active(ticket) {action(); return real.active(ticket);},
        acceptIdentity: (...args) => real.acceptIdentity(...args)};
    p = createPrivateGatePresentation({gate, getUser: () => ({uid: 'a', emailVerified: true})});
    let newer;
    action = () => {action = () => {}; newer = p.beginIdentity(); throw new Error('obsolete');};
    assert.throws(() => p.beginIdentity(), /obsolete/);
    assert.equal(p.getTicket(), newer);
    action = () => p.invalidate();
    assert.equal(p.active(newer), false);
});

test('local presentation binds opaque tickets to current verified identity and loopback', () => {
    let user = {uid: 'a', emailVerified: true};
    assert.throws(() => createLocalPresentation({origin: 'https://example.invalid', getUser: () => user}), /LOCAL_EMULATOR_ONLY/);
    const p = createLocalPresentation({origin: 'http://127.0.0.1:4188', getUser: () => user});
    const a = p.getTicket();
    assert.equal(p.getTicket(), a);
    assert.equal(p.active(a), true);
    assert.equal(p.acceptIdentity(a, user), true);
    user = {uid: 'a', emailVerified: false};
    assert.equal(p.acceptIdentity(a, {uid: 'a', emailVerified: true}), false);
    user = {uid: 'b', emailVerified: true};
    assert.equal(p.active(a), false);
    assert.notEqual(p.getTicket(), a);
    user = null;
    assert.equal(p.getTicket(), null);
    user = {uid: 'a', emailVerified: true};
    assert.equal(p.active(a), false);
    const next = p.getTicket(); p.invalidate();
    assert.equal(p.active(next), false);
    p.dispose(); assert.equal(p.getTicket(), null); assert.equal(p.active(next), false);
});

test('local presentation propagates identity errors and rejects reentrant invalidation', () => {
    let action = () => ({uid: 'a', emailVerified: true});
    const p = createLocalPresentation({origin: 'http://127.0.0.1:4188', getUser: () => action()});
    const ticket = p.getTicket();
    action = () => {p.invalidate(); return {uid: 'a', emailVerified: true};};
    assert.equal(p.active(ticket), false);
    assert.equal(p.getTicket(), null);
    action = () => {throw new Error('synthetic-reader-error');};
    assert.throws(() => p.getTicket(), /synthetic-reader-error/);
    action = () => {p.dispose(); return {uid: 'a', emailVerified: true};};
    assert.equal(p.getTicket(), null);
});

test('browser revocation still disposes and attempts every cleanup when removal fails', () => {
    const handlers = new Map(), removed = [];
    const failure = new Error('synthetic-remove-failed');
    let disposed = 0, cleared = 0;
    const target = {
        addEventListener(name, handler) {handlers.set(name, handler);},
        removeEventListener(name) {removed.push(name); if (name === 'pagehide') throw failure;},
        setInterval() {return 1;}, clearInterval() {cleared++;}
    };
    const detach = bindBrowserSession({dispose() {disposed++;}}, target);
    assert.throws(() => handlers.get('private-auth-blocked')({}), error => error === failure);
    assert.equal(disposed, 1);
    assert.deepEqual(removed, ['pagehide', 'pageshow', 'private-auth-blocked', 'freeze']);
    assert.equal(cleared, 1);
    detach();
    handlers.get('private-auth-blocked')({});
    assert.equal(disposed, 1);
});

function coordinatorFixture() {
    const state = {uid: 'synthetic-a', active: true, refused: [], readError: false};
    const deps = {
        getUser() {if (state.readError) throw new Error('identity unavailable'); return {uid: state.uid};},
        getTicket: () => 7,
        isTicketActive: () => state.active,
        admission: {check: async () => ({ok: true, uid: state.uid}), invalidate() {}, dispose() {}},
        onRefused: code => state.refused.push(code)
    };
    // Wrappers allow explicit synthetic faults without replacing production dependencies.
    const coordinator = createAdmissionCoordinator({
        getUser: () => deps.getUser(), getTicket: () => deps.getTicket(),
        isTicketActive: t => deps.isTicketActive(t), admission: deps.admission,
        onRefused: code => deps.onRefused(code)
    });
    return {state, deps, coordinator};
}

test('admission coordinator refuses current rejection and identity-read failure', async () => {
    for (const fault of ['rejection', 'identity']) {
        const {state, deps, coordinator: c} = coordinatorFixture();
        const s = c.begin('unlock');
        deps.admission.check = async () => {
            if (fault === 'identity') state.readError = true;
            throw new Error('synthetic failure');
        };
        await assert.rejects(c.check(s), /ADMISSION_REFUSED/);
        assert.equal(state.refused.length, 1);
        assert.throws(() => c.assertCurrent(s), /ATTEMPT_OBSOLETE/);
    }
});

test('admission coordinator drops late results without refusing newer navigation', async () => {
    for (const action of ['navigate', 'invalidate', 'uid', 'dispose']) {
        const {state, deps, coordinator: c} = coordinatorFixture();
        let reject;
        deps.admission.check = () => new Promise((_, r) => {reject = r;});
        const pending = c.check(c.begin('navigate'));
        if (action === 'navigate') c.begin('navigate');
        if (action === 'invalidate') c.invalidate();
        if (action === 'uid') state.uid = 'synthetic-b';
        if (action === 'dispose') c.dispose();
        reject(new Error('old failure'));
        await assert.rejects(pending, /ATTEMPT_OBSOLETE/);
        assert.deepEqual(state.refused, []);
    }
});

test('admission coordinator checks ticket after admission and rejects malformed success', async () => {
    const {state, deps, coordinator: c} = coordinatorFixture();
    const s = c.begin('unlock');
    assert.deepEqual(await c.check(s), {uid: 'synthetic-a'});
    state.active = false;
    assert.throws(() => c.assertCurrent(s), /ADMISSION_REFUSED/);
    state.active = true;
    deps.admission.check = async () => ({ok: 'true', uid: state.uid});
    await assert.rejects(c.check(c.begin('unlock')), /ADMISSION_REFUSED/);
    assert.equal(state.refused.length, 2);
    assert.throws(() => c.assertCurrent({...s}), /INVALID_ADMISSION_ATTEMPT/);
});

test('admission coordinator distinguishes throwing and reentrant ticket callbacks', () => {
    for (const callback of ['getTicket', 'isTicketActive', 'getUser']) {
        for (const invalidate of [false, true]) {
            const {state, deps, coordinator: c} = coordinatorFixture();
            const s = c.begin('unlock');
            deps[callback] = () => {if (invalidate) c.invalidate(); throw new Error('synthetic');};
            assert.throws(() => callback === 'getTicket' ? c.begin('unlock') : c.assertCurrent(s),
                invalidate ? /ATTEMPT_OBSOLETE/ : /ADMISSION_REFUSED/);
            assert.equal(state.refused.length, invalidate ? 0 : 1);
        }
    }
});

test('admission coordinator preserves cleanup errors and disposal invalidates once', () => {
    const {deps, coordinator: c} = coordinatorFixture();
    let disposed = 0;
    const s = c.begin('unlock'), error = new Error('cleanup failure');
    deps.onRefused = () => {throw error;};
    deps.isTicketActive = () => false;
    assert.throws(() => c.assertCurrent(s), e => e === error);
    deps.admission.dispose = () => {disposed++; throw error;};
    assert.throws(() => c.dispose(), e => e === error);
    c.dispose();
    assert.equal(disposed, 1);
    assert.throws(() => c.begin('unlock'), /SESSION_DISPOSED/);
});

function firebaseAdmissionFixture({online = true, server, cache} = {}) {
    const auth = {currentUser: {uid: 'synthetic-a', emailVerified: true}}, calls = [];
    const snapshot = {exists: () => true, data: () => ({passwordPolicyVersion: 1})};
    const presentationGate = {
        active(ticket) {assert.equal(this, presentationGate); return ticket === 7;},
        acceptIdentity(ticket, user) {assert.equal(this, presentationGate); assert.equal(user, auth.currentUser); return ticket === 7;}
    };
    const sdk = {
        async reload(user) {assert.equal(user, auth.currentUser); calls.push('reload');},
        doc(db, ...path) {assert.deepEqual(path, ['users', 'synthetic-a']); calls.push('doc'); return path;},
        getDocFromServer(ref) {calls.push('server'); return server ? server(ref) : Promise.resolve(snapshot);},
        getDocFromCache(ref) {calls.push('cache'); return cache ? cache(ref) : Promise.resolve(snapshot);}
    };
    const deps = {auth, db: {}, presentationGate, isOnline: () => online, enableAppCheck: () => calls.push('appcheck'), requiredPolicyVersion: 1, sdk};
    return {auth, calls, deps, gate: createFirebaseAdmission(deps)};
}

test('Firebase admission selects server or cache exclusively and preserves presentation binding', async () => {
    for (const online of [true, false]) {
        const h = firebaseAdmissionFixture({online});
        assert.deepEqual(await h.gate.check({ticket: 7}), {ok: true, uid: 'synthetic-a', online});
        assert.deepEqual(h.calls, online ? ['reload', 'appcheck', 'doc', 'server'] : ['doc', 'cache']);
    }
});

test('Firebase admission refuses a failed server read without cache fallback', async () => {
    const h = firebaseAdmissionFixture({server: async () => {throw new Error('synthetic-server-error');}});
    assert.deepEqual(await h.gate.check({ticket: 7}), {ok: false, code: 'policy-load-failed'});
    assert.equal(h.calls.includes('cache'), false);
});

test('Firebase admission rejects changed owner after pending read before reading data', async () => {
    let resolve, started; const reading = new Promise(yes => {started = yes;});
    const h = firebaseAdmissionFixture({server: () => {started(); return new Promise(yes => {resolve = yes;});}});
    const pending = h.gate.check({ticket: 7}); await reading;
    h.auth.currentUser = {uid: 'synthetic-b', emailVerified: true};
    resolve({exists() {throw new Error('stale snapshot must not be inspected');}});
    assert.deepEqual(await pending, {ok: false, code: 'uid-mismatch'});
});

test('Firebase admission refuses missing cache and malformed snapshots without network fallback', async () => {
    for (const snapshot of [null, {exists: () => 'yes'}, {exists: () => true, data: () => []}]) {
        const h = firebaseAdmissionFixture({online: false, cache: async () => snapshot});
        assert.equal((await h.gate.check({ticket: 7})).code, 'policy-load-failed');
        assert.deepEqual(h.calls, ['doc', 'cache']);
    }
    const h = firebaseAdmissionFixture({online: false, cache: async () => ({exists: () => false})});
    assert.equal((await h.gate.check({ticket: 7})).code, 'policy-insufficient');
    assert.throws(() => createFirebaseAdmission({...h.deps, sdk: {}}), /INVALID_ADMISSION_DEPENDENCY/);
});

function admissionFixture(overrides = {}) {
    const state = {user: {uid: 'synthetic-a', emailVerified: true}, online: true};
    const calls = [];
    const deps = {getUser: () => state.user, isOnline: () => state.online,
        reloadUser: async () => {calls.push('reload');}, isIdentityActive: () => true,
        acceptIdentity: () => {calls.push('identity'); return true;},
        enableAppCheck: () => {calls.push('appcheck');},
        loadPolicy: async ({source}) => {calls.push(source); return {passwordPolicyVersion: 1};},
        requiredPolicyVersion: 1, ...overrides};
    return {state, calls, gate: createAdmissionGate(deps)};
}
test('admission snapshots online mode and selects explicit policy source', async () => {
    for (const online of [true, false]) {
        const h = admissionFixture(); h.state.online = online;
        assert.deepEqual(await h.gate.check({ticket: 1}), {ok: true, uid: 'synthetic-a', online});
        assert.deepEqual(h.calls, online ? ['reload', 'identity', 'appcheck', 'server-only'] : ['identity', 'cache-only']);
    }
});
test('admission never interprets indeterminate connectivity as offline', async () => {
    for (const value of [undefined, null, 0, 1, 'false', {}]) {
        const h = admissionFixture({isOnline: () => value});
        assert.equal((await h.gate.check()).code, 'online-indeterminate'); assert.deepEqual(h.calls, []);
    }
});
test('admission fails closed for dependency errors and online reload failure', async () => {
    for (const [name, code] of [['getUser', 'user-unavailable'], ['isOnline', 'online-indeterminate'], ['reloadUser', 'reload-failed'], ['enableAppCheck', 'appcheck-failed'], ['loadPolicy', 'policy-load-failed']]) {
        const h = admissionFixture({[name]: () => {throw Error('synthetic');}});
        assert.equal((await h.gate.check()).code, code); assert.ok(!h.calls.includes('cache-only'));
    }
});
test('admission rejects unverified identity and malformed or insufficient policy', async () => {
    const h = admissionFixture(); h.state.user.emailVerified = false;
    assert.equal((await h.gate.check()).code, 'email-unverified');
    assert.deepEqual(h.calls, ['reload']);
    for (const value of [-1, 1.5, Infinity, '1', NaN]) {
        const candidate = admissionFixture({loadPolicy: async () => ({passwordPolicyVersion: value})});
        assert.equal((await candidate.gate.check()).code, 'policy-malformed');
    }
    for (const value of [null, {}, {passwordPolicyVersion: 0}]) {
        assert.equal((await admissionFixture({loadPolicy: async () => value}).gate.check()).code, 'policy-insufficient');
    }
    assert.equal((await admissionFixture({loadPolicy: async () => []}).gate.check()).code, 'policy-malformed');
});
test('admission invalidation and UID change outrank obsolete asynchronous errors', async () => {
    for (const mode of ['invalidate', 'dispose', 'uid']) {
        let reject;
        const h = admissionFixture({reloadUser: () => new Promise((yes, no) => {reject = no;})});
        const pending = h.gate.check();
        if (mode === 'uid') h.state.user = {uid: 'synthetic-b', emailVerified: true}; else h.gate[mode]();
        reject(Error('obsolete'));
        assert.equal((await pending).code, {invalidate: 'invalidated', dispose: 'disposed', uid: 'uid-mismatch'}[mode]);
        assert.deepEqual(h.calls, []);
    }
});
test('admission rechecks after synchronous callbacks and pending policy', async () => {
    for (const hook of ['acceptIdentity', 'enableAppCheck']) {
        let h;
        h = admissionFixture({[hook]: () => {h.gate.invalidate(); return true;}});
        assert.equal((await h.gate.check()).code, 'invalidated'); assert.ok(!h.calls.includes('server-only'));
    }
    let resolve;
    const h = admissionFixture({loadPolicy: () => new Promise(yes => {resolve = yes;})});
    const pending = h.gate.check();
    await new Promise(yes => setImmediate(yes));
    h.state.user.emailVerified = false; resolve({passwordPolicyVersion: 1});
    assert.equal((await pending).code, 'email-unverified');
});

function browserFixture() {
    const retained = [], timers = new Map(), listeners = new Set();
    class Target extends EventTarget {
        addEventListener(type, handler, options) {
            super.addEventListener(type, handler, options);
            const item = {target: this, type, handler}; listeners.add(item); retained.push(item);
        }
        removeEventListener(type, handler, options) {
            super.removeEventListener(type, handler, options);
            for (const item of listeners) if (item.target === this && item.type === type && item.handler === handler) listeners.delete(item);
        }
    }
    const target = new Target(), document = new Target(); document.hidden = false;
    target.document = document;
    target.setInterval = (callback, delay) => {assert.equal(delay, 1000); timers.set(callback, callback); return callback;};
    target.clearInterval = id => timers.delete(id);
    return {target, document, timers, listeners, retained};
}

test('the session boundary owns activity, background lock and periodic expiry checks', () => {
    const f = browserFixture(), calls = [];
    const detach = bindBrowserSession({touch: () => calls.push('touch'), lock: reason => calls.push(reason),
        check: () => calls.push('check')}, f.target);
    f.document.dispatchEvent(new Event('pointerdown'));
    f.document.dispatchEvent(new Event('keydown'));
    f.document.dispatchEvent(new Event('visibilitychange'));
    f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange'));
    f.document.dispatchEvent(new Event('freeze'));
    for (const callback of f.timers.values()) callback();
    assert.deepEqual(calls, ['touch', 'touch', 'background', 'freeze', 'check']);
    detach(); assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
});

test('revocation detaches everything and already queued callbacks cannot touch a disposed session', () => {
    const f = browserFixture(), calls = [];
    const detach = bindBrowserSession({touch: () => calls.push('touch'), lock: () => calls.push('lock'),
        check: () => calls.push('check'), dispose: () => calls.push('dispose')}, f.target);
    assert.equal(f.timers.size, 1);
    const ticks = [...f.timers.values()];
    f.target.dispatchEvent(new Event('private-auth-blocked'));
    assert.deepEqual(calls, ['dispose']);
    assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
    f.document.hidden = true;
    for (const {handler, type} of f.retained) handler({type, persisted: true});
    for (const tick of ticks) tick();
    detach(); detach();
    assert.deepEqual(calls, ['dispose']);
});

test('partial listener setup failure rolls back resources before propagating the error', () => {
    const f = browserFixture();
    f.document.addEventListener = () => {throw Error('synthetic-listener-failure');};
    assert.throws(() => bindBrowserSession({}, f.target), /synthetic-listener-failure/);
    assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
});

test('timer setup failure and repeated mount/dispose do not retain listeners', () => {
    const f = browserFixture(), schedule = f.target.setInterval;
    f.target.setInterval = () => {throw Error('synthetic-timer-failure');};
    assert.throws(() => bindBrowserSession({}, f.target), /synthetic-timer-failure/);
    assert.equal(f.listeners.size, 0);
    f.target.setInterval = schedule;
    for (let attempt = 0; attempt < 3; attempt++) {
        const detach = bindBrowserSession({}, f.target);
        assert.equal(f.listeners.size, 7); assert.equal(f.timers.size, 1);
        detach(); detach();
        assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
    }
});

test('periodic checks expire a real Vault without a view read and activity cannot revive expiry', async () => {
    const f = browserFixture(); let now = 0, context, cleaned = 0;
    const session = createProtectedSession({getUser: () => ({uid: 'synthetic-owner'}), subscribeUser: () => () => {},
        routes: {home: value => {context = value; return () => {cleaned++;};}},
        createVault: options => createMemoryVault({...options, now: () => now, timeoutMs: 60_000,
            unlockKey: async () => 'synthetic-key', decryptRecord: async () => 'synthetic-value'})});
    const detach = bindBrowserSession(session, f.target);
    try {
        await session.unlock(); await session.navigate('home');
        now = 30_000; f.document.dispatchEvent(new Event('pointerdown'));
        now = 60_000; for (const tick of f.timers.values()) tick();
        assert.equal(context.signal.aborted, false);
        now = 90_000; for (const tick of f.timers.values()) tick();
        assert.equal(context.signal.aborted, true); assert.equal(cleaned, 1);
        f.document.dispatchEvent(new Event('keydown'));
        assert.equal(session.check(), false);
    } finally {detach(); session.dispose();}
});

test('cutover removes only legacy unlock material without reading or writing stored values', () => {
    const values = new Map(['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry', 'preference', 'codex_explicit_logout'].map(name => [name, 'synthetic']));
    clearLegacyUnlock({removeItem: name => values.delete(name), getItem() { assert.fail('must not recover legacy key'); }, setItem() { assert.fail('must not persist key'); }});
    assert.deepEqual([...values.keys()], ['preference', 'codex_explicit_logout']);
});

test('inaccessible storage aborts cutover rather than silently retaining a recoverable key', () => {
    assert.throws(() => clearLegacyUnlock({removeItem() { throw new Error('storage denied'); }}), /storage denied/);
    clearLegacyUnlock(undefined); // Node emulator has no browser storage.
});

test('a failed legacy removal does not prevent removal of the remaining unlock material', () => {
    const names = ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry'];
    for (const failed of names) {
        const values = new Map([...names, 'preference'].map(name => [name, 'synthetic']));
        const attempted = [], failure = new Error('synthetic removal failure');
        assert.throws(() => clearLegacyUnlock({removeItem(name) {
            attempted.push(name);
            if (name === failed) throw failure;
            values.delete(name);
        }}), error => error === failure);
        assert.deepEqual(attempted, names);
        assert.deepEqual([...values.keys()], [failed, 'preference']);
    }
});

test('missing removal method and throwing getter cannot silently accept cutover', () => {
    assert.throws(() => clearLegacyUnlock({}), TypeError);
    assert.throws(() => clearLegacyUnlock({removeItem: 42}), TypeError);
    let attempts = 0;
    const failure = new Error('synthetic getter denied');
    assert.throws(() => clearLegacyUnlock({get removeItem() {
        attempts++; throw failure;
    }}), error => error === failure);
    assert.equal(attempts, 4);
});

test('retry after partial cleanup removes remaining material and preserves preferences', () => {
    const values = new Map([['vault_session_v1', 'synthetic'], ['vault_s_key', 'synthetic'], ['preference', 'keep']]);
    let denied = true;
    const storage = {removeItem(name) {
        if (denied && name === 'vault_session_v1') throw new Error('synthetic denial');
        values.delete(name);
    }};
    assert.throws(() => clearLegacyUnlock(storage), /synthetic denial/);
    assert.deepEqual([...values.keys()], ['vault_session_v1', 'preference']);
    denied = false;
    clearLegacyUnlock(storage);
    clearLegacyUnlock(storage);
    assert.deepEqual([...values], [['preference', 'keep']]);
});

test('multiple removal failures remain fatal including falsy thrown values', () => {
    const attempted = [];
    let caught = false;
    try {
        clearLegacyUnlock({removeItem(name) {attempted.push(name); throw null;}});
    } catch (error) {caught = true; assert.equal(error, null);}
    assert.equal(caught, true);
    assert.equal(attempted.length, 4);
});

for (const type of ['pagehide', 'freeze', 'pageshow', 'private-auth-blocked']) {
    test(`${type} clears a real memory session and prevents late plaintext from reaching its view`, async () => {
        let release, context;
        const events = new EventTarget();
        const session = createProtectedSession({getUser: () => ({uid: 'synthetic-owner'}), subscribeUser: () => () => {},
            routes: {home: current => { context = current; }},
            createVault: options => createMemoryVault({...options, unlockKey: async () => 'synthetic-key',
                decryptRecord: () => new Promise(resolve => { release = resolve; })})});
        const detach = bindBrowserSession(session, events);
        await session.unlock(); await session.navigate('home');
        const pending = context.read({});
        const denied = assert.rejects(pending, /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        const event = new Event(type); if (type === 'pageshow') Object.defineProperty(event, 'persisted', {value: true});
        events.dispatchEvent(event);
        assert.equal(session.check(), false);
        release('synthetic-plaintext'); await denied;
        if (type === 'private-auth-blocked') await assert.rejects(session.unlock(), /SESSION_DISPOSED/);
        detach(); session.dispose();
    });
}

test('ordinary pageshow does not lock and disposal removes event listeners', () => {
    const events = new EventTarget(); let calls = 0;
    const detach = bindBrowserSession({lock() { calls++; }, dispose() { calls++; }}, events);
    events.dispatchEvent(new Event('pageshow')); assert.equal(calls, 0);
    detach(); events.dispatchEvent(new Event('pagehide')); events.dispatchEvent(new Event('private-auth-blocked'));
    assert.equal(calls, 0);
});
