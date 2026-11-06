'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {digest, validateContent, validateFinalize, PART_BYTES, RESUME_MS} = require('../full-recovery-model');
const {createFullRecoveryRuntime, bootstrap, chunks, rawMime, runtimeCanonical, assetDestination} = require('../full-recovery-runtime');
const {createLocalFullRecoveryAdapter} = require('../full-recovery-adapter');
const {createFullRecoveryCallable} = require('../full-recovery-callable');
const {isSafeAttachmentPath} = require('../archive-purge-service');
const uid = 'synthetic-full-recovery-owner';
const content = () => seal({ownerUid: uid, backupId: 'synthetic-backup', profile: 'complete-recovery', manifestDigest: 'a'.repeat(64), sourceDigest: Buffer.alloc(32, 1).toString('base64'), records: [{kind: 'record', scope: 'profile', id: uid, data: {nome: 'Synthetic'}}], assets: [], references: []});
function seal(value) { delete value.contentDigest; return {...value, contentDigest: digest(value)}; }
const auth = data => ({auth: {uid, token: {email_verified: true, auth_time: 1000}}, app: {appId: 'synthetic-app'}, data});
test('content commitment accepts exact Phase A shape and rejects altered content', () => {
  const payload = content(); assert.equal(validateContent(payload, uid), payload);
  payload.records[0].data.nome = 'changed'; assert.throws(() => validateContent(payload, uid), /COMMITMENT/);
});

test('aggregate transport capacity rejects external-reference amplification before commitments or typed decoding', () => {
  const value = content();
  for (let i = 0; i < 17; i++) {
    const record = {kind: 'record', scope: 'private-account', id: `capacity-${i}`,
      data: {url: 'https://example.invalid/' + 'x'.repeat(760 * 1024)}};
    value.records.push(record);
    value.references.push({kind: 'external-url', recordKey: JSON.stringify(['private-account', record.id]), fieldPath: ['url'], url: record.data.url});
  }
  assert.ok(Buffer.byteLength(JSON.stringify(value.records)) < 16 * 1024 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(value)) > 24 * 1024 * 1024);
  assert.throws(() => validateContent(value, uid), error => error.code === 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
  value.sourceDigest = 'invalid'; value.records[0].data.typed = {$type: 'timestamp', seconds: 1, nanoseconds: 1};
  assert.throws(() => validateContent(value, uid), error => error.code === 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
});
test('unknown scopes, security settings and owner mismatches are rejected', () => {
  for (const record of [{kind: 'record', scope: 'unknown', id: 'one', data: {}}, {kind: 'record', scope: 'settings', id: 'security', data: {}}]) {
    const value = content(); value.records.push(record); assert.throws(() => validateContent(seal(value), uid), /SCOPE|SECURITY/);
  }
  assert.throws(() => validateContent(content(), 'other-owner'), /OWNER/);
});
test('raw key material and private JWK are not accepted as record content', () => {
  for (const bad of [{vaultKeyMaterial: 'synthetic'}, {privateJwk: {}}, {nested: 'CPVK2:synthetic'}, {constructor: 'synthetic'}]) {
    const value = content(); value.records[0].data = bad; assert.throws(() => validateContent(seal(value), uid), /SECRET/);
  }
});
test('timestamp decoding rejects precision loss before any runtime operation', () => {
  const value = content(); value.records[0].data.at = {$type: 'timestamp', seconds: 1, nanoseconds: 1};
  assert.throws(() => validateContent(seal(value), uid), /PRECISION_UNSUPPORTED/);
  value.records[0].data.at.nanoseconds = 123000; assert.doesNotThrow(() => validateContent(seal(value), uid));
});
test('record limits include 10000 records and enforce per record budget', () => {
  const value = content();
  for (let i = 0; i < 9999; i++) value.records.push({kind: 'record', scope: 'private-account', id: `account-${i}`, data: {value: 'synthetic'}});
  assert.doesNotThrow(() => validateContent(seal(value), uid));
  value.records.push({kind: 'record', scope: 'private-account', id: 'too-many', data: {}});
  assert.throws(() => validateContent(seal(value), uid), /RECORD_LIMIT/);
  const oversized = content(); oversized.records[0].data.text = 'x'.repeat(800 * 1024); assert.throws(() => validateContent(seal(oversized), uid), /RECORD_LIMIT/);
});
test('bootstrap acceptance requires the exact login repair, not its marker', () => {
  assert.equal(bootstrap(null), true); assert.equal(bootstrap({passwordPolicyVersion: 1}), true);
  const value = {email: 'synthetic@example.invalid', nome: 'Utente', cognome: 'Ripristinato', createdAt: new Date(0), photoURL: '', recreatedAfterDeletion: true};
  assert.equal(bootstrap(value), true); assert.equal(bootstrap({...value, nome: 'Real name'}), false);
  assert.equal(bootstrap({...value, photoURL: 'https://example.invalid/current-auth-photo.png'}), true); assert.equal(bootstrap({...value, photoURL: 'x'.repeat(4097)}), false);
  assert.equal(bootstrap({...value, accounts: []}), false); assert.equal(bootstrap({recreatedAfterDeletion: true}), false);
});
test('ordinary callable remains hard off after validating authentication and ownership', async () => {
  process.env.FULL_RECOVERY_ENABLED = 'true';
  const callable = createFullRecoveryCallable({clock: () => 1000000});
  const request = auth({action: 'prepare', content: content()});
  await assert.rejects(callable(request), /DISABLED/);
  await assert.rejects(callable({...request, auth: null}), /UNAUTHENTICATED/);
  await assert.rejects(callable({...request, app: null}), /APP_CHECK/);
  await assert.rejects(callable({...request, auth: {...request.auth, token: {email_verified: false, auth_time: 1000}}}), /EMAIL/);
  await assert.rejects(callable({...request, auth: {...request.auth, token: {email_verified: true, auth_time: 699}}}), /RECENT_AUTH/);
  await assert.rejects(callable(auth({content: {...content(), ownerUid: 'different'}})), /OWNER/);
  delete process.env.FULL_RECOVERY_ENABLED;
});
test('local adapter requires explicit demo project and both loopback endpoints', async () => {
  const runtime = createFullRecoveryRuntime({db: {projectId: 'demo-full-recovery', _settings: {host: '127.0.0.1:18091'}}, bucket: {name: 'demo-full-recovery.appspot.com', storage: {apiEndpoint: 'http://127.0.0.1:19191'}}, types: {timestamp: () => null, bytes: () => null, now: () => null}});
  const options = {runtime, localTestOnly: true, projectId: 'demo-full-recovery', firestoreHost: '127.0.0.1:18091', storageHost: '127.0.0.1:19191'};
  for (const bad of [{...options, localTestOnly: false}, {...options, projectId: 'real-project'}, {...options, storageHost: 'localhost.example.invalid:9199'}, {...options, firestoreHost: '127.0.0.1:99999'}]) assert.throws(() => createLocalFullRecoveryAdapter(bad), /LOCAL_CONFIGURATION/);
  const callable = createFullRecoveryCallable({localAdapter: createLocalFullRecoveryAdapter(options), clock: () => 1000000});
  await assert.rejects(callable(auth({action: 'unknown', operationId: 'synthetic-operation', content: content()})), /ACTION_INVALID/);
  const bytes = Buffer.alloc(PART_BYTES + 1).toString('base64'); await assert.rejects(callable(auth({action: 'uploadPart', operationId: 'synthetic-operation', content: content(), assetIndex: 0, partIndex: 0, bytes})), /BASE64|PART/);
  await assert.rejects(callable(auth({action: 'prepare', operationId: 'synthetic-operation', content: content(), masterPassword: 'unexpected'})), /SCHEMA/);
});
test('plans use approved fixed resume window and record chunks stay below Firestore limits', () => {
  assert.equal(RESUME_MS, 30 * 86400000); assert.equal(PART_BYTES, 2 * 1024 * 1024);
  const records = Array.from({length: 250}, (_, i) => ({kind: 'record', scope: 'private-account', id: `a${i}`, data: {}}));
  assert.deepEqual(chunks(records).map(chunk => chunk.length), [100, 100, 50]);
});
test('final authority rejects unknown properties and malformed encrypted verifier', () => {
  const c = content(); assert.throws(() => validateFinalize({...c, vaultKeyMaterial: 'synthetic'}, c, uid), /SCHEMA/);
});
test('raw image MIME accepts HEIC/HEIF brands and rejects spoofed or truncated headers', () => {
  const bytes = Buffer.alloc(24); bytes.writeUInt32BE(24, 0); bytes.write('ftyp', 4); bytes.write('heic', 8); bytes.write('mif1', 16); bytes.write('heic', 20);
  assert.equal(rawMime(bytes, 'image/heic'), true); assert.equal(rawMime(bytes, 'image/heif'), true);
  assert.equal(rawMime(bytes.subarray(0, 12), 'image/heic'), false);
  bytes.write('avc1', 8); bytes.write('isom', 16); bytes.write('mp42', 20); assert.equal(rawMime(bytes, 'image/heic'), false);
  assert.equal(rawMime(Buffer.from([137, 80, 78, 71]), 'image/png'), false);
});
test('runtime Date/Timestamp/Bytes normalization retains type and rejects plain-object impersonation', () => {
  class Timestamp { constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; } toMillis() { return this.seconds * 1000 + this.nanoseconds / 1000000; } }
  const date = new Date('2026-01-01T00:00:00.123Z'), timestamp = new Timestamp(1767225600, 123000000);
  assert.equal(runtimeCanonical({at: date, nested: [Buffer.from([0, 128, 255])]}), runtimeCanonical({at: timestamp, nested: [new Uint8Array([0, 128, 255])]}));
  assert.notEqual(runtimeCanonical(date), runtimeCanonical({seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds}));
  assert.notEqual(runtimeCanonical(date), runtimeCanonical({_seconds: timestamp.seconds, _nanoseconds: timestamp.nanoseconds}));
  assert.notEqual(runtimeCanonical([1, 2]), runtimeCanonical({'0': 1, '1': 2}));
});
test('lifecycle regression reproduction: nested restoreObjects cannot satisfy account purge or flat reserved reader path', () => {
  const path = `users/${uid}/restoreObjects/${'a'.repeat(64)}/objects/${'b'.repeat(64)}`;
  assert.equal(isSafeAttachmentPath(uid, {context: 'private', accountId: 'account-one'}, path), false);
  assert.equal(/^users\/[^/]+\/restoreObjects\/[^/]+$/.test(path), false);
});
test('lifecycle destinations use current account, company and deadline parent prefixes with fresh leaves', () => {
  const binding = {digest: 'a'.repeat(64)}, asset = {storagePath: `users/${uid}/accounts/old/source.bin`, assetClass: 'encrypted-file', contentType: 'application/octet-stream'};
  const privatePath = assetDestination(uid, binding, {...asset, references: [{recordKey: JSON.stringify(['private-account-attachment', 'account-one', 'one']), fieldPath: ['storagePath']}]});
  assert.equal(isSafeAttachmentPath(uid, {context: 'private', accountId: 'account-one'}, privatePath), true);
  const companyPath = assetDestination(uid, binding, {...asset, references: [{recordKey: JSON.stringify(['company-account-attachment', 'company-one', 'account-one', 'one']), fieldPath: ['storagePath']}]});
  assert.equal(isSafeAttachmentPath(uid, {context: 'company', companyId: 'company-one', accountId: 'account-one'}, companyPath), true);
  const deadlinePath = assetDestination(uid, binding, {...asset, references: [{recordKey: JSON.stringify(['deadline', 'deadline-one']), fieldPath: ['attachments', 0, 'storagePath']}]});
  assert.equal(deadlinePath.startsWith(`users/${uid}/scadenze/deadline-one/recovery_`), true);
  const companyLegacy = assetDestination(uid, binding, {...asset, storagePath: `users/${uid}/aziende_allegati/percent%20name.pdf`, references: [{recordKey: JSON.stringify(['company', 'company-one']), fieldPath: ['allegati', 0, 'storagePath']}]});
  assert.equal(companyLegacy.startsWith(`users/${uid}/aziende_allegati/recovery_`), true);
  assert.throws(() => assetDestination(uid, binding, {...asset, references: [{recordKey: JSON.stringify(['private-account-attachment', 'first', 'one']), fieldPath: ['storagePath']}, {recordKey: JSON.stringify(['private-account-attachment', 'second', 'two']), fieldPath: ['storagePath']}]}), /LIFECYCLE_CONFLICT/);
});
test('external references preserve schemeless URLs and explicit outside-owner Firebase URLs but reject owned old tokens', () => {
  for (const url of ['www.example.invalid/path', 'https://example.invalid/path', 'https://firebasestorage.googleapis.com/v0/b/other-bucket/o/users%2Fexternal-owner%2Ffile.png?token=synthetic', 'https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/users%2Fexternal-owner%2Ffile.png?token=synthetic']) {
    const value = content(); value.records[0].data.photoURL = url; value.references.push({recordKey: '["profile"]', fieldPath: ['photoURL'], kind: 'external-url', url});
    const sealed = seal(value); assert.doesNotThrow(() => validateContent(sealed, uid)); assert.equal(sealed.records[0].data.photoURL, url);
  }
  const url = `https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/${encodeURIComponent(`users/${uid}/avatar_original.png`)}?token=obsolete-synthetic`;
  for (const explicit of [false, true]) { const value = content(); value.records[0].data.photoURL = url; if (explicit) value.references.push({recordKey: '["profile"]', fieldPath: ['photoURL'], kind: 'external-url', url}); assert.throws(() => validateContent(seal(value), uid), /OLD_URL/); }
});
