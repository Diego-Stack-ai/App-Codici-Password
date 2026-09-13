function invalid() { throw new Error('BACKUP_VERSION_INVALID'); }
function validateExpectedVersion(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || typeof value.exists !== 'boolean') invalid();
  if (!value.exists) {
    if (Object.keys(value).some(key => key !== 'exists')) invalid();
    return {exists: false};
  }
  const time = value.updateTime;
  if (Object.keys(value).some(key => !['exists', 'updateTime'].includes(key)) ||
      !time || Object.getPrototypeOf(time) !== Object.prototype ||
      Object.keys(time).some(key => !['seconds', 'nanoseconds'].includes(key)) ||
      !Number.isSafeInteger(time.seconds) || time.seconds < -62135596800 || time.seconds > 253402300799 ||
      !Number.isInteger(time.nanoseconds) || time.nanoseconds < 0 || time.nanoseconds > 999999999) invalid();
  return {exists: true, updateTime: {seconds: time.seconds, nanoseconds: time.nanoseconds}};
}

function snapshotVersion(snapshot) {
  return validateExpectedVersion(snapshot.exists ? {exists: true, updateTime: {
    seconds: snapshot.updateTime?.seconds, nanoseconds: snapshot.updateTime?.nanoseconds
  }} : {exists: false});
}

// Mirrors the current backup-export-model encoder. No snapshot body leaves the
// server: only the comparison result and exact document version are returned.
function encodeBackupComparisonValue(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('BACKUP_VALUE_UNSUPPORTED');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (value instanceof Date) return {$type: 'date', value: value.toISOString()};
  if (value instanceof Uint8Array) return {$type: 'bytes', value: Array.from(value)};
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : encodeBackupComparisonValue(item));
  if (value && typeof value.toMillis === 'function' && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
    return {$type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds};
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, encodeBackupComparisonValue(item)]));
  }
  throw new Error('BACKUP_VALUE_UNSUPPORTED');
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function buildRestorePreview(records, snapshots) {
  return {previewVersion: 1, entries: records.map((record, index) => {
    const snapshot = snapshots[index], expectedVersion = snapshotVersion(snapshot);
    if (!snapshot.exists) return {index, status: 'missing', expectedVersion};
    // Repository/export strip the top-level legacy id; preserve that comparison
    // behavior while the version still covers every persisted field.
    const data = {...snapshot.data()};
    delete data.id;
    return {index, status: canonical(encodeBackupComparisonValue(data)) === canonical(record.data) ? 'unchanged' : 'changed', expectedVersion};
  })};
}
function staleRestoreIndexes(records, snapshots) {
  return records.flatMap((record, index) => {
    const actual = snapshotVersion(snapshots[index]), expected = record.expectedVersion;
    return expected.exists !== actual.exists || (actual.exists &&
      (expected.updateTime.seconds !== actual.updateTime.seconds || expected.updateTime.nanoseconds !== actual.updateTime.nanoseconds)) ? [index] : [];
  });
}
module.exports = {validateExpectedVersion, encodeBackupComparisonValue, buildRestorePreview, staleRestoreIndexes};
