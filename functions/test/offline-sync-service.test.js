const test = require('node:test');
const assert = require('node:assert/strict');
const {mutationDecision, validateOfflineMutation} = require('../offline-sync-service');

const valid = overrides => ({
  schemaVersion: 1, operationId: 'device-a:1', recordId: 'record-1', deviceId: 'device-a',
  expectedRevision: 2, encryptedPayload: 'ciphertext-fixture', ...overrides,
});

test('accetta soltanto un comando cifrato, limitato e ben formato', () => {
  assert.deepEqual(validateOfflineMutation(valid()), valid());
  for (const item of [valid({operationId: '../x'}), valid({expectedRevision: -1}), valid({encryptedPayload: 'corta'}), valid({extra: 'ignorato'})]) {
    if (item.extra) assert.equal(validateOfflineMutation(item).extra, undefined);
    else assert.throws(() => validateOfflineMutation(item), /INVALID/);
  }
});

test('applica, rileva conflitto e restituisce lo stesso esito per duplicato', () => {
  assert.deepEqual(mutationDecision(2, valid()), {status: 'applied', operationId: 'device-a:1', revision: 3, duplicate: false});
  assert.equal(mutationDecision(3, valid()).status, 'conflict');
  const saved = {status: 'applied', operationId: 'device-a:1', revision: 3};
  assert.deepEqual(mutationDecision(99, valid(), saved), {...saved, duplicate: true});
});
