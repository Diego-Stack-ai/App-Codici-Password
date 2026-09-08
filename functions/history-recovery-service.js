const ID_PATTERN = /^[A-Za-z0-9:_-]{1,180}$/;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ALLOWED_ACTIONS = new Set(['trashed', 'restored', 'purged']);

function validateRecoveryCommand(value) {
  const command = value || {};
  if (!ID_PATTERN.test(String(command.recordId || '')) ||
      !ID_PATTERN.test(String(command.operationId || '')) ||
      !Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new Error('RECOVERY_COMMAND_INVALID');
  }
  return {recordId: command.recordId, operationId: command.operationId, expectedRevision: command.expectedRevision};
}

function trashDecision({recordExists, currentRevision, expectedRevision, alreadyProcessed}) {
  if (alreadyProcessed) return {status: 'trashed', duplicate: true};
  if (!recordExists) return {status: 'not-found', duplicate: false};
  if (currentRevision !== expectedRevision) return {status: 'conflict', currentRevision, duplicate: false};
  return {status: 'trashed', revision: currentRevision, duplicate: false};
}

function restoreDecision({trashExists, destinationExists, trashedRevision, alreadyProcessed}) {
  if (alreadyProcessed) return {status: 'restored', duplicate: true};
  if (!trashExists) return {status: 'not-found', duplicate: false};
  if (destinationExists) return {status: 'conflict', duplicate: false};
  return {status: 'restored', revision: trashedRevision + 1, duplicate: false};
}

function safeAudit({action, actorUid, recordId, operationId}) {
  if (!ALLOWED_ACTIONS.has(action) || !actorUid || !ID_PATTERN.test(recordId) || !ID_PATTERN.test(operationId)) {
    throw new Error('AUDIT_EVENT_INVALID');
  }
  return {schemaVersion: 1, action, actorUid, recordId, operationId};
}

module.exports = {RETENTION_MS, restoreDecision, safeAudit, trashDecision, validateRecoveryCommand};
