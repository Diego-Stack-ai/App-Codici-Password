import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('./firebase-fenced-queue-client.mjs', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace('export async function', 'async function');
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function fixture() {
    const app = {}, auth = {app, currentUser: {uid: 'A'}}, lifetime = new AbortController();
    const observers = new Set(), calls = []; let config, closed = 0;
    const client = {close() { closed++; }, flush() { return config.send({uid: 'A', record: {note: 'ciphertext'}}); }};
    const context = vm.createContext({AbortController, structuredClone,
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        httpsCallable: (_functions, name) => async command => { calls.push({name, command}); return {data: {status: 'applied'}}; },
        createFencedQueueClient: async options => { config = options; return client; }});
    vm.runInContext(source, context);
    const options = {auth, functions: {app}, uid: 'A', domain: 'private-account', signal: lifetime.signal, vaultKeyMaterial: 'synthetic-key'};
    return {context, auth, lifetime, observers, calls, client, options,
        get config() { return config; }, get closed() { return closed; },
        open: overrides => context.createFirebaseFencedQueueClient({...options, ...overrides}),
        changeUser: uid => { auth.currentUser = uid ? {uid} : null; for (const fn of [...observers]) fn(auth.currentUser); }};
}

test('adapter selects only the requested canonical callable and cleans up on close', async () => {
    const f = fixture(), client = await f.open();
    assert.deepEqual(await client.flush(), {status: 'applied'});
    assert.equal(f.calls[0].name, 'applyPrivateAccountMutation');
    assert.equal(f.config.uid, 'A'); assert.equal(f.options.vaultKeyMaterial, 'synthetic-key', 'caller options unchanged');
    client.close(); client.close(); assert.equal(f.closed, 1); assert.equal(f.observers.size, 0); assert.equal(f.config.signal.aborted, true);
    await assert.rejects(client.flush(), /SESSION_INACTIVE/); assert.equal(f.calls.length, 1);
});

test('invalid domain, different Firebase app and wrong owner fail before queue creation', async () => {
    for (const override of [{domain: '__proto__'}, {domain: 'other'}, {functions: {app: {}}}, {uid: 'B'}]) {
        const f = fixture(); await assert.rejects(f.open(override)); assert.equal(f.config, undefined); assert.equal(f.observers.size, 0);
    }
});

test('identity change or Vault abort while queue opens closes the late client', async () => {
    for (const invalidate of [f => f.changeUser('B'), f => f.lifetime.abort()]) {
        const f = fixture(), gate = deferred(); f.context.createFencedQueueClient = () => gate.promise;
        const opening = f.open(); invalidate(f); gate.resolve(f.client);
        await assert.rejects(opening, /SESSION_INACTIVE/); assert.equal(f.closed, 1); assert.equal(f.observers.size, 0);
    }
});

test('late success after session invalidation is rejected rather than acknowledged to the queue', async () => {
    const f = fixture(), gate = deferred(); f.context.httpsCallable = () => () => gate.promise;
    const client = await f.open(), sending = client.flush(); f.lifetime.abort();
    gate.resolve({data: {status: 'applied'}});
    await assert.rejects(sending, /SESSION_INACTIVE/); assert.equal(f.observers.size, 0);
});

test('a failing lifecycle provider closes the client without sending or retaining Auth listeners', async () => {
    const f = fixture(); let fail = false;
    const client = await f.open({isActive: () => { if (fail) throw new Error('provider failure'); return true; }});
    fail = true; await assert.rejects(client.flush(), /SESSION_INACTIVE/);
    assert.equal(f.closed, 1); assert.equal(f.observers.size, 0); assert.equal(f.calls.length, 0);
});

test('foreign owner and mixed domains cannot reach the callable', async () => {
    const f = fixture(), client = await f.open();
    for (const command of [{uid: 'B', record: {}}, {uid: 'A', encryptedPayload: 'cipher'}, {uid: 'A', record: {}, encryptedPayload: 'cipher'}]) {
        await assert.rejects(f.config.send(command), /OPERATION_SCOPE/);
    }
    assert.equal(f.calls.length, 0); client.close();
    const generic = fixture(), genericClient = await generic.open({domain: 'offline-sync'});
    await generic.config.send({uid: 'A', encryptedPayload: 'cipher'});
    assert.equal(generic.calls[0].name, 'applyOfflineMutation'); genericClient.close();
});

test('captured command remains unchanged during token/network wait and SDK errors preserve retry reason', async () => {
    const f = fixture(), gate = deferred(); let captured;
    f.context.httpsCallable = () => command => { captured = command; return gate.promise; };
    const client = await f.open(), command = {uid: 'A', record: {note: 'original'}};
    const pending = f.config.send(command); command.record.note = 'changed';
    assert.equal(captured.record.note, 'original'); gate.resolve({data: {status: 'conflict'}}); await pending; client.close();
    const failed = fixture(), error = {code: 'functions/failed-precondition', details: {reason: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'}};
    failed.context.httpsCallable = () => async () => { throw error; };
    const failedClient = await failed.open(); await assert.rejects(failedClient.flush(), value => value === error); failedClient.close();
});
