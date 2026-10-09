// Internal pure composition only: caller must persist transitions atomically.
// Tokens identify state; they do not authenticate an executor or cancel I/O.
import {enterExclusivePurge} from './purge-fence-model.mjs';
import {beginPurgeEffect, retryPurgeEffect, requestPurgeStop, recordPurgeEffectOutcome, purgeStopSummary} from './purge-stop-model.mjs';
const fail = () => { throw new Error('PURGE_BOUND_CONFLICT'); };
export function claimBoundPurge(prepared, expected) {
  const fence = enterExclusivePurge(prepared, expected);
  return Object.freeze({stateRevision: 0, fence,
    stop: Object.freeze({revision: 0, stopRequested: false, effect: null})});
}
export function boundPurgeToken(state) {
  const f = state?.fence;
  if (!Number.isSafeInteger(state?.stateRevision) || state.stateRevision < 0 ||
      !f || f.phase !== 'exclusive' || !Number.isSafeInteger(f.revision) || f.revision < 1 ||
      typeof f.operationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(f.operationId)) fail();
  purgeStopSummary(state.stop);
  return Object.freeze({operationId: f.operationId, claimRevision: f.revision,
    stopRevision: state.stop.revision, stateRevision: state.stateRevision});
}
export function transitionBoundPurge(state, expected, action) {
  const current = boundPurgeToken(state);
  if (!expected || Object.keys(current).some(key => expected[key] !== current[key])) fail();
  if (state.stateRevision === Number.MAX_SAFE_INTEGER) fail();
  let stop;
  switch (action?.type) {
    case 'stop': stop = requestPurgeStop(state.stop); break;
    case 'begin': stop = beginPurgeEffect(state.stop, action.effectId); break;
    case 'retry': stop = retryPurgeEffect(state.stop, action.effectId); break;
    case 'outcome': stop = recordPurgeEffectOutcome(state.stop, action.effectId, action.outcome); break;
    default: fail();
  }
  return Object.freeze({stateRevision: state.stateRevision + 1,
    fence: Object.freeze({...state.fence}), stop});
}
// Deliberately no release: stopped does not grant permission to write.
