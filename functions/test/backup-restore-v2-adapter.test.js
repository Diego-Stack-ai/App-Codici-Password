const test = require('node:test');
const assert = require('node:assert/strict');
const {runBackupRestoreV2} = require('../backup-restore-v2-adapter');

const valid = {auth: {uid: 'synthetic-owner'}, app: {appId: 'synthetic-app'},
  data: {expectedOwnerUid: 'synthetic-owner', operationId: 'synthetic-operation'}};

test('candidate boundary rejects missing trust signals before the interlock', async () => {
  await assert.rejects(runBackupRestoreV2({}), error => error.code === 'BACKUP_RESTORE_V2_UNAUTHENTICATED');
  await assert.rejects(runBackupRestoreV2({auth: {uid: valid.auth.uid}, app: valid.app, data: {}}),
    error => error.code === 'BACKUP_RESTORE_V2_INVALID_OWNER');
  await assert.rejects(runBackupRestoreV2({...valid, data: {...valid.data, expectedOwnerUid: 'other'}}),
    error => error.code === 'BACKUP_RESTORE_V2_OWNER_MISMATCH');
  await assert.rejects(runBackupRestoreV2({...valid, app: null}),
    error => error.code === 'BACKUP_RESTORE_V2_APP_CHECK_REQUIRED');
});

test('hard-off boundary prevents all service and data access', async () => {
  let accesses = 0;
  const forbidden = () => { accesses++; throw new Error('UNEXPECTED_ACCESS'); };
  await assert.rejects(runBackupRestoreV2(valid, {execute: forbidden, store: forbidden, bucket: forbidden}),
    error => error.code === 'BACKUP_RESTORE_V2_SUSPENDED');
  assert.equal(accesses, 0);
});
