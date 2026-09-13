const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const service = require('../backup-restore-service');
const receipts = require('../backup-restore-receipt');
const source = readFileSync(require.resolve('../index'), 'utf8');
const handler = source.slice(source.indexOf('exports.restoreBackupChunk ='), source.indexOf('exports.getAppPresentation ='));
const original = {expectedOwnerUid: 'owner', operationId: 'restore:fixture:0', backupId: 'fixture', chunkIndex: 0,
  chunkCount: 1, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
  records: [{scope: 'private-account', id: 'record', data: {password: 'synthetic-cipher'}}]};

function fixture() {
  const data = new Map(), writes = [];
  const ref = path => ({path, collection: name => ref(`${path}/${name}`), doc: id => ref(`${path}/${id}`)});
  const store = {collection: ref, doc: ref, runTransaction: async run => {
    const staged = []; let writing = false;
    const result = await run({get: async reference => {
      assert.equal(writing, false);
      return {exists: data.has(reference.path), data: () => data.get(reference.path)};
    }, set: (reference, value) => { writing = true; staged.push([reference.path, value]); }});
    for (const [path, value] of staged) data.set(path, value);
    writes.push(...staged);
    return result;
  }};
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const context = vm.createContext({...service, ...receipts, exports: {}, HttpsError,
    onCall: (_options, run) => run, getFirestore: () => store, FieldValue: {serverTimestamp: () => 'time'}});
  vm.runInContext(handler, context);
  return {data, writes, run: (command = original) => context.exports.restoreBackupChunk({auth: {uid: 'owner'}, data: command})};
}
const resultPath = 'mutationResults/owner/operations/restore:fixture:0';
const legacyPath = 'users/owner/backupRestoreOperations/restore:fixture:0';

test('backup applies with a backend receipt and replays without reapplying changed current data', async () => {
  const f = fixture(); assert.equal((await f.run()).status, 'applied');
  assert.equal(f.data.has(resultPath), true); assert.equal(f.data.has(legacyPath), false);
  assert.equal(JSON.stringify(f.data.get(resultPath)).includes('synthetic-cipher'), false);
  f.data.set('users/owner/accounts/record', {password: 'newer-cipher'});
  f.data.set(legacyPath, {status: 'applied', recordCount: 999});
  const count = f.writes.length, retry = await f.run();
  assert.equal(retry.duplicate, true); assert.equal(retry.recordCount, 1);
  assert.equal(f.writes.length, count);
  assert.equal(f.data.get('users/owner/accounts/record').password, 'newer-cipher');
});

test('old receipt cannot declare success or apply data; preview still reads actual collisions', async () => {
  const f = fixture(); f.data.set(legacyPath, {status: 'applied', backupId: 'fixture', chunkIndex: 0});
  await assert.rejects(f.run(), error => error.details?.reason === 'LEGACY_BACKUP_RESULT_UNVERIFIED');
  assert.equal(f.writes.length, 0); assert.equal(f.data.has(resultPath), false);
  f.data.set('users/owner/accounts/record', {password: 'existing-cipher'});
  const preview = await f.run({...original, mode: 'preview'});
  assert.equal(preview.status, 'collision'); assert.equal(preview.collisionCount, 1); assert.equal(f.writes.length, 0);
});

test('same restore operation cannot change data, overwrite authorization or chunk count', async () => {
  const f = fixture(); await f.run(); const count = f.writes.length;
  for (const command of [
    {...original, records: [{...original.records[0], data: {password: 'different-cipher'}}]},
    {...original, overwriteExisting: true, confirmation: 'RESTORE_SELECTED_OVERWRITE'},
    {...original, chunkCount: 2}
  ]) {
    await assert.rejects(f.run(command), error => error.details?.reason === 'BACKUP_RESULT_UNVERIFIED');
    assert.equal(f.writes.length, count);
  }
});

test('unattested data in the new namespace fails closed rather than replacing the receipt', async () => {
  const f = fixture(); f.data.set(resultPath, {status: 'applied', backupId: 'fixture', chunkIndex: 0});
  await assert.rejects(f.run(), error => error.details?.reason === 'BACKUP_RESULT_UNVERIFIED');
  assert.equal(f.writes.length, 0);
});
