// Hard-off boundary for the resumable restore candidate. Deliberately ignores
// request data and environment variables: activation requires a reviewed code
// change, tests and an explicit deploy.
function isBackupRestoreV2Suspended() { return true; }

function requireBackupRestoreV2Disabled() {
  if (isBackupRestoreV2Suspended()) {
    const error = new Error('BACKUP_RESTORE_V2_SUSPENDED');
    error.code = 'BACKUP_RESTORE_V2_SUSPENDED';
    throw error;
  }
}

module.exports = {isBackupRestoreV2Suspended, requireBackupRestoreV2Disabled};
