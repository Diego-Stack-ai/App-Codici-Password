const test = require('node:test');
const assert = require('node:assert/strict');
const fence = require('../vault-recovery-fence');
const purge = require('../archive-purge-global-lock');
const binding = (uid = 'owner', operationId = 'recover') => fence.createVaultRecoveryBinding({uid, operationId, planDigest: 'a'.repeat(64)});

test('dedicated recovery binding, idempotent CAS, release and replay protection', () => {
  const expected = binding(), first = fence.acquireVaultRecoveryFence(null, expected);
  assert.equal(first.record.status, 'active');
  assert.equal(fence.acquireVaultRecoveryFence(first.record, expected).duplicate, true);
  assert.throws(() => fence.acquireVaultRecoveryFence(first.record, binding('owner', 'other')), /RECOVERY_FENCE_BUSY/);
  assert.throws(() => fence.releaseVaultRecoveryFence(first.record, binding('owner', 'other')), /RECOVERY_FENCE_NOT_HELD/);
  assert.deepEqual(fence.assertVaultRecoveryFenceHeld(first.record, expected), first.record);
  const released = fence.releaseVaultRecoveryFence(first.record, expected);
  assert.equal(fence.releaseVaultRecoveryFence(released.record, expected).duplicate, true);
  assert.throws(() => fence.acquireVaultRecoveryFence(released.record, expected), /RECOVERY_FENCE_REPLAY_BLOCKED/);
  assert.equal(fence.acquireVaultRecoveryFence(released.record, binding('owner', 'new')).record.status, 'active');
});

test('missing/released preserve writers; active, malformed and mismatched owner fail closed', () => {
  assert.equal(fence.assertVaultRecoveryUnlocked(null, 'owner'), true);
  const active = fence.acquireVaultRecoveryFence(null, binding()).record;
  assert.throws(() => fence.assertVaultRecoveryUnlocked(active, 'owner'), /RECOVERY_FENCE_ACTIVE/);
  const released = fence.releaseVaultRecoveryFence(active, binding()).record;
  assert.equal(fence.assertVaultRecoveryUnlocked(released, 'owner'), true);
  for (const patch of [{status: 'unknown'}, {ownerUid: 'other'}, {operationId: 'other'}, {planDigest: 'b'.repeat(64)}, {digest: 'bad'}]) {
    assert.throws(() => fence.assertVaultRecoveryUnlocked({...released, ...patch}, 'owner'), /RECOVERY_FENCE_CORRUPT/);
  }
});

function fixture() {
  const values = new Map(), reads = [], writes = [];
  const db = {doc: path => ({path}), collection: name => ({doc: id => ({collection: child => ({
    where: () => ({limit: () => ({pending: `${name}/${id}/${child}`})})
  })})})};
  const tx = {get: async ref => {
    assert.equal(writes.length, 0, 'transaction reads precede writes');
    reads.push(ref.path || ref.pending);
    if (ref.pending) return {size: values.get(ref.pending) || 0};
    return {exists: values.has(ref.path), data: () => values.get(ref.path)};
  }, set: (ref, value) => writes.push([ref.path, value])};
  return {values, reads, writes, db, tx};
}

test('acquisition reads inverse purge lock and durable storage markers before writing fence', async () => {
  const f = fixture();
  await fence.acquireTransactionVaultRecoveryFence(f.tx, f.db, binding());
  assert.deepEqual(f.reads, ['archivePurgeLocks/owner', 'users/owner/profileDocumentAttachments', 'vaultRecoveryLocks/owner']);
  assert.equal(f.writes[0][0], 'vaultRecoveryLocks/owner');
  for (const pending of [1, 5]) {
    const g = fixture(); g.values.set('users/owner/profileDocumentAttachments', pending);
    await assert.rejects(fence.acquireTransactionVaultRecoveryFence(g.tx, g.db, binding()), /RECOVERY_FENCE_STORAGE_PENDING/);
    assert.equal(g.writes.length, 0);
  }
  const g = fixture();
  g.values.set('archivePurgeLocks/owner', purge.acquireGlobalPurgeLock(null,
    purge.createGlobalPurgeLockBinding({uid: 'owner', command: {context: 'private', accountId: 'a', operationId: 'purge', expectedRevision: 1}})).record);
  await assert.rejects(fence.acquireTransactionVaultRecoveryFence(g.tx, g.db, binding()), /PURGE_LOCK_ACTIVE/);
  assert.equal(g.writes.length, 0);
});

test('shared writer guard reads same owner fence; unavailable read never becomes missing', async () => {
  const f = fixture();
  f.values.set('vaultRecoveryLocks/owner', fence.acquireVaultRecoveryFence(null, binding()).record);
  await assert.rejects(purge.assertTransactionGlobalPurgeUnlocked(f.tx, f.db, 'owner'), /RECOVERY_FENCE_ACTIVE/);
  assert.deepEqual(f.reads, ['archivePurgeLocks/owner', 'vaultRecoveryLocks/owner']);
  await assert.rejects(fence.assertTransactionVaultRecoveryUnlocked({get: async () => {throw Error('UNAVAILABLE');}}, f.db, 'owner'), /UNAVAILABLE/);
  await assert.rejects(fence.assertTransactionVaultRecoveryUnlocked({get: async () => undefined}, f.db, 'owner'), /ADAPTER_INVALID/);
});

test('demo emulator: real writer/recovery and purge/recovery races have one exclusive winner',
  {skip: !process.env.FIRESTORE_EMULATOR_HOST, timeout: 30000}, async () => {
    assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):[0-9]+$/);
    const {initializeApp, deleteApp} = require('firebase-admin/app');
    const {getFirestore} = require('firebase-admin/firestore');
    const app = initializeApp({projectId: 'demo-codici-password-rules-test'}, `fence-${Date.now()}`);
    const db = getFirestore(app);
    try {
      for (const kind of ['storage-reservation', 'purge']) {
        const uid = `fence-${kind}-${require('node:crypto').randomUUID()}`;
        const recoveryBinding = binding(uid);
        const otherRef = kind === 'purge' ? purge.globalPurgeLockRef(db, uid) :
          db.doc(`users/${uid}/profileDocumentAttachments/pending`);
        const writer = db.runTransaction(async tx => {
          if (kind === 'purge') {
            await fence.assertTransactionVaultRecoveryUnlocked(tx, db, uid);
            const snapshot = await tx.get(otherRef);
            const purgeBinding = purge.createGlobalPurgeLockBinding({uid,
              command: {context: 'private', accountId: 'account', operationId: 'purge', expectedRevision: 1}});
            tx.set(otherRef, purge.acquireGlobalPurgeLock(snapshot.exists ? snapshot.data() : null, purgeBinding).record);
          } else {
            await purge.assertTransactionGlobalPurgeUnlocked(tx, db, uid);
            tx.set(otherRef, {status: 'reserved', ownerId: uid});
          }
        });
        const recovery = db.runTransaction(tx => fence.acquireTransactionVaultRecoveryFence(tx, db, recoveryBinding));
        const outcomes = await Promise.allSettled([writer, recovery]);
        assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
        const rejected = outcomes.find(result => result.status === 'rejected');
        assert.match(String(rejected.reason?.code || rejected.reason?.message),
          /^(RECOVERY_FENCE_(ACTIVE|STORAGE_PENDING)|PURGE_LOCK_ACTIVE)$/);
        const [ownerFence, competing] = await Promise.all([fence.vaultRecoveryFenceRef(db, uid).get(), otherRef.get()]);
        assert.notEqual(ownerFence.exists, competing.exists);
      }
    } finally { await db.terminate(); await deleteApp(app); }
  });
