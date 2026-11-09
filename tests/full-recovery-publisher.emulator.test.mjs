import test, {before, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {existsSync, readFileSync} from 'node:fs';
// No client bundle or cryptographic fixture values in failure stacks.
Error.stackTraceLimit = 0;
const root = resolve(import.meta.dirname, '..');
const dependencyRoot = process.env.FULL_RECOVERY_DEPENDENCY_ROOT || root;
const require = createRequire(resolve(root, 'functions/package.json'));
const dependencyRequire = createRequire(resolve(dependencyRoot, 'functions/package.json'));
const {initializeApp, deleteApp} = dependencyRequire('firebase-admin/app');
const {getFirestore, Timestamp} = dependencyRequire('firebase-admin/firestore');
const {getStorage} = dependencyRequire('firebase-admin/storage');
const {build} = createRequire(resolve(dependencyRoot, 'package.json'))('esbuild');
const {initializeTestEnvironment} = createRequire(resolve(dependencyRoot, 'package.json'))('@firebase/rules-unit-testing');
const {getBytes, ref: storageRef, deleteObject, uploadBytes} = createRequire(resolve(dependencyRoot, 'package.json'))('firebase/storage');
const firestoreSdk = createRequire(resolve(dependencyRoot, 'package.json'))('firebase/firestore');
const {createFullRecoveryRuntime, planRef, makeBinding} = require('../functions/full-recovery-runtime.js');
const {createLocalFullRecoveryAdapter} = require('../functions/full-recovery-adapter.js');
const {createFullRecoveryCallable} = require('../functions/full-recovery-callable.js');
const {digest, PART_BYTES, RESUME_MS, validateContent, destinationPath} = require('../functions/full-recovery-model.js');
const {assetDestination} = require('../functions/full-recovery-runtime.js');
const {fencedUserWrite} = dependencyRequire('./archive-purge-global-lock.js');
const {generationFile} = require('../functions/backup-attachment-stage.js');
const {isSafeAttachmentPath} = require('../functions/archive-purge-service.js');
const projectId = 'demo-full-recovery-publisher';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST || '') || process.env.GCLOUD_PROJECT !== projectId) throw new Error('Explicit demo emulator environment required');
const app = initializeApp({projectId, storageBucket: `${projectId}.appspot.com`}, `full-recovery-${process.pid}`);
const db = getFirestore(app), bucket = getStorage(app).bucket();
const uid = 'synthetic-publisher-owner', now = Date.now();
const types = {timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds), bytes: value => Buffer.from(value), now: () => Timestamp.fromMillis(now)};
const apiRoot = existsSync(resolve(root, 'Frontend/public/assets/js/modules/settings/full-recovery-service.js')) ? root : dependencyRoot;
let api, rulesEnvironment;
before(async () => {
  const code = await build({stdin: {contents: `export * from './settings/complete-recovery-client.js'; export * from './settings/full-recovery-service.js'; export * from './settings/full-recovery-model.js'; export * from './settings/backup-export-model.js'; export * from './core/crypto-utils.js'; export * from './core/password-policy.js'; export * from './core/sharing-identity.js'; export * from './shared/attachment-security.js'; export * from './shared/chunked-attachment-security.js'; export * from './shared/contact-card-model.js';`, resolveDir: resolve(apiRoot, 'Frontend/public/assets/js/modules'), loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false});
  api = await import(`data:text/javascript;base64,${Buffer.from(code.outputFiles[0].text).toString('base64')}`);
  rulesEnvironment = await initializeTestEnvironment({projectId, firestore: {rules: readFileSync(resolve(dependencyRoot, 'firestore.rules'), 'utf8')}, storage: {rules: readFileSync(resolve(dependencyRoot, 'storage.rules'), 'utf8')}});
});
beforeEach(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {method: 'DELETE'});
  assert.equal(response.status, 200);
  await bucket.deleteFiles({force: true});
});
after(async () => { await rulesEnvironment?.cleanup(); await deleteApp(app); });
const runtime = (hooks = {}, clock = () => now) => createFullRecoveryRuntime({db, bucket, types, clock, hooks});
const request = data => ({auth: {uid, token: {email_verified: true, auth_time: Math.floor(now / 1000)}}, app: {appId: 'synthetic-emulator-app'}, data});
function callable(service, clock = () => now) { return createFullRecoveryCallable({clock, localAdapter: createLocalFullRecoveryAdapter({runtime: service, localTestOnly: true, projectId, firestoreHost: process.env.FIRESTORE_EMULATOR_HOST, storageHost: process.env.FIREBASE_STORAGE_EMULATOR_HOST})}); }
async function legacySeal(value, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), clear = new TextEncoder().encode(value);
  const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, source, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  try { return Buffer.concat([salt, iv, new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, clear))]).toString('base64'); }
  finally { clear.fill(0); }
}
async function fixture({keyring = false, assets = true, identity = true, large = false, avatarMime = 'image/png', legacyNames = false, lifecycle = false} = {}) {
  const oldMaster = api.generateSecurePassword(24), newMaster = api.generateSecurePassword(26), primary = api.generateVaultKey();
  const material = keyring ? `CPVK2:${Buffer.from(JSON.stringify({primaryKey: primary, legacyKey: 'CPVKsynthetic-old-password'}, null, 2)).toString('base64')}` : primary;
  const security = {vaultKeyEnvelope: await api.wrapVaultKey(material, oldMaster, keyring ? 'random-with-legacy-fallback' : 'random'), verifier: await api.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', oldMaster)};
  const pair = identity ? await api.createSharingIdentity({uid, vaultKeyMaterial: material}) : {publicIdentity: null, privateEnvelope: null};
  const owned = path => `https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=obsolete-synthetic-token`;
  const records = [{kind: 'record', scope: 'profile', id: uid, data: {nome: 'Synthetic recovered', email: 'backup@example.invalid', language: 'it', theme: 'dark', documenti: [{id: 'document-one'}], settings_biometric: {enabled: true}}},
    {kind: 'record', scope: 'private-account', id: 'account-one', data: {nomeAccount: 'Synthetic account', value: await api.encrypt('synthetic-secret-content', material), ...(keyring ? {legacyValue: await legacySeal('synthetic-legacy-value', 'CPVKsynthetic-old-password')} : {}), sharedWith: {obsolete: true}, sharedWithUids: ['obsolete'], acceptedCount: 1, visibility: 'shared', website: 'www.example.invalid', url: 'www.example.invalid/account', externalMedia: 'https://firebasestorage.googleapis.com/v0/b/other-synthetic-bucket/o/users%2Fexternal-owner%2Fphoto.png?alt=media&token=synthetic-external-token', date: {$type: 'date', value: '2026-01-01T00:00:00.123Z'}, nested: {dates: [{$type: 'date', value: '2000-01-01T00:00:00.456Z'}], bytes: {$type: 'bytes', value: [0, 128, 255]}}, timestamp: {$type: 'timestamp', seconds: 1234, nanoseconds: 123000}}},
    {kind: 'record', scope: 'deadline', id: 'deadline-one', data: {recipients: ['obsolete@example.invalid'], emails: ['obsolete@example.invalid'], notif_email: true, at: {$type: 'timestamp', seconds: 1234, nanoseconds: 123000}}}];
  const profileAttachments = [], blobs = new Map();
  if (assets) {
    const avatarPath = `users/${uid}/avatar_123.${avatarMime.slice(6)}`;
    let image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (avatarMime !== 'image/png') { image = Buffer.alloc(24); image.writeUInt32BE(24, 0); image.write('ftyp', 4); image.write('heic', 8); image.write('mif1', 16); image.write('heic', 20); }
    records[0].data.photoURL = owned(avatarPath); blobs.set(avatarPath, {bytes: image, contentType: avatarMime, generation: '90071992547409931234'});
    const file = await api.encryptAttachmentFile(new File(['synthetic attachment'], 'synthetic.txt', {type: 'text/plain'}), material);
    const path = `users/${uid}/accounts/account-one/file-one`;
    records.push({kind: 'record', scope: 'private-account-attachment', id: 'file-one', accountId: 'account-one', data: {storagePath: path, url: owned(path), encryption: file.metadata}});
    blobs.set(path, {bytes: new Uint8Array(await file.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '33'});
    const profileFile = await api.encryptAttachmentFile(new File(['synthetic profile document'], 'synthetic.pdf', {type: 'application/pdf'}), material);
    const profilePath = `users/${uid}/profile-documents/document-one/attachments/profile-file`, profileBytes = new Uint8Array(await profileFile.blob.arrayBuffer());
    profileAttachments.push({id: 'profile-file', ownerId: uid, documentId: 'document-one', storagePath: profilePath, status: 'ready', schemaVersion: 1, size: profileFile.metadata.originalSize, mimeType: 'application/pdf', encryption: profileFile.metadata, encryptedName: legacyNames ? await legacySeal('synthetic.pdf', 'CPVKsynthetic-old-password') : await api.encrypt('synthetic.pdf', material), digest: await api.recoveryDigest(profileBytes), generation: '90071992547409931235'});
    blobs.set(profilePath, {bytes: profileBytes, contentType: 'application/octet-stream', generation: '90071992547409931235', encrypted: 'v1'});
    if (large) {
      const bytes = new Uint8Array(PART_BYTES + 113).fill(7), big = await api.encryptAttachmentFile(new File([bytes], 'synthetic.bin', {type: 'application/pdf'}), material), bigPath = `users/${uid}/accounts/account-one/big-file`;
      records.push({kind: 'record', scope: 'private-account-attachment', id: 'big-file', accountId: 'account-one', data: {storagePath: bigPath, url: owned(bigPath), encryption: big.metadata}});
      blobs.set(bigPath, {bytes: new Uint8Array(await big.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '44'}); bytes.fill(0);
    }
    const chunked = await api.encryptAttachmentFileInChunks(new File(['synthetic video blocks'], 'synthetic.mp4', {type: 'video/mp4'}), material, {binding: 'synthetic-chunk-binding', chunkSize: 8, onChunk: async chunk => {
      const chunkPath = `users/${uid}/accounts/account-one/video/chunk-${chunk.index}`;
      blobs.set(chunkPath, {bytes: new Uint8Array(await chunk.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: String(60 + chunk.index)});
      return {storagePath: chunkPath, url: owned(chunkPath)};
    }});
    records.push({kind: 'record', scope: 'private-account-attachment', id: 'video-file', accountId: 'account-one', data: {chunks: chunked.chunks, encryption: chunked.metadata}});
    if (lifecycle) {
      const companyFile = await api.encryptAttachmentFile(new File(['synthetic company attachment'], 'company.pdf', {type: 'application/pdf'}), material), companyPath = `users/${uid}/aziende_allegati/source%20company.pdf`;
      records.push({kind: 'record', scope: 'company', id: 'company-one', data: {ragioneSociale: 'Synthetic company', allegati: [{name: 'company.pdf', url: owned(companyPath), storagePath: companyPath, type: 'application/pdf', size: companyFile.metadata.originalSize, encryption: companyFile.metadata}]}});
      blobs.set(companyPath, {bytes: new Uint8Array(await companyFile.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '81'});
      const accountFile = await api.encryptAttachmentFile(new File(['synthetic company account'], 'account.pdf', {type: 'application/pdf'}), material), accountPath = `users/${uid}/aziende/company-one/accounts/company-account/attachments/source.bin`;
      records.push({kind: 'record', scope: 'company-account', id: 'company-account', companyId: 'company-one', data: {nomeAccount: 'Synthetic company account', url: 'https://example.invalid/company-account'}});
      records.push({kind: 'record', scope: 'company-account-attachment', id: 'company-file', companyId: 'company-one', accountId: 'company-account', data: {storagePath: accountPath, encryption: accountFile.metadata}});
      blobs.set(accountPath, {bytes: new Uint8Array(await accountFile.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '82'});
      const deadlineFile = await api.encryptAttachmentFile(new File(['synthetic deadline attachment'], 'deadline.pdf', {type: 'application/pdf'}), material), deadlinePath = `users/${uid}/scadenze/deadline-one/source.pdf`;
      records.find(record => record.scope === 'deadline').data.attachments = [{name: 'deadline.pdf', storagePath: deadlinePath, url: owned(deadlinePath), encryption: deadlineFile.metadata}];
      blobs.set(deadlinePath, {bytes: new Uint8Array(await deadlineFile.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '83'});
      const legacyPath = `users/${uid}/scadenze/legacy-deadline/source.pdf`;
      records.push({kind: 'record', scope: 'deadline', id: 'legacy-deadline', data: {attachments: [{name: 'legacy.pdf', url: owned(legacyPath)}]}});
      blobs.set(legacyPath, {bytes: new TextEncoder().encode('%PDF-1.7 synthetic legacy URL attachment'), contentType: 'application/pdf', generation: '84'});
      records.push({kind: 'record', scope: 'deadline', id: 'profile-linked-deadline', data: {sourceRef: {type: 'profileDocument', id: 'document-one', fieldId: 'document.expiry_date'}, sourceType: 'profileDocument', sourceDocumentId: 'document-one', attachments: [{name: 'synthetic.pdf', storagePath: profilePath, type: 'application/pdf', size: profileFile.metadata.originalSize, encryption: profileFile.metadata, linkedSource: {type: 'profileDocumentAttachment', id: 'profile-file'}}]}});
    }
  }
  const lines = [];
  const exported = await api.writeCompleteRecoveryBackup({uid, collectRecords: async () => records, readSecurity: async () => security, promptMasterPassword: async () => oldMaster, readIdentity: async () => pair, listProfileAttachments: async () => profileAttachments, readAsset: async path => ({...blobs.get(path), size: blobs.get(path).bytes.length, bytes: new Uint8Array(blobs.get(path).bytes)}), writeLine: async line => lines.push(line)});
  const plan = await api.prepareCompleteRecovery(new Blob(lines), uid, exported.recoveryKey, {getCurrentUid: () => uid});
  const content = api.createRecoveryContentPayload(plan), finalize = await api.createFinalizePayload(plan, newMaster), staged = [];
  await api.visitRecoveryAssets(plan, async (metadata, bytes) => staged.push({metadata, bytes: Buffer.from(bytes)}));
  api.releaseCompleteRecovery(plan);
  return {content, finalize, staged, newMaster,
    openPlan: () => api.prepareCompleteRecovery(new Blob(lines), uid, exported.recoveryKey, {getCurrentUid: () => uid})};
}
async function stage(service, f, operationId = 'synthetic-operation') {
  for (let assetIndex = 0; assetIndex < f.staged.length; assetIndex++) {
    const bytes = f.staged[assetIndex].bytes;
    for (let offset = 0; offset < bytes.length; offset += PART_BYTES) await service.uploadPart(uid, {operationId, content: f.content, assetIndex, partIndex: offset / PART_BYTES}, bytes.subarray(offset, offset + PART_BYTES));
    await service.finishAsset(uid, {operationId, content: f.content, assetIndex});
  }
}
function reseal(content) { const value = structuredClone(content); delete value.contentDigest; return {...value, contentDigest: digest(value)}; }
function currentPurgeCallable() {
  const source = readFileSync(resolve(dependencyRoot, 'functions/index.js'), 'utf8');
  const owner = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
  const body = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));
  assert.ok(owner.length && body.length);
  const {HttpsError} = dependencyRequire('firebase-functions/v2/https'), {FieldValue} = dependencyRequire('firebase-admin/firestore');
  const deps = {exports: {}, HttpsError, FieldValue, console: {log() {}, warn() {}, error() {}}, ...dependencyRequire('./archive-purge-service.js'), ...dependencyRequire('./archive-purge-receipt.js'), ...dependencyRequire('./archive-purge-global-lock.js'),
    assertTransactionVaultRecoveryUnlocked: require('../functions/vault-recovery-fence.js').assertTransactionVaultRecoveryUnlocked,
    isMaturityTestActor: () => false, onCall: (_options, run) => run, getFirestore: () => db, getStorage: () => ({bucket: () => bucket})};
  return new Function(...Object.keys(deps), `${owner}\n${body}\nreturn exports.purgeArchivedAccount;`)(...Object.values(deps));
}
function currentDeadlineDeletion(clientDb, clientStorage) {
  const source = readFileSync(resolve(dependencyRoot, 'Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js'), 'utf8'), start = source.indexOf('async function deleteScadenza('), end = source.indexOf('\nfunction clearDeadline(', start);
  assert.ok(start >= 0 && end > start);
  const deps = {confirmFrameAction: async () => undefined, db: clientDb, storage: clientStorage, doc: firestoreSdk.doc, deleteDoc: firestoreSdk.deleteDoc, runTransaction: firestoreSdk.runTransaction, deleteObject, ref: storageRef};
  return new Function(...Object.keys(deps), `${source.slice(start, end)}\nreturn deleteScadenza;`)(...Object.values(deps));
}
test('actual Phase A random payload publishes fresh URLs, canonical profile metadata, authority and released fence', async () => {
  const f = await fixture({large: true}), service = runtime(), handler = callable(service), operationId = 'synthetic-operation';
  assert.doesNotThrow(() => validateContent(f.content, uid));
  await db.doc(`users/${uid}`).set({email: 'current@example.invalid', nome: 'Utente', cognome: 'Ripristinato', createdAt: Timestamp.fromMillis(now), photoURL: 'https://example.invalid/current-auth-photo.png', recreatedAfterDeletion: true, passwordPolicyVersion: 7, language: 'en', theme: 'light'});
  await handler(request({action: 'prepare', operationId, content: f.content}));
  const plan = (await planRef(db, uid, operationId).get()).data(), serialized = JSON.stringify(plan);
  for (const forbidden of ['synthetic-secret-content', 'Synthetic recovered', 'vaultKeyEnvelope', 'privateEnvelope', 'records', 'bytes', 'obsolete-synthetic-token']) assert.equal(serialized.includes(forbidden), false);
  await stage(service, f, operationId);
  await handler(request({action: 'publishChunk', operationId, content: f.content, chunkIndex: 0}));
  assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
  const result = await handler(request({action: 'finalize', operationId, content: f.content, finalize: f.finalize})); assert.equal(result.status, 'complete');
  const profile = (await db.doc(`users/${uid}`).get()).data(), account = (await db.doc(`users/${uid}/accounts/account-one`).get()).data();
  assert.equal(profile.email, 'current@example.invalid'); assert.equal(profile.passwordPolicyVersion, 7); assert.equal(profile.language, 'en'); assert.equal(profile.theme, 'light'); assert.equal(profile.settings_biometric, undefined);
  assert.equal(profile.photoURL.includes('obsolete-synthetic-token'), false); assert.equal(account.website, 'www.example.invalid'); assert.equal(account.url, 'www.example.invalid/account'); assert.equal(account.externalMedia.includes('synthetic-external-token'), true); assert.deepEqual(account.sharedWithUids, []);
  assert.equal(account.date.seconds, 1767225600); assert.equal(account.date.nanoseconds, 123000000); assert.equal(account.nested.dates[0].nanoseconds, 456000000); assert.deepEqual([...account.nested.bytes], [0, 128, 255]); assert.equal(account.timestamp.nanoseconds, 123000);
  const avatarPath = decodeURIComponent(new URL(profile.photoURL).pathname.split('/o/')[1]); assert.equal(avatarPath.startsWith(`users/${uid}/avatar_recovery_`), true);
  // QR validates the production URL shape; emulator bucket substitution is local.
  assert.doesNotThrow(() => api.validatePhotoURL(profile.photoURL.replace(encodeURIComponent(bucket.name), api.RECOVERY_BUCKET)));
  assert.equal(avatarPath.startsWith(`users/${uid}/avatar_`), true);
  const deadline = (await db.doc(`users/${uid}/scadenze/deadline-one`).get()).data(); assert.deepEqual(deadline.recipients, []); assert.equal(deadline.notif_email, undefined); assert.equal(deadline.at.nanoseconds, 123000);
  const restoredSecurity = (await db.doc(`users/${uid}/settings/security`).get()).data();
  assert.equal(await api.verifyVaultVerifier(restoredSecurity.verifier, 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', f.newMaster), true);
  let material = await api.unwrapVaultKey(restoredSecurity.vaultKeyEnvelope, f.newMaster); assert.equal(await api.decryptRequiredValue(account.value, material), 'synthetic-secret-content'); material = '';
  const attachment = (await db.doc(`users/${uid}/profileDocumentAttachments/profile-file`).get()).data();
  assert.equal(attachment.storagePath, `users/${uid}/profile-documents/document-one/attachments/profile-file`); assert.notEqual(attachment.generation, '90071992547409931235'); assert.equal(typeof attachment.generation, 'string');
  const [metadata] = await bucket.file(attachment.storagePath).getMetadata(); assert.equal(attachment.generation, metadata.generation); assert.equal(metadata.contentType, 'application/octet-stream'); assert.equal(metadata.metadata.encrypted, 'v1');
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released'); assert.equal((await db.doc(`cryptoPublicKeys/${uid}`).get()).exists, true);
  assert.equal((await handler(request({action: 'finalize', operationId, content: f.content, finalize: f.finalize}))).duplicate, true);
  const resumed = await service.prepare(uid, {operationId, content: f.content}); assert.equal(resumed.status, 'complete'); assert.equal(await api.verifyVaultVerifier(resumed.security.verifier, 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', f.newMaster), true);
  const replay = structuredClone(f.finalize); replay.sourceSecurityBinding = 'b'.repeat(64); await assert.rejects(handler(request({action: 'finalize', operationId, content: f.content, finalize: replay})), /FINALIZE_REPLAY/);
  for (let assetIndex = 0; assetIndex < f.content.assets.length; assetIndex++) await service.cleanupParts(uid, {operationId, content: f.content, assetIndex});
  const [files] = await bucket.getFiles({prefix: `users/${uid}/`}); assert.equal(files.some(file => file.name.includes('/parts/')), false);
  // A recovered Vault must itself produce another complete recovery file.
  const restoredRecords = [];
  for (const record of f.content.records.filter(item => item.scope !== 'profile-document-attachment')) restoredRecords.push({...record, data: api.encodeFirestoreValue((await db.doc(destinationPath(record, uid)).get()).data())});
  const profileDocs = await db.collection(`users/${uid}/profileDocumentAttachments`).get(), lines = [];
  const exported = await api.writeCompleteRecoveryBackup({uid, bucket: bucket.name, collectRecords: async () => restoredRecords, readSecurity: async () => restoredSecurity, promptMasterPassword: async () => f.newMaster,
    readIdentity: async () => ({publicIdentity: (await db.doc(`cryptoPublicKeys/${uid}`).get()).data(), privateEnvelope: (await db.doc(`users/${uid}/cryptoIdentity/current`).get()).data()}),
    listProfileAttachments: async () => profileDocs.docs.map(doc => ({id: doc.id, ...doc.data()})), readAsset: async path => { const [m] = await bucket.file(path).getMetadata(), [bytes] = await generationFile(bucket, path, m.generation).download(); return {bytes, size: bytes.length, generation: m.generation, contentType: m.contentType, encrypted: m.metadata?.encrypted}; }, writeLine: async line => lines.push(line)});
  const nextPlan = await api.prepareCompleteRecovery(new Blob(lines), uid, exported.recoveryKey, {getCurrentUid: () => uid, bucket: bucket.name});
  assert.doesNotThrow(() => validateContent(api.createRecoveryContentPayload(nextPlan), uid)); api.releaseCompleteRecovery(nextPlan);
});
test('actual Phase A CPVK2 legacy fallback payload remains rewrapped and identity absent', async () => {
  const f = await fixture({keyring: true, identity: false, assets: false}), service = runtime(), operationId = 'keyring-operation';
  await service.prepare(uid, {operationId, content: f.content}); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}); await service.finalize(uid, {operationId, content: f.content, finalize: f.finalize});
  const security = (await db.doc(`users/${uid}/settings/security`).get()).data(); let material = await api.unwrapVaultKey(security.vaultKeyEnvelope, f.newMaster);
  assert.equal(material.startsWith('CPVK2:'), true); assert.equal(security.vaultKeyEnvelope.keyOrigin, 'random-with-legacy-fallback'); assert.equal(await api.decryptRequiredValue((await db.doc(`users/${uid}/accounts/account-one`).get()).data().legacyValue, material), 'synthetic-legacy-value'); material = '';
  assert.equal((await db.doc(`users/${uid}/cryptoIdentity/current`).get()).exists, false);
});
test('missing root cannot conceal orphan descendants, blobs or public/private identity', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'empty-target-operation', service = runtime();
  for (const path of [`users/${uid}/unknown/missing/children/orphan`, `users/${uid}/cryptoIdentity/current`, `cryptoPublicKeys/${uid}`]) {
    await db.doc(path).set({synthetic: true}); await assert.rejects(service.prepare(uid, {operationId, content: f.content}), /NONEMPTY|IDENTITY_PRESENT/); await db.doc(path).delete();
  }
  await bucket.file(`users/${uid}/unknown-blob`).save(Buffer.from('synthetic')); await assert.rejects(service.prepare(uid, {operationId, content: f.content}), /STORAGE_NONEMPTY/);
  assert.equal((await planRef(db, uid, operationId).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).exists, false);
});
test('interrupted fence, immutable staging and chunk responses resume without replacing objects', async () => {
  const f = await fixture({identity: false}), operationId = 'interrupted-operation';
  let stopFence = true, stopAsset = true, stopChunk = true;
  const service = runtime({afterFence: async () => { if (stopFence) { stopFence = false; throw new Error('SYNTHETIC_FENCE_INTERRUPTION'); } }, afterAssetWrite: async () => { if (stopAsset) { stopAsset = false; throw new Error('SYNTHETIC_ASSET_INTERRUPTION'); } }, afterChunkWrite: async () => { if (stopChunk) { stopChunk = false; throw new Error('SYNTHETIC_CHUNK_RESPONSE_LOST'); } }});
  await assert.rejects(service.prepare(uid, {operationId, content: f.content}), /FENCE_INTERRUPTION/); await runtime().prepare(uid, {operationId, content: f.content});
  const first = f.staged[0].bytes; await service.uploadPart(uid, {operationId, content: f.content, assetIndex: 0, partIndex: 0}, first);
  await assert.rejects(service.finishAsset(uid, {operationId, content: f.content, assetIndex: 0}), /ASSET_INTERRUPTION/);
  await stage(runtime(), f, operationId);
  await assert.rejects(service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}), /RESPONSE_LOST/);
  assert.equal((await runtime().publishChunk(uid, {operationId, content: f.content, chunkIndex: 0})).duplicate, true);
  await runtime().finalize(uid, {operationId, content: f.content, finalize: f.finalize});
  assert.equal((await runtime().prepare(uid, {operationId, content: f.content})).status, 'complete');
});
test('different content replay, cross owner paths, untyped URL tokens and corrupt staged bytes fail closed', async () => {
  const f = await fixture({identity: false}), operationId = 'malformed-operation', service = runtime();
  for (const modify of [c => { c.assets[0].storagePath = 'users/another/avatar_123.png'; }, c => { c.assets[0].storagePath = `users/${uid}/accounts/../avatar_123.png`; }, c => { c.assets[0].storagePath = `users/${uid}/unknown/foo`; }, c => { c.records[0].data.photoURL = 'https://firebasestorage.googleapis.com/v0/b/old/o/source?token=old'; }, c => { c.records.push({kind: 'record', scope: 'settings', id: 'security', data: {}}); }]) {
    const c = structuredClone(f.content); modify(c); await assert.rejects(service.prepare(uid, {operationId, content: reseal(c)}), /STORAGE_PATH|REFERENCE|OLD_URL|SECURITY/);
  }
  await service.prepare(uid, {operationId, content: f.content}); const changed = structuredClone(f.content); changed.records[0].data.nome = 'changed';
  await assert.rejects(service.prepare(uid, {operationId, content: reseal(changed)}), /PLAN_MISMATCH|FENCE/);
  const bytes = Buffer.from(f.staged[0].bytes); bytes[0] ^= 1; await service.uploadPart(uid, {operationId, content: f.content, assetIndex: 0, partIndex: 0}, bytes); bytes.fill(0);
  await assert.rejects(service.finishAsset(uid, {operationId, content: f.content, assetIndex: 0}), /OBJECT_UNVERIFIED/);
  assert.equal((await db.doc(`users/${uid}`).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('expiry preserves records and fence, then explicit verified repreview resumes and completes', async () => {
  const f = await fixture({identity: false}), operationId = 'expired-operation', service = runtime();
  await service.prepare(uid, {operationId, content: f.content}); await stage(service, f, operationId); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0});
  const expired = runtime({}, () => now + RESUME_MS);
  assert.equal((await expired.prepare(uid, {operationId, content: f.content})).status, 'expired');
  await assert.rejects(expired.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}), /EXPIRED/);
  await assert.rejects(expired.finalize(uid, {operationId, content: f.content, finalize: f.finalize}), /EXPIRED/);
  await assert.rejects(expired.repreview(uid, {operationId, content: f.content}), /CONFIRMATION/);
  assert.equal((await db.doc(`users/${uid}/accounts/account-one`).get()).exists, true); assert.equal((await db.doc(`users/${uid}`).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().digest, makeBinding(uid, operationId, f.content).digest);
  const renewed = await expired.repreview(uid, {operationId, content: f.content, confirmation: 'REPREVIEW_EXPIRED_RECOVERY'}); assert.equal(renewed.status, 'repreviewed'); assert.equal(renewed.expiresAt, now + 2 * RESUME_MS);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active'); assert.equal((await expired.repreview(uid, {operationId, content: f.content, confirmation: 'REPREVIEW_EXPIRED_RECOVERY'})).duplicate, true);
  await expired.finalize(uid, {operationId, content: f.content, finalize: f.finalize}); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released');
});
test('final CAS rejects a changed bootstrap and preserves its current root', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'root-race-operation', service = runtime();
  await db.doc(`users/${uid}`).set({passwordPolicyVersion: 1}); await service.prepare(uid, {operationId, content: f.content}); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0});
  await db.doc(`users/${uid}`).set({passwordPolicyVersion: 2}); await assert.rejects(service.finalize(uid, {operationId, content: f.content, finalize: f.finalize}), /AUTHORITY_CHANGED/);
  assert.equal((await db.doc(`users/${uid}`).get()).data().passwordPolicyVersion, 2); assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('10000-record preparation persists a constant-size plan and sharded chunk count', async () => {
  const f = await fixture({assets: false, identity: false}), content = structuredClone(f.content), operationId = 'max-plan-operation';
  for (let i = content.records.length; i < 10000; i++) content.records.push({kind: 'record', scope: 'private-account', id: `synthetic-${i}`, data: {value: 'synthetic'}});
  const sealed = reseal(content), result = await runtime().prepare(uid, {operationId, content: sealed}), stored = (await planRef(db, uid, operationId).get()).data();
  assert.equal(stored.recordCount, 10000); assert.equal(result.chunkCount, 100); assert.ok(Buffer.byteLength(JSON.stringify(stored)) < 2048);
  assert.equal(stored.records, undefined); assert.equal(stored.assets, undefined);
});
test('asset metadata budgets, MIME, generation evidence and typed references reject before acquiring fence', async () => {
  const f = await fixture({identity: false}), operationId = 'asset-validation-operation';
  const avatar = f.content.assets.findIndex(asset => asset.assetClass === 'raw-media'), profile = f.content.assets.findIndex(asset => asset.assetClass === 'profile-document');
  for (const change of [c => { c.assets[avatar].contentType = 'text/html'; }, c => { c.assets[avatar].size = 32 * 1024 * 1024 + 17; }, c => { c.assets[profile].sourceGeneration = '90071992547409931236'; }, c => { c.assets[avatar].sourceGeneration = 12; }, c => { c.assets[avatar].references[0].fieldPath = ['missing']; }, c => { c.assets[profile].sha256 = 'd'.repeat(64); }]) {
    const content = structuredClone(f.content); change(content); await assert.rejects(runtime().prepare(uid, {operationId, content: reseal(content)}), /ASSET|MIME|REFERENCE|PROFILE/);
  }
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).exists, false);
});
test('final reconciliation rejects an unknown owned blob and never exposes authority', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'late-blob-operation', service = runtime();
  await service.prepare(uid, {operationId, content: f.content}); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}); await bucket.file(`users/${uid}/late-unknown-object`).save(Buffer.from('synthetic'));
  await assert.rejects(service.finalize(uid, {operationId, content: f.content, finalize: f.finalize}), /STORAGE_CHANGED/);
  assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
for (const format of ['heic', 'heif']) test(`actual Phase A ${format} avatar stages with canonical MIME and extension`, async () => {
  const f = await fixture({identity: false, avatarMime: `image/${format}`}), operationId = `image-${format}-operation`, service = runtime();
  await service.prepare(uid, {operationId, content: f.content});
  const assetIndex = f.content.assets.findIndex(asset => asset.assetClass === 'raw-media');
  await service.uploadPart(uid, {operationId, content: f.content, assetIndex, partIndex: 0}, f.staged[assetIndex].bytes); await service.finishAsset(uid, {operationId, content: f.content, assetIndex});
  const [files] = await bucket.getFiles({prefix: `users/${uid}/avatar_recovery_`}); assert.equal(files.length, 1); assert.equal(files[0].name.endsWith(`.${format}`), true);
  const [metadata] = await files[0].getMetadata(); assert.equal(metadata.contentType, `image/${format}`);
});
test('checking-state retry preserves original expiry and final CAS rechecks elapsed server time', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'time-bound-operation'; let currentTime = now, interrupt = true;
  const service = runtime({afterFence: async () => { if (interrupt) { interrupt = false; throw new Error('SYNTHETIC_INTERRUPTION'); } }, beforeFinalize: async () => { currentTime = now + RESUME_MS; }}, () => currentTime);
  await assert.rejects(service.prepare(uid, {operationId, content: f.content}), /SYNTHETIC_INTERRUPTION/);
  currentTime += 60000; const prepared = await service.prepare(uid, {operationId, content: f.content}); assert.equal(prepared.expiresAt, now + RESUME_MS);
  await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}); await assert.rejects(service.finalize(uid, {operationId, content: f.content, finalize: f.finalize}), /PLAN_EXPIRED/);
  assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('explicit repreview rejects altered content, root, authority, orphan, blob and destination changes without renewal', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'repreview-negative-operation', service = runtime();
  await service.prepare(uid, {operationId, content: f.content}); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0});
  const expired = runtime({}, () => now + RESUME_MS), input = {operationId, content: f.content, confirmation: 'REPREVIEW_EXPIRED_RECOVERY'};
  const altered = structuredClone(f.content); altered.records[0].data.nome = 'changed'; await assert.rejects(expired.repreview(uid, {...input, content: reseal(altered)}), /PLAN_MISMATCH/);
  await db.doc(`users/${uid}`).set({passwordPolicyVersion: 1}); await assert.rejects(expired.repreview(uid, input), /ROOT_CHANGED/); await db.doc(`users/${uid}`).delete();
  for (const path of [`users/${uid}/settings/security`, `users/${uid}/cryptoIdentity/current`, `cryptoPublicKeys/${uid}`]) { await db.doc(path).set({synthetic: true}); await assert.rejects(expired.repreview(uid, input), /AUTHORITY_CHANGED/); await db.doc(path).delete(); }
  await db.doc(`users/${uid}/unknown/missing/children/orphan`).set({synthetic: true}); await assert.rejects(expired.repreview(uid, input), /TARGET_CHANGED/); await db.doc(`users/${uid}/unknown/missing/children/orphan`).delete();
  await bucket.file(`users/${uid}/unknown-owned-object`).save(Buffer.from('synthetic')); await assert.rejects(expired.repreview(uid, input), /STORAGE_CHANGED/); await bucket.file(`users/${uid}/unknown-owned-object`).delete();
  const accountRef = db.doc(`users/${uid}/accounts/account-one`), account = (await accountRef.get()).data(); await accountRef.update({nomeAccount: 'altered'}); await assert.rejects(expired.repreview(uid, input), /RECORD_CHANGED/); await accountRef.set(account);
  assert.equal((await planRef(db, uid, operationId).get()).data().expiresAt, now + RESUME_MS); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
  assert.equal((await expired.repreview(uid, input)).status, 'repreviewed'); await expired.finalize(uid, {operationId, content: f.content, finalize: f.finalize});
});
test('explicit repreview detects replacement of a previously verified object generation', async () => {
  const f = await fixture({identity: false}), operationId = 'repreview-generation-operation', service = runtime();
  await service.prepare(uid, {operationId, content: f.content}); await stage(service, f, operationId);
  const [avatars] = await bucket.getFiles({prefix: `users/${uid}/avatar_recovery_`}); const [metadata] = await avatars[0].getMetadata();
  await avatars[0].save(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), {resumable: false, metadata: {contentType: 'image/png', metadata: metadata.metadata}});
  const expired = runtime({}, () => now + RESUME_MS); await assert.rejects(expired.repreview(uid, {operationId, content: f.content, confirmation: 'REPREVIEW_EXPIRED_RECOVERY'}), /ASSET_RECEIPT_INVALID/);
  assert.equal((await planRef(db, uid, operationId).get()).data().expiresAt, now + RESUME_MS); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('actual Phase A legacy encrypted profile filename survives publishing and rewrapping', async () => {
  const f = await fixture({keyring: true, identity: false, legacyNames: true}), operationId = 'legacy-name-operation', service = runtime();
  await service.prepare(uid, {operationId, content: f.content}); await stage(service, f, operationId); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}); await service.finalize(uid, {operationId, content: f.content, finalize: f.finalize});
  const security = (await db.doc(`users/${uid}/settings/security`).get()).data(), attachment = (await db.doc(`users/${uid}/profileDocumentAttachments/profile-file`).get()).data();
  let material = await api.unwrapVaultKey(security.vaultKeyEnvelope, f.newMaster); assert.equal(attachment.encryptedName.startsWith('CPFE2.'), false); assert.equal(await api.decryptRequiredValue(attachment.encryptedName, material), 'synthetic.pdf'); material = '';
});
test('lifecycle reproduces unreadable and undeletable reserved nested destination under actual Rules', async () => {
  const path = `users/${uid}/restoreObjects/${'a'.repeat(64)}/objects/${'b'.repeat(64)}`, storage = rulesEnvironment.authenticatedContext(uid).storage(`gs://${bucket.name}`);
  await bucket.file(path).save(Buffer.from('synthetic'), {resumable: false, metadata: {contentType: 'application/octet-stream', metadata: {encrypted: 'v1'}}});
  assert.equal((await bucket.file(path).exists())[0], true);
  await assert.rejects(getBytes(storageRef(storage, path)), error => error.code === 'storage/unauthorized');
  await assert.rejects(deleteObject(storageRef(storage, path)), error => error.code === 'storage/unauthorized');
  assert.equal(isSafeAttachmentPath(uid, {context: 'private', accountId: 'account-one'}, path), false);
});
test('lifecycle restored assets support current SDK readers, deletion, purge and shared profile deadline aliases', async () => {
  const f = await fixture({identity: false, lifecycle: true}), operationId = 'lifecycle-operation', service = runtime();
  assert.doesNotThrow(() => validateContent(f.content, uid));
  const linkedIndex = f.content.records.findIndex(record => record.id === 'profile-linked-deadline');
  for (const alter of [c => { c.records[linkedIndex].data.attachments[0].linkedSource.id = 'wrong'; }, c => { c.records[linkedIndex].data.sourceRef.id = 'wrong'; }, c => { c.records[linkedIndex].data.sourceDocumentId = 'wrong'; }]) {
    const content = structuredClone(f.content); alter(content); await assert.rejects(service.prepare(uid, {operationId, content: reseal(content)}), /ALIAS_INVALID/);
  }
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).exists, false);
  await service.prepare(uid, {operationId, content: f.content}); await stage(service, f, operationId); await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0});
  const privateAttachmentRef = db.doc(`users/${uid}/accounts/account-one/attachments/file-one`), privateAttachment = (await privateAttachmentRef.get()).data();
  const context = rulesEnvironment.authenticatedContext(uid, {email: 'synthetic@example.invalid', email_verified: true}), storage = context.storage(`gs://${bucket.name}`), clientDb = context.firestore();
  const denied = error => error.code === 'storage/unauthorized';
  await assert.rejects(getBytes(storageRef(storage, privateAttachment.storagePath)), denied); await assert.rejects(deleteObject(storageRef(storage, privateAttachment.storagePath)), denied);
  await assert.rejects(uploadBytes(storageRef(storage, `users/${uid}/accounts/account-one/attachments/old-writer.bin`), new Uint8Array([1]), {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}}), denied);
  await service.finalize(uid, {operationId, content: f.content, finalize: f.finalize});
  const fenceRef = db.doc(`vaultRecoveryLocks/${uid}`), released = (await fenceRef.get()).data();
  await fenceRef.set({...released, digest: '0'.repeat(64)}); await assert.rejects(getBytes(storageRef(storage, privateAttachment.storagePath)), denied); await assert.rejects(deleteObject(storageRef(storage, privateAttachment.storagePath)), denied);
  await fenceRef.delete(); assert.ok((await getBytes(storageRef(storage, privateAttachment.storagePath))).byteLength > 0); await fenceRef.set(released);
  const security = (await db.doc(`users/${uid}/settings/security`).get()).data(); let material = await api.unwrapVaultKey(security.vaultKeyEnvelope, f.newMaster);
  try {
    const privateBytes = await getBytes(storageRef(storage, privateAttachment.storagePath));
    assert.equal(privateAttachment.url.includes('obsolete-synthetic-token'), false);
    assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(privateBytes, privateAttachment.encryption, material)), 'synthetic attachment');
    assert.equal(isSafeAttachmentPath(uid, {context: 'private', accountId: 'account-one'}, privateAttachment.storagePath), true);
    await deleteObject(storageRef(storage, privateAttachment.storagePath)); await firestoreSdk.deleteDoc(firestoreSdk.doc(clientDb, privateAttachmentRef.path));
    const video = (await db.doc(`users/${uid}/accounts/account-one/attachments/video-file`).get()).data(), key = await api.unwrapAttachmentFileKey(video.encryption, material); let text = '';
    try { for (const chunk of video.chunks) { assert.equal(isSafeAttachmentPath(uid, {context: 'private', accountId: 'account-one'}, chunk.storagePath), true); assert.equal(chunk.url.includes('obsolete-synthetic-token'), false); const bytes = await getBytes(storageRef(storage, chunk.storagePath)); text += new TextDecoder().decode(await api.decryptAttachmentChunkBytesWithFileKey(bytes, video.encryption, chunk, key)); } } finally { key.fill(0); }
    assert.equal(text, 'synthetic video blocks'); await deleteObject(storageRef(storage, video.chunks[0].storagePath));
    const companyAttachment = (await db.doc(`users/${uid}/aziende/company-one/accounts/company-account/attachments/company-file`).get()).data();
    assert.equal((await db.doc(`users/${uid}/aziende/company-one/accounts/company-account`).get()).data().url, 'https://example.invalid/company-account');
    assert.equal(isSafeAttachmentPath(uid, {context: 'company', companyId: 'company-one', accountId: 'company-account'}, companyAttachment.storagePath), true);
    assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(await getBytes(storageRef(storage, companyAttachment.storagePath)), companyAttachment.encryption, material)), 'synthetic company account');
    const company = (await db.doc(`users/${uid}/aziende/company-one`).get()).data(), companyAsset = company.allegati[0];
    assert.equal(companyAsset.storagePath.startsWith(`users/${uid}/aziende_allegati/recovery_`), true);
    assert.equal(companyAsset.url.includes('obsolete-synthetic-token'), false);
    assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(await getBytes(storageRef(storage, companyAsset.storagePath)), companyAsset.encryption, material)), 'synthetic company attachment'); await deleteObject(storageRef(storage, companyAsset.storagePath));
    const deadline = (await db.doc(`users/${uid}/scadenze/deadline-one`).get()).data(), deadlineAsset = deadline.attachments[0];
    assert.equal(deadlineAsset.storagePath.startsWith(`users/${uid}/scadenze/deadline-one/recovery_`), true);
    assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(await getBytes(storageRef(storage, deadlineAsset.storagePath)), deadlineAsset.encryption, material)), 'synthetic deadline attachment');
    const deleteDeadline = currentDeadlineDeletion(clientDb, storage); await deleteDeadline(uid, 'deadline-one', deadline.sourceRef, deadline.attachments, () => true);
    assert.equal((await db.doc(`users/${uid}/scadenze/deadline-one`).get()).exists, false); await assert.rejects(getBytes(storageRef(storage, deadlineAsset.storagePath)), error => error.code === 'storage/object-not-found');
    const legacy = (await db.doc(`users/${uid}/scadenze/legacy-deadline`).get()).data(), legacyPath = decodeURIComponent(new URL(legacy.attachments[0].url).pathname.split('/o/')[1]);
    assert.equal(legacyPath.startsWith(`users/${uid}/scadenze/legacy-deadline/recovery_`), true); assert.equal(new TextDecoder().decode(await getBytes(storageRef(storage, legacyPath))), '%PDF-1.7 synthetic legacy URL attachment'); assert.equal(legacy.attachments[0].url.includes('obsolete-synthetic-token'), false);
    const linked = (await db.doc(`users/${uid}/scadenze/profile-linked-deadline`).get()).data(), profileAttachment = (await db.doc(`users/${uid}/profileDocumentAttachments/profile-file`).get()).data();
    assert.equal(linked.attachments[0].storagePath, profileAttachment.storagePath); assert.equal(f.content.assets.filter(asset => asset.storagePath === profileAttachment.storagePath).length, 1);
    await deleteDeadline(uid, 'profile-linked-deadline', linked.sourceRef, linked.attachments, () => true);
    assert.equal((await db.doc(`users/${uid}/scadenze/profile-linked-deadline`).get()).exists, false); assert.equal((await db.doc(`users/${uid}/profileDocumentAttachments/profile-file`).get()).exists, true);
    assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(await getBytes(storageRef(storage, profileAttachment.storagePath)), profileAttachment.encryption, material)), 'synthetic profile document');
    const purge = currentPurgeCallable();
    for (const account of [{context: 'private', accountId: 'account-one', path: `users/${uid}/accounts/account-one`}, {context: 'company', companyId: 'company-one', accountId: 'company-account', path: `users/${uid}/aziende/company-one/accounts/company-account`}]) {
      await db.doc(account.path).update({isArchived: true, revision: 1});
      const result = await purge({auth: {uid}, data: {expectedOwnerUid: uid, operationId: `purge-${account.context}`, context: account.context, accountId: account.accountId, ...(account.companyId ? {companyId: account.companyId} : {}), expectedRevision: 1, confirmation: 'DELETE_FOREVER'}});
      assert.equal(result.status, 'purged'); assert.equal((await db.doc(account.path).get()).exists, false); const [files] = await bucket.getFiles({prefix: `${account.path}/attachments/`}); assert.equal(files.length, 0);
    }
  } finally { material = ''; }
});
function bucketAfterFirstEmptyListing(write) {
  let first = true;
  return new Proxy(bucket, {get(target, key) {
    if (key === 'getFiles') return async options => { const result = await target.getFiles(options); if (first) { first = false; assert.equal(result[0].length, 0); await write(); } return result; };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  }});
}
async function checkingFixture(f, operationId) {
  const service = runtime({afterFence: async () => { throw new Error('SYNTHETIC_CHECK_INTERRUPTION'); }});
  await assert.rejects(service.prepare(uid, {operationId, content: f.content}), /SYNTHETIC_CHECK_INTERRUPTION/);
  const plan = (await planRef(db, uid, operationId).get()).data(); assert.equal(plan.status, 'checking'); return plan;
}
test('actual client coordinator completes the callable protocol and proves stored authority before clearing its locator', async () => {
  const f = await fixture({identity: false}), service = runtime(), handler = callable(service), actions = [], remembered = [], cleared = [];
  const operationId = 'actual-client-complete';
  const result = await api.executeCompleteRecovery(await f.openPlan(), f.newMaster, {
    uid, operationId, confirmation: 'RECOVER_EMPTY_VAULT', getCurrentUid: () => uid,
    rememberOperation: value => remembered.push(structuredClone(value)), clearRememberedOperation: value => cleared.push(structuredClone(value)),
    invoke: data => { actions.push(data.action); return handler(request(data)); }
  });
  assert.equal(result.status, 'complete'); assert.equal(result.cleanupPending, false);
  assert.equal(remembered.length, 1); assert.equal(cleared.length, 1);
  assert.deepEqual(Object.keys(remembered[0]).sort(), ['backupId', 'contentDigest', 'operationId', 'uid']);
  assert.equal(actions.filter(action => action === 'prepare').length, 2);
  assert.equal(actions.filter(action => action === 'cleanupParts').length, f.content.assets.length);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released');
  const stored = (await db.doc(`users/${uid}/settings/security`).get()).data();
  assert.equal(await api.verifyVaultVerifier(stored.verifier, 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', f.newMaster), true);
  const [objects] = await bucket.getFiles({prefix: `users/${uid}/restoreObjects/`}); assert.equal(objects.length, 0);
});
test('actual client coordinator resolves a legitimate pre-fence writer as not-started without starting another operation', async () => {
  const f = await fixture({assets: false, identity: false}), actions = [], cleared = [], competing = {passwordPolicyVersion: 7};
  const proxy = bucketAfterFirstEmptyListing(() => fencedUserWrite(db, [uid], tx => tx.set(db.doc(`users/${uid}`), competing)));
  const service = createFullRecoveryRuntime({db, bucket: proxy, types, clock: () => now}), handler = callable(service), operationId = 'actual-client-abort';
  const result = await api.executeCompleteRecovery(await f.openPlan(), f.newMaster, {
    uid, operationId, confirmation: 'RECOVER_EMPTY_VAULT', getCurrentUid: () => uid,
    rememberOperation() {}, clearRememberedOperation: value => cleared.push(structuredClone(value)),
    invoke: data => { actions.push([data.action, data.operationId]); return handler(request(data)); }
  });
  assert.deepEqual(result, {status: 'not-started', operationId, reason: 'FULL_RECOVERY_ROOT_CHANGED'});
  assert.deepEqual(actions, [['prepare', operationId], ['abortChecking', operationId]]); assert.equal(cleared.length, 1);
  assert.deepEqual((await db.doc(`users/${uid}`).get()).data(), competing);
  assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false);
  await fencedUserWrite(db, [uid], tx => tx.set(db.doc(`users/${uid}/accounts/later-writer`), {nomeAccount: 'Synthetic later writer'}));
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released');
});
for (const kind of ['bootstrap', 'security', 'account', 'storage']) test(`abortChecking releases a failed ${kind} check after a legitimate before-acquire writer`, async () => {
  const f = await fixture({assets: false, identity: false}), operationId = `abort-race-${kind}`; let currentTime = now, committed = false;
  const path = kind === 'bootstrap' ? `users/${uid}` : kind === 'security' ? `users/${uid}/settings/security` : `users/${uid}/accounts/concurrent-account`;
  const competing = kind === 'bootstrap' ? {passwordPolicyVersion: 7} : kind === 'security' ? f.finalize.security : {nomeAccount: 'Synthetic concurrent account', revision: 1};
  const storagePath = `users/${uid}/scadenze/concurrent/source.pdf`, storageBytes = new TextEncoder().encode('%PDF-1.7 synthetic concurrent writer');
  const proxy = bucketAfterFirstEmptyListing(async () => {
    assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).exists, false);
    if (kind === 'storage') await uploadBytes(storageRef(rulesEnvironment.authenticatedContext(uid).storage(`gs://${bucket.name}`), storagePath), storageBytes, {contentType: 'application/pdf'});
    else await fencedUserWrite(db, [uid], tx => tx.set(db.doc(path), competing));
    committed = true;
  });
  const service = createFullRecoveryRuntime({db, bucket: proxy, types, clock: () => currentTime}), handler = callable(service, () => currentTime);
  const invoke = data => handler({...request(data), auth: {uid, token: {email_verified: true, auth_time: Math.floor(currentTime / 1000)}}});
  await assert.rejects(invoke({action: 'prepare', operationId, content: f.content}), kind === 'bootstrap' ? /ROOT_CHANGED/ : kind === 'storage' ? /STORAGE_NONEMPTY/ : /TARGET_NONEMPTY/);
  assert.equal(committed, true);
  const previous = (await planRef(db, uid, operationId).get()).data(); assert.equal(previous.status, 'checking'); assert.equal(previous.verifiedAssets, 0); assert.equal(previous.publishedChunks, 0);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
  await assert.rejects(fencedUserWrite(db, [uid], tx => tx.set(db.doc(`users/${uid}/accounts/blocked-writer`), {nomeAccount: 'Synthetic blocked'})), /RECOVERY_FENCE_ACTIVE/);
  if (kind === 'account') currentTime += RESUME_MS + 1;
  const aborted = await invoke({action: 'abortChecking', operationId, content: f.content});
  assert.equal(aborted.status, 'not-started'); assert.equal(aborted.operationId, operationId); assert.equal(aborted.contentDigest, f.content.contentDigest); assert.match(aborted.abortReceiptDigest, /^[a-f0-9]{64}$/); assert.equal(aborted.duplicate, false);
  const plan = (await planRef(db, uid, operationId).get()).data(); assert.equal(plan.status, 'aborted'); assert.equal(plan.expiresAt, previous.expiresAt); assert.equal(plan.verifiedAssets, 0); assert.equal(plan.publishedChunks, 0);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released');
  if (kind === 'storage') assert.deepEqual(new Uint8Array(await getBytes(storageRef(rulesEnvironment.authenticatedContext(uid).storage(`gs://${bucket.name}`), storagePath))), storageBytes);
  else assert.deepEqual((await db.doc(path).get()).data(), competing);
  assert.equal((await db.doc(`users/${uid}/accounts/account-one`).get()).exists, false);
  await fencedUserWrite(db, [uid], tx => tx.set(db.doc(`users/${uid}/accounts/later-writer`), {nomeAccount: 'Synthetic later writer'})); assert.equal((await db.doc(`users/${uid}/accounts/later-writer`).get()).exists, true);
  assert.equal((await invoke({action: 'prepare', operationId, content: f.content})).status, 'not-started'); assert.equal((await invoke({action: 'abortChecking', operationId, content: f.content})).duplicate, true);
  await assert.rejects(service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}), /OPERATION_ABORTED/); await assert.rejects(service.finalize(uid, {operationId, content: f.content, finalize: f.finalize}), /OPERATION_ABORTED/); await assert.rejects(service.repreview(uid, {operationId, content: f.content, confirmation: 'REPREVIEW_EXPIRED_RECOVERY'}), /OPERATION_ABORTED/);
});
test('abortChecking rejects prepared with zero counters and rejects completed operations', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'abort-prepared-operation', service = runtime(); await service.prepare(uid, {operationId, content: f.content});
  const plan = (await planRef(db, uid, operationId).get()).data(); assert.equal(plan.verifiedAssets, 0); assert.equal(plan.publishedChunks, 0);
  await assert.rejects(service.abortChecking(uid, {operationId, content: f.content}), /ABORT_NOT_CHECKING/); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
  await service.publishChunk(uid, {operationId, content: f.content, chunkIndex: 0}); await service.finalize(uid, {operationId, content: f.content, finalize: f.finalize});
  await assert.rejects(service.abortChecking(uid, {operationId, content: f.content}), /ABORT_NOT_CHECKING/); assert.equal((await planRef(db, uid, operationId).get()).data().status, 'complete');
});
test('abortChecking preserves staged parts when prepared counters are still zero', async () => {
  const f = await fixture({identity: false}), operationId = 'abort-staged-operation', service = runtime(); await service.prepare(uid, {operationId, content: f.content});
  await service.uploadPart(uid, {operationId, content: f.content, assetIndex: 0, partIndex: 0}, f.staged[0].bytes);
  const plan = (await planRef(db, uid, operationId).get()).data(); assert.equal(plan.verifiedAssets, 0); assert.equal(plan.publishedChunks, 0);
  const prefix = `users/${uid}/restoreObjects/${makeBinding(uid, operationId, f.content).digest}/parts/`, [before] = await bucket.getFiles({prefix}); assert.equal(before.length, 1);
  await assert.rejects(service.abortChecking(uid, {operationId, content: f.content}), /ABORT_NOT_CHECKING/);
  assert.equal((await bucket.getFiles({prefix}))[0].length, 1); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
for (const collection of ['assets', 'chunks', 'unknown-receipts']) test(`abortChecking rejects an unexpected ${collection} receipt`, async () => {
  const f = await fixture({assets: false, identity: false}), operationId = `abort-receipt-${collection}`; await checkingFixture(f, operationId);
  const ref = planRef(db, uid, operationId).collection(collection).doc('unexpected'); await ref.set({synthetic: true});
  await assert.rejects(runtime().abortChecking(uid, {operationId, content: f.content}), /ABORT_UNEXPECTED_RECEIPT/); assert.equal((await ref.get()).exists, true); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
for (const kind of ['part', 'final', 'metadata']) test(`abortChecking preserves and rejects an unexpected operation-owned ${kind} object`, async () => {
  const f = await fixture({identity: false}), operationId = `abort-object-${kind}`; await checkingFixture(f, operationId); const binding = makeBinding(uid, operationId, f.content);
  const path = kind === 'part' ? `users/${uid}/restoreObjects/${binding.digest}/parts/unexpected/0` : kind === 'final' ? assetDestination(uid, binding, f.content.assets[0]) : `users/${uid}/scadenze/unknown/metadata-bound.bin`;
  await bucket.file(path).save(Buffer.from('synthetic unexpected operation object'), {resumable: false, metadata: {contentType: 'application/octet-stream', metadata: {encrypted: 'v1', ...(kind === 'metadata' ? {fullRecoveryBinding: binding.digest} : {})}}});
  await assert.rejects(runtime().abortChecking(uid, {operationId, content: f.content}), /ABORT_UNEXPECTED_OBJECT/); assert.equal((await bucket.file(path).exists())[0], true); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('abortChecking rejects changed content and operation bindings', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'abort-binding-operation'; await checkingFixture(f, operationId); const service = runtime(), changed = structuredClone(f.content); changed.records[0].data.nome = 'Changed synthetic profile';
  await assert.rejects(service.abortChecking(uid, {operationId, content: reseal(changed)}), /PLAN_MISMATCH/); await assert.rejects(service.abortChecking(uid, {operationId: 'other-operation', content: f.content}), /PLAN_MISMATCH/);
  assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active'); assert.equal((await service.abortChecking(uid, {operationId, content: f.content})).status, 'not-started');
});
test('abortChecking lost response and exact terminal lookups never replace a later operation', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'abort-lost-response'; await checkingFixture(f, operationId);
  const service = runtime({afterAbortChecking: async () => { throw new Error('SYNTHETIC_ABORT_RESPONSE_LOST'); }}); await assert.rejects(service.abortChecking(uid, {operationId, content: f.content}), /ABORT_RESPONSE_LOST/);
  const lookup = await runtime().prepare(uid, {operationId, content: f.content}); assert.equal(lookup.status, 'not-started'); assert.equal(lookup.duplicate, true);
  const terminal = (await planRef(db, uid, operationId).get()).data(), nextId = 'explicit-next-operation'; await runtime().prepare(uid, {operationId: nextId, content: f.content}); const nextFence = (await db.doc(`vaultRecoveryLocks/${uid}`).get()).data();
  assert.equal((await runtime().prepare(uid, {operationId, content: f.content})).status, 'not-started'); assert.equal((await runtime().abortChecking(uid, {operationId, content: f.content})).duplicate, true); assert.deepEqual((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data(), nextFence);
  await planRef(db, uid, operationId).update({abortReceiptDigest: '0'.repeat(64)}); await assert.rejects(runtime().prepare(uid, {operationId, content: f.content}), /ABORT_RECEIPT_UNVERIFIED/); assert.equal(terminal.status, 'aborted');
});
test('abortChecking loses CAS safely when a competing prepare becomes prepared', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'abort-prepare-wins'; await checkingFixture(f, operationId);
  const service = runtime({beforeAbortChecking: async () => { assert.equal((await runtime().prepare(uid, {operationId, content: f.content})).status, 'prepared'); }});
  await assert.rejects(service.abortChecking(uid, {operationId, content: f.content}), /ABORT_NOT_CHECKING/);
  assert.equal((await planRef(db, uid, operationId).get()).data().status, 'prepared'); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'active');
});
test('abortChecking wins CAS and prevents an in-flight old prepare from resurrecting the operation', async () => {
  const f = await fixture({assets: false, identity: false}), operationId = 'abort-wins-prepare'; let reached, resume;
  const reachedFence = new Promise(resolve => { reached = resolve; }), paused = new Promise(resolve => { resume = resolve; });
  const preparing = runtime({afterFence: async () => { reached(); await paused; }}).prepare(uid, {operationId, content: f.content}); await reachedFence;
  assert.equal((await runtime().abortChecking(uid, {operationId, content: f.content})).status, 'not-started'); resume(); await assert.rejects(preparing, /OPERATION_ABORTED/);
  assert.equal((await planRef(db, uid, operationId).get()).data().status, 'aborted'); assert.equal((await db.doc(`vaultRecoveryLocks/${uid}`).get()).data().status, 'released'); assert.equal((await db.doc(`users/${uid}/settings/security`).get()).exists, false);
});
