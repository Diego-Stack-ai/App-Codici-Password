const {createHash} = require('node:crypto');

function invalid(code) { const error = new Error(code); error.code = code; throw error; }
function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) invalid('BACKUP_OPERATION_BINDING_INVALID');
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !descriptors[key].enumerable ||
      !Object.hasOwn(descriptors[key], 'value'))) invalid('BACKUP_OPERATION_BINDING_INVALID');
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(descriptors[key].value)}`).join(',')}}`;
  }
  return invalid('BACKUP_OPERATION_BINDING_INVALID');
}

// The caller must first validateRestoreChunk, and persist only under
// mutationResults/{uid}/operations/{operationId}, historically client-denied.
// A digest binds a retry to a command; it does not attest an old receipt's origin.
function createBackupRestoreBinding({uid, command}) {
  if (typeof uid !== 'string' || !uid || !command || command.mode !== 'apply' ||
      typeof command.operationId !== 'string' || !command.operationId ||
      typeof command.backupId !== 'string' || !command.backupId ||
      !Number.isSafeInteger(command.chunkIndex) || command.chunkIndex < 0 ||
      !Number.isSafeInteger(command.chunkCount) || command.chunkCount <= command.chunkIndex ||
      !Array.isArray(command.records) || command.records.length < 1) invalid('BACKUP_OPERATION_BINDING_INVALID');
  const domain = 'backup-restore';
  const operationHash = createHash('sha256').update(canonicalJson({bindingVersion: 1, ownerUid: uid, domain, command})).digest('hex');
  return Object.freeze({bindingVersion: 1, domain, ownerUid: uid,
    operationId: command.operationId, backupId: command.backupId,
    chunkIndex: command.chunkIndex, chunkCount: command.chunkCount,
    recordCount: command.records.length, operationHash});
}

function verifyBackupRestoreReceipt(previous, binding) {
  if (!previous || previous.bindingVersion !== 1 || typeof previous.operationHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(previous.operationHash)) invalid('BACKUP_OPERATION_RESULT_UNATTESTED');
  if (!binding || binding.domain !== 'backup-restore' ||
      Object.entries(binding).some(([field, value]) => previous[field] !== value)) invalid('BACKUP_OPERATION_BINDING_MISMATCH');
  if (previous.status !== 'applied' || previous.duplicate !== false ||
      !Number.isSafeInteger(previous.recordCount) || previous.recordCount < 1 ||
      previous.recordCount !== binding.recordCount) invalid('BACKUP_OPERATION_RESULT_UNATTESTED');
  // Never return record bodies, audit payloads, or arbitrary persisted fields.
  return Object.freeze({status: 'applied', duplicate: true, recordCount: previous.recordCount});
}

module.exports = {createBackupRestoreBinding, verifyBackupRestoreReceipt};
