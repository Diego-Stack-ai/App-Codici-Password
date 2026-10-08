import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {createBackupRestoreBinding} = require('../../functions/backup-restore-receipt.js');
const DOMAIN = 'lab-staged-restore-chunk';
const fail = () => { throw new Error('LAB_CHUNK_BINDING'); };
const BINDING_FIELDS = ['domain', 'bindingVersion', 'ownerUid', 'restoreOperationId',
  'chunkOperationId', 'recordCount', 'operationHash'];

// Internal API: command must already have passed validateRestoreChunk.
// This binds inputs only; it does not authorize writes or attest receipt origin.
export function createStagedChunkBinding(uid, command, {restoreOperationId, stageIds} = {}) {
  if (typeof restoreOperationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(restoreOperationId) ||
      !Array.isArray(stageIds) || stageIds.length > 100 ||
      Array.from(stageIds).some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) ||
      new Set(stageIds).size !== stageIds.length) fail();
  const original = createBackupRestoreBinding({uid, command});
  const operationHash = createHash('sha256').update(JSON.stringify({domain: DOMAIN, bindingVersion: 1,
    original, restoreOperationId, stageIds: [...stageIds].sort()})).digest('hex');
  return Object.freeze({domain: DOMAIN, bindingVersion: 1, ownerUid: uid,
    restoreOperationId, chunkOperationId: command.operationId,
    recordCount: command.records.length, operationHash});
}

// Only for a server-owned receipt read inside the commit transaction.
// A well-formed digest is not proof of origin; no client-provided receipt is trusted.
export function verifyStagedChunkReceipt(previous, binding) {
  if (!binding || Object.keys(binding).length !== BINDING_FIELDS.length ||
      binding.domain !== DOMAIN || binding.bindingVersion !== 1 ||
      !Number.isSafeInteger(binding.recordCount) || binding.recordCount < 1 ||
      typeof binding.operationHash !== 'string' || !/^[a-f0-9]{64}$/.test(binding.operationHash) ||
      !['ownerUid', 'restoreOperationId', 'chunkOperationId'].every(key =>
        typeof binding[key] === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(binding[key]))) fail();
  if (!previous || BINDING_FIELDS.some(key => previous[key] !== binding[key]) ||
      previous.status !== 'applied' || previous.duplicate !== false ||
      typeof previous.rewriteHash !== 'string' || !/^[a-f0-9]{64}$/.test(previous.rewriteHash)) fail();
  return Object.freeze({status: 'applied', duplicate: true, recordCount: binding.recordCount});
}
