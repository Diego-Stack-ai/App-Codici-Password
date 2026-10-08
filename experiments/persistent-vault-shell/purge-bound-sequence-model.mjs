// Synthetic composition of the shared purge fence, stop/effect slot and ordered
// sequence snapshot. Persistence must CAS this complete value in one transaction.
import {claimBoundPurge, boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
import {createPurgeSequence} from './purge-sequence-model.mjs';
import {bindLabPurgeTarget, planLabPurgeTargets} from './purge-target-plan.mjs';

const fail = () => { throw new Error('PURGE_SEQUENCE_STATE_CONFLICT'); };
const snapshot = state => Object.freeze({planHash: state.planHash, revision: state.revision,
  stopRequested: state.stopRequested, outcomes: Object.freeze([...state.outcomes])});
function actionValue(action, keys) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail();
  const proto = Object.getPrototypeOf(action);
  const names = Object.getOwnPropertyNames(action);
  if ((proto !== Object.prototype && proto !== null) || Object.getOwnPropertySymbols(action).length ||
      names.length !== keys.length || keys.some(key => !names.includes(key))) fail();
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(action, key);
    if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable || !('value' in descriptor)) fail();
    result[key] = descriptor.value;
  }
  return result;
}
const engineFor = (scope, state, targets) => {
  const token = boundPurgeToken(state);
  const model = createPurgeSequence(scope, token, targets);
  const sequence = model.importSnapshot(state.sequence);
  if (model.planHash !== state.sequence.planHash || sequence.revision !== state.stateRevision ||
      state.stop.revision !== state.stateRevision || sequence.stopRequested !== state.stop.stopRequested) fail();
  const active = sequence.outcomes.findIndex(value => value === 'pending' || value === 'unknown');
  const failed = sequence.outcomes.findIndex(value => value === 'not-applied');
  if (active >= 0) {
    const id = bindLabPurgeTarget(scope, token, targets[active]).effectId;
    if (failed >= 0 || !state.stop.effect || state.stop.effect.id !== id ||
        state.stop.effect.outcome !== sequence.outcomes[active]) fail();
  } else if (failed >= 0) {
    const id = bindLabPurgeTarget(scope, token, targets[failed]).effectId;
    if (!state.stop.stopRequested || !state.stop.effect || state.stop.effect.id !== id ||
        state.stop.effect.outcome !== 'not-applied') fail();
  } else if (state.stop.effect !== null) fail();
  return {token, model, sequence};
};

export function claimBoundPurgeSequence(prepared, expected, scope, targets) {
  const canonical = planLabPurgeTargets(scope, targets);
  const state = claimBoundPurge(prepared, expected);
  const model = createPurgeSequence(scope, boundPurgeToken(state), canonical);
  return Object.freeze({...state, sequence: snapshot(model.initial)});
}

export function boundPurgeSequenceToken(state, scope, targets) {
  const {token, sequence} = engineFor(scope, state, planLabPurgeTargets(scope, targets));
  return Object.freeze({...token, sequenceRevision: sequence.revision, planHash: sequence.planHash});
}

export function transitionBoundPurgeSequence(state, expected, scope, targets, action) {
  const canonical = planLabPurgeTargets(scope, targets);
  const {token, model, sequence} = engineFor(scope, state, canonical);
  const current = Object.freeze({...token, sequenceRevision: sequence.revision, planHash: sequence.planHash});
  if (!expected || Object.keys(expected).length !== Object.keys(current).length ||
      Object.keys(current).some(key => expected[key] !== current[key])) fail();
  let nextSequence;
  let nextBound;
  const typeDescriptor = action && typeof action === 'object' && Object.getOwnPropertyDescriptor(action, 'type');
  if (!typeDescriptor || typeDescriptor.get || typeDescriptor.set || !typeDescriptor.enumerable || !('value' in typeDescriptor)) fail();
  const type = typeDescriptor.value;
  if (type === 'stop') {
    actionValue(action, ['type']);
    nextSequence = model.transition(sequence, sequence.revision, {type: 'stop'});
    nextBound = transitionBoundPurge(state, token, {type: 'stop'});
  } else if (type === 'begin') {
    const {index} = actionValue(action, ['type', 'index']);
    if (!Number.isSafeInteger(index) || index < 0 || index >= canonical.length) fail();
    const effectId = bindLabPurgeTarget(scope, token, canonical[index]).effectId;
    nextSequence = model.transition(sequence, sequence.revision,
      {type: 'begin', index, planHash: model.planHash});
    nextBound = transitionBoundPurge(state, token, {type: 'begin', effectId});
  } else if (type === 'outcome') {
    const {index, outcome} = actionValue(action, ['type', 'index', 'outcome']);
    if (!Number.isSafeInteger(index) || index < 0 || index >= canonical.length) fail();
    const effectId = bindLabPurgeTarget(scope, token, canonical[index]).effectId;
    nextSequence = model.transition(sequence, sequence.revision,
      {type: 'outcome', index, planHash: model.planHash, outcome});
    nextBound = transitionBoundPurge(state, token,
      {type: 'outcome', effectId, outcome});
    // Reuse is allowed only after the applied outcome is part of the retained
    // sequence history. Unknown and not-applied effects remain in the stop slot.
    if (outcome === 'applied') {
      if (nextSequence.outcomes[index] !== 'applied') fail();
      nextBound = Object.freeze({...nextBound, stop: Object.freeze({...nextBound.stop, effect: null})});
    } else if (outcome === 'not-applied') {
      if (!nextSequence.stopRequested) fail();
      nextBound = Object.freeze({...nextBound, stop: Object.freeze({...nextBound.stop, stopRequested: true})});
    }
  } else fail();
  const result = Object.freeze({...nextBound, sequence: snapshot(nextSequence)});
  engineFor(scope, result, canonical);
  return result;
}
