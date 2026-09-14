import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryVault} from './memory-vault.mjs';
import {createProtectedSession} from './protected-session.mjs';
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function fixture({factory, now} = {}) {
    let user = {uid: 'A'}, observer, closed = 0, invoked = 0, supplied, context;
    const key = {synthetic: true};
    const client = {key, database: 'must-not-escape', close() { closed++; }};
    for (const name of ['enqueue', 'flush', 'pendingForRecord', 'discard', 'replace']) client[name] = async () => { invoked++; return {ok: true}; };
    const session = createProtectedSession({getUser: () => user, subscribeUser: fn => { observer = fn; return () => {}; },
        routes: {private: value => { context = value; }, other: () => {}},
        createVault: callbacks => createMemoryVault({...callbacks, now, unlockKey: async () => key,
            openQueueWithKey: async (material, scope) => { supplied = {material, scope}; return factory ? factory(client) : client; }})});
    return {session, client, key, get closed() { return closed; }, get invoked() { return invoked; }, get supplied() { return supplied; },
        get context() { return context; }, change: (uid, notify = true) => { user = {uid}; if (notify) observer(user); },
        async open() { await session.unlock(); await session.navigate('private'); return session.openMutationQueue({signal: context.signal, domain: 'private-account'}); }};
}

test('only the trusted factory receives Vault material and route contexts never get the queue opener', async () => {
    const f = fixture(), queue = await f.open();
    assert.equal(f.supplied.material, f.key); assert.equal(f.supplied.scope.uid, 'A');
    assert.equal(queue.key, undefined); assert.equal(queue.database, undefined);
    assert.equal(f.context.openMutationQueue, undefined); assert.equal(f.context.openQueue, undefined);
    assert.deepEqual(await queue.flush(), {ok: true}); queue.close(); queue.close(); assert.equal(f.closed, 1);
    await assert.rejects(queue.flush(), /QUEUE_DISPOSED/); assert.equal(f.invoked, 1); f.session.dispose();
});

for (const boundary of ['lock', 'navigation', 'identity', 'delayed-identity', 'dispose', 'failed-logout']) {
    test(`${boundary} closes the owned queue and prevents retained methods`, async () => {
        const f = fixture(), queue = await f.open();
        if (boundary === 'lock') f.session.lock();
        if (boundary === 'navigation') await f.session.navigate('other');
        if (boundary === 'identity') f.change('B');
        if (boundary === 'delayed-identity') f.change('B', false);
        if (boundary === 'dispose') f.session.dispose();
        if (boundary === 'failed-logout') await assert.rejects(f.session.logout(async () => { throw new Error('offline'); }));
        await assert.rejects(queue.flush()); assert.equal(f.invoked, 0); assert.equal(f.closed, 1);
        assert.equal(f.supplied.scope.signal.aborted, true); f.session.dispose();
    });
}

test('a queue arriving after lock is closed without exposing it', async () => {
    const gate = deferred(), f = fixture({factory: () => gate.promise});
    const opening = f.open(); await new Promise(setImmediate); f.session.lock(); gate.resolve(f.client);
    await assert.rejects(opening, /QUEUE_DISPOSED|VAULT_LOCKED/); assert.equal(f.closed, 1); f.session.dispose();
});

test('late method result after identity change does not escape the owning session', async () => {
    const f = fixture(), queue = await f.open(), gate = deferred(); f.client.pendingForRecord = () => gate.promise;
    const reading = queue.pendingForRecord('record'); f.change('B'); gate.resolve({operationId: 'private-metadata'});
    await assert.rejects(reading); assert.equal(f.closed, 1); f.session.dispose();
});

test('expiration closes the queue, and one failing disposer cannot prevent the others closing', async () => {
    let time = 0; const f = fixture({now: () => time}); const queue = await f.open();
    const second = await f.session.openMutationQueue({signal: f.context.signal, domain: 'private-account'});
    const original = f.client.close; f.client.close = () => { original(); throw new Error('cleanup failed'); };
    time = 60001; await assert.rejects(queue.flush()); assert.equal(f.closed, 2);
    await assert.rejects(second.flush()); f.session.dispose();
});
