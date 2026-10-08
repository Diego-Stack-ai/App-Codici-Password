import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';

const scope = {id: 'synthetic', bucket: 'demo-purge'};
const targets = ['a', 'b', 'c'].map(id => ({kind: 'document',
  path: `labPurgeTargets/synthetic/children/${id}`, updateTime: {seconds: 1, nanoseconds: 0}}));
const make = () => {
  const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'op');
  return claimBoundPurgeSequence(prepared, prepared, scope, targets);
};
const act = (state, action) => transitionBoundPurgeSequence(state,
  boundPurgeSequenceToken(state, scope, targets), scope, targets, action);

test('applied is journaled before the stop.effect slot is reused for the next planned target', () => {
  let state = make();
  const firstToken = boundPurgeSequenceToken(state, scope, targets);
  state = transitionBoundPurgeSequence(state, firstToken, scope, targets, {type: 'begin', index: 0});
  state = act(state, {type: 'outcome', index: 0, outcome: 'applied'});
  assert.equal(state.stop.effect, null);
  assert.deepEqual(state.sequence.outcomes, ['applied', 'unstarted', 'unstarted']);
  assert.equal(state.stateRevision, state.sequence.revision);
  assert.throws(() => transitionBoundPurgeSequence(state, firstToken, scope, targets,
    {type: 'begin', index: 1}), /PURGE_SEQUENCE_STATE_CONFLICT/);
  state = act(state, {type: 'begin', index: 1});
  assert.equal(state.stop.effect.outcome, 'pending');
  state = act(state, {type: 'outcome', index: 1, outcome: 'applied'});
  assert.deepEqual(state.sequence.outcomes, ['applied', 'applied', 'unstarted']);
  assert.equal(state.stop.effect, null);
  assert.equal(state.stateRevision, state.stop.revision);
  assert.equal(state.sequence.revision, state.stateRevision);
});

test('pending and unknown block reuse until reconciled; not-applied and stop block later targets', () => {
  let state = act(make(), {type: 'begin', index: 0});
  assert.throws(() => act(state, {type: 'begin', index: 1}), /PURGE_SEQUENCE_ORDER|PURGE_STOP_STATE/);
  state = act(state, {type: 'outcome', index: 0, outcome: 'unknown'});
  assert.throws(() => act(state, {type: 'begin', index: 1}), /PURGE_SEQUENCE_ORDER|PURGE_STOP_STATE/);
  state = act(state, {type: 'outcome', index: 0, outcome: 'applied'});
  assert.equal(state.stop.effect, null);
  state = act(state, {type: 'begin', index: 1});
  state = act(state, {type: 'outcome', index: 1, outcome: 'not-applied'});
  assert.equal(state.sequence.stopRequested, true);
  assert.equal(state.stop.effect.outcome, 'not-applied');
  assert.throws(() => act(state, {type: 'begin', index: 2}), /PURGE_SEQUENCE_STOP|PURGE_STOP_STATE/);
});

test('manual stop after an applied step retains history and prevents reuse', () => {
  let state = act(make(), {type: 'begin', index: 0});
  state = act(state, {type: 'outcome', index: 0, outcome: 'applied'});
  state = act(state, {type: 'stop'});
  assert.deepEqual(state.sequence.outcomes, ['applied', 'unstarted', 'unstarted']);
  assert.equal(state.sequence.stopRequested, true);
  assert.throws(() => act(state, {type: 'begin', index: 1}), /PURGE_SEQUENCE_STOP|PURGE_STOP_STATE/);
});

test('stop survives persisted reopen at every target and uncertain outcome without reopening authorization', () => {
  const reopen = state => JSON.parse(JSON.stringify(state));
  for (let index = 0; index < targets.length; index++) {
    for (const outcome of ['pending', 'unknown']) {
      let state = make();
      for (let prior = 0; prior < index; prior++) {
        state = act(state, {type: 'begin', index: prior});
        state = act(state, {type: 'outcome', index: prior, outcome: 'applied'});
      }
      state = act(state, {type: 'begin', index});
      if (outcome === 'unknown') state = act(state, {type: 'outcome', index, outcome});
      const staleToken = boundPurgeSequenceToken(state, scope, targets);
      state = reopen(act(state, {type: 'stop'}));
      assert.equal(state.stop.effect.outcome, outcome);
      assert.equal(state.sequence.stopRequested, true);
      assert.throws(() => transitionBoundPurgeSequence(state, staleToken, scope, targets,
        {type: 'outcome', index, outcome: 'applied'}), /PURGE_SEQUENCE_STATE_CONFLICT/);
      for (const resolution of ['applied', 'not-applied']) {
        const resolved = reopen(act(state, {type: 'outcome', index, outcome: resolution}));
        assert.equal(resolved.stop.stopRequested, true);
        assert.equal(resolved.sequence.stopRequested, true);
        assert.deepEqual(resolved.sequence.outcomes.slice(0, index), Array(index).fill('applied'));
        assert.equal(resolved.sequence.outcomes[index], resolution);
        assert.throws(() => act(resolved, {type: 'begin', index: Math.min(index + 1, targets.length - 1)}));
        assert.throws(() => act(resolved, {type: 'outcome', index, outcome: resolution}));
      }
    }
  }
});

test('mismatched revisions, plan or corrupt shared snapshot fail closed', () => {
  let state = make();
  const token = boundPurgeSequenceToken(state, scope, targets);
  assert.throws(() => transitionBoundPurgeSequence(state, {...token, sequenceRevision: 1}, scope, targets,
    {type: 'stop'}), /PURGE_SEQUENCE_STATE_CONFLICT/);
  assert.throws(() => boundPurgeSequenceToken({...state, sequence: {...state.sequence, outcomes: ['applied', 'unstarted', 'unstarted']}}, scope, targets),
    /PURGE_SEQUENCE/);
  assert.throws(() => boundPurgeSequenceToken({...state, stop: {...state.stop, revision: 1}}, scope, targets),
    /PURGE_SEQUENCE_STATE_CONFLICT/);
});

test('malformed transitions reject accessors, inherited fields and extra properties without reading them', () => {
  const state = make();
  let invoked = false;
  const accessor = {};
  Object.defineProperty(accessor, 'type', {enumerable: true, get() { invoked = true; return 'stop'; }});
  assert.throws(() => act(state, accessor), /PURGE_SEQUENCE_STATE_CONFLICT/);
  assert.equal(invoked, false);
  assert.throws(() => act(state, Object.assign(Object.create({type: 'stop'}), {})), /PURGE_SEQUENCE_STATE_CONFLICT/);
  assert.throws(() => act(state, {type: 'stop', extra: true}), /PURGE_SEQUENCE_STATE_CONFLICT/);
});
