const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {isBackupRestoreV2Suspended, requireBackupRestoreV2Disabled} = require('../backup-restore-v2-service');

test('resumable restore v2 activation ignores request and environment overrides', () => {
  const previous = process.env.BACKUP_RESTORE_V2_ENABLED;
  process.env.BACKUP_RESTORE_V2_ENABLED = 'true';
  try {
    assert.equal(isBackupRestoreV2Suspended({enabled: false, bypass: false}), false);
    assert.doesNotThrow(() => requireBackupRestoreV2Disabled({enabled: false}));
  } finally {
    if (previous === undefined) delete process.env.BACKUP_RESTORE_V2_ENABLED;
    else process.env.BACKUP_RESTORE_V2_ENABLED = previous;
  }
});

test('candidate restore v2 exports only its reviewed callable factory', () => {
  const source = readFileSync(require.resolve('../index'), 'utf8');
  assert.doesNotMatch(source, /exports\.(?:restoreBackupV2|resumeBackupRestore|cleanupBackupRestoreStage)\s*=/);
  assert.match(source, /exports\.manageBackupRestoreV2\s*=\s*createBackupRestoreV2Callable/);
  assert.match(source, /require\(["']\.\/backup-restore-v2-callable["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\/backup-restore-v2-service["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\/backup-restore-v2-adapter["']\)/);
});
