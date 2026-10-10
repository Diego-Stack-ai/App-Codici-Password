const crypto = require('node:crypto');
const {accountPath} = require('./archive-purge-service');

const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;
const LOCK_SCHEMA_VERSION = 1;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function identifier(value) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail('PURGE_LOCK_INVALID');
  return value;
}

function globalPurgeLockPath(uid) {
  return `archivePurgeLocks/${identifier(uid)}`;
}

function globalPurgeLockRef(db, uid) {
  if (!db || typeof db.doc !== 'function') fail('PURGE_LOCK_ADAPTER_INVALID');
  return db.doc(globalPurgeLockPath(uid));
}

function createGlobalPurgeLockBinding({uid, command} = {}) {
  const ownerUid = identifier(uid);
  const operationId = identifier(command?.operationId);
  let targetPath;
  try { targetPath = accountPath(ownerUid, command); }
  catch { fail('PURGE_LOCK_INVALID'); }
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([LOCK_SCHEMA_VERSION, ownerUid, operationId, targetPath]))
    .digest('hex');
  return Object.freeze({schemaVersion: LOCK_SCHEMA_VERSION, ownerUid, operationId, targetPath, digest});
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeLock(value) {
  if (!isPlainObject(value) || value.schemaVersion !== LOCK_SCHEMA_VERSION ||
      !['active', 'released'].includes(value.status)) fail('PURGE_LOCK_CORRUPT');
  const normalized = {
    schemaVersion: value.schemaVersion,
    ownerUid: identifier(value.ownerUid),
    operationId: identifier(value.operationId),
    targetPath: value.targetPath,
    digest: value.digest,
    status: value.status
  };
  if (typeof normalized.targetPath !== 'string' || normalized.targetPath.length > 1024 ||
      !/^[A-Fa-f0-9]{64}$/.test(normalized.digest)) fail('PURGE_LOCK_CORRUPT');
  return normalized;
}

function sameBinding(lock, binding) {
  return lock.schemaVersion === binding.schemaVersion && lock.ownerUid === binding.ownerUid &&
    lock.operationId === binding.operationId && lock.targetPath === binding.targetPath &&
    lock.digest === binding.digest;
}

function acquireGlobalPurgeLock(current, binding) {
  if (current == null) return Object.freeze({status: 'active', duplicate: false, record: {...binding, status: 'active'}});
  const lock = normalizeLock(current);
  if (lock.status === 'released') {
    if (sameBinding(lock, binding)) fail('PURGE_LOCK_REPLAY_BLOCKED');
    return Object.freeze({status: 'active', duplicate: false, record: {...binding, status: 'active'}});
  }
  if (!sameBinding(lock, binding)) fail('PURGE_LOCK_BUSY');
  return Object.freeze({status: 'active', duplicate: true, record: lock});
}

function assertGlobalPurgeUnlocked(current) {
  if (current == null) return true;
  const lock = normalizeLock(current);
  if (lock.status === 'active') fail('PURGE_LOCK_ACTIVE');
  return true;
}

function assertGlobalPurgeLockHeld(current, binding) {
  const lock = normalizeLock(current);
  if (lock.status !== 'active' || !sameBinding(lock, binding)) fail('PURGE_LOCK_NOT_HELD');
  return lock;
}

function releaseGlobalPurgeLock(current, binding) {
  const lock = normalizeLock(current);
  if (!sameBinding(lock, binding)) fail('PURGE_LOCK_NOT_HELD');
  if (lock.status === 'released') return Object.freeze({status: 'released', duplicate: true, record: lock});
  return Object.freeze({status: 'released', duplicate: false, record: {...lock, status: 'released'}});
}

async function assertTransactionGlobalPurgeUnlocked(transaction, db, uid) {
  if (!transaction || typeof transaction.get !== 'function') fail('PURGE_LOCK_ADAPTER_INVALID');
  const snapshot = await transaction.get(globalPurgeLockRef(db, uid));
  assertGlobalPurgeUnlocked(snapshot?.exists ? snapshot.data() : null);
  return true;
}

module.exports = {
  LOCK_SCHEMA_VERSION,
  acquireGlobalPurgeLock,
  assertGlobalPurgeLockHeld,
  assertGlobalPurgeUnlocked,
  assertTransactionGlobalPurgeUnlocked,
  createGlobalPurgeLockBinding,
  globalPurgeLockPath,
  globalPurgeLockRef,
  releaseGlobalPurgeLock
};
