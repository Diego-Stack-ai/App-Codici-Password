const {runBackupRestoreV2} = require('./backup-restore-v2-adapter');
const {createBackupRestoreV2Runtime} = require('./backup-restore-v2-runtime');

const OPTIONS = Object.freeze({region: 'europe-west1', enforceAppCheck: true});

// Candidate wiring only. index.js deliberately does not import or export this
// callable while the M8 V2 end-to-end path remains behind the hard-off gate.
function createBackupRestoreV2Callable({onCall, getFirestore, now = Date.now}) {
  if (typeof onCall !== 'function' || typeof getFirestore !== 'function') {
    const error = new Error('BACKUP_RESTORE_V2_NOT_CONFIGURED');
    error.code = 'BACKUP_RESTORE_V2_NOT_CONFIGURED';
    throw error;
  }
  const runtime = createBackupRestoreV2Runtime({db: getFirestore(), now});
  return onCall(OPTIONS, request => runBackupRestoreV2(request, {
    execute: ({uid, data}) => runtime.execute(uid, data)
  }));
}

module.exports = {createBackupRestoreV2Callable, OPTIONS};
