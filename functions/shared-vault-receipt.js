const {createHash} = require('node:crypto');
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
function invalid() { throw new Error('SHARED_RESULT_UNVERIFIED'); }
function canonicalJson(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || ancestors.has(value)) return invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  const array = Array.isArray(value);
  if ((!array && Object.getPrototypeOf(value) !== Object.prototype) || keys.some(key =>
    typeof key !== 'string' || (!descriptors[key].enumerable && !(array && key === 'length')) ||
    !Object.hasOwn(descriptors[key], 'value'))) return invalid();
  if (array && (keys.length !== value.length + 1 ||
    Array.from({length: value.length}, (_, i) => String(i)).some(key => !Object.hasOwn(descriptors, key)))) return invalid();
  ancestors.add(value);
  const encoded = array ? `[${Array.from({length: value.length}, (_, i) => canonicalJson(descriptors[i].value, ancestors)).join(',')}]` :
    `{${keys.sort().map(key => `${JSON.stringify(key)}:${canonicalJson(descriptors[key].value, ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return encoded;
}
// Input is the complete validated command; never project away payload fields.
function createSharedVaultBinding(command, uid) {
  const encoded = canonicalJson(command);
  if (![uid, command.operationId, command.sharedDataId].every(value => typeof value === 'string' && ID.test(value)) ||
      !['create','update','link','unlink','delete'].includes(command.action)) return invalid();
  const expectedRevision = command.action === 'create' ? null : command.expectedRevision;
  if (command.action !== 'create' && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER)) return invalid();
  const resultingRevision = command.action === 'create' ? 1 : expectedRevision + 1;
  const fields = {bindingVersion:1, domain:'shared-vault', ownerUid:uid, operationId:command.operationId,
    action:command.action, sharedDataId:command.sharedDataId, expectedRevision, resultingRevision};
  return Object.freeze({...fields, commandDigest:createHash('sha256').update(canonicalJson(fields)).update('\n').update(encoded).digest('hex')});
}
function verifySharedVaultReceipt(previous, binding) {
  if (!previous || Object.entries(binding).some(([key,value]) => previous[key] !== value) ||
      previous.status !== 'applied' || previous.duplicate !== false || previous.revision !== binding.resultingRevision) return invalid();
  return {status:'applied',duplicate:true,revision:binding.resultingRevision};
}
module.exports = {canonicalJson,createSharedVaultBinding,verifySharedVaultReceipt};
