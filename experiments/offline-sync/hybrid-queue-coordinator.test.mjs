import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndexedDbQueueLease} from './indexeddb-queue-lease.mjs';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';

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
        get clock() { return clock; }, set clock(value) { clock = value; }, set beforeTransaction(hook) { beforeTransaction = hook; }};
}

const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
function webLocks() {
    let held = false;
    return {async request(_name, options, callback) {
        assert.deepEqual(options, {mode: 'exclusive', ifAvailable: true});
        if (held) return callback(null);
        held = true;
        try { return await callback({name: 'synthetic'}); } finally { held = false; }
    }};
}
const coordinator = (f, holderId, locks = null) => createHybridQueueCoordinator({database: f.database,
    uid: 'owner', holderId, now: () => f.clock, ttlMs: 100, locks});

test('Web Lock holder excludes fallback and fallback holder excludes Web Lock path through shared IDB', async () => {
    for (const firstUsesLocks of [true, false]) {
        const f = fixture(), locks = webLocks(), entered = gate(), leave = gate();
        const a = coordinator(f, 'A', firstUsesLocks ? locks : null);
        const b = coordinator(f, 'B', firstUsesLocks ? null : locks);
        const pending = a.run(async () => { entered.resolve(); await leave.promise; return 'done'; });
        await entered.promise;
        let calls = 0;
        assert.deepEqual(await b.run(() => { calls++; }), {acquired: false}); assert.equal(calls, 0);
        leave.resolve(); assert.deepEqual(await pending, {acquired: true, value: 'done'});
        assert.deepEqual(await b.run(() => 'next'), {acquired: true, value: 'next'});
    }
});

test('occupied or rejected Web Locks never bypass to IndexedDB fallback', async () => {
    for (const rejected of [false, true]) {
        const f = fixture(); let calls = 0;
        const locks = {request: async (_name, _options, callback) => {
            if (rejected) throw new Error('LOCKS_FAILED'); return callback(null);
        }};
        const run = coordinator(f, 'A', locks).run(() => { calls++; });
        if (rejected) await assert.rejects(run, /LOCKS_FAILED/); else assert.deepEqual(await run, {acquired: false});
        assert.equal(calls, 0); assert.equal(f.data.get('queueLeases').size, 0);
    }
});

test('lease corruption fails closed and task error releases both coordination layers', async () => {
    const f = fixture(), locks = webLocks(), a = coordinator(f, 'A', locks);
    f.data.get('queueLeases').set('owner', {id: 'owner', version: 999});
    await assert.rejects(a.run(() => assert.fail('must not execute')), /LEASE_RECORD_INVALID/);
    f.data.get('queueLeases').clear();
    await assert.rejects(a.run(() => { throw new Error('TASK_FAILED'); }), /TASK_FAILED/);
    assert.equal(f.data.get('queueLeases').get('owner').holderId, null);
    assert.deepEqual(await a.run(() => 'recovered'), {acquired: true, value: 'recovered'});
    for (const reason of [undefined, null, false, 0, '']) {
        let rejected = false;
        await a.run(() => { throw reason; }).catch(error => { rejected = true; assert.equal(error, reason); });
        assert.equal(rejected, true, 'every rejected task must remain unsuccessful');
        assert.equal(f.data.get('queueLeases').get('owner').holderId, null);
    }
});

test('abort during IDB acquisition skips task and releases the acquired lease', async () => {
    const f = fixture(), controller = new AbortController(); let calls = 0;
    f.beforeTransaction = () => controller.abort();
    await assert.rejects(coordinator(f, 'A').run(() => { calls++; }, {signal: controller.signal}), /SESSION_INACTIVE/);
    assert.equal(calls, 0); assert.equal(f.data.get('queueLeases').get('owner').holderId, null);
});

test('abort during task blocks queued mutations and completion, and invalidates retained context', async () => {
    const f = fixture(), controller = new AbortController(), entered = gate(), leave = gate(); let retained;
    const pending = coordinator(f, 'A').run(async context => { retained = context; entered.resolve(); await leave.promise; }, {signal: controller.signal});
    const rejected = assert.rejects(pending, /SESSION_INACTIVE/);
    await entered.promise; controller.abort();
    assert.equal(retained.signal.aborted, true);
    await assert.rejects(f.guard(retained, store => store.put({id: 'op'})), /SESSION_INACTIVE/);
    leave.resolve(); await rejected;
    assert.equal(f.data.get('operations').size, 0);
    await assert.rejects(retained.renew(), /SESSION_INACTIVE/);
});

test('expired Web Lock task cannot mutate after fallback takeover or report successful completion', async () => {
    const f = fixture(), entered = gate(), leave = gate(); let old;
    const pending = coordinator(f, 'A', webLocks()).run(async context => { old = context; entered.resolve(); await leave.promise; return 'stale'; });
    const rejected = assert.rejects(pending, /LEASE_LOST|CONTEXT_CLOSED/);
    await entered.promise; f.clock = 1100;
    const bEntered = gate(), bLeave = gate();
    const next = coordinator(f, 'B').run(async context => {
        await f.guard(context, store => store.put({id: 'op', value: 'B'})); bEntered.resolve(); await bLeave.promise;
    });
    await bEntered.promise;
    await assert.rejects(f.guard(old, store => store.put({id: 'op', value: 'A'})), /LEASE_LOST/);
    assert.equal(old.signal.aborted, true);
    leave.resolve(); await rejected;
    assert.equal(f.data.get('queueLeases').get('owner').holderId, 'B');
    assert.equal(f.data.get('operations').get('op').value, 'B');
    bLeave.resolve(); await next;
});

test('successful task closes context permanently and session change after await suppresses result', async () => {
    const f = fixture(); let retained;
    await coordinator(f, 'A').run(context => { retained = context; });
    await assert.rejects(retained.checkCurrent(), /CONTEXT_CLOSED/);
    await assert.rejects(f.guard(retained, store => store.put({id: 'op'})), /CONTEXT_CLOSED/);
    let active = true;
    await assert.rejects(coordinator(f, 'B').run(async () => { await Promise.resolve(); active = false; return 'stale'; },
        {isActive: () => active}), /SESSION_INACTIVE/);
    assert.equal(f.data.get('operations').size, 0);
});

