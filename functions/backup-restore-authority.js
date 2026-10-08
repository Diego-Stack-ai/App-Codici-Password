'use strict';

// Backup content is not authority to recreate a revoked invitation or grant.
// Existing access is copied from the transaction snapshot, never from the file.
const SHARING_FIELDS = ['sharedWith', 'sharedWithUids', 'acceptedCount', 'sharingCycle', 'visibility'];
function preserveRestoreAuthority(path, backup, current = null) {
  if (/^users\/[^/]+\/scadenze\/[^/]+$/.test(path)) {
    const result = {...backup};
    const fields = new Set(['recipients', 'emails', 'email1', 'email2',
      ...Object.keys(backup).filter(key => key.startsWith('notif_')),
      ...Object.keys(current || {}).filter(key => key.startsWith('notif_'))]);
    for (const field of fields) {
      delete result[field];
      if (current && Object.hasOwn(current, field)) result[field] = current[field];
    }
    if (!current) {
      result.recipients = [];
      result.emails = [];
      result.email1 = '';
      result.email2 = '';
    }
    return result;
  }
  if (/^users\/[^/]+$/.test(path)) {
    const result = {...backup};
    delete result.settings_biometric;
    if (current && Object.hasOwn(current, 'settings_biometric')) {
      result.settings_biometric = current.settings_biometric;
    }
    return result;
  }
  if (!/^users\/[^/]+\/(?:aziende\/[^/]+\/)?accounts\/[^/]+$/.test(path)) return backup;
  const result = {...backup};
  for (const field of SHARING_FIELDS) delete result[field];
  if (current && current.isArchived !== true) {
    for (const field of SHARING_FIELDS) {
      if (Object.hasOwn(current, field)) result[field] = current[field];
    }
  } else if (SHARING_FIELDS.some(field => Object.hasOwn(backup, field) || current && Object.hasOwn(current, field))) {
    // Empty entries also prevent an old pending invite from being accepted.
    result.sharedWith = {};
    result.sharedWithUids = [];
    result.acceptedCount = 0;
    result.sharingCycle = 0;
    result.visibility = 'private';
  }
  return result;
}

module.exports = {preserveRestoreAuthority};
