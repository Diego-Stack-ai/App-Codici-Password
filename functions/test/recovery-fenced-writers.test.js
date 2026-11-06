const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const fence = require('../vault-recovery-fence');
const source = readFileSync(require.resolve('../index'), 'utf8');
const code = source.slice(source.indexOf('function sanitizeEmail('), source.indexOf('function shouldSendPush('));
function fixture() {
  const records = new Map(), writes = [];
  const ref = path => ({path, collection: name => collection(`${path}/${name}`)});
  const collection = path => ({doc: id => ref(`${path}/${id}`)});
  const db = {doc: ref, collection, runTransaction: async callback => {
    const staged = [];
    const result = await callback({get: async target => {
      assert.equal(staged.length, 0, 'all owner fences precede writes');
      return {exists: records.has(target.path), data: () => records.get(target.path)};
    }, set: (target, value) => staged.push([target.path, value]), delete: target => staged.push([target.path, null])});
    for (const [path, value] of staged) {writes.push(path); if (value) records.set(path, value); else records.delete(path);}
    return result;
  }};
  const context = {...require('../archive-purge-global-lock'), crypto: require('node:crypto'),
    verifiedUserByEmail: async () => ({uid: 'guest'}),
    admin: {auth: () => ({getUser: async () => ({displayName: 'Owner'})}),
      firestore: {FieldValue: {serverTimestamp: () => 'server-time'}}}, console};
  vm.runInNewContext(code, context);
  const deadline = {name: 'fixture', dueDate: '2030-01-01', recipients: [{email: 'guest@example.invalid', sendPush: true}]};
  return {records, writes, sync: () => context.syncReceivedDeadlines(db, 'owner', 'deadline', deadline),
    remove: () => context.removeReceivedDeadlines(db, 'owner', 'deadline', {recipients: []})};
}
const lock = (uid, status = 'active') => {
  const binding = fence.createVaultRecoveryBinding({uid, operationId: 'recover', planDigest: 'a'.repeat(64)});
  const active = fence.acquireVaultRecoveryFence(null, binding).record;
  return status === 'released' ? fence.releaseVaultRecoveryFence(active, binding).record : active;
};

test('deadline copy sync preserves missing/released behavior and fences every owner/recipient atomically', async () => {
  for (const state of ['missing', 'released', 'active', 'malformed']) for (const uid of ['owner', 'guest']) {
    const f = fixture();
    if (state !== 'missing') f.records.set(`vaultRecoveryLocks/${uid}`, state === 'malformed' ? {status: 'released'} : lock(uid, state));
    if (['active', 'malformed'].includes(state)) {
      await assert.rejects(f.sync(), /RECOVERY_FENCE_(ACTIVE|CORRUPT)/); assert.deepEqual(f.writes, []);
    } else {
      await f.sync();
      assert.equal(f.writes.length, 2);
      assert.equal(f.writes.some(path => path.startsWith('users/guest/receivedDeadlines/')), true);
    }
  }
});

test('deadline copy removal re-reads indexed old recipients and defers entire operation if one is fenced', async () => {
  const f = fixture(); await f.sync(); f.writes.length = 0;
  f.records.set('vaultRecoveryLocks/guest', lock('guest'));
  await assert.rejects(f.remove(), /RECOVERY_FENCE_ACTIVE/); assert.deepEqual(f.writes, []);
  f.records.set('vaultRecoveryLocks/guest', lock('guest', 'released'));
  await f.remove(); assert.equal(f.writes.length, 2);
  assert.equal([...f.records.keys()].some(path => path.startsWith('deadlineShares/')), false);
});

test('regression: deferred old deadline deletion cannot erase recreated source copies or index', async () => {
  const f = fixture(); await f.sync(); f.writes.length = 0;
  f.records.set('vaultRecoveryLocks/guest', lock('guest'));
  await assert.rejects(f.remove(), /RECOVERY_FENCE_ACTIVE/);
  f.records.set('users/owner/scadenze/deadline', {name: 'new incarnation'});
  f.records.set('vaultRecoveryLocks/guest', lock('guest', 'released'));
  const before = [...f.records];
  await f.remove();
  assert.deepEqual(f.writes, []);
  assert.deepEqual([...f.records], before);
});
