import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResumePlan, verifyResumePlan, reconstructResumeCommands} from './restore-resume-plan.mjs';
const record = {scope: 'private-account', id: 'a', data: {synthetic: 'ORIGINAL'}};
const command = {expectedOwnerUid: 'synthetic', operationId: 'original-operation', backupId: 'backup',
  chunkIndex: 0, chunkCount: 1, mode: 'apply', records: [{...record, expectedVersion: {exists: false}}]};
test('new session rebinds original selection, flags and versions, without new preview', () => {
  for (const overwriteExisting of [false, true]) for (const confirmation of ['RESTORE_VALIDATED', 'RESTORE_SELECTED_OVERWRITE']) {
    const inputs = [{...command, overwriteExisting, confirmation}];
    const stages = [{restoreOperationId: 'restore-original', stageIds: []}];
    const plan = prepareResumePlan('synthetic', 'plan', inputs, 1000, stages);
    const result = reconstructResumeCommands(plan, 'synthetic', 'plan', 'backup',
      [{...record, id: 'unselected'}, record], 1001);
    assert.deepEqual(result.inputs, inputs);
    assert.deepEqual(result.stageCommands, stages);
    assert.deepEqual(verifyResumePlan(plan, 'synthetic', 'plan', result.inputs, 1001, result.stageCommands), plan);
    assert.equal(JSON.stringify(plan).includes('ORIGINAL'), false);
    result.inputs[0].records[0].data.synthetic = 'mutated';
    assert.equal(record.data.synthetic, 'ORIGINAL');
  }
});
test('rebind rejects different backup/body/owner, duplicates, corrupt plan and exact expiry', () => {
  const inputs = [{...command, confirmation: 'RESTORE_VALIDATED'}];
  const plan = prepareResumePlan('synthetic', 'plan', inputs, 1000);
  const run = (p = plan, owner = 'synthetic', backup = 'backup', records = [record], now = 1001) =>
    reconstructResumeCommands(p, owner, 'plan', backup, records, now);
  assert.throws(() => run(plan, 'other'), /MISMATCH/);
  assert.throws(() => run(plan, 'synthetic', 'other'), /MISMATCH/);
  assert.throws(() => run(plan, 'synthetic', 'backup', [{...record, data: {synthetic: 'CHANGED'}}]), /MISMATCH/);
  assert.throws(() => run(plan, 'synthetic', 'backup', [record, record]), /DUPLICATE/);
  assert.throws(() => run({...plan, extra: 'must-not-be-exposed'}), /MISMATCH/);
  assert.throws(() => run(plan, 'synthetic', 'backup', [record], plan.expiresAtMs), /EXPIRED/);
  assert.equal(run().stageCommands, undefined);
});
