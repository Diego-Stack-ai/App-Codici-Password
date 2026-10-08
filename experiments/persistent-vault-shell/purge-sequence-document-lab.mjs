// Synthetic Firestore-emulator experiment: sequence, fence and stop slot share
// labPurgeStates/{scopeId}; target, state outcome and idempotency receipt commit atomically.
import {bindLabPurgeTarget, planLabPurgeTargets} from './purge-target-plan.mjs';
import {boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';
import {createPurgeSequence} from './purge-sequence-model.mjs';

function assertLab(store) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
}
const fail = () => { throw new Error('PURGE_SEQUENCE_CONFLICT'); };

export async function deleteLabPurgeSequenceDocument(store, scope, expected, targets, index) {
  assertLab(store);
  // Caller-owned objects must not alter the command during transaction awaits.
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const keys = ['operationId', 'claimRevision', 'stopRevision', 'stateRevision', 'sequenceRevision', 'planHash'];
  if (!expected || typeof expected !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(expected)) ||
      Reflect.ownKeys(expected).length !== keys.length) fail();
  const token = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(expected, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail();
    token[key] = descriptor.value;
  }
  for (const key of ['claimRevision', 'stopRevision', 'stateRevision', 'sequenceRevision']) {
    if (!Number.isSafeInteger(token[key]) || token[key] < 0) fail();
  }
  expected = Object.freeze(token);
  const canonical = planLabPurgeTargets(scope, targets);
  if (!Number.isSafeInteger(index) || index < 0 || index >= canonical.length) fail();
  if (canonical[index].kind !== 'document') fail();
  const claim = {operationId: expected?.operationId, claimRevision: expected?.claimRevision};
  const model = createPurgeSequence(scope, claim, canonical);
  if (expected?.planHash !== model.planHash) fail();
  const bound = bindLabPurgeTarget(scope, claim, canonical[index]);
  const stateRef = store.doc(`labPurgeStates/${scope.id}`);
  const targetRef = store.doc(canonical[index].path);
  const receiptRef = store.doc(`labPurgeResults/${bound.effectId}`);
  return store.runTransaction(async tx => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const data = receipt.data();
      if (data.effectId !== bound.effectId || data.planHash !== model.planHash ||
          data.sequenceIndex !== index || data.outcome !== 'applied') fail();
      return {outcome: 'applied', duplicate: true};
    }
    const [stateSnapshot, targetSnapshot] = await tx.getAll(stateRef, targetRef);
    if (!stateSnapshot.exists) fail();
    const state = stateSnapshot.data();
    const begun = transitionBoundPurgeSequence(state, expected, scope, canonical,
      {type: 'begin', index});
    const target = canonical[index];
    const version = target.updateTime;
    if (!targetSnapshot.exists || targetSnapshot.updateTime.seconds !== version.seconds ||
        targetSnapshot.updateTime.nanoseconds !== version.nanoseconds) {
      throw new Error('PURGE_TARGET_CONFLICT');
    }
    const applied = transitionBoundPurgeSequence(begun,
      boundPurgeSequenceToken(begun, scope, canonical), scope, canonical,
      {type: 'outcome', index, outcome: 'applied'});
    tx.delete(targetRef, {lastUpdateTime: targetSnapshot.updateTime});
    tx.set(stateRef, applied);
    tx.create(receiptRef, {effectId: bound.effectId, planHash: model.planHash,
      sequenceIndex: index, outcome: 'applied'});
    return {outcome: 'applied', duplicate: false, sequenceRevision: applied.sequence.revision};
  });
}
