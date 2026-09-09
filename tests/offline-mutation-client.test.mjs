import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-client-core.js', import.meta.url), 'utf8');
const {createOfflineMutationClientCore, OFFLINE_MUTATION_WRITES_ENABLED} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function dependencies() {
  const queued = []; const sent = []; let notified = 0; let closed = 0;
  const queue = {
    enqueue: async operation => queued.push(operation),
    list: async () => queued,
    remove: async operationId => {
      const index = queued.findIndex(operation => operation.operationId === operationId);
      if (index >= 0) queued.splice(index, 1);
    },
    close: () => { closed += 1; }
  };
  return {
    queued, sent, get notified() { return notified; }, get closed() { return closed; },
    createQueue: async () => queue,
    createSynchronizer: ({send, onState}) => ({
      flush: async () => {
        onState({state: 'syncing'});
        for (const operation of queued) sent.push(await send(operation));
        return {status: 'saved'};
      }
    }),
    withLease: async (_uid, task) => task(),
    createChannel: () => ({notify: () => { notified += 1; }, close: () => { closed += 1; }}),
    send: async operation => ({status: 'applied', operationId: operation.operationId})
  };
}

test('il collegamento runtime-backend è disattivato per impostazione predefinita', async () => {
  assert.equal(OFFLINE_MUTATION_WRITES_ENABLED, false);
  await assert.rejects(createOfflineMutationClientCore({uid: 'owner', vaultKeyMaterial: 'fixture'}), /DISABLED/);
});

test('con flag esplicita accoda, notifica e inoltra una sola operazione dello stesso utente', async () => {
  const deps = dependencies(); const states = [];
  const client = await createOfflineMutationClientCore({
    ...deps, uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true, onState: state => states.push(state)
  });
  const operation = {uid: 'owner', operationId: 'op-1', recordId: 'record-1', encryptedPayload: {ciphertext: 'fixture'}};
  assert.deepEqual(await client.enqueue(operation), {status: 'saved'});
  assert.equal(deps.queued.length, 1); assert.equal(deps.sent.length, 1); assert.equal(deps.notified, 1);
  assert.equal(states.at(-1).state, 'syncing');
  await assert.rejects(client.enqueue({...operation, uid: 'other'}), /SCOPE/);
  await client.discard('op-1');
  assert.equal(deps.queued.length, 0);
  client.close(); assert.equal(deps.closed, 2);
});
