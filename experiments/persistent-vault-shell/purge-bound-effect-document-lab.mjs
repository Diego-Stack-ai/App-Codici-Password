import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';
import {transitionBoundEffectState} from './purge-bound-effect-state.mjs';
import service from '../../functions/archive-purge-service.js';

const fail = () => { throw new Error('PURGE_BOUND_DOCUMENT_CONFLICT'); };

export async function applyBoundDocumentDeleteLab(store, id, expected, boundPlan, index) {
  if (!store || store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
      typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(id) || !Number.isSafeInteger(index))
    throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'document-delete' || typeof effect.path !== 'string' || !effect.updateTime) fail();
  const stateRef = store.doc(`labPurgeBoundEffects/${id}`), targetRef = store.doc(effect.path);
  const receiptRef = store.doc(`labPurgeBoundEffectResults/${effectId}`);
  return store.runTransaction(async tx => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const value = receipt.data();
      if (value.effectId !== effectId || value.sequenceHash !== model.sequenceHash || value.outcome !== 'applied') fail();
      return {outcome: 'applied', duplicate: true};
    }
    const [stateSnapshot, targetSnapshot] = await Promise.all([tx.get(stateRef), tx.get(targetRef)]);
    if (!stateSnapshot.exists || !targetSnapshot.exists ||
        targetSnapshot.updateTime.seconds !== effect.updateTime.seconds ||
        targetSnapshot.updateTime.nanoseconds !== effect.updateTime.nanoseconds) fail();
    const begun = transitionBoundEffectState(stateSnapshot.data(), expected, boundPlan,
      {type: 'begin', index, effectId});
    const applied = transitionBoundEffectState(begun,
      {...expected, stateRevision: begun.stateRevision, stopRevision: begun.stop.revision,
        sequenceRevision: begun.effectSequence.revision}, boundPlan,
      {type: 'outcome', index, effectId, outcome: 'applied'});
    tx.delete(targetRef, {lastUpdateTime: targetSnapshot.updateTime});
    tx.set(stateRef, applied);
    tx.create(receiptRef, {effectId, sequenceHash: model.sequenceHash, outcome: 'applied'});
    return {outcome: 'applied', duplicate: false, stateRevision: applied.stateRevision};
  });
}

export async function applyBoundRevisionTouchLab(store, id, expected, boundPlan, index) {
  if (!store || store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
      typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(id) || !Number.isSafeInteger(index))
    throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'revision-touch' || typeof effect.path !== 'string' || !effect.updateTime ||
      !Number.isSafeInteger(effect.expectedRevision) || effect.nextRevision !== effect.expectedRevision + 1) fail();
  const stateRef = store.doc(`labPurgeBoundEffects/${id}`), targetRef = store.doc(effect.path);
  const receiptRef = store.doc(`labPurgeBoundEffectResults/${effectId}`);
  return store.runTransaction(async tx => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const value = receipt.data();
      if (value.effectId !== effectId || value.sequenceHash !== model.sequenceHash || value.outcome !== 'applied') fail();
      return {outcome: 'applied', duplicate: true};
    }
    const [stateSnapshot, targetSnapshot] = await Promise.all([tx.get(stateRef), tx.get(targetRef)]);
    if (!stateSnapshot.exists || !targetSnapshot.exists || targetSnapshot.data().revision !== effect.expectedRevision ||
        targetSnapshot.updateTime.seconds !== effect.updateTime.seconds ||
        targetSnapshot.updateTime.nanoseconds !== effect.updateTime.nanoseconds) fail();
    const begun = transitionBoundEffectState(stateSnapshot.data(), expected, boundPlan,
      {type: 'begin', index, effectId});
    const applied = transitionBoundEffectState(begun,
      {...expected, stateRevision: begun.stateRevision, stopRevision: begun.stop.revision,
        sequenceRevision: begun.effectSequence.revision}, boundPlan,
      {type: 'outcome', index, effectId, outcome: 'applied'});
    tx.update(targetRef, {revision: effect.nextRevision}, {lastUpdateTime: targetSnapshot.updateTime});
    tx.set(stateRef, applied);
    tx.create(receiptRef, {effectId, sequenceHash: model.sequenceHash, outcome: 'applied'});
    return {outcome: 'applied', duplicate: false, stateRevision: applied.stateRevision};
  });
}

export async function applyBoundProfileCleanupLab(store, id, expected, boundPlan, index) {
  if (!store || store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
      typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(id) || !Number.isSafeInteger(index))
    throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'profile-cleanup' || typeof effect.path !== 'string' || !effect.updateTime ||
      typeof effect.company !== 'boolean' || !effect.command) fail();
  const command = {...effect.command, operationId: 'lab-cleanup', expectedRevision: 0, confirmation: 'DELETE_FOREVER'};
  const normalized = service.validatePurgeCommand(command);
  const stateRef = store.doc(`labPurgeBoundEffects/${id}`), targetRef = store.doc(effect.path);
  const receiptRef = store.doc(`labPurgeBoundEffectResults/${effectId}`);
  return store.runTransaction(async tx => {
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const value = receipt.data();
      if (value.effectId !== effectId || value.sequenceHash !== model.sequenceHash || value.outcome !== 'applied') fail();
      return {outcome: 'applied', duplicate: true};
    }
    const [stateSnapshot, targetSnapshot] = await Promise.all([tx.get(stateRef), tx.get(targetRef)]);
    if (!stateSnapshot.exists || !targetSnapshot.exists ||
        targetSnapshot.updateTime.seconds !== effect.updateTime.seconds ||
        targetSnapshot.updateTime.nanoseconds !== effect.updateTime.nanoseconds) fail();
    const patch = service.planProfileReferenceCleanup(targetSnapshot.data(), normalized, {company: effect.company});
    if (Object.keys(patch).length === 0) fail();
    const begun = transitionBoundEffectState(stateSnapshot.data(), expected, boundPlan,
      {type: 'begin', index, effectId});
    const applied = transitionBoundEffectState(begun,
      {...expected, stateRevision: begun.stateRevision, stopRevision: begun.stop.revision,
        sequenceRevision: begun.effectSequence.revision}, boundPlan,
      {type: 'outcome', index, effectId, outcome: 'applied'});
    tx.update(targetRef, patch, {lastUpdateTime: targetSnapshot.updateTime});
    tx.set(stateRef, applied);
    tx.create(receiptRef, {effectId, sequenceHash: model.sequenceHash, outcome: 'applied'});
    return {outcome: 'applied', duplicate: false, stateRevision: applied.stateRevision};
  });
}
