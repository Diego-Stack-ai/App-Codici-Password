// Post-claim synthetic writer gate only. No implicit release or persisted queue.
import {planLabPurgeTargets} from './purge-target-plan.mjs';
import {invalidatePurgeForWrite, preparePurgeFence} from './purge-fence-model.mjs';
import {boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';

// Bounded lab namespace only: conservatively block on any reference in scope.
// This is not discovery of all application references or descendants.
export async function prepareLabPurgeWithoutReferences(store, scope, targets, operationId) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const plan = planLabPurgeTargets(scope, targets);
  if (plan.some(target => target.kind !== 'document')) throw new Error('PURGE_TARGET_INVALID');
  const stateRef = store.doc(`labPurgeStates/${scope.id}`);
  const references = store.collection(`labPurgeReferences/${scope.id}/items`).limit(1);
  return store.runTransaction(async tx => {
    const state = await tx.get(stateRef);
    if (!state.exists) throw new Error('PURGE_SEQUENCE_CONFLICT');
    const current = state.data();
    if (Object.keys(current).length !== 1 || !current.fence) throw new Error('FENCE_BUSY');
    const fence = preparePurgeFence(current.fence, operationId);
    if (!(await tx.get(references)).empty) throw new Error('PURGE_REFERENCES_PRESENT');
    const snapshots = await tx.getAll(...plan.map(target => store.doc(target.path)));
    snapshots.forEach((snapshot, index) => {
      const version = plan[index].updateTime;
      if (!snapshot.exists || snapshot.updateTime.seconds !== version.seconds ||
          snapshot.updateTime.nanoseconds !== version.nanoseconds) throw new Error('PURGE_TARGET_CONFLICT');
    });
    tx.set(stateRef, {fence});
    return fence;
  });
}

// Pre-claim counterpart: only synthetic document references, create-only.
export async function createLabReferenceBeforePurge(store, scope, targets, index, referenceId) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const plan = planLabPurgeTargets(scope, targets);
  if (!Number.isSafeInteger(index) || index < 0 || index >= plan.length ||
      plan[index].kind !== 'document' || typeof referenceId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(referenceId)) throw new Error('PURGE_TARGET_INVALID');
  const stateRef = store.doc(`labPurgeStates/${scope.id}`);
  const targetRef = store.doc(plan[index].path);
  const referenceRef = store.doc(`labPurgeReferences/${scope.id}/items/${referenceId}`);
  return store.runTransaction(async tx => {
    const [state, target, reference] = await tx.getAll(stateRef, targetRef, referenceRef);
    if (!state.exists) throw new Error('PURGE_SEQUENCE_CONFLICT');
    const current = state.data();
    // Never discard sequence/outcome history by treating stopped as idle.
    if (Object.keys(current).length !== 1 || !current.fence) throw new Error('FENCE_BUSY');
    const fence = invalidatePurgeForWrite(current.fence);
    if (!target.exists || target.updateTime.seconds !== plan[index].updateTime.seconds ||
        target.updateTime.nanoseconds !== plan[index].updateTime.nanoseconds) throw new Error('PURGE_TARGET_CONFLICT');
    if (reference.exists) throw new Error('REFERENCE_EXISTS');
    tx.create(referenceRef, {synthetic: true, targetPath: targetRef.path});
    tx.set(stateRef, {fence});
    return {saved: true, fenceRevision: fence.revision};
  });
}

export async function requestLabReferenceDuringPurge(store, scope, targets, index) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const plan = planLabPurgeTargets(scope, targets);
  if (!Number.isSafeInteger(index) || index < 0 || index >= plan.length || plan[index].kind !== 'document') {
    throw new Error('PURGE_TARGET_INVALID');
  }
  const stateRef = store.doc(`labPurgeStates/${scope.id}`);
  const targetRef = store.doc(plan[index].path);
  return store.runTransaction(async tx => {
    const [snapshot, target] = await tx.getAll(stateRef, targetRef);
    if (!snapshot.exists) throw new Error('PURGE_SEQUENCE_CONFLICT');
    const state = snapshot.data();
    const token = boundPurgeSequenceToken(state, scope, plan);
    if (!state.sequence.stopRequested) {
      tx.set(stateRef, transitionBoundPurgeSequence(state, token, scope, plan, {type: 'stop'}));
    }
    // Reading the target and writing the SAME state serializes this request
    // against the document executor. A surviving target is not permission to write.
    return {saved: false, status: target.exists ? 'deferred-reverification' : 'target-missing',
      outcomes: [...state.sequence.outcomes]};
  });
}
