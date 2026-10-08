const {createHash} = require('node:crypto');

function invalid(code) { const error = new Error(code); error.code = code; throw error; }

function createRecoveryBinding(uid, mode, command) {
  if (typeof uid !== 'string' || !uid || !['trash', 'restore'].includes(mode)) invalid('RECOVERY_BINDING_INVALID');
  const fields = {bindingVersion: 1, domain: 'sync-record-recovery', ownerUid: uid, action: mode,
    operationId: command.operationId, recordId: command.recordId, expectedRevision: command.expectedRevision};
  return {...fields, operationHash: createHash('sha256').update(JSON.stringify(fields)).digest('hex')};
}

// Only receipts in the historically client-denied root namespace are trusted.
function verifyRecoveryReceipt(previous, binding) {
  if (!previous || previous.bindingVersion !== 1 || typeof previous.operationHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(previous.operationHash)) invalid('RECOVERY_RESULT_UNATTESTED');
  if (Object.entries(binding).some(([key, value]) => previous[key] !== value)) invalid('RECOVERY_BINDING_MISMATCH');
  const status = binding.action === 'trash' ? 'trashed' : 'restored';
  const revision = binding.expectedRevision + (binding.action === 'restore' ? 1 : 0);
  if (previous.status !== status || previous.revision !== revision || previous.duplicate !== false) {
    invalid('RECOVERY_RESULT_UNATTESTED');
  }
  return {status, revision, duplicate: true};
}

module.exports = {createRecoveryBinding, verifyRecoveryReceipt};
