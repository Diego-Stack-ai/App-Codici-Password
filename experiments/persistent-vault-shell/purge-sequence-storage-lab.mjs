// Isolated synthetic executor. No runtime export, discovery, release or retry of uncertain effects.
import {planLabPurgeTargets} from './purge-target-plan.mjs';
import {boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';

export async function deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, index) {
  if (store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      process.env.STORAGE_EMULATOR_HOST !== 'http://127.0.0.1:9199') throw Error('PURGE_LAB_ONLY');
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const plan = planLabPurgeTargets(scope, targets);
  expected = structuredClone(expected);
  if (bucket.name !== scope.bucket || !Number.isSafeInteger(index) || index < 0 || index >= plan.length ||
      plan[index].kind !== 'object') throw Error('PURGE_TARGET_INVALID');
  // Require a dedicated client configured by its caller; never mutate a shared SDK client.
  const assertNoRetry = () => {
    if (bucket.storage?.apiEndpoint !== 'http://127.0.0.1:9199' ||
        !['http://127.0.0.1:9199', 'http://127.0.0.1:9199/storage/v1'].includes(bucket.storage?.baseUrl))
      throw Error('PURGE_LAB_ONLY');
    if (bucket.storage?.retryOptions?.autoRetry !== false) throw Error('PURGE_RETRY_CONFIG');
  };
  assertNoRetry();
  const ref = store.doc(`labPurgeStates/${scope.id}`);
  // Only the caller whose begin transaction succeeds may issue the external effect.
  await store.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw Error('PURGE_SEQUENCE_CONFLICT');
    const next = transitionBoundPurgeSequence(snapshot.data(), expected, scope, plan, {type: 'begin', index});
    tx.set(ref, next);
  });
  let outcome = 'unknown';
  try {
    assertNoRetry();
    const target = plan[index];
    // Keep the generation a string: coercing uint64 generations loses precision.
    await bucket.file(target.path, {generation: target.generation}).delete({generation: target.generation, ifGenerationMatch: target.generation});
    outcome = 'applied';
  } catch {
    // Even 404 is not proof this invocation performed the deletion. Keep uncertainty.
  }
  await store.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw Error('PURGE_SEQUENCE_CONFLICT');
    const current = snapshot.data();
    const token = boundPurgeSequenceToken(current, scope, plan);
    if (token.operationId !== expected.operationId || token.claimRevision !== expected.claimRevision ||
        token.planHash !== expected.planHash || current.sequence.outcomes[index] !== 'pending')
      throw Error('PURGE_SEQUENCE_CONFLICT');
    // Re-read the stop slot: a concurrent stop must survive settlement.
    tx.set(ref, transitionBoundPurgeSequence(current, token, scope, plan, {type: 'outcome', index, outcome}));
  });
  return {outcome, releaseAllowed: false};
}
