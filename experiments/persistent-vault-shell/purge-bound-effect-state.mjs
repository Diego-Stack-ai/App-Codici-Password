import {claimBoundPurge, boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';

const fail = () => { throw new Error('PURGE_BOUND_EFFECT_STATE_CONFLICT'); };

export function claimBoundEffectState(prepared, expected, boundPlan) {
  const bound = claimBoundPurge(prepared, expected), model = createPurgeEffectSequence(boundPlan);
  return Object.freeze({...bound, effectSequence: model.initial});
}

export function boundEffectStateToken(state, boundPlan) {
  const token = boundPurgeToken(state), model = createPurgeEffectSequence(boundPlan), sequence = state?.effectSequence;
  if (!sequence || sequence.sequenceHash !== model.sequenceHash || sequence.revision !== state.stateRevision ||
      sequence.stopRequested !== state.stop.stopRequested) fail();
  model.summary(sequence);
  return Object.freeze({...token, sequenceHash: sequence.sequenceHash, sequenceRevision: sequence.revision});
}

export function transitionBoundEffectState(state, expected, boundPlan, action) {
  const model = createPurgeEffectSequence(boundPlan), current = boundEffectStateToken(state, boundPlan);
  if (!expected || Object.keys(current).some(key => expected[key] !== current[key])) fail();
  let sequence, bound;
  if (action?.type === 'stop') {
    sequence = model.transition(state.effectSequence, {type: 'stop'});
    bound = transitionBoundPurge(state, boundPurgeToken(state), {type: 'stop'});
  } else {
    const index = action?.index, effectId = model.effectIds[index];
    if (!Number.isSafeInteger(index) || action.effectId !== effectId) fail();
    if (action.type === 'begin') {
      sequence = model.transition(state.effectSequence, {type: 'begin', index, effectId});
      bound = transitionBoundPurge(state, boundPurgeToken(state), {type: 'begin', effectId});
    } else if (action.type === 'retry') {
      sequence = model.transition(state.effectSequence, {type: 'retry', index, effectId});
      bound = transitionBoundPurge(state, boundPurgeToken(state), {type: 'retry', effectId});
    } else if (action.type === 'outcome') {
      sequence = model.transition(state.effectSequence, {type: 'outcome', index, effectId, outcome: action.outcome});
      bound = transitionBoundPurge(state, boundPurgeToken(state), {type: 'outcome', effectId, outcome: action.outcome});
      if (action.outcome === 'applied') bound = Object.freeze({...bound,
        stop: Object.freeze({...bound.stop, effect: null})});
      else if (action.outcome === 'not-applied') bound = Object.freeze({...bound,
        stop: Object.freeze({...bound.stop, stopRequested: true})});
    } else fail();
  }
  const next = Object.freeze({...bound, effectSequence: sequence});
  boundEffectStateToken(next, boundPlan);
  return next;
}
