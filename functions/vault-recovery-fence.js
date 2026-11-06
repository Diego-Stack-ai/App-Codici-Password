const crypto = require('node:crypto');

const RECOVERY_FENCE_SCHEMA_VERSION = 1;
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const SHA256 = /^[a-f0-9]{64}$/;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function identifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) fail('RECOVERY_FENCE_INVALID');
  return value;
}
function vaultRecoveryFenceRef(db, uid) {
  if (!db || typeof db.doc !== 'function') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  return db.doc(`vaultRecoveryLocks/${identifier(uid)}`);
}
function createVaultRecoveryBinding({uid, operationId, planDigest} = {}) {
  const ownerUid = identifier(uid);
  identifier(operationId);
  if (typeof planDigest !== 'string' || !SHA256.test(planDigest)) fail('RECOVERY_FENCE_INVALID');
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify([RECOVERY_FENCE_SCHEMA_VERSION, ownerUid, operationId, planDigest])).digest('hex');
  return Object.freeze({schemaVersion: RECOVERY_FENCE_SCHEMA_VERSION, ownerUid, operationId, planDigest, digest});
}
function normalize(value, uid) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schemaVersion !== RECOVERY_FENCE_SCHEMA_VERSION || !['active', 'released'].includes(value.status)) {
    fail('RECOVERY_FENCE_CORRUPT');
  }
  let binding;
  try { binding = createVaultRecoveryBinding({uid: value.ownerUid, operationId: value.operationId, planDigest: value.planDigest}); }
  catch { fail('RECOVERY_FENCE_CORRUPT'); }
  if (binding.digest !== value.digest || (uid !== undefined && binding.ownerUid !== uid)) fail('RECOVERY_FENCE_CORRUPT');
  return {...binding, status: value.status};
}
function same(left, right) { return left.digest === right.digest && left.ownerUid === right.ownerUid &&
  left.operationId === right.operationId && left.planDigest === right.planDigest; }
function checkedBinding(binding) { return normalize({...binding, status: 'active'}); }
function acquireVaultRecoveryFence(current, binding) {
  const expected = checkedBinding(binding);
  if (current == null) return {duplicate: false, record: expected};
  const lock = normalize(current, expected.ownerUid);
  if (lock.status === 'active') {
    if (!same(lock, expected)) fail('RECOVERY_FENCE_BUSY');
    return {duplicate: true, record: lock};
  }
  if (same(lock, expected)) fail('RECOVERY_FENCE_REPLAY_BLOCKED');
  return {duplicate: false, record: expected};
}
function assertVaultRecoveryUnlocked(current, uid) {
  if (current == null) return true;
  if (normalize(current, uid).status === 'active') fail('RECOVERY_FENCE_ACTIVE');
  return true;
}
function assertVaultRecoveryFenceHeld(current, binding) {
  const expected = checkedBinding(binding), lock = normalize(current, expected.ownerUid);
  if (lock.status !== 'active' || !same(lock, expected)) fail('RECOVERY_FENCE_NOT_HELD');
  return lock;
}
function releaseVaultRecoveryFence(current, binding) {
  const expected = checkedBinding(binding), lock = normalize(current, expected.ownerUid);
  if (!same(lock, expected)) fail('RECOVERY_FENCE_NOT_HELD');
  return {duplicate: lock.status === 'released', record: {...lock, status: 'released'}};
}
async function assertTransactionVaultRecoveryUnlocked(transaction, db, uid) {
  const snapshot = await transaction.get(vaultRecoveryFenceRef(db, uid));
  if (!snapshot || typeof snapshot.exists !== 'boolean') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  return assertVaultRecoveryUnlocked(snapshot.exists ? snapshot.data() : null, uid);
}
// This is a prerequisite, not the future empty-target/manifest validation.
// Storage side effects retain these durable markers until their final I/O ends.
async function assertTransactionRecoveryAcquirable(transaction, db, uid) {
  const {assertGlobalPurgeUnlocked, globalPurgeLockRef} = require('./archive-purge-global-lock');
  const purge = await transaction.get(globalPurgeLockRef(db, uid));
  if (!purge || typeof purge.exists !== 'boolean') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  assertGlobalPurgeUnlocked(purge.exists ? purge.data() : null);
  const pending = await transaction.get(db.collection('users').doc(uid).collection('profileDocumentAttachments')
    .where('status', 'in', ['reserved', 'deleting']).limit(1));
  if (!pending || !Number.isInteger(pending.size)) fail('RECOVERY_FENCE_ADAPTER_INVALID');
  if (pending.size) fail('RECOVERY_FENCE_STORAGE_PENDING');
}
async function acquireTransactionVaultRecoveryFence(transaction, db, binding) {
  checkedBinding(binding);
  await assertTransactionRecoveryAcquirable(transaction, db, binding.ownerUid);
  const ref = vaultRecoveryFenceRef(db, binding.ownerUid), snapshot = await transaction.get(ref);
  if (!snapshot || typeof snapshot.exists !== 'boolean') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  const result = acquireVaultRecoveryFence(snapshot.exists ? snapshot.data() : null, binding);
  if (!result.duplicate) transaction.set(ref, result.record);
  return result;
}
async function assertTransactionVaultRecoveryFenceHeld(transaction, db, binding) {
  const snapshot = await transaction.get(vaultRecoveryFenceRef(db, binding.ownerUid));
  if (!snapshot || typeof snapshot.exists !== 'boolean') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  return assertVaultRecoveryFenceHeld(snapshot.exists ? snapshot.data() : null, binding);
}
async function releaseTransactionVaultRecoveryFence(transaction, db, binding) {
  const ref = vaultRecoveryFenceRef(db, binding.ownerUid), snapshot = await transaction.get(ref);
  if (!snapshot || typeof snapshot.exists !== 'boolean') fail('RECOVERY_FENCE_ADAPTER_INVALID');
  const result = releaseVaultRecoveryFence(snapshot.exists ? snapshot.data() : null, binding);
  if (!result.duplicate) transaction.set(ref, result.record);
  return result;
}
module.exports = {RECOVERY_FENCE_SCHEMA_VERSION, vaultRecoveryFenceRef, createVaultRecoveryBinding,
  acquireVaultRecoveryFence, releaseVaultRecoveryFence, assertVaultRecoveryUnlocked, assertVaultRecoveryFenceHeld,
  assertTransactionVaultRecoveryUnlocked, assertTransactionRecoveryAcquirable,
  acquireTransactionVaultRecoveryFence, releaseTransactionVaultRecoveryFence, assertTransactionVaultRecoveryFenceHeld};
