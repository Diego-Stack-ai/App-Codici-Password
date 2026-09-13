const test = require('node:test');
const assert = require('node:assert/strict');
const {validateRestoreChunk} = require('../backup-restore-service');
const {createBackupRestoreBinding, verifyBackupRestoreReceipt} = require('../backup-restore-receipt');
const command = () => validateRestoreChunk({expectedOwnerUid: 'owner', operationId: 'restore-op', backupId: 'backup',
  chunkIndex: 0, chunkCount: 2, mode: 'apply', confirmation: 'RESTORE_SELECTED_OVERWRITE', overwriteExisting: true,
  records: [{scope: 'private-account', id: 'a1', data: {password: 'ciphertext', metadata: {x: 1, y: 2}}, expectedVersion: {exists: false}}]
}, 'owner');
const bindingFor = value => createBackupRestoreBinding({uid: 'owner', command: value});

test('backup binding is stable across object order and receipt exposes only minimum result metadata', () => {
  const original = command(), before = structuredClone(original), binding = bindingFor(original);
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  reordered.records = original.records.map(record => ({expectedVersion: record.expectedVersion, data: {metadata: {y: 2, x: 1}, password: 'ciphertext'}, path: record.path}));
  assert.deepEqual(bindingFor(reordered), binding);
  assert.deepEqual(original, before); assert.equal(Object.isFrozen(binding), true);
  assert.equal(JSON.stringify(binding).includes('ciphertext'), false);
  assert.deepEqual(verifyBackupRestoreReceipt({...binding, status: 'applied', duplicate: false, unexpected: 'secret'}, binding),
    {status: 'applied', duplicate: true, recordCount: 1});
});

test('changes to restored data, overwrite consent, chunk layout, UID and operation identity cannot replay', () => {
  const value = command(), binding = bindingFor(value), receipt = {...binding, status: 'applied', duplicate: false};
  const variants = [
    {...value, records: [{...value.records[0], data: {password: 'other-ciphertext'}}]},
    {...value, overwriteExisting: false}, {...value, overwriteConfirmed: false}, {...value, confirmed: false},
    {...value, chunkCount: 3}, {...value, chunkIndex: 1}, {...value, operationId: 'other'}, {...value, backupId: 'other'}
  ].map(bindingFor);
  variants.push(createBackupRestoreBinding({uid: 'other', command: value}));
  for (const changed of variants) {
    assert.notEqual(changed.operationHash, binding.operationHash);
    assert.throws(() => verifyBackupRestoreReceipt(receipt, changed), {code: 'BACKUP_OPERATION_BINDING_MISMATCH'});
  }
});

test('legacy, malformed and non-applied receipts are never accepted', () => {
  const binding = bindingFor(command()), good = {...binding, status: 'applied', duplicate: false};
  for (const receipt of [null, {}, {status: 'applied'}, {...good, bindingVersion: 0}, {...good, operationHash: 'invalid'},
    {...good, status: 'processing'}, {...good, duplicate: true}, {...good, duplicate: undefined}]) {
    assert.throws(() => verifyBackupRestoreReceipt(receipt, binding), {code: 'BACKUP_OPERATION_RESULT_UNATTESTED'});
  }
  for (const patch of [{recordCount: 2}, {recordCount: '1'}, {domain: 'private-account'}, {ownerUid: 'other'}]) {
    assert.throws(() => verifyBackupRestoreReceipt({...good, ...patch}, binding), {code: 'BACKUP_OPERATION_BINDING_MISMATCH'});
  }
});

test('the complete validated command binds future version preconditions and array order without coercion', () => {
  const original = command();
  const versioned = {...original, records: [{...original.records[0], expectedVersion: {exists: true, updateTime: {seconds: 1, nanoseconds: 0}}}]};
  assert.notEqual(bindingFor(versioned).operationHash, bindingFor(original).operationHash);
  const ordered = {...original, records: [...original.records, {path: 'users/owner/accounts/a2', data: {password: 'ciphertext2'}}]};
  assert.notEqual(bindingFor(ordered).operationHash, bindingFor({...ordered, records: [...ordered.records].reverse()}).operationHash);
  for (const changed of [{...original, mode: 'preview'}, {...original, chunkIndex: '0'},
    {...original, records: []}, {...original, extra: new Date()}, {...original, extra: undefined}]) {
    assert.throws(() => bindingFor(changed), {code: 'BACKUP_OPERATION_BINDING_INVALID'});
  }
});
