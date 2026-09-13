const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../archive-purge-service');
const source = readFileSync(require.resolve('../index'), 'utf8');
const ownerGuard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));
const command = {expectedOwnerUid: 'A', accountId: 'account', operationId: 'operation', context: 'private',
  expectedRevision: 1, confirmation: 'DELETE_FOREVER'};

function fixture() {
  const accesses = {validation: 0, firestore: 0, storage: 0, recursiveDelete: 0};
  const reads = [], writes = [];
  const ref = path => ({path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`),
    get: async () => { reads.push(path); return {docs: []}; }});
  const store = {collection: ref, doc: ref,
    recursiveDelete: async reference => { accesses.recursiveDelete++; writes.push(reference.path); },
    runTransaction: async callback => callback({
      get: async reference => {
        reads.push(reference.path);
        const exists = reference.path === 'users/A/accounts/account';
        return {exists, data: () => exists ? {isArchived: true, revision: 1} : undefined, docs: []};
      },
      set: reference => writes.push(reference.path), update: reference => writes.push(reference.path),
    })};
  const context = vm.createContext({...policy, exports: {}, HttpsError, onCall: (_options, run) => run,
    validatePurgeCommand: data => { accesses.validation++; return policy.validatePurgeCommand(data); },
    getFirestore: () => { accesses.firestore++; return store; },
    getStorage: () => { accesses.storage++; return {bucket: () => ({})}; },
    FieldValue: {serverTimestamp: () => 'synthetic-time'}});
  vm.runInContext(ownerGuard + handler, context);
  return {accesses, reads, writes,
    run: (data = command, uid = 'A') => context.exports.purgeArchivedAccount({auth: uid ? {uid} : null, data})};
}

test('purge rejects absent and mismatched owner before validation, Firestore or Storage', async () => {
  for (const expectedOwnerUid of [undefined, null, '', false, 42, {}, 'B']) {
    const f = fixture();
    // Deliberately invalid payload proves owner validation precedes command validation.
    await assert.rejects(f.run({expectedOwnerUid}), error => error.code === 'failed-precondition' &&
      error.details?.reason === 'MUTATION_OWNER_MISMATCH');
    assert.deepEqual(f.accesses, {validation: 0, firestore: 0, storage: 0, recursiveDelete: 0});
    assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
  }
});

test('purge bound to A cannot run with a token for B', async () => {
  const f = fixture();
  await assert.rejects(f.run(command, 'B'), error => error.details?.reason === 'MUTATION_OWNER_MISMATCH');
  assert.deepEqual(f.accesses, {validation: 0, firestore: 0, storage: 0, recursiveDelete: 0});
  assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
});

test('unauthenticated purge preserves its authentication error and accesses no data', async () => {
  const f = fixture();
  await assert.rejects(f.run(command, null), error => error.code === 'unauthenticated');
  assert.deepEqual(f.accesses, {validation: 0, firestore: 0, storage: 0, recursiveDelete: 0});
});

test('matching owner preserves purge and constrains all paths to that owner', async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 'purged');
  assert.deepEqual(f.accesses, {validation: 1, firestore: 1, storage: 1, recursiveDelete: 1});
  assert.ok(f.reads.length > 0); assert.ok(f.writes.length > 0);
  assert.ok([...f.reads, ...f.writes].every(path => /^users\/A(?:\/|$)/.test(path)));
});
