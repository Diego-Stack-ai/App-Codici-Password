import {bindLabPurgeTarget} from './purge-target-plan.mjs';
import {boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
// Internal emulator-only single-document experiment. No endpoint or writer release.
export async function deleteLabPurgeDocument(store, scope, expected, target) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
  const token = Object.freeze({operationId: expected?.operationId, claimRevision: expected?.claimRevision,
    stopRevision: expected?.stopRevision, stateRevision: expected?.stateRevision});
  if (!Number.isSafeInteger(token.stopRevision) || token.stopRevision < 0 ||
      !Number.isSafeInteger(token.stateRevision) || token.stateRevision < 0) throw new Error('PURGE_BOUND_CONFLICT');
  const bound = bindLabPurgeTarget(scope, token, target);
  if (bound.target.kind !== 'document') throw new Error('PURGE_DOCUMENT_ONLY');
  const stateRef = store.doc(`labPurgeStates/${scope.id}`);
  const receiptRef = store.doc(`labPurgeResults/${bound.effectId}`);
  const targetRef = store.doc(bound.target.path);
  return store.runTransaction(async tx => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const data = receipt.data();
      if (data.effectId !== bound.effectId || data.outcome !== 'applied') throw new Error('PURGE_RECEIPT_CONFLICT');
      return {outcome: 'applied', duplicate: true};
    }
    const [stateSnapshot, snapshot] = await tx.getAll(stateRef, targetRef);
    const state = stateSnapshot.data();
    const begun = transitionBoundPurge(state, token, {type: 'begin', effectId: bound.effectId});
    const version = bound.target.updateTime;
    if (!snapshot.exists || snapshot.updateTime.seconds !== version.seconds || snapshot.updateTime.nanoseconds !== version.nanoseconds) {
      throw new Error('PURGE_TARGET_CONFLICT');
    }
    const applied = transitionBoundPurge(begun, boundPurgeToken(begun), {type: 'outcome', effectId: bound.effectId, outcome: 'applied'});
    tx.delete(targetRef, {lastUpdateTime: snapshot.updateTime});
    tx.set(stateRef, applied);
    tx.create(receiptRef, {effectId: bound.effectId, outcome: 'applied'});
    return {outcome: 'applied', duplicate: false};
  });
}
