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

function fixture(provider = async () => ({ok: false, json: async () => ({})})) {
  let state = null, calls = 0, writes = 0, authAccess = 0;
  const sent = [];
  const db = {
    collection(name) {assert.equal(name, 'mfaRecoveryAttempts'); return {doc: id => ({id})};},
    runTransaction: action => action({get: async () => ({exists: state !== null, data: () => state}), set: (_ref, data) => {state = data; writes++;}}),
  };
  const context = {exports: {}, crypto, ...security, FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
    HttpsError: class extends Error {constructor(code, text) {super(text); this.code = code;}},
    admin: {firestore: Object.assign(() => db, {FieldValue: {serverTimestamp: () => 'synthetic-time'}}), auth: () => {authAccess++; throw Error('UNEXPECTED_AUTH_ACCESS');}},
    fetch: async (url, options) => {
      calls++;
      sent.push({url, options});
      return provider();
    },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return {invoke: data => context.exports.recoverMfaWithCode({data: data || {email: ' User@Example.invalid ', password: 'synthetic-password', recoveryCode: 'ABCD-EFGH-2345-6789'}, rawRequest: {ip: '127.0.0.1'}}),
    sent: () => sent, counts: () => ({calls, writes, authAccess}), corrupt: () => {state = {attempts: 'invalid'};}};
}
function assertPasswordCalls(f) {
  for (const {url, options} of f.sent()) {
    assert.equal(url, 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {email: 'user@example.invalid', password: 'synthetic-password', returnSecureToken: true});
  }
}
const generic = error => error.code === 'failed-precondition' && error.message === message && error.details === undefined;
const replies = {
  'wrong password': {ok: false, body: {error: {message: 'INVALID_LOGIN_CREDENTIALS'}}},
  'unknown account': {ok: false, body: {error: {message: 'EMAIL_NOT_FOUND'}}},
  'disabled account': {ok: false, body: {error: {message: 'USER_DISABLED'}}},
  'correct password': {ok: true, body: {localId: 'user-id', idToken: 'synthetic-proof'}},
  'MFA required': {ok: true, body: {localId: 'user-id', mfaPendingCredential: 'synthetic-proof'}},
  'different email': {ok: true, body: {localId: 'user-id', email: 'other@example.invalid', idToken: 'synthetic-proof'}},
  'invalid UID': {ok: true, body: {localId: 'bad/uid', idToken: 'synthetic-proof'}},
  'missing proof': {ok: true, body: {localId: 'user-id'}},
  'provider failure': {ok: false, status: 500, body: {error: {message: 'INTERNAL_ERROR'}}},
  'provider throttle': {ok: false, status: 429, body: {error: {message: 'TOO_MANY_ATTEMPTS_TRY_LATER'}}},
};
for (const [name, reply] of Object.entries(replies)) test(`uniform MFA refusal: ${name}`, async () => {
  const f = fixture(async () => ({...reply, json: async () => reply.body}));
  await assert.rejects(f.invoke(), generic);
  assertPasswordCalls(f);
  assert.deepEqual(f.counts(), {calls: 1, writes: 1, authAccess: 0});
});
for (const stage of ['fetch', 'json']) test(`provider ${stage} failure is contained`, async () => {
  const f = fixture(async () => {if (stage === 'fetch') throw Error('provider-sensitive-detail'); return {json: async () => {throw Error('provider-sensitive-detail');}};});
  await assert.rejects(f.invoke(), generic);
  assertPasswordCalls(f);
  assert.deepEqual(f.counts(), {calls: 1, writes: 1, authAccess: 0});
});
test('input validation and persisted limit precede all password calls', async () => {
  const f = fixture();
  for (const data of [{}, {email: 'x', password: 'p', recoveryCode: 'bad'}]) {
    await assert.rejects(f.invoke(data), error => error.code === 'invalid-argument');
  }
  assert.deepEqual(f.counts(), {calls: 0, writes: 0, authAccess: 0});
  for (let index = 0; index < 5; index++) await assert.rejects(f.invoke(), generic);
  for (let index = 0; index < 2; index++) await assert.rejects(f.invoke(), error => error.code === 'resource-exhausted');
  assert.equal(f.counts().calls, 5);
  assertPasswordCalls(f);
});
test('corrupt limiter state fails before password verification and any write', async () => {
  const f = fixture(); f.corrupt();
  await assert.rejects(f.invoke(), generic);
  assertPasswordCalls(f);
  assert.deepEqual(f.counts(), {calls: 0, writes: 0, authAccess: 0});
});
