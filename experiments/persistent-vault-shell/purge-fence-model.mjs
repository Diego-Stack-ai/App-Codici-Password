// Pure pre-destruction model only. Each transition must be committed in the SAME
// transaction as the participating writer/claim. This is not an I/O lock by itself.
const fail = code => { throw new Error(code); };
function validate(state) {
  if (!state || Object.keys(state).some(key => !['revision','phase','operationId','previewHash'].includes(key)) ||
      (Object.hasOwn(state,'previewHash') && (state.phase !== 'prepared' ||
        typeof state.previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(state.previewHash))) ||
      !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !['idle', 'prepared', 'exclusive'].includes(state.phase) ||
      (state.phase === 'idle' ? state.operationId !== null :
        typeof state.operationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(state.operationId))) fail('FENCE_STATE');
}
function next(state, phase, operationId) {
  if (state.revision === Number.MAX_SAFE_INTEGER) fail('FENCE_OVERFLOW');
  return Object.freeze({revision: state.revision + 1, phase, operationId});
}
export function preparePurgeFence(state, operationId) {
  validate(state);
  if (typeof operationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(operationId)) fail('FENCE_INPUT');
  if (state.phase !== 'idle') fail('FENCE_BUSY');
  return next(state, 'prepared', operationId);
}
export function invalidatePurgeForWrite(state) {
  validate(state);
  if (state.phase === 'exclusive') fail('FENCE_BUSY');
  return next(state, 'idle', null);
}
export function enterExclusivePurge(state, expected) {
  validate(state);
  if (state.phase !== 'prepared' || !expected || expected.phase !== 'prepared' ||
      state.revision !== expected.revision || state.operationId !== expected.operationId ||
      state.previewHash !== expected.previewHash) fail('FENCE_CONFLICT');
  return next(state, 'exclusive', state.operationId);
}
// Cancel only before any exclusive effect can begin. A stale request must not
// cancel a later preparation, even when it reused the same operation ID.
export function cancelPreparedPurge(state, expected) {
  validate(state);
  if (state.phase !== 'prepared' || !expected || expected.phase !== 'prepared' ||
      state.revision !== expected.revision || state.operationId !== expected.operationId ||
      state.previewHash !== expected.previewHash) fail('FENCE_CONFLICT');
  return next(state, 'idle', null);
}
// No exclusive expiry/unlock/recovery transition: an unknown destructive outcome must not
// silently reopen writes. Post-boundary cancellation and partial effects remain separate.
