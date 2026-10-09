const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {isBackupRestoreV2Suspended, requireBackupRestoreV2Disabled} = require('../backup-restore-v2-service');

test('resumable restore v2 remains hard-off without request or environment override', () => {
  const previous = process.env.BACKUP_RESTORE_V2_ENABLED;
  process.env.BACKUP_RESTORE_V2_ENABLED = 'true';
  try {
    assert.equal(isBackupRestoreV2Suspended({enabled: true, bypass: true}), true);
    assert.throws(() => requireBackupRestoreV2Disabled({enabled: true}), error =>
      error.code === 'BACKUP_RESTORE_V2_SUSPENDED');
  } finally {
    if (previous === undefined) delete process.env.BACKUP_RESTORE_V2_ENABLED;
    else process.env.BACKUP_RESTORE_V2_ENABLED = previous;
  }
});

test('candidate restore v2 has no deployed Functions export', () => {
  const source = readFileSync(require.resolve('../index'), 'utf8');
  assert.doesNotMatch(source, /exports\.(?:restoreBackupV2|resumeBackupRestore|cleanupBackupRestoreStage)\s*=/);
  assert.doesNotMatch(source, /require\(["']\.\/backup-restore-v2-service["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\/backup-restore-v2-adapter["']\)/);
});
