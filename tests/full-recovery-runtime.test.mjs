import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
// Bundled data URLs are intentionally omitted from failure stacks.
Error.stackTraceLimit = 0;

const root = 'Frontend/public/assets/js/modules/';
const compiled = build({stdin: {contents: `
export * from './settings/full-recovery-service.js';
export * from './settings/full-recovery-model.js';
export * from './settings/backup-crypto.js';
export * from './settings/backup-export-model.js';
export * from './core/crypto-utils.js';
export * from './core/password-policy.js';
export * from './core/sharing-identity.js';
export * from './shared/attachment-security.js';
export * from './shared/chunked-attachment-security.js';
`, resolveDir: `${process.cwd()}/${root}`, loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false})
  .then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`));
const uid = 'synthetic-recovery-owner';
const marker = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';
const copy = value => structuredClone(value);
const fileOf = lines => new Blob([lines.join('')], {type: 'application/x-codici-password-backup'});
const ownerOptions = {getCurrentUid: () => uid};

async function fixture({keyring = false, identity = true, assets = true, legacyPrefix = false} = {}) {
  const api = await compiled;
  const oldMaster = api.generateSecurePassword(24), newMaster = api.generateSecurePassword(26);
  const primary = api.generateVaultKey(), legacy = legacyPrefix ? 'CPVK2:valid-Legacy!1234' : api.generateSecurePassword(22);
  // Whitespace in keyring serialization is supported and must survive byte for
  // byte because attachment/identity HKDF uses the complete CPVK2 string.
  const material = keyring ? `CPVK2:${Buffer.from(JSON.stringify({primaryKey: primary, legacyKey: legacy}, null, 2)).toString('base64')}` : primary;
  const keyOrigin = keyring ? 'random-with-legacy-fallback' : 'random';
  const security = {id: 'security', vaultKeyEnvelope: await api.wrapVaultKey(material, oldMaster, keyOrigin),
    verifier: await api.createVaultVerifier(marker, oldMaster)};
  const sharing = identity ? await api.createSharingIdentity({uid, vaultKeyMaterial: material}) : {publicIdentity: null, privateEnvelope: null};
  const values = {v2: await api.encrypt('synthetic-current-field', material)};
  if (keyring) {
    // Runtime's legacy unprefixed field envelope: 100k PBKDF2, salt16/iv12.
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(legacy), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, source, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode('synthetic-legacy-field')));
    values.legacy = Buffer.concat([salt, iv, ciphertext]).toString('base64');
  }
  const records = [
    {kind: 'record', scope: 'profile', id: uid, data: {documenti: [{id: 'document-one'}]}},
    {kind: 'record', scope: 'settings', id: 'security', data: copy(security)},
    {kind: 'record', scope: 'private-account', id: 'account-one', data: {nomeAccount: 'Synthetic account', ...values,
      logo: 'data:image/png;base64,AQID', website: 'https://example.invalid/site'}}
  ];
  const profileAttachments = [], blobs = new Map();
  const ownedUrl = path => `https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=obsolete-synthetic-token`;
  if (assets) {
    const path = `users/${uid}/avatar_123.png`;
    records[0].data.photoURL = ownedUrl(path);
    blobs.set(path, {bytes: new Uint8Array([137,80,78,71]), contentType: 'image/png', generation: '90071992547409931234'});
    const attachment = await api.encryptAttachmentFile(new File(['synthetic attachment content'], 'synthetic.txt', {type: 'text/plain'}), material);
    const attachmentPath = `users/${uid}/accounts/account-one/file-one`;
    records.push({kind: 'record', scope: 'private-account-attachment', id: 'file-one', accountId: 'account-one',
      data: {storagePath: attachmentPath, url: ownedUrl(attachmentPath), encryption: attachment.metadata}});
    blobs.set(attachmentPath, {bytes: new Uint8Array(await attachment.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '12345'});
    const profileFile = await api.encryptAttachmentFile(new File(['synthetic profile document'], 'synthetic.pdf', {type: 'application/pdf'}), material);
    const profilePath = `users/${uid}/profile-documents/document-one/attachments/profile-file`;
    const profileBytes = new Uint8Array(await profileFile.blob.arrayBuffer());
    profileAttachments.push({id: 'profile-file', ownerId: uid, documentId: 'document-one', storagePath: profilePath,
      status: 'ready', schemaVersion: 1, mimeType: 'application/pdf', size: profileFile.metadata.originalSize,
      encryptedName: await api.encrypt('synthetic.pdf', material), encryption: profileFile.metadata,
      digest: await api.recoveryDigest(profileBytes), generation: '90071992547409931235'});
    records.push({kind: 'record', scope: 'deadline', id: 'profile-deadline', data: {
      sourceRef: {type: 'profileDocument', id: 'document-one'}, sourceType: 'profileDocument', sourceDocumentId: 'document-one',
      attachments: [{name: 'synthetic.pdf', storagePath: profilePath, type: 'application/pdf', size: profileFile.metadata.originalSize,
        encryption: copy(profileFile.metadata), linkedSource: {type: 'profileDocumentAttachment', id: 'profile-file'}}]
    }});
    blobs.set(profilePath, {bytes: profileBytes, contentType: 'application/octet-stream', generation: '90071992547409931235'});
    records.push({kind: 'record', scope: 'private-account-attachment', id: 'legacy-file', accountId: 'account-one',
      data: {url: ownedUrl(`users/${uid}/accounts/account-one/legacy-file`)}});
    blobs.set(`users/${uid}/accounts/account-one/legacy-file`, {bytes: new Uint8Array([1,2,3]), contentType: 'text/plain', generation: '456'});
    records.push({kind: 'record', scope: 'private-account-attachment', id: 'external-file', accountId: 'account-one',
      data: {url: 'https://example.invalid/external.pdf'}});
  }
  const lines = [];
  const adapters = {uid, collectRecords: async () => ({records: copy(records)}), readSecurity: async () => copy(security),
    promptMasterPassword: async () => oldMaster, readIdentity: async () => copy(sharing), listProfileAttachments: async () => copy(profileAttachments),
    readAsset: async path => { const blob = blobs.get(path); if (!blob) throw new Error('missing'); return {...blob,
      bytes: blob.bytes.slice(), size: blob.bytes.length, encrypted: path.includes('/profile-documents/') ? 'v1' : undefined}; },
    writeLine: async line => lines.push(line)};
  const exported = await api.writeCompleteRecoveryBackup(adapters);
  return {api, oldMaster, newMaster, material, keyOrigin, security, sharing, records, profileAttachments, blobs, lines, exported, adapters, file: fileOf(lines)};
}

for (const keyring of [false, true]) test(`file + Recovery Key + new Master recover exact ${keyring ? 'CPVK2 plus legacy' : 'random'} material and bytes`, async () => {
  const f = await fixture({keyring, legacyPrefix: keyring});
  const {api} = f;
  assert.equal(f.exported.schemaVersion, 3);
  assert.equal(f.exported.attachmentCount, 4);
  for (const secret of [f.material, f.oldMaster, f.newMaster, f.exported.recoveryKey]) assert.equal(f.lines.join('').includes(secret), false);
  const plan = await api.prepareCompleteRecovery(f.file, uid, f.exported.recoveryKey, ownerOptions);
  assert.equal(JSON.stringify(plan).includes(f.material), false);
  assert.equal(plan.counts.assets, 4);
  assert.equal(plan.counts.externalReferences, 1);
  const content = api.createRecoveryContentPayload(plan);
  assert.equal(content.records.some(record => record.scope === 'settings' && record.id === 'security'), false);
  assert.equal(content.records.filter(record => record.scope === 'profile-document-attachment').length, 1);
  const sharedProfileAsset = content.assets.find(asset => asset.assetClass === 'profile-document');
  assert.equal(sharedProfileAsset.references.some(reference => reference.recordKey === JSON.stringify(['deadline','profile-deadline'])), true);
  assert.equal(content.assets.filter(asset => asset.storagePath === sharedProfileAsset.storagePath).length, 1);
  assert.deepEqual(new Set(content.assets.map(asset => asset.assetClass)), new Set(['encrypted-file', 'raw-file', 'raw-media', 'profile-document']));
  assert.equal(content.assets.find(asset => asset.assetClass === 'raw-media').sourceGeneration, '90071992547409931234');
  assert.equal(content.references.some(ref => ref.kind === 'embedded-data'), true);
  assert.equal(content.records.find(record => record.scope === 'profile').data.photoURL, null);
  assert.equal(JSON.stringify(content).includes('obsolete-synthetic-token'), false);
  const {contentDigest, ...committed} = content;
  assert.equal(await api.digestRecoveryValue(committed), contentDigest);
  const payload = await api.createFinalizePayload(plan, f.newMaster);
  assert.equal(await api.verifyVaultVerifier(payload.security.verifier, marker, f.newMaster), true);
  assert.equal(await api.verifyVaultVerifier(payload.security.verifier, marker, f.oldMaster), false);
  const recovered = await api.unwrapVaultKey(payload.security.vaultKeyEnvelope, f.newMaster);
  assert.equal(recovered, f.material);
  assert.equal(payload.sharingIdentity.publicIdentity.keyId, f.sharing.publicIdentity.keyId);
  assert.equal(payload.contentDigest, contentDigest);
  assert.equal(await api.verifyCompletedRecovery(plan, payload.security, f.newMaster), true);
  assert.equal(await api.verifyCompletedRecovery(plan, payload.security, f.oldMaster), false);
  const unrelatedSecurity = {vaultKeyEnvelope: await api.wrapVaultKey(api.generateVaultKey(), f.newMaster),
    verifier: await api.createVaultVerifier(marker, f.newMaster)};
  assert.equal(await api.verifyCompletedRecovery(plan, unrelatedSecurity, f.newMaster), false);
  const opened = await api.openSharingIdentity({...payload.sharingIdentity, uid, vaultKeyMaterial: recovered});
  assert.equal(opened.keyId, f.sharing.publicIdentity.keyId);
  const account = content.records.find(record => record.scope === 'private-account');
  assert.equal(await api.decrypt(account.data.v2, recovered), 'synthetic-current-field');
  if (keyring) assert.equal(await api.decrypt(account.data.legacy, recovered), 'synthetic-legacy-field');
  const received = new Map();
  await api.visitRecoveryAssets(plan, async (metadata, bytes) => received.set(metadata.storagePath, bytes.slice()));
  for (const [path, source] of f.blobs) assert.deepEqual(received.get(path), source.bytes);
  const attachment = content.records.find(record => record.id === 'file-one');
  assert.equal(new TextDecoder().decode(await api.decryptAttachmentBytes(received.get(attachment.data.storagePath), attachment.data.encryption, recovered)), 'synthetic attachment content');
  for (const secret of [f.material, f.oldMaster, f.newMaster, f.exported.recoveryKey, '"d":']) assert.equal(JSON.stringify(payload).includes(secret), false);
  await assert.rejects(api.createFinalizePayload(plan, 'weak'), /MASTER_POLICY/);
  api.releaseCompleteRecovery(plan);
  assert.throws(() => api.createRecoveryContentPayload(plan), /RELEASED/);
});

async function reseal(f, mutate) {
  const header = JSON.parse(f.lines[0]), key = await f.api.deriveBackupKey(header, f.exported.recoveryKey, uid);
  let previousDigest = ''; const entries = [];
  for (let i = 1; i < f.lines.length; i++) {
    const opened = await f.api.decryptBackupEntry({header, key, expectedSequence: i - 1, previousDigest, envelope: JSON.parse(f.lines[i])});
    previousDigest = opened.digest; entries.push(opened.entry);
  }
  const candidate = mutate(entries, header) || entries;
  const lines = [JSON.stringify(header) + '\n']; previousDigest = '';
  for (let i = 0; i < candidate.length; i++) {
    const encrypted = await f.api.encryptBackupEntry({header, key, sequence: i, previousDigest, entry: candidate[i]});
    previousDigest = encrypted.digest; lines.push(JSON.stringify(encrypted.envelope) + '\n');
  }
  return fileOf(lines);
}

test('authenticated malformed capsules/records/assets/footer and unauthenticated corruption fail closed', async () => {
  const f = await fixture();
  const rejectFile = file => assert.rejects(f.api.prepareCompleteRecovery(file, uid, f.exported.recoveryKey, ownerOptions));
  await assert.rejects(f.api.prepareCompleteRecovery(f.file, 'other-owner', f.exported.recoveryKey, {getCurrentUid: () => 'other-owner'}));
  await assert.rejects(f.api.prepareCompleteRecovery(f.file, uid, f.api.generateRecoveryKey(), ownerOptions));
  await rejectFile(fileOf(f.lines.slice(0, -1)));
  await rejectFile(fileOf([...f.lines, f.lines.at(-1)]));
  await rejectFile(fileOf([f.lines[0], f.lines[2], f.lines[1], ...f.lines.slice(3)]));
  const changed = [...f.lines]; const envelope = JSON.parse(changed[1]); envelope.ciphertext = envelope.ciphertext.replace(/^./, c => c === 'A' ? 'B' : 'A'); changed[1] = JSON.stringify(envelope) + '\n';
  await rejectFile(fileOf(changed));
  const changedHeader = [...f.lines]; const header = JSON.parse(changedHeader[0]); header.createdAt++; changedHeader[0] = JSON.stringify(header) + '\n';
  await rejectFile(fileOf(changedHeader));
  for (const mutate of [
    entries => { entries[0].vaultKeyMaterial = 'unsupported'; },
    entries => { entries.splice(1, 0, copy(entries[0])); },
    entries => { entries.splice(2, 0, copy(entries[1])); },
    entries => { entries[1].scope = 'unknown'; },
    entries => { entries[1] = {kind: 'record', scope: 'settings', id: 'security', data: {}}; },
    entries => { entries.find(entry => entry.kind === 'asset').content = 'AQID'; },
    entries => { entries.find(entry => entry.kind === 'asset').sha256 = '0'.repeat(64); },
    entries => { entries.splice(entries.findIndex(entry => entry.kind === 'asset'), 1); },
    entries => { entries.at(-1).recordCount++; },
    entries => { entries.at(-1).unexpected = true; },
    entries => { entries.at(-1).manifestDigest = '0'.repeat(64); },
    entries => { entries.splice(2, 0, {kind: 'unknown'}); }
  ]) await rejectFile(await reseal(f, mutate));
});

test('source proofs, identity pairing, missing assets and profile attachment invariants are required', async () => {
  const f = await fixture();
  const rejectExport = (overrides, match) => assert.rejects(f.api.writeCompleteRecoveryBackup({...f.adapters, ...overrides, writeLine: async () => {}}), match);
  await rejectExport({readSecurity: async () => null});
  await rejectExport({promptMasterPassword: async () => f.newMaster});
  await rejectExport({readIdentity: async () => ({publicIdentity: f.sharing.publicIdentity, privateEnvelope: null})});
  await rejectExport({readIdentity: async () => undefined}, /IDENTITY_INCOMPLETE/);
  await rejectExport({readIdentity: async () => ({...f.sharing, publicIdentity: {...f.sharing.publicIdentity, uid: 'wrong-owner'}})});
  await rejectExport({readAsset: async () => null});
  let reads = 0;
  await rejectExport({readSecurity: async () => (++reads === 1 ? copy(f.security) : {...copy(f.security), changed: true})});
  for (const mutate of [
    record => { record.status = 'reserved'; }, record => { record.ownerId = 'wrong-owner'; },
    record => { record.documentId = 'orphan'; }, record => { record.generation = 9007199254740992; },
    record => { record.digest = '0'.repeat(64); }, record => { record.storagePath += '/wrong'; },
    record => { record.encryption.originalSize++; }
  ]) {
    const records = copy(f.profileAttachments); mutate(records[0]);
    await rejectExport({listProfileAttachments: async () => records});
  }
  const mismatchedDeadline = copy(f.records);
  mismatchedDeadline.find(record => record.scope === 'deadline').data.attachments[0].linkedSource.id = 'wrong-profile-file';
  await rejectExport({collectRecords: async () => mismatchedDeadline}, /ASSET_CONFLICT/);
  const pair = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
  const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(f.material), 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('CodiciPassword:sharing-identity:v1')}, source, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  const aad = new TextEncoder().encode(`CodiciPassword:sharing-identity:v1:${uid}:${f.sharing.publicIdentity.keyId}`);
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, new TextEncoder().encode(JSON.stringify(privateJwk)));
  const mismatched = {...copy(f.sharing), privateEnvelope: {...copy(f.sharing.privateEnvelope), salt: Buffer.from(salt).toString('base64'), iv: Buffer.from(iv).toString('base64'), ciphertext: Buffer.from(ciphertext).toString('base64')}};
  await rejectExport({readIdentity: async () => mismatched}, /IDENTITY_PAIR_MISMATCH/);
});

test('re-read before asset callbacks and release/lock/owner change erase recovery authority', async () => {
  const f = await fixture({identity: false});
  let current = f.file, owner = uid;
  const mutable = {get size() { return current.size; }, slice: (...args) => current.slice(...args)};
  const plan = await f.api.prepareCompleteRecovery(mutable, uid, f.exported.recoveryKey, {getCurrentUid: () => owner});
  let writes = 0;
  current = await reseal(f, entries => { entries.at(-1).manifestDigest = 'f'.repeat(64); });
  await assert.rejects(f.api.visitRecoveryAssets(plan, async () => { writes++; }));
  assert.equal(writes, 0);
  owner = 'other-owner';
  assert.throws(() => f.api.createRecoveryContentPayload(plan), /SESSION_INVALIDATED/);
  const controller = new AbortController();
  const fresh = await f.api.prepareCompleteRecovery(f.file, uid, f.exported.recoveryKey, {...ownerOptions, signal: controller.signal});
  controller.abort();
  await assert.rejects(f.api.createFinalizePayload(fresh, f.newMaster), /SESSION_INVALIDATED/);
  f.api.releaseCompleteRecovery(plan); f.api.releaseCompleteRecovery(fresh);
});

test('v2 remains default and content/portable collector cannot receive recovery capsules', async () => {
  const api = await compiled;
  const header = api.createBackupHeader(uid), recoveryKey = api.generateRecoveryKey();
  assert.equal(header.schemaVersion, 2); assert.equal(Object.hasOwn(header, 'profile'), false);
  const key = await api.deriveBackupKey(header, recoveryKey, uid);
  const record = await api.encryptBackupEntry({header, key, sequence: 0, entry: {kind: 'record', scope: 'profile', id: uid, data: {}}});
  const footer = await api.encryptBackupEntry({header, key, sequence: 1, previousDigest: record.digest, entry: {kind: 'footer', entryCount: 1}});
  assert.equal((await api.verifyBackupChain({header, key, envelopes: [record.envelope, footer.envelope]})).entries.length, 1);
  await assert.rejects(api.prepareCompleteRecovery(fileOf([header, record.envelope, footer.envelope].map(value => JSON.stringify(value) + '\n')), uid, recoveryKey, ownerOptions), /PROFILE_REQUIRED/);
  const exportSource = await readFile(`${root}settings/backup-export-service.js`, 'utf8');
  const portableSource = await readFile(`${root}settings/portable-archive-service.js`, 'utf8');
  assert.match(portableSource, /collectOwnerBackup\(uid/);
  const collector = exportSource.slice(exportSource.indexOf('export async function collectOwnerBackup'), exportSource.indexOf('async function openSink'));
  assert.doesNotMatch(collector, /recovery|capsule|Identity|ProfileDocument/);
  assert.doesNotMatch(await readFile(`${root}settings/full-recovery-service.js`, 'utf8'), /localStorage|sessionStorage|httpsCallable|setDoc\(/);
});

test('strict owner paths and unambiguous keyring/header schemas reject unsupported source material', async () => {
  const api = await compiled, primary = api.generateVaultKey();
  const duplicate = `CPVK2:${Buffer.from(`{"primaryKey":"${primary}","legacyKey":null,"primaryKey":"${primary}"}`).toString('base64')}`;
  assert.throws(() => api.validateVaultMaterial(duplicate, 'random-with-legacy-fallback'), /KEY_MATERIAL_INVALID/);
  assert.throws(() => api.validateVaultMaterial(primary, 'legacy'), /KEY_ORIGIN_INVALID/);
  assert.throws(() => api.validateVaultMaterial('CPVK1:ambiguous', 'random'));
  const header = api.createBackupHeader(uid, 123, {profile: 'complete-recovery'});
  assert.throws(() => api.validateBackupHeader({...header, unexpected: true}, uid));
  assert.throws(() => api.validateBackupHeader({...header, profile: 'content-only'}, uid));
  assert.throws(() => api.validateBackupHeader({...header, kdf: {...header.kdf, iterations: 100000}}, uid));
  assert.throws(() => api.validateOwnedStoragePath(`users/${uid}/../other`, uid));
  assert.equal(api.ownedStorageUrl(`https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent('users/other/avatar_1')}`, uid), null);
  assert.throws(() => api.validateOwnedStoragePath('users/other/avatar_1', uid));
  assert.equal(api.ownedStorageUrl('https://example.invalid/a.png', uid), null);
});

test('late lock, sink rejection and asset visitor rejection clear every transferred byte buffer', async () => {
  const f = await fixture({identity: false});
  let active = true, sourceBuffer;
  await assert.rejects(f.api.writeCompleteRecoveryBackup({...f.adapters,
    check: () => { if (!active) throw new Error('BACKUP_SESSION_INVALIDATED'); },
    readAsset: async (...args) => { const source = await f.adapters.readAsset(...args); sourceBuffer = source.bytes; active = false; return source; },
    writeLine: async () => {}}), /SESSION_INVALIDATED/);
  assert.equal(sourceBuffer.every(byte => byte === 0), true);
  sourceBuffer = null;
  await assert.rejects(f.api.writeCompleteRecoveryBackup({...f.adapters,
    readAsset: async (...args) => { const source = await f.adapters.readAsset(...args); sourceBuffer = source.bytes; return source; },
    writeLine: async () => { if (sourceBuffer) throw new Error('synthetic sink failure'); }}));
  assert.equal(sourceBuffer.every(byte => byte === 0), true);
  const plan = await f.api.prepareCompleteRecovery(f.file, uid, f.exported.recoveryKey, ownerOptions);
  let visitedBuffer;
  await assert.rejects(f.api.visitRecoveryAssets(plan, async (_asset, bytes) => { visitedBuffer = bytes; throw new Error('synthetic visitor failure'); }));
  assert.equal(visitedBuffer.every(byte => byte === 0), true);
  await assert.rejects(f.api.createFinalizePayload(plan, f.newMaster), /SESSION_INVALIDATED/);
  f.api.releaseCompleteRecovery(plan);
  const events = new EventTarget(), previousAdd = globalThis.addEventListener, previousRemove = globalThis.removeEventListener;
  globalThis.addEventListener = events.addEventListener.bind(events); globalThis.removeEventListener = events.removeEventListener.bind(events);
  try {
    const locked = await f.api.prepareCompleteRecovery(f.file, uid, f.exported.recoveryKey, ownerOptions);
    events.dispatchEvent(new Event('vault-session-locked'));
    assert.throws(() => f.api.createRecoveryContentPayload(locked), /SESSION_INVALIDATED/);
    f.api.releaseCompleteRecovery(locked);
  } finally { globalThis.addEventListener = previousAdd; globalThis.removeEventListener = previousRemove; }
});

test('chunked video assets retain per-chunk authentication and exact full keyring material', async () => {
  const f = await fixture({keyring: true, assets: false, identity: false}), {api} = f;
  const video = new File(['synthetic video bytes only'], 'synthetic.mp4', {type: 'video/mp4'});
  const encrypted = await api.encryptAttachmentFileInChunks(video, f.material, {binding: 'video-one', chunkSize: 8,
    onChunk: async chunk => {
      const path = `users/${uid}/accounts/account-one/attachments/video-one/chunks/${chunk.index}.bin`;
      f.blobs.set(path, {bytes: new Uint8Array(await chunk.blob.arrayBuffer()), contentType: 'application/octet-stream', generation: '98765'});
      return {storagePath: path, url: `https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=synthetic-obsolete-token`};
    }});
  const records = copy(f.records);
  records.push({kind: 'record', scope: 'private-account-attachment', id: 'video-one', accountId: 'account-one',
    data: {chunks: encrypted.chunks, encryption: encrypted.metadata}});
  const lines = [];
  const exported = await api.writeCompleteRecoveryBackup({...f.adapters, collectRecords: async () => records, writeLine: async line => lines.push(line)});
  const plan = await api.prepareCompleteRecovery(fileOf(lines), uid, exported.recoveryKey, ownerOptions);
  assert.equal(plan.counts.assets, encrypted.chunks.length);
  const fileKey = await api.unwrapAttachmentFileKey(encrypted.metadata, f.material), chunks = [];
  try {
    await api.visitRecoveryAssets(plan, async (asset, bytes) => {
      const chunk = encrypted.chunks.find(candidate => candidate.storagePath === asset.storagePath);
      chunks.push({index: chunk.index, bytes: new Uint8Array(await api.decryptAttachmentChunkBytesWithFileKey(bytes, encrypted.metadata, chunk, fileKey))});
    });
    assert.equal(Buffer.concat(chunks.sort((a,b) => a.index - b.index).map(chunk => chunk.bytes)).toString(), await video.text());
  } finally { fileKey.fill(0); chunks.forEach(chunk => chunk.bytes.fill(0)); api.releaseCompleteRecovery(plan); }
});

test('private and company websites remain verbatim content with and without a scheme', async () => {
  const f = await fixture({assets: false, identity: false}), {api} = f;
  const records = copy(f.records);
  records.find(record => record.scope === 'private-account').data.url = 'www.example.com';
  records.push({kind: 'record', scope: 'company', id: 'company-one', data: {nome: 'Synthetic company'}});
  records.push({kind: 'record', scope: 'company-account', companyId: 'company-one', id: 'company-account',
    data: {url: 'example.invalid/path'}});
  records.push({kind: 'record', scope: 'private-account', id: 'old-unopenable-website', data: {url: 'mailto:synthetic@example.invalid'}});
  const foreignUrl = `https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent('users/another-owner/external.pdf')}?alt=media&token=external-synthetic-token`;
  records.push({kind: 'record', scope: 'private-account', id: 'external-foreign-object', data: {url: foreignUrl}});
  const lines = [];
  const exported = await api.writeCompleteRecoveryBackup({...f.adapters, collectRecords: async () => copy(records), writeLine: async line => lines.push(line)});
  const plan = await api.prepareCompleteRecovery(fileOf(lines), uid, exported.recoveryKey, ownerOptions);
  try {
    const content = api.createRecoveryContentPayload(plan);
    assert.equal(content.records.find(record => record.id === 'account-one').data.url, 'www.example.com');
    assert.equal(content.records.find(record => record.id === 'company-account').data.url, 'example.invalid/path');
    assert.equal(content.records.find(record => record.id === 'old-unopenable-website').data.url, 'mailto:synthetic@example.invalid');
    assert.equal(plan.counts.assets, 0);
    assert.equal(plan.counts.externalReferences, 3);
    assert.equal(content.records.find(record => record.id === 'external-foreign-object').data.url, foreignUrl);
  } finally { api.releaseCompleteRecovery(plan); }
});

test('independent account lifecycle aliases fail before producing a complete export', async () => {
  const f = await fixture(), records = copy(f.records);
  records.push({kind: 'record', scope: 'private-account', id: 'account-two', data: {nomeAccount: 'Synthetic second'}});
  records.push({kind: 'record', scope: 'private-account-attachment', id: 'file-two', accountId: 'account-two',
    data: copy(records.find(record => record.id === 'file-one').data)});
  let written = 0;
  await assert.rejects(f.api.writeCompleteRecoveryBackup({...f.adapters, collectRecords: async () => records,
    writeLine: async () => { written++; }}), /RECOVERY_ASSET_LIFECYCLE_CONFLICT/);
  assert.equal(written, 0);
});

test('asset count and UTF-8 metadata limits admit the boundary and refuse excess before a successful export', async () => {
  const f = await fixture({assets: false, identity: false}), {api} = f;
  const metadataList = []; let metadataSize = 0;
  for (const metadata of [{name: '界'}, {name: 'second'}]) {
    metadataSize = api.appendRecoveryAssetMetadata(metadataList, metadata, metadataSize);
    assert.equal(metadataSize, new TextEncoder().encode(JSON.stringify(metadataList)).length);
  }
  const assets = Array(api.MAX_RECOVERY_ASSETS - 1).fill(null);
  const countBytes = new TextEncoder().encode(JSON.stringify(assets)).length;
  assert.equal(api.appendRecoveryAssetMetadata(assets, {}, countBytes), countBytes + 3);
  assert.equal(assets.length, api.MAX_RECOVERY_ASSETS);
  assert.throws(() => api.appendRecoveryAssetMetadata(assets, {}, 2), /ASSET_CAPACITY/);
  const bytes = new TextEncoder().encode(JSON.stringify({name: '界'})).length;
  assert.equal(api.appendRecoveryAssetMetadata([], {name: '界'}, api.MAX_RECOVERY_ASSET_METADATA_BYTES - bytes - 2), api.MAX_RECOVERY_ASSET_METADATA_BYTES);
  assert.throws(() => api.appendRecoveryAssetMetadata([], {name: '界'}, api.MAX_RECOVERY_ASSET_METADATA_BYTES - bytes - 1), /ASSET_CAPACITY/);
  const countRecords = [{kind: 'record', scope: 'profile', id: uid, data: {}}];
  for (let group = 0; group < 3; group++) countRecords.push({kind: 'record', scope: 'private-account', id: `count-${group}`,
    data: {attachments: Array.from({length: group < 2 ? 4000 : 2000}, (_, index) => ({storagePath: `users/${uid}/count-${group}/${index}`}))}});
  assert.equal(api.createRecoveryInventory(countRecords, uid).assets.length, api.MAX_RECOVERY_ASSETS);
  countRecords.at(-1).data.attachments.push({storagePath: `users/${uid}/count-extra`});
  assert.throws(() => api.createRecoveryInventory(countRecords, uid), /ASSET_CAPACITY/);

  // A supported-size record inventory can still exceed the asset-metadata
  // budget. The exporter must refuse it, rather than return an unreadable file.
  const records = copy(f.records), lines = [];
  for (let account = 0; account < 100; account++) {
    const accountId = `synthetic-account-${account}`;
    records.push({kind: 'record', scope: 'private-account', id: accountId, data: {nomeAccount: accountId}});
    for (let attachment = 0; attachment < 60; attachment++) {
      const path = `users/${uid}/accounts/${accountId}/attachments/synthetic-attachment-${attachment}.pdf`;
      records.push({kind: 'record', scope: 'private-account-attachment', accountId, id: `attachment-${attachment}`,
        data: {url: `https://firebasestorage.googleapis.com/v0/b/${api.RECOVERY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=synthetic-obsolete-token`}});
    }
  }
  await assert.rejects(api.writeCompleteRecoveryBackup({...f.adapters, collectRecords: async () => copy(records),
    readAsset: async () => ({bytes: new Uint8Array([1]), size: 1, contentType: 'application/pdf', generation: '12345'}),
    writeLine: async line => lines.push(line)}), /RECOVERY_ASSET_CAPACITY_EXCEEDED/);
  assert.ok(lines.length > 0);
});

test('external-reference amplification aborts export without footer/key and rejects an authenticated legacy oversized file', async () => {
  const f = await fixture({assets: false, identity: false}), {api} = f;
  const records = [{kind: 'record', scope: 'profile', id: uid, data: {}}];
  for (let i = 0; i < 17; i++) records.push({kind: 'record', scope: 'private-account', id: `capacity-${i}`,
    data: {url: 'https://example.invalid/' + 'x'.repeat(760 * 1024)}});
  const inventory = api.createRecoveryInventory(records, uid);
  assert.equal(inventory.assets.length, 0); assert.equal(inventory.references.length, 17);
  assert.ok(Buffer.byteLength(JSON.stringify(records)) < 16 * 1024 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({records, references: inventory.references})) > 24 * 1024 * 1024);
  let written = 0, succeeded = false;
  await assert.rejects(api.writeCompleteRecoveryBackup({...f.adapters, collectRecords: async () => copy(records),
    writeLine: async () => { written++; }}).then(value => { succeeded = true; return value; }), /RECOVERY_TRANSPORT_CAPACITY_EXCEEDED/);
  assert.equal(succeeded, false);
  assert.equal(written, 2 + records.length); // header, capsule, records; no valid footer

  // Seal a complete, authentic file as a pre-limit writer did. Its footer,
  // manifest, chain and key are valid; only the aggregate transport is too big.
  const {id: _id, ...security} = f.security;
  const sourceSecurityBinding = await api.digestRecoveryValue(security);
  const manifestDigest = await api.digestRecoveryValue(api.recoveryManifest(records, [], inventory.references, sourceSecurityBinding, 'absent'));
  const oldFile = await reseal(f, entries => [entries[0], ...records, {kind: 'footer', entryCount: 1 + records.length,
    recordCount: records.length, assetCount: 0, capsuleCount: 1, manifestDigest, references: inventory.references}]);
  await assert.rejects(api.prepareCompleteRecovery(oldFile, uid, f.exported.recoveryKey, ownerOptions), /RECOVERY_TRANSPORT_CAPACITY_EXCEEDED/);
  const plan = await api.prepareCompleteRecovery(f.file, uid, f.exported.recoveryKey, ownerOptions);
  api.releaseCompleteRecovery(plan);
});

test('invalid UTF-8 and arbitrary exception text are sanitized by recovery readers and writer', async () => {
  const f = await fixture({assets: false, identity: false}), {api} = f;
  await assert.rejects(api.prepareCompleteRecovery(new Blob([new Uint8Array([0xff, 0x0a])]), uid,
    f.exported.recoveryKey, ownerOptions), /^Error: RECOVERY_FILE_INVALID$/);
  await assert.rejects(api.writeCompleteRecoveryBackup({...f.adapters,
    readSecurity: async () => { throw new Error('RECOVERY_private arbitrary details'); }}), /^Error: RECOVERY_EXPORT_INVALID$/);
});
