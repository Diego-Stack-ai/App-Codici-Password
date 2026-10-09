import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundEffectState, boundEffectStateToken, transitionBoundEffectState} from './purge-bound-effect-state.mjs';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';

const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
  effects: [{kind: 'profile-cleanup', path: 'users/u'}, {kind: 'document-delete', path: 'users/u/accounts/a'}]};
const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};

test('exclusive fence, stop slot and effect journal advance as one state', () => {
  let state = claimBoundEffectState(prepared, prepared, plan), token = boundEffectStateToken(state, plan);
  const effects = createPurgeEffectSequence(plan).effectIds;
  state = transitionBoundEffectState(state, token, plan, {type: 'begin', index: 0, effectId: effects[0]});
  assert.equal(state.stateRevision, 1); assert.equal(state.effectSequence.revision, 1);
  token = boundEffectStateToken(state, plan);
  state = transitionBoundEffectState(state, token, plan, {type: 'outcome', index: 0, effectId: effects[0], outcome: 'applied'});
  assert.equal(state.stop.effect, null); assert.equal(state.effectSequence.outcomes[0], 'applied');
  token = boundEffectStateToken(state, plan);
  state = transitionBoundEffectState(state, token, plan, {type: 'stop'});
  assert.equal(state.stop.stopRequested, true); assert.equal(state.effectSequence.stopRequested, true);
});

test('stale token, changed plan and unknown effect cannot advance composed state', () => {
  const state = claimBoundEffectState(prepared, prepared, plan), token = boundEffectStateToken(state, plan);
  const effects = createPurgeEffectSequence(plan).effectIds;
  assert.throws(() => transitionBoundEffectState(state, {...token, stateRevision: 9}, plan,
    {type: 'begin', index: 0, effectId: effects[0]}), /CONFLICT/);
  assert.throws(() => boundEffectStateToken(state, {...plan, storageHash: 'c'.repeat(64)}), /CONFLICT/);
  assert.throws(() => transitionBoundEffectState(state, token, plan,
    {type: 'begin', index: 0, effectId: '0'.repeat(64)}), /CONFLICT/);
});
