import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';

const bound = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
  effects: [{kind: 'profile-cleanup', path: 'users/u'}, {kind: 'document-delete', path: 'users/u/accounts/a'}]};

test('effect journal advances in order and preserves stop after partial application', () => {
  const model = createPurgeEffectSequence(bound);
  let state = model.transition(model.initial, {type: 'begin', index: 0, effectId: model.effectIds[0]});
  state = model.transition(state, {type: 'outcome', index: 0, effectId: model.effectIds[0], outcome: 'applied'});
  state = model.transition(state, {type: 'stop'});
  assert.deepEqual(model.summary(state), {appliedCount: 1, unresolved: false, stopped: true, allApplied: false});
  assert.throws(() => model.transition(state, {type: 'begin', index: 1, effectId: model.effectIds[1]}), /CONFLICT/);
});

test('unknown outcome blocks advance and effect identity binds plan and order', () => {
  const model = createPurgeEffectSequence(bound);
  let state = model.transition(model.initial, {type: 'begin', index: 0, effectId: model.effectIds[0]});
  state = model.transition(state, {type: 'outcome', index: 0, effectId: model.effectIds[0], outcome: 'unknown'});
  assert.equal(model.summary(state).unresolved, true);
  assert.throws(() => model.transition(state, {type: 'begin', index: 1, effectId: model.effectIds[1]}), /CONFLICT/);
  const changed = createPurgeEffectSequence({...bound, effects: [...bound.effects].reverse()});
  assert.notEqual(model.sequenceHash, changed.sequenceHash);
  assert.notDeepEqual(model.effectIds, changed.effectIds);
});
