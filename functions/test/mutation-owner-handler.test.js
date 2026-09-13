const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const binding = require('../mutation-result-binding');
const privateService = require('../private-account-mutation-service');
const offlineService = require('../offline-sync-service');
const sharedService = require('../shared-vault-service');
const widgetService = require('../account-widget-service');
const scopeService = require('../private-account-write-scope');
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('function verifiedMutationRetry('), end = source.indexOf('async function runRecoveryCommand(', start);
assert.ok(start >= 0 && end > start);
const cipher = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB';
const base = {schemaVersion: 1, uid: 'A', operationId: 'owner-bound', deviceId: 'device', recordId: 'record', expectedRevision: 0};
const field = {id: 'field', label: 'Synthetic', type: 'sensitive', encrypted: true, valueEnc: cipher, includeInQr: false, copyable: false};
const cases = [
  ['applyPrivateAccountMutation', 'uid', {...base, record: {nomeAccount: 'Synthetic', type: 'account', visibility: 'private', _encrypted: true,
    username: cipher, account: cipher, password: cipher, note: cipher}}],
  ['applyOfflineMutation', 'uid', {...base, encryptedPayload: cipher}],
  ['manageAccountWidget', 'expectedOwnerUid', {expectedOwnerUid: 'A', action: 'create', operationId: 'widget-op', widgetId: 'widget', context: 'private', accountId: 'record', data: {title: 'Synthetic', fields: [field]}}],
  ['manageSharedVaultData', 'expectedOwnerUid', {expectedOwnerUid: 'A', action: 'create', operationId: 'shared-op', sharedDataId: 'shared', data: {title: 'Synthetic', fields: [field]}}],
];

function fixture(name) {
  let accesses = 0;
  const reads = [], writes = [];
  const reference = path => ({path, collection: segment => reference(`${path}/${segment}`), doc: segment => reference(`${path}/${segment}`)});
  const store = {collection: path => reference(path), doc: path => reference(path), runTransaction: callback => callback({
    get: async ref => {
      reads.push(ref.path);
      const exists = name === 'manageAccountWidget' && ref.path === 'users/A/accounts/record';
      return {exists, data: () => exists ? {type: 'account', visibility: 'private'} : undefined, docs: []};
    },
    set: (...args) => writes.push(args), delete: (...args) => writes.push(args),
  })};
  const context = vm.createContext({
    exports: {}, HttpsError, ...binding, ...privateService, ...offlineService, ...sharedService, ...widgetService, ...scopeService,
    onCall: (_options, handler) => handler,
    getFirestore: () => { accesses += 1; return store; }, FieldValue: {serverTimestamp: () => 'synthetic-time'},
  });
  vm.runInContext(source.slice(start, end), context, {filename: 'index.js:owner-bound-mutations'});
  return {reads, writes, accesses: () => accesses, run: (data, uid = 'A') => context.exports[name]({auth: {uid}, data})};
}

for (const [name, ownerField, command] of cases) {
  test(`${name}: missing/mismatched owner fails before any Firestore read or write`, async () => {
    for (const value of [undefined, null, '', false, 7, {uid: 'A'}, 'B']) {
      const f = fixture(name);
      await assert.rejects(f.run({...command, [ownerField]: value}), error => error.code === 'failed-precondition' && error.details?.reason === 'MUTATION_OWNER_MISMATCH');
      assert.equal(f.accesses(), 0); assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0);
    }
    const changed = fixture(name);
    await assert.rejects(changed.run(command, 'B'), error => error.details?.reason === 'MUTATION_OWNER_MISMATCH');
    assert.equal(changed.accesses(), 0); assert.equal(changed.writes.length, 0);
  });

  test(`${name}: the correctly bound caller retains the normal apply behavior`, async () => {
    const f = fixture(name), result = await f.run(command);
    assert.equal(result.status, 'applied'); assert.ok(f.writes.length >= 2);
    assert.ok(f.reads.every(path => /^(users|mutationResults)\/A(?:\/|$)/.test(path)));
    assert.ok(f.writes.every(([ref]) => /^(users|mutationResults)\/A(?:\/|$)/.test(ref.path)));
  });
}

test('adding the transport UID leaves normalized commands and existing receipt hashes unchanged', () => {
  for (const [name, , command] of cases.slice(0, 2)) {
    const validate = name === 'applyPrivateAccountMutation' ? privateService.validatePrivateAccountMutation : offlineService.validateOfflineMutation;
    const {uid, ...withoutUid} = command;
    assert.equal(uid, 'A');
    assert.deepEqual(validate(command), validate(withoutUid));
    const domain = name === 'applyPrivateAccountMutation' ? 'private-account' : 'offline-sync';
    assert.deepEqual(binding.createMutationBinding({uid, domain, operation: validate(command)}),
      binding.createMutationBinding({uid, domain, operation: validate(withoutUid)}));
  }
});
