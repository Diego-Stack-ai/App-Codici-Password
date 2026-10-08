import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRestoreReceipts, bindOriginalRestorePlan} from './restore-resume-summary.mjs';
import {createStagedChunkBinding} from './restore-chunk-binding.mjs';
const binding = id => createStagedChunkBinding('u1', {mode: 'apply', operationId: id, backupId: 'b',
  chunkIndex: 0, chunkCount: 1, records: [{path: 'users/u1/accounts/a', data: {name: 'synthetic'}}]},
{restoreOperationId: 'r', stageIds: []});
const receipt = b => ({...b, status: 'applied', duplicate: false, rewriteHash: 'a'.repeat(64)});
test('summary distinguishes attested, absent and mismatched receipts without leaking payload', () => {
  const bindings = ['a', 'b', 'c'].map(binding);
  const receipts = [receipt(bindings[0]), null, receipt(bindings[0])];
  const before = structuredClone({bindings, receipts});
  assert.deepEqual(summarizeRestoreReceipts(bindings, receipts), {entries: [
    {index: 0, status: 'confirmed'}, {index: 1, status: 'unconfirmed'}, {index: 2, status: 'conflict'}],
  confirmed: 1, unconfirmed: 1, conflicts: 1});
  assert.deepEqual({bindings, receipts}, before);
});
test('duplicate operation, mixed owner, missing slots and invalid binding are refused', () => {
  const a = binding('a'), b = binding('b');
  for (const [bindings, receipts] of [[[a, a], [null, null]], [[a, {...b, ownerUid: 'u2'}], [null, null]],
    [[a], Array(1)], [[{}], [null]], [[], []]]) {
    assert.throws(() => summarizeRestoreReceipts(bindings, receipts));
  }
  assert.equal(summarizeRestoreReceipts([a], [undefined]).conflicts, 1);
});

test('original plan requires complete ordered chunks, one backup and unique record paths', () => {
  const chunks = [0, 1].map(index => ({command: {expectedOwnerUid: 'u1', mode: 'apply', operationId: `c${index}`,
    backupId: 'b', chunkIndex: index, chunkCount: 2, confirmation: 'RESTORE_VALIDATED',
    records: [{scope: 'private-account', id: `a${index}`, data: {name: 'synthetic'}, expectedVersion: {exists: false}}]},
  stages: {restoreOperationId: 'r', stageIds: []}}));
  const plan = bindOriginalRestorePlan('u1', chunks);
  assert.equal(plan.bindings.length, 2); assert.match(plan.planHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(bindOriginalRestorePlan('u1', structuredClone(chunks)), plan);
  assert.throws(() => bindOriginalRestorePlan('u1', chunks.slice(0, 1)));
  assert.throws(() => bindOriginalRestorePlan('u1', [...chunks].reverse()));
  for (const change of [c => {c[1].command.backupId = 'other';},
    c => {c[1].command.records[0].id = 'a0';}, c => {c[1].command.operationId = 'c0';},
    c => {c[1].stages.restoreOperationId = 'other';}]) {
    const altered = structuredClone(chunks); change(altered);
    assert.throws(() => bindOriginalRestorePlan('u1', altered));
  }
  const altered = structuredClone(chunks); altered[1].command.records[0].data.name = 'changed';
  assert.notEqual(bindOriginalRestorePlan('u1', altered).planHash, plan.planHash);
});
