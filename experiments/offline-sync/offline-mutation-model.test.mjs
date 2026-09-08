import assert from 'node:assert/strict';
import test from 'node:test';
import {applyOperation, createOperation, decryptQueuedOperation, encryptQueuedOperation, resolveConflict} from './offline-mutation-model.mjs';
const key = () => crypto.getRandomValues(new Uint8Array(32));
const operation = overrides => createOperation({operationId: 'device-a:1', recordId: 'record-1', deviceId: 'device-a', expectedRevision: 0, changes: {title: 'Modifica offline'}, ...overrides});

test('la coda non conserva contenuto in chiaro e rileva chiave errata o manomissione', async () => {
  const queueKey = key(); const queued = await encryptQueuedOperation(operation(), queueKey);
  assert.equal(JSON.stringify(queued).includes('Modifica offline'), false);
  assert.equal((await decryptQueuedOperation(queued, queueKey)).changes.title, 'Modifica offline');
  await assert.rejects(decryptQueuedOperation(queued, key()));
  queued.ciphertext = `${queued.ciphertext.slice(0, -2)}AA`;
  await assert.rejects(decryptQueuedOperation(queued, queueKey));
});

test('un operationId ripetuto è idempotente', () => {
  const first = applyOperation({records: {}, processed: []}, operation());
  const second = applyOperation(first.state, operation());
  assert.equal(second.state.records['record-1'].revision, 1); assert.equal(second.duplicate, true); assert.deepEqual(second.result, first.result);
});

test('due dispositivi non si sovrascrivono silenziosamente', () => {
  const initial = {records: {'record-1': {revision: 4, title: 'Server'}}, processed: []};
  const accepted = applyOperation(initial, operation({operationId: 'device-a:9', expectedRevision: 4, changes: {title: 'Da A'}}));
  const rejected = applyOperation(accepted.state, operation({operationId: 'device-b:3', deviceId: 'device-b', expectedRevision: 4, changes: {title: 'Da B'}}));
  assert.equal(accepted.state.records['record-1'].title, 'Da A'); assert.equal(rejected.result.status, 'conflict'); assert.equal(rejected.result.currentRevision, 5);
});

test('il conflitto richiede una scelta esplicita', () => {
  const local = operation({expectedRevision: 2}); const server = {revision: 5, title: 'Server'};
  assert.equal(resolveConflict({localOperation: local, serverRecord: server, choice: 'keep-server'}).status, 'discarded');
  const retry = resolveConflict({localOperation: local, serverRecord: server, choice: 'retry-local'});
  assert.equal(retry.operation.expectedRevision, 5); assert.notEqual(retry.operation.operationId, local.operationId);
});

test('chiusura e ritorno online conservano una sola operazione applicabile', async () => {
  const queueKey = key(); const persisted = JSON.stringify(await encryptQueuedOperation(operation(), queueKey));
  const restored = await decryptQueuedOperation(JSON.parse(persisted), queueKey);
  const result = applyOperation({records: {}, processed: []}, restored);
  assert.equal(result.result.status, 'applied'); assert.equal(result.state.records['record-1'].revision, 1);
});
