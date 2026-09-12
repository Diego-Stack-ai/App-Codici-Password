const ID_PATTERN = /^[A-Za-z0-9:_-]{1,180}$/;
const MAX_CIPHERTEXT_LENGTH = 300000;

function validateOfflineMutation(value) {
  const operation = value || {};
  if (typeof operation.operationId !== 'string' || !ID_PATTERN.test(operation.operationId) ||
      typeof operation.recordId !== 'string' || !ID_PATTERN.test(operation.recordId) ||
      typeof operation.deviceId !== 'string' || !ID_PATTERN.test(operation.deviceId) ||
      !Number.isSafeInteger(operation.expectedRevision) || operation.expectedRevision < 0 || operation.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      operation.schemaVersion !== 1 ||
      typeof operation.encryptedPayload !== 'string' ||
      operation.encryptedPayload.length < 16 || operation.encryptedPayload.length > MAX_CIPHERTEXT_LENGTH) {
    throw new Error('OFFLINE_MUTATION_INVALID');
  }
  return {
    schemaVersion: 1,
    operationId: operation.operationId,
    recordId: operation.recordId,
    deviceId: operation.deviceId,
    expectedRevision: operation.expectedRevision,
    encryptedPayload: operation.encryptedPayload,
  };
}

function mutationDecision(currentRevision, operation, previousResult = null) {
  if (previousResult) return {...previousResult, duplicate: true};
  if (currentRevision !== operation.expectedRevision) {
    return {status: 'conflict', operationId: operation.operationId, currentRevision, duplicate: false};
  }
  return {status: 'applied', operationId: operation.operationId, revision: currentRevision + 1, duplicate: false};
}

module.exports = {MAX_CIPHERTEXT_LENGTH, mutationDecision, validateOfflineMutation};
