import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';

const fail = () => { throw new Error('PURGE_BOUND_STORAGE_CONFLICT'); };

// Synthetic adapter only. It deliberately leaves a failed/ambiguous delete as
// `unknown`; a later reconciliation gate is required before any real engine.
export async function applyBoundObjectDeleteLab(stateLab, bucket, id, expected, boundPlan, index) {
  if (!stateLab || typeof stateLab.transition !== 'function' || typeof stateLab.token !== 'function' ||
      !bucket || typeof bucket.file !== 'function' || typeof id !== 'string' || !Number.isSafeInteger(index))
    throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'object-delete' || typeof effect.storagePath !== 'string' ||
      typeof effect.generation !== 'string' || !/^[1-9][0-9]*$/.test(effect.generation)) fail();
  await stateLab.transition(id, expected, boundPlan, {type: 'begin', index, effectId});
  let outcome = 'applied';
  try {
    await bucket.file(effect.storagePath).delete({ifGenerationMatch: effect.generation});
  } catch {
    outcome = 'unknown';
  }
  const token = await stateLab.token(id, boundPlan);
  const state = await stateLab.transition(id, token, boundPlan, {type: 'outcome', index, effectId, outcome});
  return Object.freeze({outcome, stateRevision: state.stateRevision, destructiveAllowed: false});
}

export async function reconcileBoundObjectDeleteLab(stateLab, bucket, id, expected, boundPlan, index) {
  if (!stateLab || typeof stateLab.transition !== 'function' || !bucket || typeof bucket.file !== 'function' ||
      typeof id !== 'string' || !Number.isSafeInteger(index)) throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'object-delete' || typeof effect.storagePath !== 'string' ||
      typeof effect.generation !== 'string' || !/^[1-9][0-9]*$/.test(effect.generation)) fail();
  let outcome = 'not-applied';
  try {
    const [metadata] = await bucket.file(effect.storagePath, {generation: effect.generation}).getMetadata();
    if (!metadata || metadata.generation !== effect.generation) fail();
  } catch (error) {
    if (Number(error?.code) === 404) outcome = 'applied';
    else return Object.freeze({outcome: 'unknown', destructiveAllowed: false});
  }
  const state = await stateLab.transition(id, expected, boundPlan, {type: 'outcome', index, effectId, outcome});
  return Object.freeze({outcome, stateRevision: state.stateRevision, destructiveAllowed: false});
}

export async function retryBoundObjectDeleteLab(stateLab, bucket, id, expected, boundPlan, index) {
  if (!stateLab || typeof stateLab.transition !== 'function' || typeof stateLab.token !== 'function' ||
      !bucket || typeof bucket.file !== 'function' || typeof id !== 'string' || !Number.isSafeInteger(index))
    throw new Error('PURGE_LAB_ONLY');
  const model = createPurgeEffectSequence(boundPlan), effect = boundPlan.effects[index], effectId = model.effectIds[index];
  if (!effect || effect.kind !== 'object-delete' || typeof effect.storagePath !== 'string' ||
      typeof effect.generation !== 'string' || !/^[1-9][0-9]*$/.test(effect.generation)) fail();
  // The atomic transition proves that this exact effect was unresolved before
  // the second Storage call. Any non-unknown or stopped state fails first.
  await stateLab.transition(id, expected, boundPlan, {type: 'retry', index, effectId});
  let outcome = 'applied';
  try { await bucket.file(effect.storagePath).delete({ifGenerationMatch: effect.generation}); }
  catch { outcome = 'unknown'; }
  const token = await stateLab.token(id, boundPlan);
  const state = await stateLab.transition(id, token, boundPlan, {type: 'outcome', index, effectId, outcome});
  return Object.freeze({outcome, stateRevision: state.stateRevision, destructiveAllowed: false});
}
