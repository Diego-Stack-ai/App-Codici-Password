const test = require('node:test');
const assert = require('node:assert/strict');
const {createBackupRestoreV2Callable, OPTIONS} = require('../backup-restore-v2-callable');

function inertDb() {
  return {doc: () => ({get: async () => ({exists: false})}), runTransaction: async callback => callback({})};
}

test('M8 V2 callable candidate requires explicit dependencies and secure options', () => {
  assert.throws(() => createBackupRestoreV2Callable({}),
    error => error.code === 'BACKUP_RESTORE_V2_NOT_CONFIGURED');
  let captured;
  const callable = createBackupRestoreV2Callable({
    getFirestore: inertDb,
    onCall: (options, handler) => { captured = {options, handler}; return handler; }
  });
  assert.equal(callable, captured.handler);
  assert.deepEqual(captured.options, OPTIONS);
  assert.deepEqual(OPTIONS, {region: 'europe-west1', enforceAppCheck: true});
});

test('M8 V2 callable candidate rejects unknown actions before repository access', async () => {
  let reads = 0;
  const callable = createBackupRestoreV2Callable({
    getFirestore: () => ({
      doc: () => { reads++; throw new Error('UNEXPECTED_REPOSITORY_ACCESS'); },
      runTransaction: async () => { reads++; throw new Error('UNEXPECTED_REPOSITORY_ACCESS'); }
    }),
    onCall: (_options, handler) => handler
  });
  await assert.rejects(callable({auth: {uid: 'synthetic-owner'}, app: {appId: 'synthetic-app'},
    data: {expectedOwnerUid: 'synthetic-owner', action: 'arbitrary'}}),
  error => error.code === 'BACKUP_RESTORE_V2_REQUEST_INVALID');
  assert.equal(reads, 0);
});
