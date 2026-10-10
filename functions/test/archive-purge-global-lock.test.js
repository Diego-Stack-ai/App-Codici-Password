const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {
  acquireGlobalPurgeLock,
  assertGlobalPurgeLockHeld,
  assertGlobalPurgeUnlocked,
  assertTransactionGlobalPurgeUnlocked,
  createGlobalPurgeLockBinding,
  globalPurgeLockPath,
  releaseGlobalPurgeLock
} = require('../archive-purge-global-lock');

const command = {context: 'private', accountId: 'account', operationId: 'operation', expectedRevision: 4};
const binding = () => createGlobalPurgeLockBinding({uid: 'owner', command});

test('binding opaco lega proprietario, operazione e percorso Account', () => {
  const value = binding();
  assert.equal(globalPurgeLockPath('owner'), 'archivePurgeLocks/owner');
  assert.deepEqual(Object.keys(value), ['schemaVersion', 'ownerUid', 'operationId', 'targetPath', 'digest']);
  assert.equal(value.targetPath, 'users/owner/accounts/account');
  assert.match(value.digest, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(value));
});

test('acquisizione è CAS, idempotente solo per lo stesso binding', () => {
  const first = acquireGlobalPurgeLock(null, binding());
  assert.equal(first.duplicate, false);
  assert.equal(first.record.status, 'active');
  const retry = acquireGlobalPurgeLock(first.record, binding());
  assert.equal(retry.duplicate, true);
  const other = createGlobalPurgeLockBinding({uid: 'owner', command: {...command, operationId: 'other'}});
  assert.throws(() => acquireGlobalPurgeLock(first.record, other), /PURGE_LOCK_BUSY/);
});

test('writer globale passa solo senza lock o dopo release verificata', () => {
  assert.equal(assertGlobalPurgeUnlocked(null), true);
  const active = acquireGlobalPurgeLock(null, binding()).record;
  assert.throws(() => assertGlobalPurgeUnlocked(active), /PURGE_LOCK_ACTIVE/);
  const released = releaseGlobalPurgeLock(active, binding()).record;
  assert.equal(assertGlobalPurgeUnlocked(released), true);
});

test('purge prosegue e rilascia soltanto il proprio lock attivo', () => {
  const active = acquireGlobalPurgeLock(null, binding()).record;
  assert.deepEqual(assertGlobalPurgeLockHeld(active, binding()), active);
  const other = createGlobalPurgeLockBinding({uid: 'owner', command: {...command, operationId: 'other'}});
  assert.throws(() => assertGlobalPurgeLockHeld(active, other), /PURGE_LOCK_NOT_HELD/);
  const release = releaseGlobalPurgeLock(active, binding());
  assert.equal(release.duplicate, false);
  assert.equal(release.record.status, 'released');
  assert.equal(releaseGlobalPurgeLock(release.record, binding()).duplicate, true);
  assert.throws(() => acquireGlobalPurgeLock(release.record, binding()), /PURGE_LOCK_REPLAY_BLOCKED/);
  const next = createGlobalPurgeLockBinding({uid: 'owner', command: {...command, operationId: 'next'}});
  const reacquired = acquireGlobalPurgeLock(release.record, next);
  assert.equal(reacquired.duplicate, false);
  assert.equal(reacquired.record.status, 'active');
  assert.equal(reacquired.record.operationId, 'next');
});

test('record malformati falliscono chiusi e input non vengono normalizzati', () => {
  const malformed = [
    {}, {...binding(), status: 'unknown'}, {...binding(), status: 'active', digest: 'bad'},
    {...binding(), status: 'active', ownerUid: '../owner'}
  ];
  for (const value of malformed) {
    assert.throws(() => assertGlobalPurgeUnlocked(value), /PURGE_LOCK_/);
  }
  assert.throws(() => createGlobalPurgeLockBinding({uid: '../owner', command}), /PURGE_LOCK_INVALID/);
});

test('adapter Admin legge il lock nella stessa transazione del writer', async () => {
  const reads = [];
  const db = {doc: path => ({path})};
  const transaction = {get: async reference => {
    reads.push(reference.path);
    return {exists: false, data: () => null};
  }};
  assert.equal(await assertTransactionGlobalPurgeUnlocked(transaction, db, 'owner'), true);
  assert.deepEqual(reads, ['archivePurgeLocks/owner']);
  const active = acquireGlobalPurgeLock(null, binding()).record;
  transaction.get = async () => ({exists: true, data: () => active});
  await assert.rejects(assertTransactionGlobalPurgeUnlocked(transaction, db, 'owner'), /PURGE_LOCK_ACTIVE/);
  await assert.rejects(assertTransactionGlobalPurgeUnlocked({}, db, 'owner'), /PURGE_LOCK_ADAPTER_INVALID/);
});

test('inventario callable: la cancellazione contatto resta dietro il fence transazionale', () => {
  const source = readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.deleteContactIfUnused');
  const end = source.indexOf('// ─────────────────────────────────────────────────────────────', start);
  assert.ok(start >= 0 && end > start, 'DELETE_CONTACT_HANDLER_NOT_FOUND');
  const handler = source.slice(start, end);
  const transaction = handler.indexOf('store.runTransaction');
  const fence = handler.indexOf('assertTransactionGlobalPurgeUnlocked', transaction);
  const deletion = handler.indexOf('transaction.delete(contactRef)', fence);
  assert.ok(transaction >= 0, 'DELETE_CONTACT_TRANSACTION_MISSING');
  assert.ok(fence > transaction, 'DELETE_CONTACT_FENCE_MISSING');
  assert.ok(deletion > fence, 'DELETE_CONTACT_DELETE_NOT_FENCED');
  assert.equal(handler.includes('await contactRef.delete()'), false);
});
