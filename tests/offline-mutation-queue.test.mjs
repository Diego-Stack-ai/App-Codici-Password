import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-queue.js', import.meta.url), 'utf8');
const queue = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('il contenitore runtime è cifrato, autenticato e legato allo UID', async () => {
    const key = await queue.deriveOfflineQueueKey('FIXTURE-NON-SEGRETO', 'owner-a');
    const operation = {uid: 'owner-a', operationId: 'device-a:1', recordId: 'record-1', changes: {password: 'fixture'}};
    const sealed = await queue.sealOfflineOperation(operation, key);
    assert.equal(JSON.stringify(sealed).includes('fixture'), false);
    assert.deepEqual(await queue.openOfflineOperation(sealed, key, 'owner-a'), operation);
    await assert.rejects(queue.openOfflineOperation(sealed, key, 'owner-b'), /SCOPE/);
    sealed.ciphertext = `${sealed.ciphertext.slice(0, -2)}AA`;
    await assert.rejects(queue.openOfflineOperation(sealed, key, 'owner-a'));
});

test('Web Lock concede la lavorazione a una sola scheda', async () => {
    let occupied = false;
    const locks = {request: async (_name, _options, callback) => {
        if (occupied) return callback(null);
        occupied = true;
        try { return await callback({name: 'lock'}); } finally { occupied = false; }
    }};
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = queue.withOfflineQueueLease('owner-a', () => gate, locks);
    await Promise.resolve();
    assert.deepEqual(await queue.withOfflineQueueLease('owner-a', () => 'seconda', locks), {acquired: false});
    release('prima');
    assert.deepEqual(await first, {acquired: true, value: 'prima'});
});

test('BroadcastChannel notifica soltanto la coda dello stesso utente', () => {
    let instance;
    class FakeChannel {
        constructor(name) { this.name = name; instance = this; }
        postMessage(value) { this.posted = value; }
        close() { this.closed = true; }
    }
    let changes = 0;
    const channel = queue.createOfflineQueueChannel('owner-a', () => { changes += 1; }, FakeChannel);
    channel.notify();
    assert.deepEqual(instance.posted, {type: 'changed', uid: 'owner-a'});
    instance.onmessage({data: {type: 'changed', uid: 'owner-b'}});
    instance.onmessage({data: {type: 'changed', uid: 'owner-a'}});
    assert.equal(changes, 1);
    channel.close(); assert.equal(instance.closed, true);
});
