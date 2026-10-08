import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createStagedChunkBinding} from './restore-chunk-binding.mjs';
const require = createRequire(import.meta.url);
const {validateRestoreChunk} = require('../../functions/backup-restore-service.js');
const {createBackupRestoreBinding} = require('../../functions/backup-restore-receipt.js');
export const RESUME_PLAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const fail = code => {throw new Error(code);};
const id = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value);
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const clock = now => {if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + RESUME_PLAN_DURATION_MS)) fail('RESUME_CLOCK_INVALID');};

// Internal candidate only: server clock and authenticated uid must be supplied by
// the caller. The original backup is required again; bodies and keys stay absent.
export function prepareResumePlan(uid, planId, inputs, now, stageCommands) {
  clock(now);
  if (!id(uid) || !id(planId) || !Array.isArray(inputs) || !inputs.length || inputs.length > 10000) fail('RESUME_PLAN_INVALID');
  if (stageCommands !== undefined && (!Array.isArray(stageCommands) || stageCommands.length !== inputs.length)) fail('RESUME_STAGE_INVALID');
  const paths = new Set(), operations = new Set();
  let backupId, restoreOperationId;
  const chunks = inputs.map((input, index) => {
    const command = validateRestoreChunk(input, uid);
    if (command.mode !== 'apply' || !command.confirmed || command.chunkIndex !== index ||
      command.chunkCount !== inputs.length || operations.has(command.operationId)) fail('RESUME_PLAN_INVALID');
    operations.add(command.operationId);
    backupId ??= command.backupId;
    if (backupId !== command.backupId) fail('RESUME_PLAN_INVALID');
    const binding = createBackupRestoreBinding({uid, command});
    const records = command.records.map(({path, expectedVersion}) => {
      if (paths.has(path)) fail('RESUME_DUPLICATE_TARGET');
      paths.add(path);
      return {path, expectedVersion};
    });
    const stage = stageCommands === undefined ? null : stageCommands[index];
    const stagedBinding = stageCommands === undefined ? null : createStagedChunkBinding(uid, command, stage);
    if (stagedBinding) {
      restoreOperationId ??= stagedBinding.restoreOperationId;
      if (restoreOperationId !== stagedBinding.restoreOperationId) fail('RESUME_STAGE_INVALID');
    }
    return {operationId: command.operationId, operationHash: binding.operationHash, records,
      ...(stagedBinding ? {stage: {restoreOperationId: stagedBinding.restoreOperationId,
        stageIds: [...stage.stageIds].sort(), binding: stagedBinding}} : {})};
  });
  const identity = {schemaVersion: 1, ownerUid: uid, planId, backupId, chunks};
  if (Buffer.byteLength(JSON.stringify(identity)) > 800 * 1024) fail('RESUME_PLAN_CAPACITY');
  const planHash = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return {...identity, planHash, createdAtMs: now, expiresAtMs: now + RESUME_PLAN_DURATION_MS};
}

// Compare a trusted server record with a re-derived plan, never with client
// metadata. Reopening cannot extend expiry or substitute commands/versions.
export function verifyResumePlan(stored, uid, planId, inputs, now, stageCommands) {
  clock(now);
  if (!stored || !Number.isSafeInteger(stored.createdAtMs) || stored.createdAtMs > now) fail('RESUME_PLAN_INVALID');
  const expected = prepareResumePlan(uid, planId, inputs, stored.createdAtMs, stageCommands);
  if (Object.keys(stored).length !== Object.keys(expected).length ||
    Object.keys(expected).some(key => canonical(stored[key]) !== canonical(expected[key]))) fail('RESUME_PLAN_MISMATCH');
  if (now >= expected.expiresAtMs) fail('RESUME_PLAN_EXPIRED_NEW_PREVIEW_REQUIRED');
  return structuredClone(expected);
}

// Rebuild only from the re-supplied backup plus the original minimal manifest.
// No fresh preview/version lookup: that would change the identity of a retry.
export function reconstructResumeCommands(stored, uid, planId, backupId, records, now) {
  clock(now);
  if (!stored || stored.ownerUid !== uid || stored.planId !== planId || stored.backupId !== backupId ||
    !Array.isArray(stored.chunks) || !stored.chunks.length || stored.chunks.length > 10000 ||
    !Array.isArray(records) || !records.length || records.length > 10000) fail('RESUME_BACKUP_MISMATCH');
  const source = new Map();
  for (const record of structuredClone(records)) {
    const validated = validateRestoreChunk({expectedOwnerUid: uid, operationId: 'rebind', backupId,
      chunkIndex: 0, chunkCount: 1, mode: 'preview', records: [record]}, uid).records[0];
    if (source.has(validated.path)) fail('RESUME_DUPLICATE_TARGET');
    source.set(validated.path, record);
  }
  const inputs = stored.chunks.map((chunk, chunkIndex) => {
    if (!Array.isArray(chunk.records) || !chunk.records.length) fail('RESUME_PLAN_INVALID');
    const selected = chunk.records.map(({path, expectedVersion}) => {
      const record = source.get(path);
      if (!record) fail('RESUME_BACKUP_MISMATCH');
      return {...record, expectedVersion: structuredClone(expectedVersion)};
    });
    // Old manifests store the digest, not these two normalized flags. Enumerate
    // their four valid combinations and accept ONLY the original exact digest.
    // This is not permission to overwrite: the writer still checks CAS/receipt.
    for (const overwriteExisting of [false, true]) {
      for (const confirmation of ['RESTORE_VALIDATED', 'RESTORE_SELECTED_OVERWRITE']) {
        const input = {expectedOwnerUid: uid, operationId: chunk.operationId, backupId,
          chunkIndex, chunkCount: stored.chunks.length, mode: 'apply', overwriteExisting, confirmation, records: selected};
        const binding = createBackupRestoreBinding({uid, command: validateRestoreChunk(input, uid)});
        if (binding.operationHash === chunk.operationHash) return input;
      }
    }
    fail('RESUME_BACKUP_MISMATCH');
  });
  const staged = stored.chunks.some(chunk => Object.hasOwn(chunk, 'stage'));
  const stageCommands = staged ? stored.chunks.map(chunk => ({
    restoreOperationId: chunk.stage?.restoreOperationId, stageIds: structuredClone(chunk.stage?.stageIds)
  })) : undefined;
  const plan = verifyResumePlan(stored, uid, planId, inputs, now, stageCommands);
  return {inputs, stageCommands, expiresAtMs: plan.expiresAtMs};
}
