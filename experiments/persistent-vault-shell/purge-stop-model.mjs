// Pure single-effect model AFTER exclusive claim; no I/O or automatic release.
const fail = () => { throw new Error('PURGE_STOP_STATE'); };
function validate(s) {
  if (!s || typeof s.stopRequested !== 'boolean' || !Number.isSafeInteger(s.revision) || s.revision < 0) fail();
  if (s.effect !== null && (!s.effect || typeof s.effect.id !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(s.effect.id) ||
      !['pending', 'unknown', 'applied', 'not-applied'].includes(s.effect.outcome))) fail();
}
function update(s, patch) {
  if (s.revision === Number.MAX_SAFE_INTEGER) fail();
  const next = {...s, ...patch, revision: s.revision + 1};
  if (next.effect) next.effect = Object.freeze({...next.effect});
  return Object.freeze(next);
}
export function requestPurgeStop(s) {
  validate(s);
  return update(s, {stopRequested: true});
}
export function beginPurgeEffect(s, id) {
  validate(s);
  if (s.stopRequested || s.effect !== null || typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(id)) fail();
  return update(s, {effect: {id, outcome: 'pending'}});
}
// Evidence must come from the executor/reconciliation, never a client assertion.
export function recordPurgeEffectOutcome(s, id, outcome) {
  validate(s);
  if (!s.effect || s.effect.id !== id || !['pending', 'unknown'].includes(s.effect.outcome) ||
      !['unknown', 'applied', 'not-applied'].includes(outcome)) fail();
  return update(s, {effect: {id, outcome}});
}
export function purgeStopSummary(s) {
  validate(s);
  const unresolved = s.effect !== null && ['pending', 'unknown'].includes(s.effect.outcome);
  return Object.freeze({stopRequested: s.stopRequested, unresolved,
    stopped: s.stopRequested && !unresolved, partial: s.effect?.outcome === 'applied'});
}
