// Read-only, transactionally consistent evidence. Never a release authorization.
import {planLabPurgeTargets, bindLabPurgeTarget} from './purge-target-plan.mjs';
import {boundPurgeSequenceToken} from './purge-bound-sequence-model.mjs';

function commandPlan(store, scope, targets) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || store.projectId !== 'demo-purge-fence') {
    throw new Error('PURGE_LAB_ONLY');
  }
  scope = Object.freeze({id: scope?.id, bucket: scope?.bucket});
  const plan = planLabPurgeTargets(scope, targets);
  if (plan.some(target => target.kind !== 'document')) throw new Error('PURGE_TARGET_INVALID');
  return {scope, plan};
}

async function inspectInTransaction(tx, store, scope, plan) {
    const snapshot = await tx.get(store.doc(`labPurgeStates/${scope.id}`));
    if (!snapshot.exists) throw new Error('PURGE_SEQUENCE_CONFLICT');
    const state = snapshot.data();
    const token = boundPurgeSequenceToken(state, scope, plan);
    if (!state.sequence.stopRequested) throw new Error('PURGE_NOT_STOPPED');
    const bindings = plan.map(target => bindLabPurgeTarget(scope, token, target));
    const documents = await tx.getAll(...plan.map(target => store.doc(target.path)));
    const receipts = await tx.getAll(...bindings.map(binding => store.doc(`labPurgeResults/${binding.effectId}`)));
    const items = plan.map((target, index) => {
      const outcome = state.sequence.outcomes[index];
      const receipt = receipts[index];
      if (receipt.exists) {
        const data = receipt.data();
        if (data.effectId !== bindings[index].effectId || data.planHash !== token.planHash ||
            data.sequenceIndex !== index || data.outcome !== 'applied' || outcome !== 'applied') {
          throw new Error('PURGE_RECEIPT_CONFLICT');
        }
      } else if (outcome === 'applied') throw new Error('PURGE_RECEIPT_CONFLICT');
      const doc = documents[index];
      const presence = !doc.exists ? 'absent' :
        doc.updateTime.seconds === target.updateTime.seconds &&
        doc.updateTime.nanoseconds === target.updateTime.nanoseconds ? 'original-version' : 'different-version';
      // Atomic document deletion plus receipt cannot leave that exact version alive.
      if (outcome === 'applied' && presence === 'original-version') throw new Error('PURGE_EVIDENCE_CONFLICT');
      // Absence alone never changes pending/unknown into applied.
      return Object.freeze({index, outcome, presence, confirmedApplied: receipt.exists});
    });
    return Object.freeze({writeAllowed: false, stateRevision: token.stateRevision,
      unresolved: items.some(item => ['pending', 'unknown'].includes(item.outcome)),
      items: Object.freeze(items)});
}

export async function inspectStoppedLabPurge(store, scope, targets) {
  const command = commandPlan(store, scope, targets);
  return store.runTransaction(tx => inspectInTransaction(tx, store, command.scope, command.plan));
}

// Explicit retry for an unchanged, unstarted document only. The purge stays stopped:
// no generic fence release, recreation of deleted data, or loss of sequence history.
export async function resumeLabReferenceAfterStop(store, scope, targets, index, referenceId, expectedRevision) {
  const command = commandPlan(store, scope, targets);
  if (!Number.isSafeInteger(index) || index < 0 || index >= command.plan.length ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      typeof referenceId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(referenceId)) {
    throw new Error('PURGE_RESUME_INPUT');
  }
  const ref = store.doc(`labPurgeReferences/${command.scope.id}/items/${referenceId}`);
  return store.runTransaction(async tx => {
    const report = await inspectInTransaction(tx, store, command.scope, command.plan);
    if (report.stateRevision !== expectedRevision || report.unresolved ||
        report.items.some(item => !['applied', 'unstarted'].includes(item.outcome)) ||
        report.items[index].outcome !== 'unstarted' || report.items[index].presence !== 'original-version') {
      throw new Error('PURGE_RESUME_CONFLICT');
    }
    const existing = await tx.get(ref);
    if (existing.exists) throw new Error('REFERENCE_EXISTS');
    tx.create(ref, {synthetic: true, targetPath: command.plan[index].path});
    return {saved: true, purgeStillStopped: true};
  });
}
