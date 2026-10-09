const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const security = require('../recovery-security');

const allowed = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
  process.env.GCLOUD_PROJECT === 'demo-purge-fence';

test('concurrent recovery requests share a persisted limit and corrupt state has no side effects',
  {skip: !allowed, timeout: 60000}, async () => {
    const app = initializeApp({projectId: 'demo-purge-fence'}, `recovery-${crypto.randomUUID()}`);
    const db = getFirestore(app);
    try {
      const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
      const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
      const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
      assert.ok(start >= 0 && end > start);
      let calls = 0;
      const context = {exports: {}, crypto, ...security,
        FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
        HttpsError: class extends Error {constructor(code, message) {super(message); this.code = code;}},
        fetch: async () => {calls++; return {ok: false, json: async () => ({error: {message: 'INVALID_LOGIN_CREDENTIALS'}})};},
        admin: {firestore: Object.assign(() => db, {FieldValue}), auth: () => {throw Error('Unexpected Auth access');}},
      };
      // Use the SDK's realm: Firestore checks instanceof Promise in its callback.
      vm.compileFunction(source.slice(start, end), Object.keys(context))(...Object.values(context));
      const email = `${crypto.randomUUID()}@example.invalid`, ip = '127.0.0.1';
      const request = {data: {email, password: 'synthetic', recoveryCode: 'ABCD-EFGH-2345-6789'}, rawRequest: {ip}};
      const invoke = () => context.exports.recoverMfaWithCode(request);
      const results = await Promise.allSettled(Array.from({length: 8}, invoke));
      assert.equal(results.every(result => result.status === 'rejected'), true);
      assert.equal(results.filter(result => result.reason.code === 'permission-denied').length, 5,
        results.map(result => result.reason?.message).join('\n'));
      assert.equal(results.filter(result => result.reason.code === 'resource-exhausted').length, 3);
      assert.equal(calls, 5);
      const ref = db.collection('mfaRecoveryAttempts').doc(security.recoveryAttemptId(email, ip));
      const blocked = (await ref.get()).data();
      assert.equal(blocked.attempts, 6);
      assert.ok(blocked.blockedUntil > Date.now());
      await assert.rejects(invoke(), error => error.code === 'resource-exhausted');
      const again = (await ref.get()).data();
      for (const field of ['attempts', 'windowStartedAt', 'blockedUntil']) assert.equal(again[field], blocked[field]);
      // Only this test's synthetic record is changed; no existing bank is reseeded.
      await ref.update({attempts: NaN});
      const corrupt = await ref.get();
      await assert.rejects(invoke(), error => error.code === 'failed-precondition');
      assert.equal((await ref.get()).updateTime.isEqual(corrupt.updateTime), true);
      assert.equal(calls, 5);
    } finally {
      await db.terminate();
      await deleteApp(app);
    }
  });

test('concurrent use of one recovery code consumes it once and leaves no pending marker',
  {skip: !allowed, timeout: 60000}, async () => {
    const app = initializeApp({projectId: 'demo-purge-fence'}, `recovery-code-${crypto.randomUUID()}`);
    const db = getFirestore(app);
    try {
      const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
      const start = source.indexOf('exports.recoverMfaWithCode = onCall(');
      const end = source.indexOf('exports.revokeAllSessions = onCall(', start);
      const code = 'ABCD-EFGH-2345-6789', uid = `synthetic-${crypto.randomUUID()}`;
      const email = `${crypto.randomUUID()}@example.invalid`, ip = '127.0.0.2';
      const recoveryRef = db.collection('mfaRecovery').doc(uid);
      await recoveryRef.set({codeHashes: [security.recoveryCodeHash(code)], remaining: 1});
      let factorsRemoved = false, updates = 0;
      const auth = {
        getUser: async requested => ({uid: requested, email, multiFactor: {enrolledFactors:
          factorsRemoved ? [] : [{factorId: 'totp', uid: 'totp-factor'}]}}),
        updateUser: async () => {updates++; factorsRemoved = true;},
        revokeRefreshTokens: async () => {},
      };
      const context = {exports: {}, crypto, ...security,
        FIREBASE_WEB_API_KEY: 'synthetic', onCall: (_options, handler) => handler,
        HttpsError: class extends Error {constructor(codeValue, message) {super(message); this.code = codeValue;}},
        fetch: async () => ({ok: true, json: async () => ({localId: uid, mfaPendingCredential: 'proof'})}),
        admin: {firestore: Object.assign(() => db, {FieldValue}), auth: () => auth},
      };
      vm.compileFunction(source.slice(start, end), Object.keys(context))(...Object.values(context));
      const request = {data: {email, password: 'synthetic', recoveryCode: code}, rawRequest: {ip}};
      const results = await Promise.allSettled([
        context.exports.recoverMfaWithCode(request), context.exports.recoverMfaWithCode(request),
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter(result => result.status === 'rejected').length, 1);
      assert.ok(['permission-denied', 'failed-precondition'].includes(results.find(result => result.status === 'rejected').reason.code));
      const final = (await recoveryRef.get()).data();
      assert.deepEqual(final.codeHashes, []);
      assert.equal(final.remaining, 0);
      assert.equal(final.recoveryPendingCodeHash, undefined);
      assert.equal(final.recoveryPendingAt, undefined);
      assert.equal(final.recoveryPendingExpiresAt, undefined);
      assert.ok(updates >= 1 && updates <= 2);
    } finally {
      await db.terminate();
      await deleteApp(app);
    }
  });
