import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurgeFence, invalidatePurgeForWrite} from './purge-fence-model.mjs';
import {claimBoundPurge, boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
import {purgeStopSummary} from './purge-stop-model.mjs';
const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'purge-A');
const step = (s, a) => transitionBoundPurge(s, boundPurgeToken(s), a);
test('claim rejects invalidated preparation and binds operation plus revision', () => {
  assert.throws(() => claimBoundPurge(invalidatePurgeForWrite(prepared), prepared));
  const s = claimBoundPurge(prepared, prepared);
  for (const patch of [{operationId: 'purge-B'}, {claimRevision: 4}, {stopRevision: 1}, {stateRevision: 1}]) {
    assert.throws(() => transitionBoundPurge(s, {...boundPurgeToken(s), ...patch}, {type: 'begin', effectId: 'one'}), /PURGE_BOUND_CONFLICT/);
  }
});
test('each shared-state CAS transition advances one monotone revision', () => {
  let s = claimBoundPurge(prepared, prepared);
  assert.equal(s.stateRevision, 0);
  s = step(s, {type: 'begin', effectId: 'one'});
  assert.equal(s.stateRevision, 1);
  s = step(s, {type: 'outcome', effectId: 'one', outcome: 'applied'});
  assert.equal(s.stateRevision, 2);
  assert.throws(() => transitionBoundPurge(s, {...boundPurgeToken(s), stateRevision: 1},
    {type: 'stop'}), /PURGE_BOUND_CONFLICT/);
});
test('stop invalidates old begin token and leaves exclusive fence intact', () => {
  const s = claimBoundPurge(prepared, prepared);
  const stopped = step(s, {type: 'stop'});
  assert.throws(() => transitionBoundPurge(stopped, boundPurgeToken(s), {type: 'begin', effectId: 'one'}));
  assert.throws(() => step(stopped, {type: 'begin', effectId: 'one'}));
  assert.throws(() => invalidatePurgeForWrite(stopped.fence), /FENCE_BUSY/);
});
test('in-flight result needs current state and matching effect; unknown never releases', () => {
  const started = step(claimBoundPurge(prepared, prepared), {type: 'begin', effectId: 'one'});
  let s = step(started, {type: 'stop'});
  assert.throws(() => transitionBoundPurge(s, boundPurgeToken(started), {type: 'outcome', effectId: 'one', outcome: 'applied'}));
  assert.throws(() => step(s, {type: 'outcome', effectId: 'other', outcome: 'applied'}));
  s = step(s, {type: 'outcome', effectId: 'one', outcome: 'unknown'});
  assert.equal(purgeStopSummary(s.stop).unresolved, true);
  s = step(s, {type: 'outcome', effectId: 'one', outcome: 'applied'});
  assert.equal(purgeStopSummary(s.stop).partial, true);
  assert.throws(() => invalidatePurgeForWrite(s.fence), /FENCE_BUSY/);
  assert.equal(started.stop.stopRequested, false);
});
