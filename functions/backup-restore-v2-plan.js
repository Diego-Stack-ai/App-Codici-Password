const {createHash} = require('node:crypto');
const {validateRestoreChunk} = require('./backup-restore-service');
const {createBackupRestoreBinding} = require('./backup-restore-receipt');

const RESUME_PLAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  fail('BACKUP_RESTORE_V2_VALUE_INVALID');
}
function validId(value) { return typeof value === 'string' && IDENTIFIER.test(value); }
function validClock(value) {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value + RESUME_PLAN_DURATION_MS)) {
    fail('BACKUP_RESTORE_V2_CLOCK_INVALID');
  }
}

function prepareBackupRestoreV2Plan(uid, planId, inputs, now) {
  validClock(now);
  if (!validId(uid) || !validId(planId) || !Array.isArray(inputs) || !inputs.length || inputs.length > 10000) {
    fail('BACKUP_RESTORE_V2_PLAN_INVALID');
  }
  const paths = new Set();
  const operations = new Set();
  let backupId = null;
  const chunks = inputs.map((input, index) => {
    const command = validateRestoreChunk(input, uid);
    if (command.mode !== 'apply' || !command.confirmed || command.chunkIndex !== index ||
        command.chunkCount !== inputs.length || operations.has(command.operationId)) {
      fail('BACKUP_RESTORE_V2_PLAN_INVALID');
    }
    operations.add(command.operationId);
    backupId ??= command.backupId;
    if (backupId !== command.backupId) fail('BACKUP_RESTORE_V2_PLAN_INVALID');
    const binding = createBackupRestoreBinding({uid, command});
    const records = command.records.map(record => {
      if (paths.has(record.path)) fail('BACKUP_RESTORE_V2_DUPLICATE_TARGET');
      paths.add(record.path);
      return {path: record.path, expectedVersion: structuredClone(record.expectedVersion)};
    });
    return {operationId: command.operationId, operationHash: binding.operationHash, records};
  });
  const identity = {schemaVersion: 1, ownerUid: uid, planId, backupId, chunks};
  if (Buffer.byteLength(canonical(identity), 'utf8') > 800 * 1024) fail('BACKUP_RESTORE_V2_PLAN_CAPACITY');
  const planHash = createHash('sha256').update(canonical(identity)).digest('hex');
  return {...identity, planHash, createdAtMs: now, expiresAtMs: now + RESUME_PLAN_DURATION_MS};
}

function verifyBackupRestoreV2Plan(stored, uid, planId, inputs, now) {
  validClock(now);
  if (!stored || !Number.isSafeInteger(stored.createdAtMs) || stored.createdAtMs > now) {
    fail('BACKUP_RESTORE_V2_PLAN_INVALID');
  }
  const expected = prepareBackupRestoreV2Plan(uid, planId, inputs, stored.createdAtMs);
  if (canonical(stored) !== canonical(expected)) fail('BACKUP_RESTORE_V2_PLAN_MISMATCH');
  if (now >= expected.expiresAtMs) fail('BACKUP_RESTORE_V2_PLAN_EXPIRED');
  return structuredClone(expected);
}

function reconstructBackupRestoreV2Commands(stored, uid, planId, backupId, records, now) {
  validClock(now);
  if (!stored || stored.ownerUid !== uid || stored.planId !== planId || stored.backupId !== backupId ||
      !Array.isArray(stored.chunks) || !stored.chunks.length || !Array.isArray(records) || !records.length) {
    fail('BACKUP_RESTORE_V2_BACKUP_MISMATCH');
  }
  const source = new Map();
  for (const record of structuredClone(records)) {
    const validated = validateRestoreChunk({expectedOwnerUid: uid, operationId: 'reconstruct', backupId,
      chunkIndex: 0, chunkCount: 1, mode: 'preview', records: [record]}, uid).records[0];
    if (source.has(validated.path)) fail('BACKUP_RESTORE_V2_DUPLICATE_TARGET');
    source.set(validated.path, record);
  }
  const inputs = stored.chunks.map((chunk, chunkIndex) => {
    const selected = chunk.records.map(({path, expectedVersion}) => {
      const record = source.get(path);
      if (!record) fail('BACKUP_RESTORE_V2_BACKUP_MISMATCH');
      return {...record, expectedVersion: structuredClone(expectedVersion)};
    });
    for (const overwriteExisting of [false, true]) {
      for (const confirmation of ['RESTORE_VALIDATED', 'RESTORE_SELECTED_OVERWRITE']) {
        const input = {expectedOwnerUid: uid, operationId: chunk.operationId, backupId,
          chunkIndex, chunkCount: stored.chunks.length, mode: 'apply', overwriteExisting, confirmation,
          records: selected};
        const command = validateRestoreChunk(input, uid);
        if (createBackupRestoreBinding({uid, command}).operationHash === chunk.operationHash) return input;
      }
    }
    fail('BACKUP_RESTORE_V2_BACKUP_MISMATCH');
  });
  verifyBackupRestoreV2Plan(stored, uid, planId, inputs, now);
  return {inputs, expiresAtMs: stored.expiresAtMs};
}

module.exports = {RESUME_PLAN_DURATION_MS, prepareBackupRestoreV2Plan,
  reconstructBackupRestoreV2Commands, verifyBackupRestoreV2Plan};
