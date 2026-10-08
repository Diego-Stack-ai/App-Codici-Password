import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../Frontend/public/assets/js/main-v129.js', import.meta.url), 'utf8');
const start = source.indexOf('    // --- N1: avvisi di revoca ---');
const end = source.indexOf('    // --- fine N1 avvisi di revoca ---');
assert.ok(start >= 0 && end > start);
const id = n => `n1rev-n-${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const snapshot = ids => ({docs: ids.map(value => ({id: value, data: () => ({type: 'share_revoked', read: false, n1Protocol: 'n1-invite-revocation'})}))});
function fixture() {
    const modals = [], callbacks = [], writes = [], events = new Map();
    let ack = async () => {};
    const node = (tag, props = {}, children = []) => ({tag, ...props, children, removed: false,
        remove() {this.removed = true;}});
    const auth = {currentUser: {uid: 'A'}};
    const context = vm.createContext({auth, db: {}, console: {warn() {}},
        window: {addEventListener: (name, fn) => events.set(name, fn)},
        document: {body: {appendChild: value => modals.push(value)}}, createElement: node,
        collection: (_db, ...parts) => parts.join('/'), doc: (_db, ...parts) => parts.join('/'),
        query: (...parts) => parts, where: (...parts) => parts, limit: n => n,
        onSnapshot: (query, next, error) => {const c = {query, next, error, stopped: false}; callbacks.push(c); return () => {c.stopped = true;};},
        updateDoc: async (path, patch) => {writes.push({path, patch: {...patch}}); await ack();}
    });
    vm.runInContext(source.slice(start, end), context);
    const begin = (uid = 'A') => {
        auth.currentUser = uid ? {uid} : null;
        return vm.runInContext('++n1CallbackEpoch; stopN1ShareRevokedNotices(); n1CallbackEpoch', context);
    };
    const open = (uid = 'A', epoch = begin(uid)) => vm.runInContext(`startN1ShareRevokedNotices(${JSON.stringify(uid)}, undefined, ${epoch})`, context);
    const live = () => modals.filter(m => !m.removed);
    const button = () => live()[0].children[0].children[2].children[0];
    return {modals, callbacks, writes, auth, begin, open, live, button,
        deliver: (ids, index = callbacks.length - 1) => callbacks[index].next(snapshot(ids)),
        hide: () => events.get('pagehide')(), block: () => events.get('private-auth-blocked')(),
        setGate: gate => {context.window.privateAuthGate = gate;}, setAck: fn => {ack = fn;}};
}
test('query filters legacy records before limiting; protocol guard rejects malformed snapshots', async () => {
    const {createRequire} = await import('node:module');
    const require = createRequire(import.meta.url);
    const {acceptanceNotificationPayload} = require('../functions/invite-acceptance-receipt.js');
    const f = fixture(); f.open();
    const rows = Array.from({length: 25}, (_, n) => ({id: `0legacy-${n}`, data: () => ({type: 'share_revoked', read: false})}));
    rows.push({id: id(99), data: acceptanceNotificationPayload});
    const query = f.callbacks[0].query;
    const filters = query.filter(p => Array.isArray(p) && p[1] === '==');
    const count = query.find(p => Number.isInteger(p));
    assert.equal(count, 20);
    assert.ok(filters.some(p => p[0] === 'n1Protocol' && p[2] === acceptanceNotificationPayload().n1Protocol));
    const run = conditions => rows.filter(row => conditions.every(([key, , value]) => row.data()[key] === value)).slice(0, count);
    assert.equal(run(filters.filter(p => p[0] !== 'n1Protocol')).some(row => row.id === id(99)), false);
    f.callbacks[0].next({docs: run(filters)});
    assert.equal(f.live().length, 1);
    await f.button().onclick();
    assert.equal(f.writes[0].path, `users/A/notifications/${id(99)}`);
    assert.deepEqual(f.writes[0].patch, {read: true});
    f.callbacks[0].next({docs: [{id: id(100), data: () => ({type: 'share_revoked', read: false})}]});
    assert.equal(f.live().length, 0);
});

test('duplicates do not display twice or mark read automatically', () => {
    const f = fixture(); f.open(); f.deliver([id(1)]); f.deliver([id(1)]);
    assert.equal(f.live().length, 1); assert.equal(f.writes.length, 0);
});
test('gate must be ready and blocking immediately removes listener and modal', async () => {
    const f = fixture(); let ready = false;
    f.setGate({active: () => true, isReady: () => ready});
    f.open(); assert.equal(f.callbacks.length, 0);
    ready = true; f.open(); f.deliver([id(1)]);
    const button = f.button(); ready = false; f.block(); await button.onclick();
    assert.equal(f.live().length, 0); assert.equal(f.writes.length, 0);
    assert.equal(f.callbacks[0].stopped, true);
});
test('stale UID and same-UID epochs cannot replace current instance', () => {
    const f = fixture(); const old = f.begin(); f.open('A', old);
    f.open('B'); f.deliver([id(1)], 0);
    assert.equal(f.live().length, 0);
    f.open('A'); const latest = f.callbacks.length;
    f.open('A', old); assert.equal(f.callbacks.length, latest);
    f.deliver([id(1)], 0); assert.equal(f.live().length, 0);
});
test('pagehide invalidates callbacks, ACK and delayed start', async () => {
    const f = fixture(); const epoch = f.begin(); f.open('A', epoch); f.deliver([id(1)]);
    const button = f.button(); f.hide(); await button.onclick(); f.deliver([id(2)]); f.open('A', epoch);
    assert.equal(f.live().length, 0); assert.equal(f.writes.length, 0);
    assert.equal(f.callbacks.length, 1); assert.equal(f.callbacks[0].stopped, true);
});
test('snapshot during deferred ACK does not release busy or lose next ACK', async () => {
    const f = fixture(); let resolve;
    f.setAck(() => new Promise(done => {resolve = done;})); f.open(); f.deliver([id(1), id(2)]);
    const firstButton = f.button(); const first = firstButton.onclick();
    f.deliver([id(2)]); assert.equal(f.live().length, 0);
    await firstButton.onclick(); assert.equal(f.writes.length, 1);
    resolve(); await first; assert.equal(f.live().length, 1);
    f.setAck(async () => {}); await f.button().onclick();
    assert.equal(f.writes.length, 2);
    assert.equal(f.writes[1].path, `users/A/notifications/${id(2)}`);
    assert.deepEqual(f.writes[1].patch, {read: true});
});
test('failed ACK remains retryable and only updates read', async () => {
    const f = fixture(); f.setAck(async () => {throw new Error('synthetic');});
    f.open(); f.deliver([id(1)]); await f.button().onclick();
    assert.equal(f.live().length, 1);
    f.setAck(async () => {}); await f.button().onclick();
    assert.equal(f.live().length, 0); assert.equal(f.writes.length, 2);
    f.writes.forEach(w => assert.deepEqual(w.patch, {read: true}));
});
test('full snapshot removes remote-read queued notice and fills next page', async () => {
    const f = fixture(); f.open(); f.deliver(Array.from({length: 20}, (_, n) => id(n + 1)));
    f.deliver([id(1), id(21)]);
    await f.button().onclick(); assert.equal(f.live().length, 1);
    await f.button().onclick(); assert.equal(f.writes[1].path.endsWith(id(21)), true);
});
