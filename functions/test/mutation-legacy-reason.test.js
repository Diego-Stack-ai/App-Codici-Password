const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const bindingService = require('../mutation-result-binding');
const privateService = require('../private-account-mutation-service');
const offlineService = require('../offline-sync-service');

// Run the actual mutation handlers with only callable registration and Firestore
// transaction boundaries replaced. This does not test HTTP/Auth/App Check.
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('function verifiedMutationRetry(');
const end = source.indexOf('exports.manageSharedVaultData =', start);
assert.ok(start >= 0 && end > start);
const mutationSource = source.slice(start, end);
const uid = 'synthetic-owner';
const cipher = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB';
const base = {schemaVersion: 1, operationId: 'device:legacy-review', deviceId: 'device', recordId: 'record', expectedRevision: 2};

function harness({domain, input, trusted, legacy, revision = 2}) {
  const writes = [];
  const reads = [];
  const records = new Map([
    [`users/${uid}/${domain === 'private-account' ? 'accounts' : 'syncRecords'}/record`, {revision}],
  ]);
  if (trusted !== undefined) records.set(`mutationResults/${uid}/operations/${base.operationId}`, trusted);
  if (legacy !== undefined) records.set(`users/${uid}/operationResults/${base.operationId}`, legacy);
  const reference = path => ({
    path,
    collection: name => reference(`${path}/${name}`),
    doc: id => reference(`${path}/${id}`),
  });
  const store = {
    collection: name => reference(name),
    runTransaction: callback => callback({
      get: async ref => {
        reads.push(ref.path);
        return {exists: records.has(ref.path), data: () => records.get(ref.path)};
      },
      set: (...args) => writes.push(args),
    }),
  };
  const context = vm.createContext({
    exports: {}, HttpsError, ...bindingService, ...privateService, ...offlineService,
    onCall: (_options, handler) => handler,
    getFirestore: () => store,
    FieldValue: {serverTimestamp: () => 'synthetic-timestamp'},
  });
  vm.runInContext(mutationSource, context, {filename: 'index.js:mutation-handlers'});
  const name = domain === 'private-account' ? 'applyPrivateAccountMutation' : 'applyOfflineMutation';
  return {invoke: () => context.exports[name]({auth: {uid}, data: input}), writes, reads};
}

for (const domain of ['private-account', 'offline-sync']) {
  const input = domain === 'private-account' ? {...base, record: {
    nomeAccount: 'Synthetic', type: 'account', visibility: 'private', _encrypted: true,
    username: cipher, account: cipher, password: cipher, note: cipher,
  }} : {...base, encryptedPayload: cipher};
  const validate = domain === 'private-account' ? privateService.validatePrivateAccountMutation : offlineService.validateOfflineMutation;
  const binding = bindingService.createMutationBinding({uid, domain, operation: validate(input)});
  const trusted = {...binding, status: 'applied', revision: 3, duplicate: false};
  const legacy = {status: 'applied', revision: 3, domain, recordId: 'record', secretFixture: 'must-not-leak'};

  test(`${domain}: legacy-only returns the structured review reason and never writes`, async () => {
    const runtime = harness({domain, input, legacy});
    await assert.rejects(runtime.invoke(), error => {
      assert.equal(error.code, 'failed-precondition');
      const serialized = error.toJSON();
      assert.deepEqual(JSON.parse(JSON.stringify(serialized.details)), {reason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
      assert.equal(JSON.stringify(serialized).includes('must-not-leak'), false);
      return true;
    });
    assert.equal(runtime.reads.includes(`users/${uid}/operationResults/${base.operationId}`), true);
    assert.equal(runtime.writes.length, 0);
  });

  test(`${domain}: a valid trusted receipt still takes precedence over legacy`, async () => {
    const runtime = harness({domain, input, trusted, legacy});
    const result = await runtime.invoke();
    assert.equal(result.status, 'applied');
    assert.equal(result.duplicate, true);
    assert.equal(runtime.writes.length, 0);
  });

  test(`${domain}: malformed trusted receipt is not misclassified as legacy review`, async () => {
    const runtime = harness({domain, input, trusted: {...trusted, revision: 99}, legacy});
    await assert.rejects(runtime.invoke(), error => error.code === 'failed-precondition' && error.details === undefined);
    assert.equal(runtime.writes.length, 0);
  });

  test(`${domain}: operation binding collision retains its distinct rejection`, async () => {
    const runtime = harness({domain, input, trusted: {...trusted, deviceId: 'other-device'}, legacy});
    await assert.rejects(runtime.invoke(), error => error.code === 'already-exists' && error.details === undefined);
    assert.equal(runtime.writes.length, 0);
  });
}
