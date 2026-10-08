import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndexedDbQueueLease} from './indexeddb-queue-lease.mjs';

// Serialized IDB request/event boundary, draft writes commit only on completion.
// A guard get and queue put share one transaction, including rollback on abort.
function fixture() {
    const data = new Map([['queueLeases', new Map()], ['operations', new Map()]]);
    let tail = Promise.resolve(), clock = 1000, beforeTransaction, failWrite = false;
    const database = {transaction(names, mode) {
        names = Array.isArray(names) ? names : [names];
        const requests = [];
        const tx = {db: database, mode, aborted: false, abort() { this.aborted = true; }, objectStore(name) {
            if (!names.includes(name)) throw new Error('STORE_NOT_IN_TRANSACTION');
            const enqueue = (action, key, value) => { const request = {}; requests.push({name, action, key, value, request}); return request; };
            return {get: key => enqueue('get', key), put: value => enqueue('put', value.id, value)};
        }};
        tail = tail.then(() => new Promise(resolve => setImmediate(() => {
            if (beforeTransaction) { const hook = beforeTransaction; beforeTransaction = null; hook(); }
            const drafts = new Map(names.map(name => [name, structuredClone(data.get(name))]));
            while (requests.length && !tx.aborted) {
                const {name, action, key, value, request} = requests.shift();
                if (action === 'get') request.result = structuredClone(drafts.get(name).get(key));
                else if (failWrite && name === 'operations') {
                    tx.error = new Error('SYNTHETIC_REQUEST_FAILED'); tx.abort(); break;
                } else drafts.get(name).set(key, structuredClone(value));
                try { request.onsuccess?.(); } catch (error) { tx.error = error; tx.abort(); }
            }
            if (!tx.aborted && mode === 'readwrite') for (const [name, draft] of drafts) data.set(name, draft);
            if (tx.aborted) tx.onabort?.(); else tx.oncomplete?.();
            resolve();
        })));
        return tx;
    }};
    const client = holderId => createIndexedDbQueueLease({database, uid: 'owner', holderId, now: () => clock, ttlMs: 100});
    const guard = (lease, callback) => new Promise((resolve, reject) => {
        const tx = database.transaction(['queueLeases', 'operations'], 'readwrite');
        let reason;
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(reason || tx.error || new Error('ABORTED'));
        lease.guardTransaction(tx, () => callback(tx.objectStore('operations')), error => { reason = error; });
    });
    return {data, database, client, guard, set failWrite(value) { failWrite = value; },
        set clock(value) { clock = value; }, set beforeTransaction(hook) { beforeTransaction = hook; }};
}

test('two simultaneous acquisitions grant one holder and token; expiry allows a new generation', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.client('A').acquire(), f.client('B').acquire()]);
    assert.equal(a.token, 1); assert.equal(b, null);
    f.clock = 1100;
    const replacement = await f.client('B').acquire();
    assert.equal(replacement.token, 2); assert.equal(await a.isCurrent(), false); assert.equal(await replacement.isCurrent(), true);
});

test('a resumed stale holder cannot renew, release or mutate the queue after takeover', async () => {
    const f = fixture(), a = await f.client('A').acquire();
    f.clock = 1101; const b = await f.client('B').acquire();
    const before = structuredClone(f.data.get('queueLeases').get('owner'));
    assert.equal(await a.renew(), false); assert.equal(await a.release(), false);
    let callbacks = 0;
    await assert.rejects(f.guard(a, store => { callbacks++; store.put({id: 'op', value: 'stale'}); }), /LEASE_LOST/);
    assert.equal(callbacks, 0); assert.equal(f.data.get('operations').size, 0);
    assert.deepEqual(f.data.get('queueLeases').get('owner'), before);
    await f.guard(b, store => store.put({id: 'op', value: 'current'}));
    assert.equal(f.data.get('operations').get('op').value, 'current');
});

test('renew extends only the current lease; release preserves token and prevents ABA', async () => {
    const f = fixture(), a = await f.client('A').acquire();
    f.clock = 1050; assert.equal(await a.renew(), true);
    f.clock = 1101; assert.equal(await f.client('B').acquire(), null);
    assert.equal(await a.release(), true);
    const next = await f.client('A').acquire(); assert.equal(next.token, 2);
    assert.equal(await a.release(), false); assert.equal(await next.isCurrent(), true);
});

test('guard rollback includes queued writes when callback throws or returns a promise', async () => {
    const f = fixture(), lease = await f.client('A').acquire();
    await assert.rejects(f.guard(lease, store => { store.put({id: 'op'}); throw new Error('SYNTHETIC_FAILURE'); }), /SYNTHETIC_FAILURE/);
    await assert.rejects(f.guard(lease, store => { store.put({id: 'op'}); return Promise.resolve(); }), /ASYNC_MUTATION_FORBIDDEN/);
    await assert.rejects(f.guard(lease, async store => { store.put({id: 'op'}); throw new Error('ASYNC_SYNTHETIC_FAILURE'); }), /ASYNC_MUTATION_FORBIDDEN/);
    // Let the rejection microtask run: node:test fails on an unhandled rejection.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.data.get('operations').size, 0);
});

test('foreign database and readonly transaction cannot invoke a mutation callback', async () => {
    const f = fixture(), lease = await f.client('A').acquire();
    const foreign = fixture(); await foreign.client('A').acquire();
    let callbacks = 0;
    for (const tx of [foreign.database.transaction(['queueLeases', 'operations'], 'readwrite'),
        f.database.transaction(['queueLeases', 'operations'], 'readonly')]) {
        assert.throws(() => lease.guardTransaction(tx, () => { callbacks++; }), /LEASE_GUARD_INVALID/);
    }
    assert.equal(callbacks, 0);
    assert.equal(f.data.get('operations').size, 0); assert.equal(foreign.data.get('operations').size, 0);
});

test('failed IndexedDB mutation request rejects completion without committing queue data', async () => {
    const f = fixture(), lease = await f.client('A').acquire();
    f.failWrite = true;
    await assert.rejects(f.guard(lease, store => store.put({id: 'op', value: 'synthetic'})), /SYNTHETIC_REQUEST_FAILED/);
    assert.equal(f.data.get('operations').size, 0);
    assert.equal(await lease.isCurrent(), true);
});

test('expiry is checked in the mutation transaction, including suspension before its callback', async () => {
    const f = fixture(), lease = await f.client('A').acquire();
    assert.equal(await lease.isCurrent(), true);
    f.beforeTransaction = () => { f.clock = 1100; };
    await assert.rejects(f.guard(lease, store => store.put({id: 'op'})), /LEASE_LOST/);
    assert.equal(f.data.get('operations').size, 0);
    assert.equal(await lease.renew(), false);
});

test('malformed persisted metadata and exhausted token fail closed without replacement', async () => {
    for (const patch of [{token: 0}, {token: '1'}, {version: 2}, {holderId: {}}, {expiresAt: NaN}, {id: 'other'}, {updatedAt: -1}]) {
        const f = fixture(); await f.client('A').acquire();
        const bad = {...f.data.get('queueLeases').get('owner'), ...patch}; f.data.get('queueLeases').set('owner', bad);
        await assert.rejects(f.client('B').acquire(), /LEASE_RECORD_INVALID/);
        assert.deepEqual(f.data.get('queueLeases').get('owner'), bad);
    }
    const f = fixture(); await f.client('A').acquire(); f.clock = 1200;
    f.data.get('queueLeases').get('owner').token = Number.MAX_SAFE_INTEGER;
    await assert.rejects(f.client('B').acquire(), /LEASE_TOKEN_EXHAUSTED/);
    assert.equal(f.data.get('queueLeases').get('owner').token, Number.MAX_SAFE_INTEGER);
});

test('backward clock fails closed; forward jump expires ownership and allows fenced takeover', async () => {
    const f = fixture(), a = await f.client('A').acquire();
    f.clock = 999;
    await assert.rejects(a.renew(), /LEASE_CLOCK_REVERSED/);
    await assert.rejects(f.client('B').acquire(), /LEASE_CLOCK_REVERSED/);
    f.clock = 1_000_000;
    const b = await f.client('B').acquire(); assert.equal(b.token, 2);
    assert.equal(await a.isCurrent(), false);
    f.clock = Infinity; await assert.rejects(b.renew(), /LEASE_CLOCK_INVALID/);
});
