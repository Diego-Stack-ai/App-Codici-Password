// Code-owned activation boundary. Request data and environment variables remain
// unable to alter it; deployment is still a separate explicitly authorized step.
function isBackupRestoreV2Suspended() { return false; }

function requireBackupRestoreV2Disabled() {
  if (isBackupRestoreV2Suspended()) {
    const error = new Error('BACKUP_RESTORE_V2_SUSPENDED');
    error.code = 'BACKUP_RESTORE_V2_SUSPENDED';
    throw error;
  }
}

module.exports = {isBackupRestoreV2Suspended, requireBackupRestoreV2Disabled};
