import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createStagedChunkBinding, verifyStagedChunkReceipt} from './restore-chunk-binding.mjs';
import {prepareResumePlan, verifyResumePlan} from './restore-resume-plan.mjs';
const require = createRequire(import.meta.url);
const {validateRestoreChunk, decodeFirestoreValue, restoreChunkDecision} = require('../../functions/backup-restore-service.js');
const {staleRestoreIndexes} = require('../../functions/backup-restore-preview.js');
const {preserveRestoreAuthority} = require('../../functions/backup-restore-authority.js');
const {rewriteStorageData} = require('../../functions/backup-storage-rewrite.js');
const {createBackupRestoreBinding} = require('../../functions/backup-restore-receipt.js');
const hash = value => createHash('sha256').update(value).digest('hex');

// Internal emulator-only service, not an authenticated endpoint or production export.
export function createRestoreChunkLab({store, stageLab, projectId, types = {}, now = Date.now, beforeChunkWrite}) {
  if (!/^demo-[a-z0-9-]+$/.test(projectId || '') || store.projectId !== projectId) {
    throw new Error('LAB_PROJECT');
  }
  async function commit(uid, input, stageCommand, resumeContext) {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid)) throw new Error('LAB_OWNER');
    const command = validateRestoreChunk(structuredClone(input), uid);
    if (command.mode !== 'apply' || !command.confirmed) throw new Error('LAB_CONFIRM');
    const binding = createStagedChunkBinding(uid, command, stageCommand);
    const stageIds = [...stageCommand.stageIds];
    const resume = resumeContext === undefined ? null : structuredClone(resumeContext);
    if (resume && !/^[A-Za-z0-9._:-]{1,160}$/.test(resume.planId || '')) throw Error('RESUME_PLAN_INVALID');
    const receipt = store.doc(`labRestoreChunkReceipts/${uid}/items/${hash(command.operationId)}`);
    const targets = command.records.map(record => store.doc(`labCandidateRecords/${uid}/items/${hash(record.path)}`));
    return store.runTransaction(async tx => {
      if (resume) {
        const snapshot = await tx.get(store.doc(`labRestoreResumePlans/${uid}/items/${hash(resume.planId)}`));
        if (!snapshot.exists) throw Error('RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
        const plan = verifyResumePlan(snapshot.data(), uid, resume.planId, resume.inputs, now(), resume.stageCommands);
        const planned = plan.chunks[command.chunkIndex]?.stage?.binding;
        if (!planned || planned.operationHash !== binding.operationHash) throw Error('RESUME_PLAN_MISMATCH');
      }
      const previous = await tx.get(receipt);
      if (previous.exists) return verifyStagedChunkReceipt(previous.data(), binding);
      const mapping = stageIds.length ? await stageLab.resolveMappingInTransaction(tx, uid,
        {operationId: binding.restoreOperationId, stageIds}) : Object.create(null);
      const snapshots = await Promise.all(targets.map(ref => tx.get(ref)));
      const stale = staleRestoreIndexes(command.records, snapshots);
      if (stale.length) return {status: 'stale-preview', duplicate: false, staleCount: stale.length, staleIndexes: stale};
      const decision = restoreChunkDecision({collisions: snapshots.filter(s => s.exists),
        overwriteExisting: command.overwriteExisting && command.overwriteConfirmed});
      if (decision.status !== 'ready') return decision;
      const applyFence = beforeChunkWrite ? await beforeChunkWrite(tx, structuredClone(command.records),
        snapshots.map(snapshot => snapshot.exists ? snapshot.data() : null)) : null;
      if (beforeChunkWrite && typeof applyFence !== 'function') throw Error('RESUME_FENCE_INVALID');
      // Rewrite the whole chunk at once: every mapping entry must be consumed.
      const rewritten = rewriteStorageData(uid, command.records.map(record => record.data), mapping);
      const rewrittenCommand = {...command, records: command.records.map((record, index) =>
        ({...record, data: rewritten[index]}))};
      const rewriteHash = createBackupRestoreBinding({uid, command: rewrittenCommand}).operationHash;
      const values = rewritten.map((data, index) => preserveRestoreAuthority(command.records[index].path,
        decodeFirestoreValue(data, types), snapshots[index].exists ? snapshots[index].data() : null));
      applyFence?.();
      values.forEach((data, index) => tx.set(targets[index], data,
        {merge: command.records[index].path === `users/${uid}`}));
      const result = {status: 'applied', duplicate: false, recordCount: command.records.length};
      tx.create(receipt, {...binding, ...result, rewriteHash});
      return result;
    });
  }
  async function commitPlan(uid, planId, inputs, stageCommands) {
    const commands = structuredClone(inputs), stages = structuredClone(stageCommands);
    if (!Array.isArray(stages)) throw Error('RESUME_STAGE_INVALID');
    prepareResumePlan(uid, planId, commands, now(), stages);
    // Old persisted plans predate creation-time validation. Reject invalid
    // typed values across the entire request before committing another chunk.
    for(const command of commands)for(const record of command.records)
      decodeFirestoreValue(record.data,{timestamp:()=>null,bytes:()=>null});
    const context = {planId, inputs: commands, stageCommands: stages}, results = [];
    for (let index = 0; index < commands.length; index++) {
      const result = await commit(uid, commands[index], stages[index], context);
      results.push(result);
      if (result.status !== 'applied') return {status: 'stopped', index, results};
    }
    return {status: 'completed', results};
  }
  return Object.freeze({commit, commitPlan});
}
