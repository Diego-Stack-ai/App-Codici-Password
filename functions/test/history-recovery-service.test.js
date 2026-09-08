const test = require('node:test');
const assert = require('node:assert/strict');
const {restoreDecision, safeAudit, trashDecision, validateRecoveryCommand} = require('../history-recovery-service');

test('valida comandi senza accettare percorsi arbitrari', () => {
  assert.deepEqual(validateRecoveryCommand({recordId: 'r-1', operationId: 'd:1', expectedRevision: 2, ignored: 'x'}), {recordId: 'r-1', operationId: 'd:1', expectedRevision: 2});
  assert.throws(() => validateRecoveryCommand({recordId: '../r', operationId: 'x', expectedRevision: 0}), /INVALID/);
});
test('cestino e ripristino sono idempotenti e rilevano conflitti', () => {
  assert.equal(trashDecision({recordExists: true, currentRevision: 2, expectedRevision: 2}).status, 'trashed');
  assert.equal(trashDecision({recordExists: true, currentRevision: 3, expectedRevision: 2}).status, 'conflict');
  assert.equal(restoreDecision({trashExists: true, destinationExists: false, trashedRevision: 2}).revision, 3);
  assert.equal(restoreDecision({trashExists: true, destinationExists: true, trashedRevision: 2}).status, 'conflict');
});
test('audit espone soltanto identificatori tecnici consentiti', () => {
  const event = safeAudit({action: 'trashed', actorUid: 'owner', recordId: 'r1', operationId: 'op1', password: 'vietata'});
  assert.equal(event.password, undefined); assert.equal(JSON.stringify(event).includes('vietata'), false);
});
