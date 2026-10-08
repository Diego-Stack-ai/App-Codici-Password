const test = require('node:test');
const assert = require('node:assert/strict');
const {createMutationBinding, verifyMutationResult, currentMutationRevision} = require('../mutation-result-binding');
const {validatePrivateAccountMutation} = require('../private-account-mutation-service');
const {validateOfflineMutation} = require('../offline-sync-service');
const cipher = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB';
const privateInput = () => ({schemaVersion: 1, operationId: 'device:op', deviceId: 'device', recordId: 'record', expectedRevision: 2,
  record: {nomeAccount: 'Synthetic title', type: 'account', visibility: 'private', _encrypted: true,
    username: cipher, account: cipher, password: cipher, note: cipher, sharedWith: {}, sharedWithUids: []}});
const genericInput = () => ({schemaVersion: 1, operationId: 'device:op', deviceId: 'device', recordId: 'record', expectedRevision: 2, encryptedPayload: cipher});
const privateBinding = (operation = validatePrivateAccountMutation(privateInput()), uid = 'owner') =>
  createMutationBinding({uid, domain: 'private-account', operation});
const receipt = binding => ({...binding, status: 'applied', revision: binding.expectedRevision + 1, duplicate: false});

test('canonical binding accepts a reordered but otherwise identical validated request', () => {
  const first = privateBinding();
  const input = privateInput(); input.record = Object.fromEntries(Object.entries(input.record).reverse());
  const reordered = privateBinding(validatePrivateAccountMutation(Object.fromEntries(Object.entries(input).reverse())));
  assert.deepEqual(reordered, first);
  const saved = receipt(first);
  assert.equal(verifyMutationResult(saved, reordered), saved);
});

test('binding changes with payload, revision, owner, record, operation, device and domain', () => {
  const operation = validatePrivateAccountMutation(privateInput()), first = privateBinding(operation), saved = receipt(first);
  const variants = [
    privateBinding({...operation, record: {...operation.record, password: `${cipher}AAAA`}}),
    privateBinding({...operation, record: {...operation.record, nomeAccount: 'Changed title'}}),
    privateBinding({...operation, expectedRevision: 3}), privateBinding({...operation, recordId: 'other'}),
    privateBinding({...operation, operationId: 'other'}), privateBinding({...operation, deviceId: 'other'}),
    privateBinding(operation, 'other-owner'), createMutationBinding({uid: 'owner', domain: 'offline-sync', operation})
  ];
  for (const binding of variants) {
    assert.notEqual(binding.operationHash, first.operationHash);
    assert.throws(() => verifyMutationResult(saved, binding), {code: 'OPERATION_BINDING_MISMATCH'});
  }
});

test('legacy and malformed receipts are never accepted as attested retry results', () => {
  const binding = privateBinding();
  for (const saved of [null, {status: 'applied', revision: 3}, {...receipt(binding), bindingVersion: 0},
    {...receipt(binding), operationHash: 'invalid'}, {...receipt(binding), revision: 200},
    {...receipt(binding), duplicate: true}, {...receipt(binding), status: 'unknown'},
    {...receipt(binding), status: 'conflict', currentRevision: 5}]) {
    assert.throws(() => verifyMutationResult(saved, binding), {code: 'OPERATION_RESULT_UNATTESTED'});
  }
});

test('receipt metadata mismatches are rejected even when its operation hash is copied', () => {
  const binding = privateBinding();
  for (const altered of [{domain: 'offline-sync'}, {ownerUid: 'other'}, {deviceId: 'other'}, {recordId: 'other'}, {operationId: 'other'}, {expectedRevision: 8}]) {
    assert.throws(() => verifyMutationResult({...receipt(binding), ...altered}, binding), {code: 'OPERATION_BINDING_MISMATCH'});
  }
});

test('generic mutation conflict receipts remain bound to the original command', () => {
  const operation = validateOfflineMutation(genericInput());
  const binding = createMutationBinding({uid: 'owner', domain: 'offline-sync', operation});
  const saved = {...binding, status: 'conflict', currentRevision: 5, duplicate: false};
  assert.equal(verifyMutationResult(saved, binding), saved);
  const changed = createMutationBinding({uid: 'owner', domain: 'offline-sync', operation: {...operation, encryptedPayload: `${cipher}AAAA`}});
  assert.throws(() => verifyMutationResult(saved, changed), {code: 'OPERATION_BINDING_MISMATCH'});
  assert.throws(() => verifyMutationResult({...saved, currentRevision: 2}, binding), {code: 'OPERATION_RESULT_UNATTESTED'});
});

test('binding serialization preserves array order and unambiguous JSON structure', () => {
  const first = privateInput(); first.record.createdAt = {nested: ['first', 'second']};
  const second = privateInput(); second.record.createdAt = {nested: ['second', 'first']};
  assert.notEqual(privateBinding(validatePrivateAccountMutation(first)).operationHash,
    privateBinding(validatePrivateAccountMutation(second)).operationHash);
  assert.throws(() => createMutationBinding({uid: 'owner', domain: 'private-account', operation: {undefinedValue: undefined}}),
    {code: 'OPERATION_BINDING_INVALID'});
});

test('mutation validators reject coercible identifiers and unsafe revision increments', () => {
  for (const [validate, input] of [[validatePrivateAccountMutation, privateInput], [validateOfflineMutation, genericInput]]) {
    for (const altered of [{operationId: 123}, {recordId: 123}, {deviceId: 123}, {expectedRevision: Number.MAX_SAFE_INTEGER},
      {expectedRevision: Number.MAX_SAFE_INTEGER + 1}, {expectedRevision: 0.5}]) {
      assert.throws(() => validate({...input(), ...altered}), /INVALID/);
    }
  }
});

test('server revision is validated without coercion while missing legacy revision remains zero', () => {
  assert.equal(currentMutationRevision(undefined), 0);
  assert.equal(currentMutationRevision({}), 0);
  assert.equal(currentMutationRevision({revision: 0}), 0);
  assert.equal(currentMutationRevision({revision: 7}), 7);
  for (const revision of [undefined, null, false, '', '0', '7', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => currentMutationRevision({revision}), {code: 'MUTATION_REVISION_INVALID'});
  }
});
