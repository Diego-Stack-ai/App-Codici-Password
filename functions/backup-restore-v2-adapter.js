const {requireBackupRestoreV2Disabled} = require('./backup-restore-v2-service');

const UID = /^[A-Za-z0-9._:-]{1,160}$/;
const fail = code => { const error = new Error(code); error.code = code; throw error; };

// Candidate callable boundary only; intentionally not exported by index.js.
// Authentication, owner binding and App Check are evaluated before the hard-off
// interlock. No repository, Storage or restore service can be reached while off.
async function runBackupRestoreV2(request, dependencies = {}) {
  const uid = request?.auth?.uid;
  if (typeof uid !== 'string' || !UID.test(uid)) fail('BACKUP_RESTORE_V2_UNAUTHENTICATED');
  const expectedOwnerUid = request?.data?.expectedOwnerUid;
  if (typeof expectedOwnerUid !== 'string' || !UID.test(expectedOwnerUid)) fail('BACKUP_RESTORE_V2_INVALID_OWNER');
  if (expectedOwnerUid !== uid) fail('BACKUP_RESTORE_V2_OWNER_MISMATCH');
  if (!request.app) fail('BACKUP_RESTORE_V2_APP_CHECK_REQUIRED');
  requireBackupRestoreV2Disabled();
  // Unreachable until a reviewed activation replaces the hard-off interlock.
  if (typeof dependencies.execute !== 'function') fail('BACKUP_RESTORE_V2_NOT_CONFIGURED');
  return dependencies.execute({uid, data: request.data});
}

module.exports = {runBackupRestoreV2};
