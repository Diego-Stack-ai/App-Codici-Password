const {createHash} = require('node:crypto');
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;

function invalid(code) { const error = new Error(code); error.code = code; throw error; }
function canonicalJson(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || ancestors.has(value)) return invalid('ARCHIVE_OPERATION_BINDING_INVALID');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value);
  const array = Array.isArray(value);
  if ((!array && Object.getPrototypeOf(value) !== Object.prototype) || keys.some(key =>
    typeof key !== 'string' || (!descriptors[key].enumerable && !(array && key === 'length')) ||
    !Object.hasOwn(descriptors[key], 'value'))) return invalid('ARCHIVE_OPERATION_BINDING_INVALID');
  if (array && (keys.length !== value.length + 1 ||
    Array.from({length: value.length}, (_, index) => String(index)).some(key => !Object.hasOwn(descriptors, key)))) {
    return invalid('ARCHIVE_OPERATION_BINDING_INVALID');
  }
  ancestors.add(value);
  const encoded = array ? `[${value.map(item => canonicalJson(item, ancestors)).join(',')}]` :
    `{${keys.sort().map(key => `${JSON.stringify(key)}:${canonicalJson(descriptors[key].value, ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return encoded;
}

function validIdentity(value) { return typeof value === 'string' && IDENTIFIER.test(value); }
function validFields(value) {
  return value && validIdentity(value.ownerUid) && validIdentity(value.operationId) && validIdentity(value.accountId) &&
    (value.context === 'private' ? value.companyId === null : value.context === 'company' && validIdentity(value.companyId)) &&
    Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0 && value.confirmation === true;
}

// Only a validated, normalized command is accepted. The complete command digest
// includes future preconditions, not merely the current identity fields.
function createArchivePurgeBinding({uid, command}) {
  if (!command || !validFields({...command, ownerUid: uid})) return invalid('ARCHIVE_OPERATION_BINDING_INVALID');
  const domain = 'archive-account-purge';
  const operationHash = createHash('sha256').update(canonicalJson({bindingVersion: 1, ownerUid: uid, domain, command})).digest('hex');
  return Object.freeze({bindingVersion: 1, domain, ownerUid: uid,
    operationId: command.operationId, accountId: command.accountId, context: command.context,
    companyId: command.companyId, expectedRevision: command.expectedRevision, confirmation: true, operationHash});
}

// Caller MUST read mutationResults/{uid}/operations/{operationId}, historically
// client-denied. A matching hash does not certify legacy archiveOperations.
// A verified processing receipt still requires live Account precondition checks;
// this helper provides no tombstone or protection against purge/restore races.
function verifyArchivePurgeReceipt(previous, binding) {
  if (!binding || binding.bindingVersion !== 1 || binding.domain !== 'archive-account-purge' ||
    !validFields(binding) || typeof binding.operationHash !== 'string' || !/^[a-f0-9]{64}$/.test(binding.operationHash)) {
    return invalid('ARCHIVE_OPERATION_BINDING_INVALID');
  }
  if (!previous || previous.bindingVersion !== 1 || typeof previous.operationHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(previous.operationHash) || !['processing', 'purged'].includes(previous.status)) {
    return invalid('ARCHIVE_OPERATION_RESULT_UNATTESTED');
  }
  if (Object.entries(binding).some(([key, value]) => previous[key] !== value)) {
    return invalid('ARCHIVE_OPERATION_BINDING_MISMATCH');
  }
  return Object.freeze({status: previous.status, duplicate: previous.status === 'purged'});
}

module.exports = {createArchivePurgeBinding, verifyArchivePurgeReceipt};
