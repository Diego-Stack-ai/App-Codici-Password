const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const {HttpsError} = require('firebase-functions/v2/https');
const service = require('../history-recovery-service');
const receipts = require('../recovery-command-receipt');
const {currentMutationRevision} = require('../mutation-result-binding');
const {assertTransactionGlobalPurgeUnlocked} = require('../archive-purge-global-lock');
const source = readFileSync(require.resolve('../index'), 'utf8');
const helpers = source.slice(source.indexOf('function verifiedCurrentRevision('), source.indexOf('exports.applyOfflineMutation ='));
const handler = source.slice(source.indexOf('async function runRecoveryCommand('), source.indexOf('exports.purgeArchivedAccount ='));
const recordPath = 'users/A/syncRecords/item', trashPath = 'users/A/trash/item';
const resultPath = 'mutationResults/A/operations/recovery-op', legacyPath = 'users/A/operationResults/recovery-op';
const command = {expectedOwnerUid: 'A', recordId: 'item', operationId: 'recovery-op', expectedRevision: 3};
function fixture(mode, extra = {}) {
  const docs = new Map([[mode === 'trash' ? recordPath : trashPath,
    {revision: 3, encryptedPayload: 'SYNTHETIC-CIPHERTEXT', deletedAt: 123, purgeAfterMs: 456}], ...Object.entries(extra)]);
  const writes = [];
  const reference = path => ({path, doc: id => reference(`${path}/${id}`), collection: id => reference(`${path}/${id}`)});
  const store = {collection: reference, doc: reference, runTransaction: async callback => {
    const pending = [];
    const value = await callback({get: async ref => ({exists: docs.has(ref.path), data: () => docs.get(ref.path)}),
      set: (ref, data) => pending.push(['set', ref.path, data]), delete: ref => pending.push(['delete', ref.path])});
    for (const [action, path, data] of pending) {
      writes.push([action, path, data]); if (action === 'set') docs.set(path, data); else docs.delete(path);
    }
    return value;
  }};
  const context = vm.createContext({exports: {}, ...service, ...receipts, currentMutationRevision, HttpsError,
    assertTransactionGlobalPurgeUnlocked,
    getFirestore: () => store, onCall: (_opts, callback) => callback, FieldValue: {serverTimestamp: () => 'synthetic-time'}});
  vm.runInContext(helpers + handler, context);
  return {docs, writes, run: (data = command, action = mode) => context.exports[action === 'trash' ? 'trashSyncRecord' : 'restoreSyncRecord']({auth: {uid: 'A'}, data})};
}
for (const mode of ['trash', 'restore']) {
  test(`${mode}: real handler writes a root-bound receipt and exact retry does not mutate`, async () => {
    const f = fixture(mode), first = await f.run();
    assert.equal(first.status, mode === 'trash' ? 'trashed' : 'restored');
    assert.equal(first.revision, mode === 'trash' ? 3 : 4);
    assert.equal(f.docs.has(legacyPath), false); assert.ok(f.docs.has(resultPath));
    const count = f.writes.length, duplicate = await f.run();
    assert.equal(duplicate.duplicate, true); assert.equal(duplicate.revision, first.revision);
    assert.equal(f.writes.length, count);
    if (mode === 'restore') {
      assert.equal(f.docs.get(recordPath).deletedAt, undefined);
      assert.equal(f.docs.get(recordPath).purgeAfterMs, undefined);
      assert.equal(f.docs.get(recordPath).encryptedPayload, 'SYNTHETIC-CIPHERTEXT');
    }
  });
  test(`${mode}: operation ID cannot cross action, record or revision`, async () => {
    const f = fixture(mode); await f.run(); const count = f.writes.length;
    for (const changed of [{...command, recordId: 'other'}, {...command, expectedRevision: 2}]) {
      await assert.rejects(f.run(changed), error => error.code === 'already-exists');
    }
    await assert.rejects(f.run(command, mode === 'trash' ? 'restore' : 'trash'), error => error.code === 'already-exists');
    assert.equal(f.writes.length, count);
  });
  test(`${mode}: legacy or corrupt receipt never attests success or reapplies`, async () => {
    for (const extra of [{[legacyPath]: {status: 'restored'}}, {[resultPath]: {status: 'trashed'}},
      {[resultPath]: {...receipts.createRecoveryBinding('A', mode, command), status: mode === 'trash' ? 'trashed' : 'restored', revision: 99, duplicate: false}}]) {
      const f = fixture(mode, extra);
      await assert.rejects(f.run(), error => error.code === 'failed-precondition');
      assert.equal(f.writes.length, 0);
    }
  });
  test(`${mode}: stale or malformed source revision cannot mutate data`, async () => {
    for (const revision of [2, '3', -1, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const f = fixture(mode, {[mode === 'trash' ? recordPath : trashPath]: {revision}});
      if (revision === 2) assert.equal((await f.run()).status, 'conflict');
      else await assert.rejects(f.run(), error => error.code === 'failed-precondition');
      assert.equal(f.writes.length, 0);
    }
  });
  test(`${mode}: occupied destination is preserved`, async () => {
    const path = mode === 'trash' ? trashPath : recordPath;
    const f = fixture(mode, {[path]: {revision: 7, encryptedPayload: 'KEEP'}});
    assert.equal((await f.run()).status, 'conflict');
    assert.equal(f.writes.length, 0); assert.equal(f.docs.get(path).encryptedPayload, 'KEEP');
  });
}
test('recovery command rejects coerced identifiers and unsafe revisions', () => {
  for (const patch of [{recordId: 123}, {operationId: {toString: () => 'valid'}},
    {expectedRevision: Number.MAX_SAFE_INTEGER}, {expectedRevision: Number.MAX_SAFE_INTEGER + 1}]) {
    assert.throws(() => service.validateRecoveryCommand({...command, ...patch}));
  }
});
