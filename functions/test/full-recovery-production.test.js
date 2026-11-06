'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {HttpsError} = require('firebase-functions/v2/https');
const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');
const {digest} = require('../full-recovery-model');
const {createFullRecoveryRuntime} = require('../full-recovery-runtime');
const {createFullRecoveryCallable} = require('../full-recovery-callable');
const {createProductionFullRecoveryAdapter, isProductionFullRecoveryAdapter} = require('../full-recovery-adapter');
const {RECOVERY_TARGET, RECOVERY_PRODUCTION_POLICY, freezeRecoveryPolicy} = require('../full-recovery-policy');
const {createProductionRecoveryCallables, RECOVERY_CALLABLE_OPTIONS, RECOVERY_CLIENT_TIMEOUT_MS} = require('../full-recovery-production');
const {toRecoveryHttpsError} = require('../full-recovery-errors');
const uid = 'qa-recovery-owner', email = 'codex.recovery.owner@example.invalid', now = 1900000000000;
const active = () => ({stage: 'canary', canaryOwners: [{uid, email}]});
const error = code => Object.assign(new Error('provider contained synthetic-private-path'), {code});
function content() {
  const value = {ownerUid: uid, backupId: 'synthetic-backup', profile: 'complete-recovery', manifestDigest: 'a'.repeat(64),
    sourceDigest: Buffer.alloc(32, 1).toString('base64'), records: [{kind: 'record', scope: 'profile', id: uid, data: {}}], assets: [], references: []};
  return {...value, contentDigest: digest(value)};
}
function request(kind = 'restore') {
  return {auth: {uid, token: {email, email_verified: true, auth_time: Math.floor(now / 1000), firebase: {sign_in_provider: 'password'}}},
    app: {appId: RECOVERY_TARGET.appId}, data: kind === 'restore' ? {action: 'prepare', operationId: 'synthetic-operation', content: content()} :
      {action: 'inspect', expectedOwnerUid: uid, storagePath: `users/${uid}/synthetic-file`}};
}
function fixture({policy, target = {}, failure = 'FULL_RECOVERY_TARGET_NONEMPTY'} = {}) {
  const calls = {getDb: 0, getStorage: 0, paths: [], transactions: 0}, options = [];
  const db = {projectId: target.projectId ?? RECOVERY_TARGET.projectId, databaseId: target.databaseId ?? '(default)', _settings: target.settings ?? {},
    doc: path => ({get: async () => { calls.paths.push(path); throw error(failure); }}),
    runTransaction: async () => { calls.transactions++; throw error('RECOVERY_FENCE_ACTIVE'); }};
  const bucket = {name: RECOVERY_TARGET.bucketName, storage: {projectId: target.storageProjectId ?? RECOVERY_TARGET.projectId,
    apiEndpoint: target.storageEndpoint ?? 'https://storage.googleapis.com'}, file: () => ({})};
  const handlers = createProductionRecoveryCallables({onCall: (value, handler) => { options.push(value); return handler; }, HttpsError,
    getFirestore: () => { calls.getDb++; return db; }, getStorage: () => { calls.getStorage++; return {bucket: name => { assert.equal(name, RECOVERY_TARGET.bucketName); return bucket; }}; },
    Timestamp: class {}, FieldValue: {serverTimestamp: () => null}, clock: () => now, ...(policy ? {policy} : {})});
  return {handlers, calls, options, db, bucket};
}
const rejects = (promise, reason) => assert.rejects(promise, value => {
  assert.equal(value instanceof HttpsError, true); assert.deepEqual(value.details, {reason});
  assert.equal(JSON.stringify(value.toJSON()).includes('synthetic-private-path'), false); return true;
});

test('production registration is code-disabled with an empty immutable cohort and no SDK I/O', async () => {
  assert.equal(RECOVERY_PRODUCTION_POLICY.stage, 'disabled'); assert.equal(RECOVERY_PRODUCTION_POLICY.canaryOwners.length, 0);
  assert.equal(Object.isFrozen(RECOVERY_PRODUCTION_POLICY), true);
  const f = fixture();
  await rejects(f.handlers.manageFullVaultRecovery(request()), 'FULL_RECOVERY_DISABLED');
  await rejects(f.handlers.readRecoveryBackupAsset(request('reader')), 'RECOVERY_ASSET_DISABLED');
  assert.deepEqual(f.calls, {getDb: 0, getStorage: 0, paths: [], transactions: 0});
  assert.equal(f.options.length, 2);
  for (const value of f.options) assert.deepEqual(value, {region: 'europe-west1', enforceAppCheck: true,
    memory: '512MiB', concurrency: 1, maxInstances: 1, timeoutSeconds: 120});
  assert.equal(RECOVERY_CLIENT_TIMEOUT_MS, 130000);
  assert.equal(Object.isFrozen(RECOVERY_CALLABLE_OPTIONS), true);
});
test('authentication, signed owner, exact App ID and recent authentication reject before SDK construction', async () => {
  for (const kind of ['restore', 'reader']) {
    const prefix = kind === 'restore' ? 'FULL_RECOVERY' : 'RECOVERY_ASSET';
    for (const [mutate, reason] of [
      [r => { r.auth = null; }, `${prefix}_UNAUTHENTICATED`],
      [r => { r.auth.token.email_verified = false; }, kind === 'restore' ? 'FULL_RECOVERY_EMAIL_UNVERIFIED' : 'RECOVERY_ASSET_VERIFIED_EMAIL_REQUIRED'],
      [r => { r.auth.token.email = ''; }, kind === 'restore' ? 'FULL_RECOVERY_EMAIL_UNVERIFIED' : 'RECOVERY_ASSET_VERIFIED_EMAIL_REQUIRED'],
      [r => { r.app.appId = 'other-app'; }, `${prefix}_APP_CHECK_REQUIRED`],
      [r => { r.auth.token.auth_time -= 301; }, `${prefix}_RECENT_AUTH_REQUIRED`],
      [r => { if (kind === 'restore') r.data.content.ownerUid = 'other'; else r.data.expectedOwnerUid = 'other'; }, `${prefix}_OWNER_MISMATCH`]
    ]) {
      const f = fixture({policy: active()}), r = request(kind); mutate(r);
      await rejects(f.handlers[kind === 'restore' ? 'manageFullVaultRecovery' : 'readRecoveryBackupAsset'](r), reason);
      assert.equal(f.calls.getDb + f.calls.getStorage + f.calls.transactions, 0);
    }
  }
});
test('only a copied exact synthetic UID/email password cohort can reach the pinned service', async () => {
  for (const mutate of [r => { r.auth.uid = 'qa-recovery-other'; r.data.content.ownerUid = r.auth.uid; },
    r => { r.auth.token.email = 'codex.recovery.other@example.invalid'; }, r => { r.auth.token.firebase.sign_in_provider = 'custom'; }]) {
    const f = fixture({policy: active()}), r = request(); mutate(r);
    await rejects(f.handlers.manageFullVaultRecovery(r), 'FULL_RECOVERY_DISABLED'); assert.equal(f.calls.getDb, 0);
  }
  const policy = active(), f = fixture({policy}); policy.canaryOwners[0].uid = 'qa-recovery-replacement'; policy.stage = 'disabled';
  await rejects(f.handlers.manageFullVaultRecovery(request()), 'FULL_RECOVERY_TARGET_NONEMPTY');
  assert.equal(f.calls.getDb, 1); assert.equal(f.calls.getStorage, 1);
  assert.deepEqual(f.calls.paths, [`fullRecoveryOperations/${uid}/items/synthetic-operation`]);
  await rejects(f.handlers.readRecoveryBackupAsset(request('reader')), 'RECOVERY_ASSET_BUSY');
  assert.equal(f.calls.getDb, 1); assert.equal(f.calls.transactions, 1);
});
test('request and environment activation hints cannot change the source policy', async () => {
  const original = process.env.FULL_RECOVERY_ENABLED;
  try {
    process.env.FULL_RECOVERY_ENABLED = 'true';
    const f = fixture(), r = request(); r.data.enabled = true; r.data.policy = active(); r.data.canaryOwners = [{uid, email}];
    await rejects(f.handlers.manageFullVaultRecovery(r), 'FULL_RECOVERY_DISABLED'); assert.equal(f.calls.getDb, 0);
  } finally { if (original === undefined) delete process.env.FULL_RECOVERY_ENABLED; else process.env.FULL_RECOVERY_ENABLED = original; }
  for (const value of [{stage: 'all', canaryOwners: []}, {stage: 'canary', canaryOwners: [{uid: 'existing-qa2', email}]},
    {stage: 'canary', canaryOwners: [{uid, email: 'someone@real.example'}]}, {stage: 'canary', canaryOwners: [{uid, email}, {uid, email}]}]) {
    assert.throws(() => freezeRecoveryPolicy(value), /POLICY_INVALID/);
  }
});
test('mixed, custom, emulator and alternate database targets fail before domain I/O', async () => {
  for (const target of [{projectId: 'other-project'}, {databaseId: 'other-db'}, {settings: {host: '127.0.0.1:8080', ssl: false}},
    {settings: {servicePath: 'other.example'}}, {settings: {port: 80}}, {settings: {ssl: false}},
    {storageEndpoint: 'http://127.0.0.1:9199'}, {storageEndpoint: 'https://storage.googleapis.com.other.example'}, {storageProjectId: 'other-project'}]) {
    const f = fixture({policy: active(), target});
    await rejects(f.handlers.manageFullVaultRecovery(request()), 'FULL_RECOVERY_PRODUCTION_TARGET_MISMATCH');
    assert.deepEqual(f.calls.paths, []); assert.equal(f.calls.transactions, 0);
  }
});
test('actual installed SDK constructors describe the default pinned target without network calls', async () => {
  const db = new Firestore({projectId: RECOVERY_TARGET.projectId}), bucket = new Storage({projectId: RECOVERY_TARGET.projectId}).bucket(RECOVERY_TARGET.bucketName);
  const runtime = createFullRecoveryRuntime({db, bucket, types: {timestamp() {}, bytes() {}, now() {}}});
  const adapter = createProductionFullRecoveryAdapter({runtime, policy: active()});
  assert.equal(isProductionFullRecoveryAdapter(adapter), true); assert.equal(adapter.authorize(request()), true);
  await db.terminate();
});

test('actual SDK apiEndpoint and universeDomain aliases cannot redirect the pinned Firestore target', async () => {
  const bucket = new Storage({projectId: RECOVERY_TARGET.projectId}).bucket(RECOVERY_TARGET.bucketName);
  for (const settings of [{apiEndpoint: 'other.example'}, {universeDomain: 'other.example'}]) {
    const db = new Firestore({projectId: RECOVERY_TARGET.projectId, ...settings});
    try {
      const runtime = createFullRecoveryRuntime({db, bucket, types: {timestamp() {}, bytes() {}, now() {}}});
      assert.throws(() => createProductionFullRecoveryAdapter({runtime, policy: active()}), /PRODUCTION_TARGET_MISMATCH/);
    } finally { await db.terminate(); }
  }
});
test('fake production adapters and oversized bodies cannot reach the runtime', async () => {
  const fake = createFullRecoveryCallable({productionAdapter: {authorize: () => true, runtime: {}}, clock: () => now});
  await assert.rejects(fake(request()), /DISABLED/);
  const f = fixture({policy: active()}), r = request(); r.data.padding = 'x'.repeat(24 * 1024 * 1024);
  await rejects(f.handlers.manageFullVaultRecovery(r), 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
  assert.equal(f.calls.getDb, 0); assert.equal(f.calls.transactions, 0);
});
test('typed reasons survive real HttpsError serialization while provider content is masked', async () => {
  for (const reason of ['FULL_RECOVERY_ROOT_CHANGED', 'FULL_RECOVERY_TARGET_NONEMPTY', 'FULL_RECOVERY_RECENT_AUTH_REQUIRED',
    'FULL_RECOVERY_ABORT_NOT_CHECKING', 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED']) {
    const value = toRecoveryHttpsError(error(reason), 'FULL_RECOVERY', HttpsError);
    assert.deepEqual(value.toJSON().details, {reason}); assert.equal(JSON.stringify(value.toJSON()).includes('synthetic-private-path'), false);
  }
  for (const [code, reason] of [['BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED', 'FULL_RECOVERY_VALUE_INVALID'],
    ['RECOVERY_FENCE_ACTIVE', 'FULL_RECOVERY_BUSY'], ['FULL_RECOVERY_CUSTOM_private', 'FULL_RECOVERY_OPERATION_UNCONFIRMED'],
    ['ENOENT', 'FULL_RECOVERY_OPERATION_UNCONFIRMED']]) {
    assert.deepEqual(toRecoveryHttpsError(error(code), 'FULL_RECOVERY', HttpsError).toJSON().details, {reason});
  }
  const f = fixture({policy: active(), failure: 'private-provider-code'});
  await rejects(f.handlers.manageFullVaultRecovery(request()), 'FULL_RECOVERY_OPERATION_UNCONFIRMED');
});
test('actual index registers both guarded functions and the client timeout exceeds the explicit server deadline', () => {
  const source = readFileSync(require.resolve('../index.js'), 'utf8');
  assert.match(source, /createProductionRecoveryCallables\(\{onCall, HttpsError, getFirestore, getStorage, Timestamp, FieldValue\}\)/);
  for (const name of ['manageFullVaultRecovery', 'readRecoveryBackupAsset']) assert.match(source, new RegExp(`exports\\.${name} = fullRecovery\\.${name}`));
  const client = readFileSync(require.resolve('../../Frontend/public/assets/js/modules/settings/complete-recovery-entry.js'), 'utf8');
  assert.match(client, /httpsCallable\(functions, name, \{timeout: 130000\}\)/);
});
test('every literal full-recovery protocol reason survives the exact public error allowlist', () => {
  for (const file of ['full-recovery-model.js', 'full-recovery-runtime.js', 'full-recovery-callable.js', 'full-recovery-adapter.js']) {
    const source = readFileSync(require.resolve(`../${file}`), 'utf8');
    for (const match of source.matchAll(/['"](FULL_RECOVERY_[A-Z0-9_]+)['"]/g)) {
      const reason = match[1];
      assert.deepEqual(toRecoveryHttpsError(error(reason), 'FULL_RECOVERY', HttpsError).toJSON().details, {reason}, `${file}: ${reason}`);
    }
  }
});
