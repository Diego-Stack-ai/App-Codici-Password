const {createHash} = require('node:crypto');

function invalid(code) { const error = new Error(code); error.code = code; throw error; }
function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return invalid('OPERATION_BINDING_INVALID');
}

// Hashing binds retry semantics; it is not a signature or a proof of origin.
// Callers must store these receipts only in the new, historically client-denied
// top-level namespace. Old owner-writable receipts cannot be promoted in place.
function createMutationBinding({uid, domain, operation}) {
  if (typeof uid !== 'string' || !uid || !['private-account', 'offline-sync'].includes(domain) ||
      !operation || typeof operation !== 'object') invalid('OPERATION_BINDING_INVALID');
  const operationHash = createHash('sha256').update(canonicalJson({bindingVersion: 1, ownerUid: uid, domain, operation})).digest('hex');
  return Object.freeze({bindingVersion: 1, operationHash, ownerUid: uid, domain,
    operationId: operation.operationId, recordId: operation.recordId, deviceId: operation.deviceId,
    expectedRevision: operation.expectedRevision});
}

function verifyMutationResult(previous, binding) {
  if (!previous || previous.bindingVersion !== 1 ||
      typeof previous.operationHash !== 'string' || !/^[a-f0-9]{64}$/.test(previous.operationHash)) {
    invalid('OPERATION_RESULT_UNATTESTED');
  }
  if (Object.entries(binding).some(([field, value]) => previous[field] !== value)) invalid('OPERATION_BINDING_MISMATCH');
  const applied = previous.status === 'applied' && Number.isSafeInteger(previous.revision) &&
    previous.revision === binding.expectedRevision + 1;
  const conflict = binding.domain === 'offline-sync' && previous.status === 'conflict' &&
    Number.isSafeInteger(previous.currentRevision) && previous.currentRevision >= 0 && previous.currentRevision !== binding.expectedRevision;
  if ((!applied && !conflict) || previous.duplicate !== false) invalid('OPERATION_RESULT_UNATTESTED');
  return previous;
}

function currentMutationRevision(record) {
  // A missing revision remains the explicit legacy baseline zero. Present but
  // malformed revisions must not be coerced into a writable baseline.
  const revision = record && Object.hasOwn(record, 'revision') ? record.revision : 0;
  if (!Number.isSafeInteger(revision) || revision < 0) invalid('MUTATION_REVISION_INVALID');
  return revision;
}

module.exports = {createMutationBinding, verifyMutationResult, currentMutationRevision};
