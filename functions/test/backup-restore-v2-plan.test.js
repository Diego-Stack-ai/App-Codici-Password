const test = require('node:test');
const assert = require('node:assert/strict');
const {prepareBackupRestoreV2Plan, reconstructBackupRestoreV2Commands,
  verifyBackupRestoreV2Plan} = require('../backup-restore-v2-plan');

const uid = 'synthetic-owner';
const record = (id, value = 'ciphertext') => ({scope: 'private-account', id, data: {name: value},
  expectedVersion: {exists: false}});
const input = (records = [record('one')]) => ({expectedOwnerUid: uid, operationId: 'restore-one',
  backupId: 'backup-one', chunkIndex: 0, chunkCount: 1, mode: 'apply',
  confirmation: 'RESTORE_VALIDATED', records});

test('M8 V2 plan stores only manifest and re-verifies exact commands', () => {
  const plan = prepareBackupRestoreV2Plan(uid, 'plan-one', [input()], 1000);
  assert.equal(plan.ownerUid, uid);
  assert.equal(plan.chunks[0].records[0].path, `users/${uid}/accounts/one`);
  assert.equal(JSON.stringify(plan).includes('ciphertext'), false);
  assert.deepEqual(verifyBackupRestoreV2Plan(plan, uid, 'plan-one', [input()], 2000), plan);
  assert.throws(() => verifyBackupRestoreV2Plan(plan, uid, 'plan-one', [input([record('one', 'changed')])], 2000),
    error => error.code === 'BACKUP_RESTORE_V2_PLAN_MISMATCH');
});

test('M8 V2 reconstructs only the original backup body and versions', () => {
  const plan = prepareBackupRestoreV2Plan(uid, 'plan-one', [input()], 1000);
  const result = reconstructBackupRestoreV2Commands(plan, uid, 'plan-one', 'backup-one',
    [{scope: 'private-account', id: 'one', data: {name: 'ciphertext'}}], 2000);
  assert.deepEqual(result.inputs, [{...input(), overwriteExisting: false}]);
  assert.throws(() => reconstructBackupRestoreV2Commands(plan, uid, 'plan-one', 'backup-one',
    [{scope: 'private-account', id: 'other', data: {name: 'ciphertext'}}], 2000),
    error => error.code === 'BACKUP_RESTORE_V2_BACKUP_MISMATCH');
});

test('M8 V2 rejects duplicate targets and expired plans', () => {
  assert.throws(() => prepareBackupRestoreV2Plan(uid, 'plan-one', [input([record('one'), record('one')])], 1000),
    error => error.message === 'BACKUP_RECORD_DUPLICATE');
  const plan = prepareBackupRestoreV2Plan(uid, 'plan-one', [input()], 1000);
  assert.throws(() => verifyBackupRestoreV2Plan(plan, uid, 'plan-one', [input()], plan.expiresAtMs),
    error => error.code === 'BACKUP_RESTORE_V2_PLAN_EXPIRED');
});
