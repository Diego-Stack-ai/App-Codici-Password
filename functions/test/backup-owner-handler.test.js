const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, readdirSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const backupService = require('../backup-restore-service');
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('exports.restoreBackupChunk =');
const end = source.indexOf('exports.getAppPresentation =', start);
assert.ok(start >= 0 && end > start);

function fixture() {
  let storeAccesses = 0;
  const reads = [], writes = [];
  const reference = value => ({path: value, collection: name => reference(`${value}/${name}`), doc: id => reference(`${value}/${id}`)});
  const store = {collection: name => reference(name), doc: value => reference(value),
    runTransaction: callback => callback({
      get: async ref => { reads.push(ref.path); return {exists: false, data: () => undefined}; },
      set: (...args) => writes.push(args),
    })};
  const context = vm.createContext({
    exports: {}, HttpsError, ...backupService, onCall: (_options, handler) => handler,
    getFirestore: () => { storeAccesses += 1; return store; },
    FieldValue: {serverTimestamp: () => 'synthetic-time'},
  });
  vm.runInContext(source.slice(start, end), context, {filename: 'index.js:restoreBackupChunk'});
  return {reads, writes, accesses: () => storeAccesses,
    run: (data, uid = 'A') => context.exports.restoreBackupChunk({auth: {uid}, data})};
}
const command = mode => ({expectedOwnerUid: 'A', operationId: 'restore:fixture:0', backupId: 'fixture', chunkIndex: 0, chunkCount: 1,
  mode, confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: 'record', data: {password: 'synthetic-ciphertext'}}]});

for (const mode of ['preview', 'apply']) {
  test(`${mode}: missing or changed expected owner is rejected before any Firestore access`, async () => {
    for (const expectedOwnerUid of [undefined, 'B', null, false, 42]) {
      const f = fixture();
      await assert.rejects(f.run({...command(mode), expectedOwnerUid}), error => {
        assert.equal(error.code, 'failed-precondition');
        assert.equal(error.details.reason, 'BACKUP_OWNER_MISMATCH');
        assert.equal(JSON.stringify(error.toJSON()).includes('synthetic-ciphertext'), false);
        return true;
      });
      assert.equal(f.accesses(), 0); assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
    }
  });
}

test('matching expected owner preserves preview and apply behavior under the authenticated UID', async () => {
  for (const mode of ['preview', 'apply']) {
    const f = fixture(), result = await f.run(command(mode));
    assert.equal(result.status, mode === 'preview' ? 'ready' : 'applied');
    assert.ok(f.reads.every(value => value.startsWith('users/A/')));
    assert.equal(f.writes.length, mode === 'preview' ? 0 : 3);
    assert.ok(f.writes.every(([ref]) => ref.path.startsWith('users/A/')));
  }
});

test('real SDK Auth token microtask gap can select B, but the captured owner A still prevents the restore', async () => {
  // This executes the installed SDK method with synthetic users, not Firebase
  // Auth or an HTTP endpoint. It characterizes the token lookup ordering.
  const directory = path.resolve(path.dirname(require.resolve('../index')), '../node_modules/@firebase/auth/dist/esm');
  const sdk = readdirSync(directory).filter(name => name.endsWith('.js'))
    .map(name => readFileSync(path.join(directory, name), 'utf8'))
    .find(text => text.includes('    async getToken(forceRefresh) {'));
  assert.ok(sdk);
  const begin = sdk.indexOf('    async getToken(forceRefresh) {');
  const finish = sdk.indexOf('    addAuthTokenListener(', begin);
  assert.ok(finish > begin);
  const method = sdk.slice(begin, finish).trim().replace('async getToken(forceRefresh)', 'async function getToken(forceRefresh)');
  const getToken = vm.runInNewContext(`(${method})`);
  const auth = {_initializationPromise: Promise.resolve(), currentUser: {getIdToken: async () => 'A'}};
  const pending = getToken.call({auth, assertAuthConfigured() {}});
  auth.currentUser = {getIdToken: async () => 'B'};
  const token = await pending;
  assert.equal(token.accessToken, 'B');
  const f = fixture();
  await assert.rejects(f.run(command('apply'), token.accessToken), error => error.details?.reason === 'BACKUP_OWNER_MISMATCH');
  assert.equal(f.accesses(), 0); assert.equal(f.writes.length, 0);
});
