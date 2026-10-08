import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPurgeStop, beginPurgeEffect, recordPurgeEffectOutcome, purgeStopSummary} from './purge-stop-model.mjs';
const initial = {revision: 0, stopRequested: false, effect: null};
test('stop before authorization prevents any effect', () => {
  const stopped = requestPurgeStop(initial);
  assert.throws(() => beginPurgeEffect(stopped, 'delete'));
  assert.deepEqual(purgeStopSummary(stopped), {stopRequested: true, unresolved: false, stopped: true, partial: false});
});
test('stop cannot resolve pending or unknown I/O; confirmed deletion is partial', () => {
  let state = requestPurgeStop(beginPurgeEffect(initial, 'delete'));
  assert.equal(purgeStopSummary(state).stopped, false);
  state = recordPurgeEffectOutcome(state, 'delete', 'unknown');
  assert.equal(purgeStopSummary(state).unresolved, true);
  assert.throws(() => beginPurgeEffect(state, 'next'));
  assert.throws(() => recordPurgeEffectOutcome(state, 'other', 'not-applied'));
  state = recordPurgeEffectOutcome(state, 'delete', 'applied');
  assert.deepEqual(purgeStopSummary(state), {stopRequested: true, unresolved: false, stopped: true, partial: true});
  assert.throws(() => recordPurgeEffectOutcome(state, 'delete', 'not-applied'));
});
test('confirmed no-effect can stop without claiming partial deletion', () => {
  const state = recordPurgeEffectOutcome(requestPurgeStop(beginPurgeEffect(initial, 'delete')), 'delete', 'not-applied');
  assert.equal(purgeStopSummary(state).stopped, true);
  assert.equal(purgeStopSummary(state).partial, false);
  assert.deepEqual(initial, {revision: 0, stopRequested: false, effect: null});
});
