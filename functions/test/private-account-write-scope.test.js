const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {assertPrivateAccountWriteScope} = require('../private-account-write-scope');
const {validatePrivateAccountMutation, privateAccountMutationDecision} = require('../private-account-mutation-service');
const {createMutationBinding, verifyMutationResult, currentMutationRevision} = require('../mutation-result-binding');

const cipher = 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB';
const operation = () => ({schemaVersion: 1, recordId: 'record', operationId: 'device:scope', deviceId: 'device', expectedRevision: 1,
  record: {type: 'account', visibility: 'private', _encrypted: true, nomeAccount: 'Synthetic account',
    username: cipher, account: cipher, password: cipher, note: cipher}});
const basic = () => ({ownerId: 'owner', revision: 1, type: 'account', visibility: 'private'});
const unsupported = [
  {ownerId: 'other'}, {ownerId: null}, {ownerId: ''}, {visibility: 'shared'}, {visibility: null}, {type: 'company'},
  {shared: true}, {isMemoShared: true}, {_isGuest: true}, {sharedWith: {guest: {status: 'accepted'}}},
  {sharedWithUids: ['guest']}, {sharedWithEmails: ['guest@example.invalid']}, {recipientEmail: 'guest@example.invalid'},
  {acceptedCount: 1}, {isBanking: true}, {banking: [{}]}, {banking: {iban: 'legacy'}},
  {iban: 'legacy'}, {cards: [{}]}, {passwordDispositiva: cipher}, {isArchived: true},
  {linkedProfileField: {id: 'email'}}, {linkedCompanyProfileField: {id: 'phone'}},
  {linkedProfileFields: [{id: 'utility'}]}, {linkedCompanyProfileFields: [{id: 'document'}]}
];

test('scope permits own isolated accounts, private memos and missing legacy owner', () => {
  for (const record of [basic(), {}, {...basic(), type: 'memo'}, {...basic(), type: 'memorandum'},
    {...basic(), shared: false, isBanking: false, isArchived: false, sharedWith: {}, sharedWithUids: [],
      sharedWithEmails: [], banking: [], acceptedCount: 0, linkedProfileFields: [], linkedCompanyProfileFields: []}]) {
    const before = structuredClone(record);
    assert.doesNotThrow(() => assertPrivateAccountWriteScope({uid: 'owner', record}));
    assert.deepEqual(record, before);
  }
});

test('actual sharing, banking, archive and profile declarations cannot be hidden by a reduced incoming payload', () => {
  for (const extra of unsupported) {
    assert.throws(() => assertPrivateAccountWriteScope({uid: 'owner', record: {...basic(), ...extra}}), /PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED/);
  }
});

test('malformed declaration values are rejected while empty nullable link containers remain harmless', () => {
  for (const extra of [{shared: 'false'}, {isArchived: 0}, {isBanking: null}, {sharedWithUids: ''},
    {sharedWith: []}, {banking: false}, {acceptedCount: '0'}, {linkedProfileFields: {}}, {linkedProfileField: {}}]) {
    assert.throws(() => assertPrivateAccountWriteScope({uid: 'owner', record: {...basic(), ...extra}}), /UNSUPPORTED/);
  }
  assert.doesNotThrow(() => assertPrivateAccountWriteScope({uid: 'owner', record: {...basic(),
    sharedWith: null, banking: null, linkedProfileField: null, linkedProfileFields: []}}));
});

// Execute the actual handler body and retry/revision helpers from index.js with
// a transaction boundary fixture. Rules and real SDK integration remain separate.
const index = readFileSync(require.resolve('../index.js'), 'utf8');
const retrySource = index.slice(index.indexOf('function verifiedMutationRetry('), index.indexOf('exports.applyOfflineMutation'));
const handlerSource = index.slice(index.indexOf('exports.applyPrivateAccountMutation'), index.indexOf('exports.manageSharedVaultData'));
function handlerFixture({record = basic(), receipt = null, legacy = null} = {}) {
  const writes = [], refs = [];
  const reference = path => ({path, collection: name => reference(`${path}/${name}`), doc: id => reference(`${path}/${id}`)});
  const store = {collection: name => reference(name), runTransaction: async run => {
    const staged = [];
    const result = await run({get: async ref => {
      refs.push(ref.path);
      const value = ref.path.startsWith('mutationResults/') ? receipt : ref.path.includes('/operationResults/') ? legacy : record;
      return {exists: value !== null, data: () => value};
    }, set: (ref, value, options) => staged.push({path: ref.path, value, options})});
    writes.push(...staged); return result;
  }};
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const context = vm.createContext({exports: {}, onCall: (_options, handler) => handler,
    HttpsError, getFirestore: () => store, FieldValue: {serverTimestamp: () => 'synthetic-time'},
    validatePrivateAccountMutation, privateAccountMutationDecision, createMutationBinding, verifyMutationResult,
    currentMutationRevision, assertPrivateAccountWriteScope});
  vm.runInContext(retrySource + handlerSource, context);
  return {writes, refs, run: (data = operation()) => context.exports.applyPrivateAccountMutation({auth: {uid: 'owner'}, data})};
}

test('handler rejects unsupported current records with no account or receipt writes', async () => {
  for (const extra of unsupported) {
    const f = handlerFixture({record: {...basic(), ...extra}});
    await assert.rejects(f.run(), error => error.code === 'failed-precondition' && error.details.reason === 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');
    assert.deepEqual(f.writes, []);
  }
});

test('handler applies an isolated own record and permits legacy absence of ownerId', async () => {
  const record = basic(); delete record.ownerId;
  const f = handlerFixture({record}); const result = await f.run();
  assert.equal(result.status, 'applied'); assert.equal(result.revision, 2);
  assert.equal(f.writes[0].path, 'users/owner/accounts/record');
  assert.equal(f.writes[1].path, 'mutationResults/owner/operations/device:scope');
});

test('trusted retry remains idempotent after the record becomes shared or archived', async () => {
  const binding = createMutationBinding({uid: 'owner', domain: 'private-account', operation: validatePrivateAccountMutation(operation())});
  const receipt = {...binding, status: 'applied', revision: 2, duplicate: false};
  const f = handlerFixture({record: {...basic(), visibility: 'shared', isArchived: true, revision: 5}, receipt});
  const result = await f.run();
  assert.equal(result.status, 'applied'); assert.equal(result.duplicate, true); assert.equal(result.revision, 2);
  assert.deepEqual(f.writes, []);
});

test('legacy receipt reason is preserved before unsupported current scope is evaluated', async () => {
  const f = handlerFixture({record: {...basic(), visibility: 'shared'}, legacy: {status: 'applied', revision: 2}});
  await assert.rejects(f.run(), error => error.code === 'failed-precondition' && error.details.reason === 'LEGACY_MUTATION_RESULT_UNVERIFIED');
  assert.deepEqual(f.writes, []);
});

test('new creation and stale revision retain their existing behavior', async () => {
  const creation = handlerFixture({record: null});
  assert.equal((await creation.run({...operation(), expectedRevision: 0})).status, 'applied');
  const stale = handlerFixture({record: {...basic(), revision: 4}});
  assert.equal((await stale.run()).status, 'conflict'); assert.deepEqual(stale.writes, []);
});
