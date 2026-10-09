import {createHash} from 'node:crypto';

const OUTCOMES = new Set(['unstarted', 'pending', 'applied', 'not-applied', 'unknown']);
const fail = () => { throw new Error('PURGE_EFFECT_SEQUENCE_CONFLICT'); };

export function createPurgeEffectSequence(boundPlan) {
  if (!boundPlan || boundPlan.destructiveAllowed !== false || typeof boundPlan.planHash !== 'string' ||
      typeof boundPlan.storageHash !== 'string' || !Array.isArray(boundPlan.effects) || !boundPlan.effects.length) fail();
  const effectIds = boundPlan.effects.map((effect, index) => createHash('sha256').update(JSON.stringify({
    domain: 'purge-bound-effect-v1', planHash: boundPlan.planHash, storageHash: boundPlan.storageHash, index, effect
  })).digest('hex'));
  const sequenceHash = createHash('sha256').update(JSON.stringify({domain: 'purge-bound-sequence-v1', effectIds})).digest('hex');
  const issue = (revision, stopRequested, outcomes) => Object.freeze({sequenceHash, revision, stopRequested,
    outcomes: Object.freeze(outcomes)});
  const validate = state => {
    if (!state || state.sequenceHash !== sequenceHash || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
        typeof state.stopRequested !== 'boolean' || !Array.isArray(state.outcomes) ||
        state.outcomes.length !== effectIds.length || state.outcomes.some(value => !OUTCOMES.has(value))) fail();
  };
  const initial = issue(0, false, effectIds.map(() => 'unstarted'));
  const transition = (state, action) => {
    validate(state);
    if (state.revision === Number.MAX_SAFE_INTEGER || !action || typeof action !== 'object') fail();
    const outcomes = [...state.outcomes]; let stopRequested = state.stopRequested;
    if (action.type === 'stop') {
      stopRequested = true;
    } else {
      const index = action.index;
      if (!Number.isSafeInteger(index) || index < 0 || index >= outcomes.length || action.effectId !== effectIds[index]) fail();
      if (action.type === 'begin') {
        if (stopRequested || outcomes[index] !== 'unstarted' || outcomes.slice(0, index).some(value => value !== 'applied')) fail();
        outcomes[index] = 'pending';
      } else if (action.type === 'retry') {
        if (stopRequested || outcomes[index] !== 'unknown' || outcomes.slice(0, index).some(value => value !== 'applied')) fail();
        outcomes[index] = 'pending';
      } else if (action.type === 'outcome') {
        if (!['pending', 'unknown'].includes(outcomes[index]) || !['applied', 'not-applied', 'unknown'].includes(action.outcome)) fail();
        outcomes[index] = action.outcome;
        if (action.outcome === 'not-applied') stopRequested = true;
      } else fail();
    }
    return issue(state.revision + 1, stopRequested, outcomes);
  };
  return Object.freeze({sequenceHash, effectIds: Object.freeze(effectIds), initial, transition,
    summary(state) { validate(state); const appliedCount = state.outcomes.filter(value => value === 'applied').length;
      const unresolved = state.outcomes.some(value => value === 'pending' || value === 'unknown');
      return Object.freeze({appliedCount, unresolved, stopped: state.stopRequested && !unresolved,
        allApplied: appliedCount === effectIds.length}); }});
}
