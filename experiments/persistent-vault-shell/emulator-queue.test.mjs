import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./emulator-queue.mjs', import.meta.url), 'utf8');
function fixture({oldVersion = 0, origin = 'http://127.0.0.1:4188', delay = false, methods = {}} = {}) {
    const controller = new AbortController(), stores = []; let opened = 0, aborted = 0, closed = 0, clientClosed = 0, finish;
    const database = {version: 2, createObjectStore: name => stores.push(name), close: () => closed++};
    const auth = {app: {options: {projectId: 'demo-vault-shell'}}, currentUser: {uid: 'fixture'}};
    const realm = vm.createContext({location: {origin}, crypto: {randomUUID: () => 'fixture-holder'},
        createFirebaseFencedQueueClient: async () => ({...methods, close: () => clientClosed++}),
        indexedDB: {open: () => {
            opened++; const request = {result: database, error: new Error('UPGRADE_ABORTED'), transaction: {abort: () => aborted++}};
            finish = () => {
                if (oldVersion !== 2) request.onupgradeneeded({oldVersion});
                if (aborted) request.onerror(); else request.onsuccess();
            };
            if (!delay) queueMicrotask(finish); return request;
        }}});
    vm.runInContext(source.replace(/^import .*;$/gm, '').replace('export async function', 'async function'), realm);
    return {controller, auth, stores, get opened() { return opened; }, get closed() { return closed; }, get clientClosed() { return clientClosed; },
        finish: () => finish(), open: () => realm.openEmulatorQueue({auth, functions: {}, uid: 'fixture', signal: controller.signal})};
}
test('only an empty loopback demo queue is provisioned and abort closes its database and client once', async () => {
    const f = fixture(), queue = await f.open();
    assert.deepEqual(f.stores, ['queueLeases', 'encryptedOperations']);
    f.controller.abort(); queue.close(); assert.equal(f.closed, 1); assert.equal(f.clientClosed, 1);
});
test('existing schema one is not upgraded and nonlocal origins never open IndexedDB', async () => {
    const f = fixture({oldVersion: 1}); await assert.rejects(f.open(), /UPGRADE_ABORTED/); assert.deepEqual(f.stores, []);
    const g = fixture({origin: 'https://appcodici-password.web.app'}); await assert.rejects(g.open(), /LOCAL_EMULATOR_ONLY/); assert.equal(g.opened, 0);
});
test('aborted or changed identities do not open a client after delayed IndexedDB completion', async () => {
    for (const boundary of ['abort', 'identity']) {
        const f = fixture({delay: true, oldVersion: 2}), opening = f.open();
        if (boundary === 'abort') f.controller.abort(); else f.auth.currentUser = {uid: 'other'};
        f.finish(); await assert.rejects(opening, /DEMO_QUEUE_SESSION/); assert.equal(f.closed, 1); assert.equal(f.clientClosed, 0);
    }
});

for (const outcome of ['resolve', 'reject']) test(`navigation revokes immediately but drains ${outcome} before closing the lease database`, async () => {
    let settle;
    const gate = new Promise((resolve, reject) => { settle = () => outcome === 'resolve' ? resolve(null) : reject(new Error('INTERRUPTED')); });
    const f = fixture({methods: {pendingForRecord: () => gate}}), queue = await f.open();
    const pending = queue.pendingForRecord('alfa');
    const rejected = assert.rejects(pending, /DEMO_QUEUE_SESSION|INTERRUPTED/);
    f.controller.abort(); queue.close();
    assert.equal(f.clientClosed, 1); assert.equal(f.closed, 0);
    await assert.rejects(queue.pendingForRecord('other'), /DEMO_QUEUE_SESSION/);
    // An interrupted coordinator still needs its live connection to release.
    assert.equal(f.closed, 0); settle(); await rejected;
    assert.equal(f.closed, 1); queue.close(); assert.equal(f.closed, 1);
});
