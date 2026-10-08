import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagedChunkBinding, verifyStagedChunkReceipt} from './restore-chunk-binding.mjs';
const command = {mode: 'apply', operationId: 'chunk', backupId: 'backup', chunkIndex: 0,
  chunkCount: 1, confirmed: true, overwriteExisting: false, overwriteConfirmed: false,
  records: [{path: 'users/u1/accounts/a', data: {name: 'synthetic'}, expectedVersion: null}]};
const stages = {restoreOperationId: 'restore', stageIds: ['a'.repeat(64), 'b'.repeat(64)]};
test('staged binding is canonical for stage order and binds every command field', () => {
  const bind = (uid = 'u1', cmd = command, ids = stages) => createStagedChunkBinding(uid, cmd, ids);
  const original = bind();
  assert.equal(original.domain, 'lab-staged-restore-chunk');
  assert.deepEqual(bind('u1', command, {...stages, stageIds: [...stages.stageIds].reverse()}), original);
  for (const changed of [{operationId: 'other'}, {backupId: 'other'}, {chunkCount: 2},
    {confirmed: false}, {overwriteExisting: true}, {overwriteConfirmed: true},
    {records: [{...command.records[0], data: {name: 'changed'}}]},
    {records: [{...command.records[0], expectedVersion: 'changed'}]}]) {
    assert.notEqual(bind('u1', {...command, ...changed}).operationHash, original.operationHash);
  }
  assert.notEqual(bind('u2').operationHash, original.operationHash);
  assert.notEqual(bind('u1', command, {...stages, restoreOperationId: 'other'}).operationHash, original.operationHash);
  assert.notEqual(bind('u1', command, {...stages, stageIds: [stages.stageIds[0]]}).operationHash, original.operationHash);
});
test('stage duplicates and malformed identifiers are refused', () => {
  for (const stageIds of [Array(1), ['a'.repeat(64), 'a'.repeat(64)], ['bad'], Array(101).fill('a'.repeat(64))]) {
    assert.throws(() => createStagedChunkBinding('u1', command, {...stages, stageIds}), /LAB_CHUNK_BINDING/);
  }
  assert.throws(() => createStagedChunkBinding('u1', command, {...stages, restoreOperationId: '../x'}));
});

test('receipt replay verifies full binding and only returns the allowlisted result', () => {
  const binding = createStagedChunkBinding('u1', command, stages);
  const receipt = {...binding, status: 'applied', duplicate: false, rewriteHash: 'c'.repeat(64),
    syntheticInternalPayload: {notForResponse: true}};
  assert.deepEqual(verifyStagedChunkReceipt(receipt, binding),
    {status: 'applied', duplicate: true, recordCount: 1});
  for (const key of Object.keys(binding)) {
    assert.throws(() => verifyStagedChunkReceipt({...receipt, [key]: 'different'}, binding));
    const incomplete = {...binding}; delete incomplete[key];
    assert.throws(() => verifyStagedChunkReceipt(receipt, incomplete));
  }
  for (const change of [{status: 'pending'}, {duplicate: true}, {rewriteHash: undefined},
    {rewriteHash: 'bad'}, {domain: 'backup-restore'}]) {
    assert.throws(() => verifyStagedChunkReceipt({...receipt, ...change}, binding));
  }
  // No stage service is involved in replay: their later absence does not alter this result.
  assert.throws(() => verifyStagedChunkReceipt(receipt,
    createStagedChunkBinding('u1', command, {...stages, stageIds: []})));
});
