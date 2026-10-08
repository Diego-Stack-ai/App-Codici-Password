const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {
  generateRecoveryCode,
  hasRecentAuthentication,
  nextRecoveryAttemptState,
  normalizeRecoveryCode,
  recoveryAttemptId,
  recoveryCodeHash,
} = require('../recovery-security');

test('recent authentication rejects malformed, future and stale auth_time without coercion', () => {
  const now = 1_800_000_000_000, seconds = now / 1000;
  for (const auth_time of [undefined, null, false, String(seconds), NaN, Infinity, -1, 0,
    seconds + 1, seconds - 301, seconds - 0.5]) {
    assert.equal(hasRecentAuthentication({auth_time}, now), false);
  }
  assert.equal(hasRecentAuthentication(undefined, now), false);
  assert.equal(hasRecentAuthentication({auth_time: seconds}, now), true);
  assert.equal(hasRecentAuthentication({auth_time: seconds - 300}, now), true);
});

test('real recovery-code generator refuses invalid authentication before Auth or database access', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.createMfaRecoveryCodes =');
  const end = source.indexOf('exports.recoverMfaWithCode =', start);
  assert.ok(start >= 0 && end > start);
  let accesses = 0;
  const context = {exports: {}, hasRecentAuthentication,
    onCall: (_options, handler) => handler,
    HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
    admin: {auth: () => {accesses++; throw new Error('UNEXPECTED_AUTH');},
      firestore: () => {accesses++; throw new Error('UNEXPECTED_DB');}}};
  vm.runInNewContext(source.slice(start, end), context);
  for (const token of [undefined, {}, {auth_time: 'invalid'}, {auth_time: Math.floor(Date.now() / 1000) + 1000}]) {
    await assert.rejects(context.exports.createMfaRecoveryCodes({auth: {uid: 'synthetic', token}}),
      error => error.code === 'failed-precondition');
  }
  assert.equal(accesses, 0);
});

test('i recovery code hanno formato ed entropia coerenti', () => {
  const codes = new Set(Array.from({length: 100}, generateRecoveryCode));
  assert.equal(codes.size, 100);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/);
});

test('normalizzazione e hash sono stabili senza conservare il codice', () => {
  assert.equal(normalizeRecoveryCode('abcd-efgh-2345-6789'), 'ABCDEFGH23456789');
  assert.equal(recoveryCodeHash('ABCD-EFGH-2345-6789'), recoveryCodeHash('abcdefgh23456789'));
  assert.notEqual(recoveryAttemptId('utente@example.com', '127.0.0.1'), recoveryAttemptId('utente@example.com', '127.0.0.2'));
});

test('il sesto tentativo nella finestra attiva il blocco server', () => {
  const now = 1_800_000_000_000;
  let state = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = nextRecoveryAttemptState(state, now + attempt);
    assert.equal(state.allowed, true);
  }
  state = nextRecoveryAttemptState(state, now + 6);
  assert.equal(state.allowed, false);
  assert.ok(state.blockedUntil > now);
  assert.equal(nextRecoveryAttemptState(state, now + 7).allowed, false);
});

test('recovery attempt limiter rejects malformed persisted counters and clocks', () => {
  const now = 1_800_000_000_000;
  const valid = {attempts: 3, windowStartedAt: now - 100, blockedUntil: 0};
  for (const value of [NaN, Infinity, -1, 0.5, '3', null, undefined]) {
    for (const field of ['attempts', 'windowStartedAt', 'blockedUntil']) {
      assert.throws(() => nextRecoveryAttemptState({...valid, [field]: value}, now), /RECOVERY_ATTEMPT_STATE/);
    }
  }
  for (const state of [{}, [], false, 'state']) {
    assert.throws(() => nextRecoveryAttemptState(state, now), /RECOVERY_ATTEMPT_STATE/);
  }
  for (const clock of [NaN, Infinity, -1, 0.5, '123', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => nextRecoveryAttemptState(null, clock), /RECOVERY_ATTEMPT_STATE/);
  }
  assert.equal(nextRecoveryAttemptState(valid, now).attempts, 4);
  assert.equal(nextRecoveryAttemptState(null, now).attempts, 1);
  assert.equal(nextRecoveryAttemptState({...valid, windowStartedAt: now - 15 * 60 * 1000}, now).attempts, 1);
});

test('recovery handler rejects corrupt attempt state before writes, Auth or code consumption', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
  const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
  assert.ok(start >= 0 && end > start);
  let effects = 0;
  const db = {
    collection: name => {assert.equal(name, 'mfaRecoveryAttempts'); return {doc: id => ({id})};},
    runTransaction: async action => action({
      get: async () => ({exists: true, data: () => ({attempts: 'invalid', windowStartedAt: Date.now(), blockedUntil: 0})}),
      set: () => {effects++;},
    }),
  };
  const context = {exports: {}, crypto, recoveryAttemptId, recoveryCodeHash, normalizeRecoveryCode, nextRecoveryAttemptState,
    onCall: (_options, handler) => handler,
    HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
    fetch: async () => {effects++; throw Error('Unexpected request');},
    admin: {firestore: () => db, auth: () => {effects++; throw Error('Unexpected Auth');}},
  };
  vm.runInNewContext(source.slice(start, end), context);
  await assert.rejects(context.exports.recoverMfaWithCode({data: {email: 'test@example.invalid',
    password: 'synthetic', recoveryCode: 'ABCD-EFGH-2345-6789'}}), error =>
    error.code === 'failed-precondition' && error.message.includes('Nessun codice consumato') &&
    !error.message.includes('RECOVERY_ATTEMPT_STATE'));
  assert.equal(effects, 0);
});

test('active recovery block preserves counters and expiry across repeated attempts', () => {
  const now = 1_800_000_000_000;
  const state = {attempts: 6, windowStartedAt: now - 100, blockedUntil: now + 1000};
  assert.deepEqual(nextRecoveryAttemptState(state, now), {allowed: false, ...state});
  assert.deepEqual(nextRecoveryAttemptState(state, now + 999), {allowed: false, ...state});
  const expired = nextRecoveryAttemptState(state, now + 1000);
  assert.equal(expired.allowed, false, 'window still active: no reset before window expiry');
  assert.equal(expired.attempts, 7);
  assert.equal(nextRecoveryAttemptState(state, now + 30 * 60 * 1000).attempts, 1);
});

test('real recovery handler persists the attempt limit and never calls Auth during a block', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
  const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
  assert.ok(start >= 0 && end > start);
  let persisted, calls = 0;
  const db = {
    collection: name => {assert.equal(name, 'mfaRecoveryAttempts'); return {doc: id => ({id})};},
    runTransaction: async action => action({
      get: async () => ({exists: persisted !== undefined, data: () => persisted}),
      set: (_, data) => {persisted = structuredClone(data);},
    }),
  };
  const context = {exports: {}, crypto, recoveryAttemptId, recoveryCodeHash, normalizeRecoveryCode, nextRecoveryAttemptState,
    FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
    HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
    fetch: async () => {calls++; return {ok: false, json: async () => ({error: {message: 'INVALID_LOGIN_CREDENTIALS'}})};},
    admin: {firestore: Object.assign(() => db, {FieldValue: {serverTimestamp: () => 123}})},
  };
  vm.runInNewContext(source.slice(start, end), context);
  const request = {data: {email: 'test@example.invalid', password: 'synthetic', recoveryCode: 'ABCD-EFGH-2345-6789'}};
  for (let i = 0; i < 5; i++) {
    await assert.rejects(context.exports.recoverMfaWithCode(request), error => error.code === 'permission-denied');
    assert.equal(persisted.attempts, i + 1);
  }
  await assert.rejects(context.exports.recoverMfaWithCode(request), error => error.code === 'resource-exhausted');
  const blocked = structuredClone(persisted);
  for (let i = 0; i < 3; i++) {
    await assert.rejects(context.exports.recoverMfaWithCode(request), error => error.code === 'resource-exhausted');
    assert.equal(persisted.attempts, blocked.attempts);
    assert.equal(persisted.windowStartedAt, blocked.windowStartedAt);
    assert.equal(persisted.blockedUntil, blocked.blockedUntil);
  }
  assert.equal(calls, 5);
});

test('caratterizzazione: errore Auth dopo consumo MFA lascia codice consumato e recupero pendente', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
  const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
  assert.ok(start >= 0 && end > start);
  const code = 'ABCD-EFGH-2345-6789';
  const records = new Map([['mfaRecovery/synthetic', {codeHashes: [recoveryCodeHash(code)], remaining: 1}]]);
  let updates = 0;
  const db = {
    collection: name => ({doc: id => ({path: `${name}/${id}`})}),
    runTransaction: async action => action({
      get: async ref => ({exists: records.has(ref.path), data: () => records.get(ref.path)}),
      set: (ref, data, options) => records.set(ref.path, {...(options?.merge ? records.get(ref.path) : {}), ...data}),
    }),
  };
  const firestore = Object.assign(() => db, {FieldValue: {serverTimestamp: () => 123}});
  const context = {exports: {}, crypto, recoveryAttemptId, recoveryCodeHash, normalizeRecoveryCode, nextRecoveryAttemptState,
    FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
    HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
    fetch: async () => ({ok: true, json: async () => ({localId: 'synthetic', mfaPendingCredential: 'synthetic-proof'})}),
    admin: {firestore, auth: () => ({getUser: async uid => {assert.equal(uid, 'synthetic'); return {uid, email: 'test@example.invalid'};},
      updateUser: async () => {updates++; throw new Error('SYNTHETIC_AUTH_FAILURE');}})},
  };
  vm.runInNewContext(source.slice(start, end), context);
  const request = {data: {email: 'test@example.invalid', password: 'synthetic', recoveryCode: code}, rawRequest: {ip: '127.0.0.1'}};
  await assert.rejects(context.exports.recoverMfaWithCode(request), /SYNTHETIC_AUTH_FAILURE/);
  assert.equal(records.get('mfaRecovery/synthetic').remaining, 0);
  assert.equal(records.get('mfaRecovery/synthetic').recoveryPendingAt, 123);
  await assert.rejects(context.exports.recoverMfaWithCode(request), error => error.code === 'permission-denied');
  assert.equal(updates, 1, 'il ritentativo non raggiunge Auth: limite riprodotto, non risolto');
});

test('recovery binds the password response UID and fails closed before consuming any code', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
  const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
  assert.ok(start >= 0 && end > start);
  const cases = [
    {body: {}},
    {body: {localId: 'original'}},
    {body: {localId: 'original', idToken: 123}},
    {body: {localId: 'bad/path', idToken: 'proof'}},
    {ok: false, body: {error: {message: 'MFA_REQUIRED'}, localId: 'original', mfaPendingCredential: 'proof'}},
    {body: {localId: 'original', idToken: 'proof'}, user: {uid: 'replacement', email: 'test@example.invalid'}},
    {body: {localId: 'original', idToken: 'proof'}, user: {uid: 'original', email: 'changed@example.invalid'}},
    {body: {localId: 'original', mfaPendingCredential: 'proof'}, user: {uid: 'original', email: 'test@example.invalid', disabled: true}},
  ];
  for (const scenario of cases) {
    let codeAccesses = 0;
    const db = {
      collection: name => {if (name === 'mfaRecovery') codeAccesses++; return {doc: id => ({path: `${name}/${id}`})};},
      runTransaction: async action => action({get: async () => ({exists: false}), set: () => {}}),
    };
    const context = {exports: {}, crypto, recoveryAttemptId, recoveryCodeHash, normalizeRecoveryCode, nextRecoveryAttemptState,
      FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
      HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
      fetch: async () => ({ok: scenario.ok !== false, json: async () => scenario.body}),
      admin: {firestore: Object.assign(() => db, {FieldValue: {serverTimestamp: () => 123}}),
        auth: () => ({getUser: async uid => {assert.equal(uid, 'original'); assert.ok(scenario.user); return scenario.user;}})},
    };
    vm.runInNewContext(source.slice(start, end), context);
    await assert.rejects(context.exports.recoverMfaWithCode({data: {email: 'test@example.invalid',
      password: 'synthetic', recoveryCode: 'ABCD-EFGH-2345-6789'}}), error => error.code === 'permission-denied');
    assert.equal(codeAccesses, 0);
  }
});
