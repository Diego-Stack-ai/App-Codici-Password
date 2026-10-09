import test from 'node:test';
import assert from 'node:assert/strict';
import {claimBoundEffectState, boundEffectStateToken, transitionBoundEffectState} from './purge-bound-effect-state.mjs';
import {applyBoundObjectDeleteLab, reconcileBoundObjectDeleteLab, retryBoundObjectDeleteLab} from './purge-bound-effect-storage-lab.mjs';
import {preparePurgeFence} from './purge-fence-model.mjs';

const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
  effects: [{kind: 'object-delete', storagePath: 'synthetic/attachment.bin', generation: '9007199254740993'}]};
const createStateLab = () => {
  const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};
  let state = claimBoundEffectState(prepared, prepared, plan);
  return {async transition(_id, expected, candidate, action) { state = transitionBoundEffectState(state, expected, candidate, action); return state; },
    async token(_id, candidate) { return boundEffectStateToken(state, candidate); }, read: () => state};
};

test('object delete passes the exact string generation and records applied', async () => {
  const calls = [], lab = createStateLab(), bucket = {file: path => ({async delete(options) { calls.push({path, options}); }})};
  const result = await applyBoundObjectDeleteLab(lab, bucket, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  assert.deepEqual(calls, [{path: 'synthetic/attachment.bin', options: {ifGenerationMatch: '9007199254740993'}}]);
  assert.equal(result.outcome, 'applied');
  assert.equal(result.destructiveAllowed, false);
});

test('storage failure remains unknown and cannot be reported as completed', async () => {
  const lab = createStateLab(), bucket = {file: () => ({async delete() { throw Object.assign(new Error('ambiguous'), {code: 503}); }})};
  const result = await applyBoundObjectDeleteLab(lab, bucket, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  assert.equal(result.outcome, 'unknown');
  assert.equal(lab.read().effectSequence.outcomes[0], 'unknown');
});

test('reconciliation addresses the exact generation and closes only a confirmed absence', async () => {
  const lab = createStateLab(), calls = [], failing = {file: () => ({async delete() { throw Object.assign(new Error('ambiguous'), {code: 503}); }})};
  await applyBoundObjectDeleteLab(lab, failing, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  const absent = {file(path, options) { calls.push({path, options}); return {async getMetadata() {
    throw Object.assign(new Error('gone'), {code: 404}); }}; }};
  const result = await reconcileBoundObjectDeleteLab(lab, absent, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  assert.deepEqual(calls, [{path: 'synthetic/attachment.bin', options: {generation: '9007199254740993'}}]);
  assert.equal(result.outcome, 'applied');
  assert.equal(lab.read().effectSequence.outcomes[0], 'applied');
});

test('reconciliation keeps a still-present exact generation not-applied', async () => {
  const lab = createStateLab(), failing = {file: () => ({async delete() { throw Object.assign(new Error('ambiguous'), {code: 503}); }})};
  await applyBoundObjectDeleteLab(lab, failing, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  const present = {file: () => ({async getMetadata() { return [{generation: '9007199254740993'}]; }})};
  const result = await reconcileBoundObjectDeleteLab(lab, present, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  assert.equal(result.outcome, 'not-applied');
  assert.equal(lab.read().effectSequence.stopRequested, true);
});

test('retry is admitted only from unknown and keeps the exact generation precondition', async () => {
  const lab = createStateLab(), failing = {file: () => ({async delete() { throw Object.assign(new Error('ambiguous'), {code: 503}); }})};
  await applyBoundObjectDeleteLab(lab, failing, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  const calls = [], succeeding = {file: path => ({async delete(options) { calls.push({path, options}); }})};
  const result = await retryBoundObjectDeleteLab(lab, succeeding, 'synthetic', await lab.token('synthetic', plan), plan, 0);
  assert.equal(result.outcome, 'applied');
  assert.deepEqual(calls, [{path: 'synthetic/attachment.bin', options: {ifGenerationMatch: '9007199254740993'}}]);
  await assert.rejects(retryBoundObjectDeleteLab(lab, succeeding, 'synthetic', await lab.token('synthetic', plan), plan, 0),
    /SEQUENCE_CONFLICT/);
  assert.equal(calls.length, 1);
});
