import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareResumePlan, verifyResumePlan, reconstructResumeCommands, RESUME_PLAN_DURATION_MS} from './restore-resume-plan.mjs';
import {verifyStagedChunkReceipt} from './restore-chunk-binding.mjs';
import {restoreReferenceParents,validateRestoreSharedPairs} from './restore-reference-scope.mjs';
import {validateRestoreProfileDeadlinePairs} from './restore-profile-deadline-pair.mjs';
const require = createRequire(import.meta.url);
const {validateRestoreChunk, decodeFirestoreValue} = require('../../functions/backup-restore-service.js');
const {createBackupRestoreBinding, verifyBackupRestoreReceipt} = require('../../functions/backup-restore-receipt.js');
const {staleRestoreIndexes, buildRestorePreview} = require('../../functions/backup-restore-preview.js');

// Internal demo only; no endpoint, client write permissions, receipts or target mutations.
export function createResumePlanLab({store, projectId, now = Date.now}) {
  if (!/^demo-[a-z0-9-]+$/.test(projectId || '') || store.projectId !== projectId ||
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') throw Error('RESUME_LAB_ONLY');
  const reference = (uid, planId) => store.doc(`labRestoreResumePlans/${uid}/items/${createHash('sha256').update(planId).digest('hex')}`);
  async function checkParents(tx, uid, records, chunkByPath, checkBanks = false) {
    const checked = new Map();
    const selected = new Map(records.map(record => [record.path, record.data]));
    for (const record of records.filter(record=>/^users\/[^/]+(?:\/aziende\/[^/]+)?$/.test(record.path))) {
      for(const parent of restoreReferenceParents(record)) {
        if(chunkByPath.has(parent)&&chunkByPath.get(parent)<=chunkByPath.get(record.path))continue;
        const snapshot=await tx.get(store.doc(`labCandidateRecords/${uid}/items/${createHash('sha256').update(parent).digest('hex')}`));
        if(!snapshot.exists)throw Error('RESUME_PROFILE_PARENT_MISSING');
      }
    }
    for (const record of records.filter(record => /\/(?:accountWidgets|attachments)\//.test(record.path))) {
      const parent = restoreReferenceParents(record)[0];
      const widget = /\/accountWidgets\//.test(record.path);
      let account;
      if (chunkByPath.has(parent) && chunkByPath.get(parent) <= chunkByPath.get(record.path)) account = selected.get(parent);
      else {
        if (!checked.has(parent)) checked.set(parent, await tx.get(store.doc(
          `labCandidateRecords/${uid}/items/${createHash('sha256').update(parent).digest('hex')}`)));
        if (!checked.get(parent).exists) throw Error(widget ? 'RESUME_WIDGET_PARENT_MISSING' : 'RESUME_ATTACHMENT_PARENT_MISSING');
        if (checkBanks && widget) account = checked.get(parent).data();
      }
      // Only after selection: preview must still let the user preserve an
      // existing Account instead of overwriting it with the backup version.
      if (checkBanks && widget && record.data.bankId != null && (!Array.isArray(account?.banking) ||
          account.banking.filter(bank => bank?.bankId === record.data.bankId).length !== 1)) throw Error('RESUME_WIDGET_BANK_MISSING');
    }
  }
  const api = {
    async recoverCreation(uid, inputs, stageCommands) {
      const commands = structuredClone(inputs), stages = structuredClone(stageCommands);
      const probe = prepareResumePlan(uid, 'probe', commands, now(), stages);
      const page = await store.collection(`labRestoreResumePlans/${uid}/items`).where('backupId', '==', probe.backupId).limit(101).get();
      if (page.size > 100) throw Error('RESUME_CREATION_SEARCH_LIMIT');
      const matches = page.docs.filter(snapshot => snapshot.data().chunks?.[0]?.operationId === probe.chunks[0].operationId);
      if (!matches.length) return {status: 'unconfirmed'};
      if (matches.length !== 1) throw Error('RESUME_CREATION_AMBIGUOUS');
      const stored = matches[0].data();
      if (typeof stored.planId !== 'string' || reference(uid, stored.planId).path !== matches[0].ref.path) throw Error('RESUME_PLAN_INVALID');
      const plan = verifyResumePlan(stored, uid, stored.planId, commands, now(), stages);
      return {status: 'found', planId: plan.planId, expiresAtMs: plan.expiresAtMs};
    },
    async preview(uid, inputs) {
      if (!Array.isArray(inputs) || !inputs.length || inputs.length > 10000) throw Error('RESUME_PLAN_INVALID');
      const commands = structuredClone(inputs).map(input => validateRestoreChunk(input, uid));
      const paths = new Set();
      commands.forEach((command, index) => {
        if (command.mode !== 'preview' || command.chunkIndex !== index || command.chunkCount !== commands.length ||
          command.backupId !== commands[0].backupId) throw Error('RESUME_PLAN_INVALID');
        for (const record of command.records) {
          const prefix = `users/${uid}/`;
          if (record.path !== `users/${uid}` && !record.path.startsWith(prefix)) throw Error('RESUME_SCOPE_NOT_CONNECTED');
          restoreReferenceParents(record);
          // Fail before the preview can enable attachment uploads for a
          // backup whose typed values the eventual commit cannot preserve.
          decodeFirestoreValue(record.data,{timestamp:()=>null,bytes:()=>null});
          if (paths.has(record.path)) throw Error('RESUME_DUPLICATE_TARGET'); paths.add(record.path);
        }
      });
      if (paths.size > 10000) throw Error('RESUME_PLAN_CAPACITY');
      return store.runTransaction(async tx => {
        const result = [];
        const chunkByPath = new Map();
        commands.forEach((command, index) => command.records.forEach(record => chunkByPath.set(record.path, index)));
        await checkParents(tx, uid, commands.flatMap(command => command.records), chunkByPath);
        for (const command of commands) {
          const snapshots = await Promise.all(command.records.map(record => tx.get(store.doc(
            `labCandidateRecords/${uid}/items/${createHash('sha256').update(record.path).digest('hex')}`))));
          command.records.forEach((record,index)=>restoreReferenceParents(record,snapshots[index].exists?snapshots[index].data():null));
          validateRestoreProfileDeadlinePairs(uid,command.records);
          validateRestoreSharedPairs(uid,command.records);
          validateRestoreProfileDeadlinePairs(uid,command.records.flatMap((record,index)=>snapshots[index].exists?[{path:record.path,data:snapshots[index].data()}]:[]));
          result.push(buildRestorePreview(command.records, snapshots));
        }
        return {chunks: result};
      });
    },
    async reconstruct(uid, planId, backupId, records) {
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(uid || '') || !/^[A-Za-z0-9._:-]{1,160}$/.test(planId || '')) throw Error('RESUME_PLAN_INVALID');
      const original = structuredClone(records);
      const snapshot = await reference(uid, planId).get();
      if (!snapshot.exists) throw Error('RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
      return reconstructResumeCommands(snapshot.data(), uid, planId, backupId, original, now());
    },
    // Bounded owner-local sweep. Every candidate is rechecked transactionally;
    // query results never authorize deletion. No timers or production scheduler.
    async sweepExpired(uid, {limit = 50, after = null} = {}) {
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(uid || '') || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (after !== null && !/^[a-f0-9]{64}$/.test(after))) throw Error('RESUME_SWEEP_INVALID');
      const time = now();
      if (!Number.isSafeInteger(time) || time < 0) throw Error('RESUME_CLOCK_INVALID');
      let query = store.collection(`labRestoreResumePlans/${uid}/items`).orderBy('__name__').limit(limit);
      if (after !== null) query = query.startAfter(after);
      const page = await query.get();
      const result = {scanned: page.docs.length, removed: 0, retained: 0, absent: 0, rejected: 0,
        next: page.docs.length === limit ? page.docs.at(-1).id : null};
      for (const snapshot of page.docs) {
        const data = snapshot.data();
        if (data.ownerUid !== uid || typeof data.planId !== 'string' ||
          reference(uid, data.planId).path !== snapshot.ref.path) {result.rejected++; continue;}
        // Do not trust an indexed expiry to delete an unrelated/corrupt record.
        try {result[(await api.removeExpired(uid, data.planId)).status]++;}
        catch (error) {
          if (!['RESUME_EXPIRY_UNVERIFIED', 'RESUME_PLAN_INVALID'].includes(error.message)) throw error;
          result.rejected++;
        }
      }
      return result;
    },
    async create(uid, inputs, stageCommands) {
      const time = now(), commands = structuredClone(inputs), planId = randomUUID();
      const candidate = prepareResumePlan(uid, planId, commands, time, structuredClone(stageCommands));
      const records = commands.flatMap(input => validateRestoreChunk(input, uid).records);
      for(const input of commands) {
        const inputRecords=validateRestoreChunk(input,uid).records;
        validateRestoreProfileDeadlinePairs(uid,inputRecords);
        validateRestoreSharedPairs(uid,inputRecords);
      }
      // Validate every typed value before a resumable plan exists. These
      // factories discard the decoded result; commit uses its real factories.
      for(const record of records)decodeFirestoreValue(record.data,{timestamp:()=>null,bytes:()=>null});
      // The candidate commit uses these same isolated target paths. Creation is
      // not a write permit: commit must still perform its own CAS and receipt checks.
      return store.runTransaction(async tx => {
        const snapshots = await Promise.all(records.map(record => tx.get(store.doc(
          `labCandidateRecords/${uid}/items/${createHash('sha256').update(record.path).digest('hex')}`))));
        if (staleRestoreIndexes(records, snapshots).length) throw Error('RESUME_NEW_PREVIEW_REQUIRED');
        // A moved widget can depend on two selected Accounts. Reject a split
        // dependency before saving the plan, rather than after earlier chunks
        // have committed. The writer still rechecks references and versions.
        const chunkByPath=new Map();
        commands.forEach((input,index)=>validateRestoreChunk(input,uid).records.forEach(record=>chunkByPath.set(record.path,index)));
        await checkParents(tx, uid, records, chunkByPath, true);
        records.forEach((record,index)=>{
          if(!/\/accountWidgets\//.test(record.path))return;
          const parents=restoreReferenceParents(record,snapshots[index].exists?snapshots[index].data():null);
          if(parents.some(path=>chunkByPath.has(path)&&chunkByPath.get(path)!==chunkByPath.get(record.path)))
            throw Error('RESUME_DEPENDENCY_CROSS_CHUNK');
        });
        tx.create(reference(uid, planId), candidate);
        return structuredClone(candidate);
      });
    },
    async removeExpired(uid, planId) {
      if (!/^[A-Za-z0-9._:-]{1,160}$/.test(uid || '') || !/^[A-Za-z0-9._:-]{1,160}$/.test(planId || '')) throw Error('RESUME_PLAN_INVALID');
      const time = now();
      if (!Number.isSafeInteger(time) || time < 0) throw Error('RESUME_CLOCK_INVALID');
      const ref = reference(uid, planId);
      return store.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return {status: 'absent'};
        const data = snapshot.data();
        if (data.ownerUid !== uid || data.planId !== planId || data.schemaVersion !== 1 ||
          !Number.isSafeInteger(data.createdAtMs) || data.createdAtMs < 0 ||
          !Number.isSafeInteger(data.expiresAtMs) || data.expiresAtMs !== data.createdAtMs + RESUME_PLAN_DURATION_MS)
          throw Error('RESUME_EXPIRY_UNVERIFIED');
        if (time < data.expiresAtMs) return {status: 'retained'};
        tx.delete(ref);
        return {status: 'removed'};
      });
    },
    // Read-only reconciliation; standard and staged receipt domains remain separate.
    // Absence is uncertainty, never proof that a chunk was not applied or may run.
    async reconcile(uid, planId, inputs, stageCommands) {
      const time = now(), commands = structuredClone(inputs), stages = structuredClone(stageCommands);
      const candidate = prepareResumePlan(uid, planId, commands, time, stages);
      const bindings = commands.map(input => createBackupRestoreBinding({uid, command: validateRestoreChunk(input, uid)}));
      return store.runTransaction(async tx => {
        const snapshots = await Promise.all([tx.get(reference(uid, planId)),
          ...bindings.map(binding => tx.get(store.doc(stages === undefined
            ? `mutationResults/${uid}/operations/${binding.operationId}`
            : `labRestoreChunkReceipts/${uid}/items/${createHash('sha256').update(binding.operationId).digest('hex')}`)))]);
        if (!snapshots[0].exists) throw Error('RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
        const plan = verifyResumePlan(snapshots[0].data(), uid, planId, commands, time, stages);
        const chunks = bindings.map((binding, index) => {
          const receipt = snapshots[index + 1];
          if (!receipt.exists) return {operationId: binding.operationId, status: 'unconfirmed'};
          if (stages === undefined) verifyBackupRestoreReceipt(receipt.data(), binding);
          else verifyStagedChunkReceipt(receipt.data(), candidate.chunks[index].stage.binding);
          return {operationId: binding.operationId, status: 'applied'};
        });
        return {expiresAtMs: plan.expiresAtMs, chunks};
      });
    },
    async save(uid, planId, inputs, stageCommands) {
      const time = now(), commands = structuredClone(inputs), stages = structuredClone(stageCommands);
      prepareResumePlan(uid, planId, commands, time, stages);
      const ref = reference(uid, planId);
      return store.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw Error('RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
        return verifyResumePlan(snapshot.data(), uid, planId, commands, time, stages);
      });
    },
    async reopen(uid, planId, inputs, stageCommands) {
      const time = now(), commands = structuredClone(inputs), stages = structuredClone(stageCommands); prepareResumePlan(uid, planId, commands, time, stages);
      const snapshot = await reference(uid, planId).get();
      if (!snapshot.exists) throw Error('RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
      return verifyResumePlan(snapshot.data(), uid, planId, commands, time, stages);
    }
  };
  return Object.freeze(api);
}
