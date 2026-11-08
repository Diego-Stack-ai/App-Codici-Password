const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const security = require('../recovery-security');
const message = 'Recupero non disponibile. Se i dati sono corretti contatta l’assistenza. Nessun codice è stato consumato.';
const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
assert.ok(start >= 0 && end > start);

function fixture() {
  let state = null, calls = 0, writes = 0, authAccess = 0, logs = 0;
  const db = {
    collection(name) {assert.equal(name, 'mfaRecoveryAttempts'); return {doc: id => ({id})};},
    runTransaction: action => action({get: async () => ({exists: state !== null, data: () => state}), set: (_ref, data) => {state = data; writes++;}}),
  };
  const context = {exports: {}, crypto, ...security, onCall: (options, handler) => {
      assert.equal(options.region, 'europe-west1'); assert.equal(options.enforceAppCheck, true); return handler;
    }, HttpsError: class extends Error {constructor(code, text) {super(text); this.code = code;}},
    console: new Proxy({}, {get: () => () => {logs++; throw Error('UNEXPECTED_LOG');}}),
    admin: {firestore: Object.assign(() => db, {FieldValue: {serverTimestamp: () => 'synthetic-time'}}), auth: () => {authAccess++; throw Error('UNEXPECTED_AUTH_ACCESS');}},
    fetch: async () => {calls++; throw Error('UNEXPECTED_NETWORK');},
  };
  vm.runInNewContext(source.slice(start, end), context);
  return {invoke: (data = {email: ' User@Example.invalid ', recoveryCode: 'ABCD-EFGH-2345-6789'}) =>
      context.exports.recoverMfaWithCode({data, rawRequest: {ip: '127.0.0.1'}}),
    counts: () => ({calls, writes, authAccess, logs}), corrupt: () => {state = {attempts: 'invalid'};}};
}
const generic = error => error.code === 'failed-precondition' && error.message === message && error.details === undefined;
for (const password of [undefined, null, '', 'wrong', 'synthetic-correct', {}, 42]) test(`legacy password is ignored: ${typeof password}`, async () => {
  const f = fixture();
  await assert.rejects(f.invoke({email: 'user@example.invalid', recoveryCode: 'ABCD-EFGH-2345-6789', password}), generic);
  assert.deepEqual(f.counts(), {calls: 0, writes: 1, authAccess: 0, logs: 0});
});
test('password is never read, serialized, forwarded or logged, including legacy input', async () => {
  const f = fixture();
  const data = {email: 'user@example.invalid', recoveryCode: 'ABCD-EFGH-2345-6789'};
  Object.defineProperty(data, 'password', {enumerable: true, get() {throw Error('PASSWORD_READ');}});
  Object.defineProperty(data, 'toJSON', {get() {throw Error('PAYLOAD_SERIALIZED');}});
  await assert.rejects(f.invoke(data), generic);
  assert.deepEqual(f.counts(), {calls: 0, writes: 1, authAccess: 0, logs: 0});
});
test('all syntactically valid identities get the same reply without an account lookup', async () => {
  for (const email of ['unknown@example.invalid', 'disabled@example.invalid', 'no-mfa@example.invalid', 'mfa@example.invalid']) {
    const f = fixture(); await assert.rejects(f.invoke({email, recoveryCode: 'ABCD-EFGH-2345-6789'}), generic);
    assert.deepEqual(f.counts(), {calls: 0, writes: 1, authAccess: 0, logs: 0});
  }
});
test('input validation precedes persisted limit; allowed attempts and blocked attempts never call Auth', async () => {
  const f = fixture();
  for (const data of [{}, {email: '', recoveryCode: 'ABCD-EFGH-2345-6789'}, {email: 'x', recoveryCode: 'bad'}]) {
    await assert.rejects(f.invoke(data), error => error.code === 'invalid-argument');
  }
  assert.deepEqual(f.counts(), {calls: 0, writes: 0, authAccess: 0, logs: 0});
  for (let index = 0; index < 5; index++) await assert.rejects(f.invoke(), generic);
  for (let index = 0; index < 2; index++) await assert.rejects(f.invoke(), error => error.code === 'resource-exhausted');
  assert.deepEqual(f.counts(), {calls: 0, writes: 7, authAccess: 0, logs: 0});
});
test('corrupt limiter state fails before any write and any external operation', async () => {
  const f = fixture(); f.corrupt(); await assert.rejects(f.invoke(), generic);
  assert.deepEqual(f.counts(), {calls: 0, writes: 0, authAccess: 0, logs: 0});
});
