'use strict';

// Shared runtime. Registration and the code-owned rollout are separate.
const {randomUUID, createHash} = require('node:crypto');
const {generationFile, deleteStageGeneration} = require('./backup-attachment-stage');
const {createVaultRecoveryBinding, acquireTransactionVaultRecoveryFence,
  assertTransactionVaultRecoveryFenceHeld, releaseTransactionVaultRecoveryFence,
  vaultRecoveryFenceRef, releaseVaultRecoveryFence} = require('./vault-recovery-fence');
const {PART_BYTES, RESUME_MS, fail, hash, digest, identifier, validateContent, validateFinalize, destinationPath, projectRecord} = require('./full-recovery-model');
const runtimeTargets = new WeakMap();
function fullRecoveryRuntimeTarget(runtime) { return runtimeTargets.get(runtime); }

function rootVersion(snapshot) { return snapshot.exists ? `${snapshot.updateTime?.seconds}:${snapshot.updateTime?.nanoseconds}` : 'absent'; }
// Firestore stores JavaScript Dates as Timestamps. Compare runtime values with
// explicit type tags; plain JSON objects cannot impersonate SDK values. This is
// deliberately separate from the wire/content commitment canonical JSON.
function runtimeCanonical(value) {
  function tagged(item) {
    if (item instanceof Date) { const seconds = Math.floor(item.getTime() / 1000); return ['timestamp', seconds, (item.getTime() - seconds * 1000) * 1000000]; }
    if (Buffer.isBuffer(item) || item instanceof Uint8Array) return ['bytes', Buffer.from(item).toString('base64')];
    if (Array.isArray(item)) return ['array', item.map(tagged)];
    if (item && typeof item === 'object') {
      if (Object.getPrototypeOf(item) !== Object.prototype && typeof item.toMillis === 'function' && Number.isSafeInteger(item.seconds) && Number.isInteger(item.nanoseconds)) return ['timestamp', item.seconds, item.nanoseconds];
      return ['object', Object.keys(item).sort().map(key => [key, tagged(item[key])])];
    }
    return ['value', item];
  }
  return JSON.stringify(tagged(value));
}
function bootstrap(data) {
  if (!data) return true;
  const keys = Object.keys(data), preferences = ['passwordPolicyVersion', 'language', 'theme'];
  if (keys.length === 1 && keys[0] === 'passwordPolicyVersion' && Number.isSafeInteger(data.passwordPolicyVersion) && data.passwordPolicyVersion > 0) return true;
  const required = ['email', 'nome', 'cognome', 'createdAt', 'photoURL', 'recreatedAfterDeletion'];
  return required.every(key => Object.hasOwn(data, key)) && keys.every(key => required.includes(key) || preferences.includes(key)) &&
    data.recreatedAfterDeletion === true && data.nome === 'Utente' && data.cognome === 'Ripristinato' &&
    typeof data.email === 'string' && data.email.length <= 320 && (data.photoURL === null || typeof data.photoURL === 'string' && data.photoURL.length <= 4096) &&
    (data.createdAt instanceof Date || typeof data.createdAt?.toMillis === 'function') &&
    (!Object.hasOwn(data, 'passwordPolicyVersion') || Number.isSafeInteger(data.passwordPolicyVersion) && data.passwordPolicyVersion > 0) &&
    ['language', 'theme'].every(key => !Object.hasOwn(data, key) || typeof data[key] === 'string' && data[key].length < 40);
}
function chunks(records) {
  const result = []; let chunk = [], bytes = 0;
  for (const record of records.filter(item => item.scope !== 'profile')) {
    const size = Buffer.byteLength(JSON.stringify(record));
    if (chunk.length && (chunk.length >= 100 || bytes + size > 4 * 1024 * 1024)) { result.push(chunk); chunk = []; bytes = 0; }
    chunk.push(record); bytes += size;
  }
  if (chunk.length) result.push(chunk);
  return result;
}
function makeBinding(uid, operationId, content) {
  identifier(operationId);
  return createVaultRecoveryBinding({uid, operationId, planDigest: digest({uid, operationId, backupId: content.backupId, contentDigest: content.contentDigest, manifestDigest: content.manifestDigest, sourceDigest: content.sourceDigest})});
}
function planRef(db, uid, operationId) { return db.doc(`fullRecoveryOperations/${uid}/items/${operationId}`); }
function assetId(asset) { return hash(asset.storagePath); }
function assetDestination(uid, binding, asset) {
  if (asset.storagePath.startsWith(`users/${uid}/avatar_`) || asset.references.some(ref => ref.recordKey === '["profile"]' && ['photoURL', 'avatar'].includes(ref.fieldPath.at(-1)))) {
    const extension = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif'}[asset.contentType];
    if (!extension) fail('FULL_RECOVERY_ASSET_MIME_INVALID');
    return `users/${uid}/avatar_recovery_${binding.digest}_${assetId(asset)}.${extension}`;
  }
  if (asset.assetClass === 'profile-document') return asset.storagePath;
  const parents = new Set();
  for (const reference of asset.references) {
    const key = JSON.parse(reference.recordKey), scope = key[0];
    if (['private-account', 'private-account-attachment'].includes(scope)) parents.add(`users/${uid}/accounts/${key[1]}/attachments`);
    else if (['company-account', 'company-account-attachment'].includes(scope)) parents.add(`users/${uid}/aziende/${key[1]}/accounts/${key[2]}/attachments`);
    else if (scope === 'deadline') parents.add(`users/${uid}/scadenze/${key[1]}`);
  }
  if (parents.size > 1) fail('FULL_RECOVERY_ASSET_LIFECYCLE_CONFLICT');
  const parent = parents.size ? [...parents][0] : asset.storagePath.slice(0, asset.storagePath.lastIndexOf('/'));
  if (parent.startsWith(`users/${uid}/restoreObjects`)) fail('FULL_RECOVERY_ASSET_LIFECYCLE_UNSUPPORTED');
  const extension = /\.([A-Za-z0-9]{1,10})$/.exec(asset.storagePath)?.[1]?.toLowerCase() || 'bin';
  return `${parent}/recovery_${binding.digest}_${assetId(asset)}.${extension}`;
}
function partPath(uid, binding, asset, index) { return `users/${uid}/restoreObjects/${binding.digest}/parts/${assetId(asset)}/${index}`; }
function checkPlan(plan, binding, content, now, completeAllowed = false, allowExpired = false) {
  if (!plan || plan.schemaVersion !== 1 || plan.ownerUid !== binding.ownerUid || plan.operationId !== binding.operationId || plan.planDigest !== binding.planDigest || plan.bindingDigest !== binding.digest || plan.contentDigest !== content.contentDigest || plan.backupId !== content.backupId || plan.manifestDigest !== content.manifestDigest || plan.sourceDigest !== content.sourceDigest || plan.recordCount !== content.records.length || plan.assetCount !== content.assets.length || plan.chunkCount !== chunks(content.records).length || !['checking', 'prepared', 'complete', 'aborted'].includes(plan.status)) fail('FULL_RECOVERY_PLAN_MISMATCH');
  if (!['complete', 'aborted'].includes(plan.status) && (!Number.isSafeInteger(plan.expiresAt) || !allowExpired && plan.expiresAt <= now)) fail('FULL_RECOVERY_PLAN_EXPIRED');
  if (plan.status === 'aborted' && !completeAllowed) fail('FULL_RECOVERY_OPERATION_ABORTED');
  if (!completeAllowed && plan.status !== 'prepared') fail('FULL_RECOVERY_NOT_PREPARED');
  return plan;
}
function checkingAbortReceipt(plan) {
  return {schemaVersion: 1, status: 'not-started', ownerUid: plan.ownerUid, operationId: plan.operationId,
    planDigest: plan.planDigest, bindingDigest: plan.bindingDigest, contentDigest: plan.contentDigest,
    recordCount: plan.recordCount, assetCount: plan.assetCount, chunkCount: plan.chunkCount,
    verifiedAssets: plan.verifiedAssets, publishedChunks: plan.publishedChunks, rootVersion: plan.rootVersion,
    createdAt: plan.createdAt, expiresAt: plan.expiresAt, abortedAt: plan.abortedAt,
    abortCheckedVersion: plan.abortCheckedVersion, abortReason: plan.abortReason};
}
function assertCheckingAbortState(plan) {
  if (plan.status !== 'checking') fail('FULL_RECOVERY_ABORT_NOT_CHECKING');
  if (plan.verifiedAssets !== 0 || plan.publishedChunks !== 0 || !Number.isSafeInteger(plan.createdAt) || plan.createdAt < 0 || !Number.isSafeInteger(plan.expiresAt) || plan.expiresAt !== plan.createdAt + RESUME_MS || typeof plan.rootVersion !== 'string' || !(plan.rootVersion === 'absent' || /^[0-9]+:[0-9]+$/.test(plan.rootVersion)) || ['repreviewCount', 'repreviewedAt', 'completedAt', 'abortedAt', 'abortReceiptDigest'].some(key => plan[key] !== undefined)) fail('FULL_RECOVERY_ABORT_STATE_UNVERIFIED');
}
function assertAbortedReceipt(plan, binding, fence) {
  if (plan.status !== 'aborted' || plan.verifiedAssets !== 0 || plan.publishedChunks !== 0 || plan.abortReason !== 'CHECKING_NOT_STARTED' || !Number.isSafeInteger(plan.createdAt) || !Number.isSafeInteger(plan.expiresAt) || plan.expiresAt !== plan.createdAt + RESUME_MS || !Number.isSafeInteger(plan.abortedAt) || plan.abortedAt < plan.createdAt || typeof plan.abortCheckedVersion !== 'string' || !/^[0-9]+:[0-9]+$/.test(plan.abortCheckedVersion) || plan.abortReceiptDigest !== digest(checkingAbortReceipt(plan))) fail('FULL_RECOVERY_ABORT_RECEIPT_UNVERIFIED');
  try {
    if (!fence) fail('FULL_RECOVERY_ABORT_RECEIPT_UNVERIFIED');
    const current = createVaultRecoveryBinding({uid: fence.ownerUid, operationId: fence.operationId, planDigest: fence.planDigest});
    releaseVaultRecoveryFence(fence, current); // Validate any later operation without changing it.
    if (fence.ownerUid !== binding.ownerUid || current.digest === binding.digest && fence.status !== 'released') fail('FULL_RECOVERY_ABORT_RECEIPT_UNVERIFIED');
  } catch { fail('FULL_RECOVERY_ABORT_RECEIPT_UNVERIFIED'); }
}
function notStarted(plan, duplicate) {
  return {status: 'not-started', operationId: plan.operationId, planDigest: plan.planDigest,
    contentDigest: plan.contentDigest, abortReceiptDigest: plan.abortReceiptDigest, duplicate};
}
async function enumerateDocuments(root, max = 10002) {
  const result = [], pending = [root];
  while (pending.length) {
    const ref = pending.pop();
    for (const collection of await ref.listCollections()) for (const doc of await collection.listDocuments()) {
      if (result.length >= max) fail('FULL_RECOVERY_TARGET_NONEMPTY');
      result.push(doc.path); pending.push(doc);
    }
  }
  return result;
}
function rawMime(bytes, mime) {
  if (mime === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  if (mime === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'image/heic' || mime === 'image/heif') {
    if (bytes.length < 16 || bytes.subarray(4, 8).toString() !== 'ftyp') return false;
    const length = bytes.readUInt32BE(0);
    if (length < 16 || length > bytes.length || length > 4096 || length % 4 !== 0) return false;
    const brands = [bytes.subarray(8, 12).toString()];
    for (let offset = 16; offset < length; offset += 4) brands.push(bytes.subarray(offset, offset + 4).toString());
    return brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand));
  }
  return false;
}
function createFullRecoveryRuntime({db, bucket, types, clock = Date.now, hooks = {}}) {
  if (!db || !bucket || typeof types?.timestamp !== 'function' || typeof types?.bytes !== 'function' || typeof types?.now !== 'function') fail('FULL_RECOVERY_ADAPTER_REQUIRED');
  const context = (uid, input) => {
    validateContent(input.content, uid, bucket.name);
    const binding = makeBinding(uid, input.operationId, input.content), ref = planRef(db, uid, input.operationId);
    for (const asset of input.content.assets) assetDestination(uid, binding, asset);
    const now = clock(); if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + RESUME_MS)) fail('FULL_RECOVERY_TIME_INVALID');
    return {uid, content: input.content, binding, ref, now};
  };
  async function held(c, completeAllowed = false, allowExpired = false) {
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref), plan = checkPlan(snapshot.exists ? snapshot.data() : null, c.binding, c.content, clock(), completeAllowed, allowExpired);
      if (plan.status === 'aborted') fail('FULL_RECOVERY_OPERATION_ABORTED');
      if (plan.status !== 'complete') await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      return plan;
    });
  }
  async function abortedLookup(c) {
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref), plan = checkPlan(snapshot.exists ? snapshot.data() : null, c.binding, c.content, clock(), true, true), fence = await tx.get(vaultRecoveryFenceRef(db, c.uid));
      assertAbortedReceipt(plan, c.binding, fence.exists ? fence.data() : null);
      return notStarted(plan, true);
    });
  }
  async function inspectEmpty(uid) {
    const root = db.doc(`users/${uid}`), snapshot = await root.get();
    if (!bootstrap(snapshot.exists ? snapshot.data() : null) || (await enumerateDocuments(root)).length) fail('FULL_RECOVERY_TARGET_NONEMPTY');
    for (const path of [`users/${uid}/cryptoIdentity/current`, `cryptoPublicKeys/${uid}`]) if ((await db.doc(path).get()).exists) fail('FULL_RECOVERY_IDENTITY_PRESENT');
    // listDocuments includes missing ancestors; Storage root absence proves nothing.
    const [files] = await bucket.getFiles({prefix: `users/${uid}/`, autoPaginate: false, maxResults: 1});
    if (files.length) fail('FULL_RECOVERY_STORAGE_NONEMPTY');
    return snapshot;
  }
  async function prepare(uid, input) {
    const c = context(uid, input), previous = await c.ref.get(); let initialRoot;
    if (previous.exists) {
      const initial = checkPlan(previous.data(), c.binding, c.content, clock(), true, true);
      if (initial.status === 'aborted') return abortedLookup(c);
      const plan = await held(c, true, true);
      if (plan.status === 'complete') {
        const security = await db.doc(`users/${uid}/settings/security`).get();
        if (!security.exists || digest(security.data()) !== plan.securityDigest) fail('FULL_RECOVERY_COMPLETED_AUTHORITY_CHANGED');
        return {status: 'complete', operationId: input.operationId, planDigest: c.binding.planDigest, security: security.data(), duplicate: true};
      }
      if (plan.expiresAt <= clock()) return {status: 'expired', operationId: input.operationId, planDigest: c.binding.planDigest, expiresAt: plan.expiresAt, chunkCount: plan.chunkCount, partBytes: PART_BYTES, duplicate: true};
      if (plan.status === 'prepared') return {status: 'prepared', operationId: input.operationId, planDigest: c.binding.planDigest, expiresAt: plan.expiresAt, chunkCount: plan.chunkCount, partBytes: PART_BYTES, duplicate: true};
    } else initialRoot = await inspectEmpty(uid);
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref);
      if (snapshot.exists) { checkPlan(snapshot.data(), c.binding, c.content, clock(), true); if (snapshot.data().status === 'aborted') fail('FULL_RECOVERY_OPERATION_ABORTED'); }
      await acquireTransactionVaultRecoveryFence(tx, db, c.binding);
      if (!snapshot.exists) tx.create(c.ref, {schemaVersion: 1, ownerUid: uid, operationId: input.operationId, bindingDigest: c.binding.digest, planDigest: c.binding.planDigest,
        backupId: c.content.backupId, contentDigest: c.content.contentDigest, manifestDigest: c.content.manifestDigest, sourceDigest: c.content.sourceDigest,
        recordCount: c.content.records.length, assetCount: c.content.assets.length, chunkCount: chunks(c.content.records).length,
        verifiedAssets: 0, publishedChunks: 0, status: 'checking', rootVersion: rootVersion(initialRoot), createdAt: c.now, expiresAt: c.now + RESUME_MS});
    });
    await hooks.afterFence?.();
    const root = await inspectEmpty(uid);
    const prepared = await db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref), currentRoot = await tx.get(db.doc(`users/${uid}`));
      checkPlan(snapshot.data(), c.binding, c.content, clock(), true);
      if (snapshot.data().status === 'aborted') fail('FULL_RECOVERY_OPERATION_ABORTED');
      await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      if (snapshot.data().rootVersion !== rootVersion(root) || rootVersion(root) !== rootVersion(currentRoot) || !bootstrap(currentRoot.exists ? currentRoot.data() : null)) fail('FULL_RECOVERY_ROOT_CHANGED');
      tx.update(c.ref, {status: 'prepared', rootVersion: rootVersion(root)});
      return {expiresAt: snapshot.data().expiresAt, chunkCount: snapshot.data().chunkCount};
    });
    return {status: 'prepared', operationId: input.operationId, planDigest: c.binding.planDigest, ...prepared, partBytes: PART_BYTES, duplicate: false};
  }
  async function metadata(path) {
    try { const [value] = await bucket.file(path).getMetadata(); return value; }
    catch (error) { if (Number(error.code) === 404) return null; throw error; }
  }
  async function abortChecking(uid, input) {
    const c = context(uid, input), original = await c.ref.get(), plan = checkPlan(original.exists ? original.data() : null, c.binding, c.content, clock(), true, true);
    if (plan.status === 'aborted') return abortedLookup(c);
    assertCheckingAbortState(plan);
    await held(c, true, true);
    if ((await enumerateDocuments(c.ref)).length) fail('FULL_RECOVERY_ABORT_UNEXPECTED_RECEIPT');
    const finalPaths = new Set(c.content.assets.map(asset => assetDestination(uid, c.binding, asset))), operationPrefix = `users/${uid}/restoreObjects/${c.binding.digest}`;
    let query = {prefix: `users/${uid}/`, autoPaginate: false, maxResults: 500};
    while (query) {
      const [files, next] = await bucket.getFiles(query);
      for (const file of files) {
        if (file.name === operationPrefix || file.name.startsWith(`${operationPrefix}/`) || file.name.split('/').at(-1).includes(`recovery_${c.binding.digest}_`) || finalPaths.has(file.name)) fail('FULL_RECOVERY_ABORT_UNEXPECTED_OBJECT');
        const m = await metadata(file.name);
        if (m?.metadata?.fullRecoveryBinding === c.binding.digest) fail('FULL_RECOVERY_ABORT_UNEXPECTED_OBJECT');
      }
      query = next || null;
    }
    await hooks.beforeAbortChecking?.();
    const result = await db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref), current = checkPlan(snapshot.exists ? snapshot.data() : null, c.binding, c.content, clock(), true, true);
      const [assets, recordChunks, fence] = await Promise.all([tx.get(c.ref.collection('assets').limit(1)), tx.get(c.ref.collection('chunks').limit(1)), tx.get(vaultRecoveryFenceRef(db, uid))]);
      if (current.status === 'aborted') { assertAbortedReceipt(current, c.binding, fence.exists ? fence.data() : null); return notStarted(current, true); }
      assertCheckingAbortState(current);
      if (rootVersion(snapshot) !== rootVersion(original) || current.verifiedAssets !== 0 || current.publishedChunks !== 0 || assets.size || recordChunks.size) fail('FULL_RECOVERY_ABORT_CHANGED');
      await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      const aborted = {...current, status: 'aborted', abortedAt: clock(), abortCheckedVersion: rootVersion(snapshot), abortReason: 'CHECKING_NOT_STARTED'};
      if (!Number.isSafeInteger(aborted.abortedAt) || aborted.abortedAt < current.createdAt) fail('FULL_RECOVERY_TIME_INVALID');
      aborted.abortReceiptDigest = digest(checkingAbortReceipt(aborted));
      await releaseTransactionVaultRecoveryFence(tx, db, c.binding);
      tx.update(c.ref, {status: aborted.status, abortedAt: aborted.abortedAt, abortCheckedVersion: aborted.abortCheckedVersion, abortReason: aborted.abortReason, abortReceiptDigest: aborted.abortReceiptDigest});
      return notStarted(aborted, false);
    });
    await hooks.afterAbortChecking?.();
    return result;
  }
  async function verifyObject(path, expected, binding, {readBytes = true} = {}) {
    const m = await metadata(path);
    if (!m || String(m.size) !== String(expected.size) || typeof m.generation !== 'string' || !/^[1-9][0-9]*$/.test(m.generation) || m.contentType !== expected.contentType || m.metadata?.fullRecoveryBinding !== binding.digest || m.metadata?.sha256 !== expected.sha256 || ['encrypted-file', 'profile-document'].includes(expected.assetClass) && m.metadata?.encrypted !== 'v1') fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
    if (readBytes) {
      const [bytes] = await generationFile(bucket, path, m.generation).download();
      try { if (bytes.length !== expected.size || hash(bytes) !== expected.sha256 || expected.assetClass === 'raw-media' && !rawMime(bytes, expected.contentType)) fail('FULL_RECOVERY_OBJECT_UNVERIFIED'); }
      finally { bytes.fill(0); }
    }
    return m;
  }
  async function uploadPart(uid, input, bytes) {
    const c = context(uid, input); await held(c);
    const asset = c.content.assets[input.assetIndex];
    if (!asset || !Number.isSafeInteger(input.assetIndex) || !Number.isSafeInteger(input.partIndex) || input.partIndex < 0 || input.partIndex >= Math.ceil(asset.size / PART_BYTES) || !Buffer.isBuffer(bytes) || bytes.length !== Math.min(PART_BYTES, asset.size - input.partIndex * PART_BYTES)) fail('FULL_RECOVERY_PART_INVALID');
    const path = partPath(uid, c.binding, asset, input.partIndex), sha256 = hash(bytes);
    await hooks.beforePartWrite?.(); await held(c);
    try { await bucket.file(path).save(bytes, {resumable: false, preconditionOpts: {ifGenerationMatch: 0}, metadata: {contentType: 'application/octet-stream', metadata: {fullRecoveryBinding: c.binding.digest, sha256}}}); }
    catch (error) { if (Number(error.code) !== 412) throw error; }
    const m = await verifyObject(path, {size: bytes.length, sha256, contentType: 'application/octet-stream'}, c.binding);
    await held(c); await hooks.afterPartWrite?.();
    return {status: 'staged', assetIndex: input.assetIndex, partIndex: input.partIndex, generation: m.generation};
  }
  async function finishAsset(uid, input) {
    const c = context(uid, input); await held(c);
    const asset = c.content.assets[input.assetIndex];
    if (!asset || !Number.isSafeInteger(input.assetIndex)) fail('FULL_RECOVERY_ASSET_INVALID');
    const path = assetDestination(uid, c.binding, asset), ref = c.ref.collection('assets').doc(assetId(asset));
    const old = await ref.get();
    if (old.exists) {
      if (old.data().descriptorDigest !== digest(asset) || old.data().bindingDigest !== c.binding.digest) fail('FULL_RECOVERY_ASSET_RECEIPT_INVALID');
      const m = await verifyObject(path, asset, c.binding);
      if (old.data().generation !== m.generation) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
      return {status: 'verified', assetIndex: input.assetIndex, generation: m.generation, duplicate: true};
    }
    if (!await metadata(path)) {
      const parts = [];
      try {
        for (let index = 0; index < Math.ceil(asset.size / PART_BYTES); index++) {
          const p = partPath(uid, c.binding, asset, index), m = await metadata(p);
          if (!m) fail('FULL_RECOVERY_PART_MISSING');
          await verifyObject(p, {size: Math.min(PART_BYTES, asset.size - index * PART_BYTES), sha256: m.metadata?.sha256, contentType: 'application/octet-stream'}, c.binding, {readBytes: false});
          const [bytes] = await generationFile(bucket, p, m.generation).download();
          if (hash(bytes) !== m.metadata.sha256) { bytes.fill(0); fail('FULL_RECOVERY_OBJECT_UNVERIFIED'); }
          parts.push(bytes);
        }
        const bytes = Buffer.concat(parts);
        try {
          if (bytes.length !== asset.size || hash(bytes) !== asset.sha256 || asset.assetClass === 'raw-media' && !rawMime(bytes, asset.contentType)) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
          await hooks.beforeAssetWrite?.(); await held(c);
          try { await bucket.file(path).save(bytes, {resumable: false, preconditionOpts: {ifGenerationMatch: 0}, metadata: {contentType: asset.contentType, metadata: {fullRecoveryBinding: c.binding.digest, sha256: asset.sha256, firebaseStorageDownloadTokens: randomUUID(), ...(['encrypted-file', 'profile-document'].includes(asset.assetClass) ? {encrypted: 'v1'} : {})}}}); }
          catch (error) { if (Number(error.code) !== 412) throw error; }
        } finally { bytes.fill(0); }
      } finally { parts.forEach(part => part.fill(0)); }
    }
    const m = await verifyObject(path, asset, c.binding);
    await hooks.afterAssetWrite?.();
    await db.runTransaction(async tx => {
      const plan = await tx.get(c.ref), existing = await tx.get(ref);
      checkPlan(plan.data(), c.binding, c.content, clock()); await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      if (existing.exists) { if (existing.data().generation !== m.generation || existing.data().descriptorDigest !== digest(asset)) fail('FULL_RECOVERY_ASSET_RECEIPT_INVALID'); return; }
      tx.create(ref, {schemaVersion: 1, bindingDigest: c.binding.digest, descriptorDigest: digest(asset), generation: m.generation, state: 'verified'});
      tx.update(c.ref, {verifiedAssets: plan.data().verifiedAssets + 1});
    });
    return {status: 'verified', assetIndex: input.assetIndex, generation: m.generation, duplicate: false};
  }
  async function resolvedAssets(c, verifyBytes = false) {
    const result = [];
    for (const asset of c.content.assets) {
      const receipt = await c.ref.collection('assets').doc(assetId(asset)).get(), path = assetDestination(c.uid, c.binding, asset);
      if (!receipt.exists || receipt.data().bindingDigest !== c.binding.digest || receipt.data().descriptorDigest !== digest(asset)) fail('FULL_RECOVERY_ASSET_NOT_VERIFIED');
      const m = await verifyObject(path, asset, c.binding, {readBytes: verifyBytes});
      if (receipt.data().generation !== m.generation || !/^[0-9a-f-]{36}$/.test(m.metadata?.firebaseStorageDownloadTokens || '')) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
      result.push({...asset, destinationPath: path, generation: m.generation, downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${m.metadata.firebaseStorageDownloadTokens}`});
    }
    return result;
  }
  async function inspectStorage(c) {
    const expected = new Set();
    for (const asset of c.content.assets) {
      expected.add(assetDestination(c.uid, c.binding, asset));
      for (let i = 0; i < Math.ceil(asset.size / PART_BYTES); i++) expected.add(partPath(c.uid, c.binding, asset, i));
    }
    let query = {prefix: `users/${c.uid}/`, autoPaginate: false, maxResults: 500}, seen = 0;
    while (query) {
      const [files, next] = await bucket.getFiles(query);
      for (const file of files) if (++seen > expected.size || !expected.has(file.name)) fail('FULL_RECOVERY_STORAGE_CHANGED');
      query = next || null;
    }
  }
  async function repreview(uid, input) {
    const c = context(uid, input);
    if (input.confirmation !== 'REPREVIEW_EXPIRED_RECOVERY') fail('FULL_RECOVERY_REPREVIEW_CONFIRMATION_REQUIRED');
    const snapshot = await c.ref.get(), original = checkPlan(snapshot.exists ? snapshot.data() : null, c.binding, c.content, clock(), true, true);
    if (original.status === 'aborted') fail('FULL_RECOVERY_OPERATION_ABORTED');
    await held(c, true, true);
    if (original.status === 'complete') fail('FULL_RECOVERY_ALREADY_COMPLETE');
    if (original.expiresAt > clock()) {
      if (Number.isSafeInteger(original.repreviewCount) && original.repreviewCount > 0) return {status: 'repreviewed', operationId: input.operationId, planDigest: c.binding.planDigest, expiresAt: original.expiresAt, chunkCount: original.chunkCount, partBytes: PART_BYTES, duplicate: true};
      fail('FULL_RECOVERY_NOT_EXPIRED');
    }
    const rootRef = db.doc(`users/${uid}`), root = await rootRef.get();
    if (rootVersion(root) !== original.rootVersion || !bootstrap(root.exists ? root.data() : null)) fail('FULL_RECOVERY_ROOT_CHANGED');
    for (const path of [`users/${uid}/settings/security`, `users/${uid}/cryptoIdentity/current`, `cryptoPublicKeys/${uid}`]) if ((await db.doc(path).get()).exists) fail('FULL_RECOVERY_AUTHORITY_CHANGED');
    const assetReceipts = await c.ref.collection('assets').get(), byAsset = new Map(c.content.assets.map(asset => [assetId(asset), asset])), resolved = [];
    if (assetReceipts.size !== original.verifiedAssets || assetReceipts.docs.some(doc => !byAsset.has(doc.id))) fail('FULL_RECOVERY_ASSET_RECEIPT_INVALID');
    const receiptByAsset = new Map(assetReceipts.docs.map(doc => [doc.id, doc.data()]));
    for (const asset of c.content.assets) {
      const receipt = receiptByAsset.get(assetId(asset)), destination = assetDestination(uid, c.binding, asset), existing = await metadata(destination);
      if (receipt && (receipt.bindingDigest !== c.binding.digest || receipt.descriptorDigest !== digest(asset) || receipt.state !== 'verified' || !existing || receipt.generation !== existing.generation)) fail('FULL_RECOVERY_ASSET_RECEIPT_INVALID');
      if (existing) {
        const m = await verifyObject(destination, asset, c.binding);
        if (!/^[0-9a-f-]{36}$/.test(m.metadata?.firebaseStorageDownloadTokens || '')) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
        if (receipt) resolved.push({...asset, destinationPath: destination, generation: m.generation, downloadUrl: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(destination)}?alt=media&token=${m.metadata.firebaseStorageDownloadTokens}`});
      }
      const partCount = Math.ceil(asset.size / PART_BYTES), composite = createHash('sha256'); let complete = true, header;
      for (let i = 0; i < partCount; i++) {
        const path = partPath(uid, c.binding, asset, i), m = await metadata(path);
        if (!m) { complete = false; continue; }
        if (!/^[a-f0-9]{64}$/.test(m.metadata?.sha256 || '')) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
        await verifyObject(path, {size: Math.min(PART_BYTES, asset.size - i * PART_BYTES), sha256: m.metadata.sha256, contentType: 'application/octet-stream'}, c.binding, {readBytes: false});
        const [bytes] = await generationFile(bucket, path, m.generation).download();
        try {
          if (bytes.length !== Math.min(PART_BYTES, asset.size - i * PART_BYTES) || hash(bytes) !== m.metadata.sha256) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
          composite.update(bytes); if (i === 0) header = Buffer.from(bytes.subarray(0, 4096));
        } finally { bytes.fill(0); }
      }
      try { if (complete && (composite.digest('hex') !== asset.sha256 || asset.assetClass === 'raw-media' && !rawMime(header, asset.contentType))) fail('FULL_RECOVERY_OBJECT_UNVERIFIED'); }
      finally { header?.fill(0); }
    }
    await inspectStorage(c);
    const allChunks = chunks(c.content.records), receipts = await c.ref.collection('chunks').get(), published = [];
    if (receipts.size !== original.publishedChunks) fail('FULL_RECOVERY_CHUNK_RECEIPT_INVALID');
    for (const doc of receipts.docs) {
      const index = Number(doc.id), receipt = doc.data(), records = allChunks[index];
      if (!/^(?:0|[1-9][0-9]*)$/.test(doc.id) || !records || receipt.bindingDigest !== c.binding.digest || receipt.state !== 'published' || receipt.chunkDigest !== digest(records) || receipt.recordCount !== records.length || resolved.length !== c.content.assets.length) fail('FULL_RECOVERY_CHUNK_RECEIPT_INVALID');
      published.push(...records);
    }
    const expected = new Set(published.map(record => destinationPath(record, uid))), structural = new Set(expected);
    for (const path of expected) { const parts = path.split('/'); for (let n = 4; n < parts.length; n += 2) structural.add(parts.slice(0, n).join('/')); }
    for (const path of await enumerateDocuments(rootRef)) {
      if (!structural.has(path) || !expected.has(path) && (await db.doc(path).get()).exists) fail('FULL_RECOVERY_TARGET_CHANGED');
    }
    for (const record of published) {
      const target = await db.doc(destinationPath(record, uid)).get();
      if (!target.exists) fail('FULL_RECOVERY_RECORD_MISSING');
      const projected = projectRecord(record, uid, resolved, types), data = target.data();
      if (record.scope === 'profile-document-attachment') { projected.readyAt = data.readyAt; projected.updatedAt = data.updatedAt; }
      if (runtimeCanonical(projected) !== runtimeCanonical(data)) fail('FULL_RECOVERY_RECORD_CHANGED');
    }
    await hooks.beforeRepreview?.();
    const result = await db.runTransaction(async tx => {
      const currentSnapshot = await tx.get(c.ref), current = checkPlan(currentSnapshot.exists ? currentSnapshot.data() : null, c.binding, c.content, clock(), true, true), currentRoot = await tx.get(rootRef);
      const authority = await Promise.all([`users/${uid}/settings/security`, `users/${uid}/cryptoIdentity/current`, `cryptoPublicKeys/${uid}`].map(path => tx.get(db.doc(path))));
      await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      if (rootVersion(currentSnapshot) !== rootVersion(snapshot) || current.status === 'complete' || current.expiresAt > clock() || current.rootVersion !== rootVersion(currentRoot) || !bootstrap(currentRoot.exists ? currentRoot.data() : null) || authority.some(doc => doc.exists)) fail('FULL_RECOVERY_REPREVIEW_CHANGED');
      const now = clock(), count = current.repreviewCount || 0;
      if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + RESUME_MS) || !Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) fail('FULL_RECOVERY_TIME_INVALID');
      tx.update(c.ref, {status: 'prepared', expiresAt: now + RESUME_MS, repreviewedAt: now, repreviewCount: count + 1});
      return {expiresAt: now + RESUME_MS, chunkCount: current.chunkCount};
    });
    return {status: 'repreviewed', operationId: input.operationId, planDigest: c.binding.planDigest, ...result, partBytes: PART_BYTES, duplicate: false};
  }
  async function publishChunk(uid, input) {
    const c = context(uid, input), plan = await held(c), all = chunks(c.content.records);
    if (!Number.isSafeInteger(input.chunkIndex) || !all[input.chunkIndex] || plan.verifiedAssets !== c.content.assets.length) fail('FULL_RECOVERY_CHUNK_INVALID');
    const assets = await resolvedAssets(c), records = all[input.chunkIndex], ref = c.ref.collection('chunks').doc(String(input.chunkIndex));
    const chunkDigest = digest(records), projected = records.map(record => ({path: destinationPath(record, uid), data: projectRecord(record, uid, assets, types)}));
    await hooks.beforeChunkWrite?.();
    const result = await db.runTransaction(async tx => {
      const current = await tx.get(c.ref), receipt = await tx.get(ref);
      checkPlan(current.data(), c.binding, c.content, clock()); await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      if (receipt.exists) { if (receipt.data().chunkDigest !== chunkDigest || receipt.data().bindingDigest !== c.binding.digest) fail('FULL_RECOVERY_CHUNK_RECEIPT_INVALID'); return {duplicate: true}; }
      const targets = await Promise.all(projected.map(record => tx.get(db.doc(record.path))));
      if (targets.some(snapshot => snapshot.exists)) fail('FULL_RECOVERY_RECORD_COLLISION');
      projected.forEach(record => tx.create(db.doc(record.path), record.data));
      tx.create(ref, {schemaVersion: 1, bindingDigest: c.binding.digest, chunkDigest, recordCount: records.length, state: 'published'});
      tx.update(c.ref, {publishedChunks: current.data().publishedChunks + 1});
      return {duplicate: false};
    });
    await hooks.afterChunkWrite?.();
    return {status: 'published', chunkIndex: input.chunkIndex, ...result};
  }
  async function finalize(uid, input) {
    const c = context(uid, input); validateFinalize(input.finalize, c.content, uid);
    const plan = await held(c, true), authorityDigest = digest(input.finalize);
    if (plan.status === 'complete') {
      if (plan.authorityDigest !== authorityDigest) fail('FULL_RECOVERY_FINALIZE_REPLAY');
      return {status: 'complete', operationId: input.operationId, duplicate: true};
    }
    if (plan.verifiedAssets !== c.content.assets.length || plan.publishedChunks !== chunks(c.content.records).length) fail('FULL_RECOVERY_INCOMPLETE');
    const assets = await resolvedAssets(c, true);
    await inspectStorage(c);
    // Reconcile every descendant against this operation, including missing parents.
    const paths = new Set(c.content.records.filter(record => record.scope !== 'profile').map(record => destinationPath(record, uid)));
    const descendants = await enumerateDocuments(db.doc(`users/${uid}`));
    if (descendants.length !== paths.size || descendants.some(path => !paths.has(path))) fail('FULL_RECOVERY_TARGET_CHANGED');
    for (const record of c.content.records.filter(record => record.scope !== 'profile')) {
      const target = await db.doc(destinationPath(record, uid)).get();
      if (!target.exists) fail('FULL_RECOVERY_RECORD_MISSING');
      const expected = projectRecord(record, uid, assets, types), current = target.data();
      // readyAt/updatedAt are server timestamps fixed at publication.
      if (record.scope === 'profile-document-attachment') { expected.readyAt = current.readyAt; expected.updatedAt = current.updatedAt; }
      if (runtimeCanonical(current) !== runtimeCanonical(expected)) fail('FULL_RECOVERY_RECORD_CHANGED');
    }
    await hooks.beforeFinalize?.();
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(c.ref), current = checkPlan(snapshot.data(), c.binding, c.content, clock(), true);
      if (current.status === 'complete') { if (current.authorityDigest !== authorityDigest) fail('FULL_RECOVERY_FINALIZE_REPLAY'); return {status: 'complete', operationId: input.operationId, duplicate: true}; }
      const rootRef = db.doc(`users/${uid}`), root = await tx.get(rootRef), securityRef = db.doc(`users/${uid}/settings/security`), privateRef = db.doc(`users/${uid}/cryptoIdentity/current`), publicRef = db.doc(`cryptoPublicKeys/${uid}`);
      const [security, privateIdentity, publicIdentity] = await Promise.all([tx.get(securityRef), tx.get(privateRef), tx.get(publicRef)]);
      await assertTransactionVaultRecoveryFenceHeld(tx, db, c.binding);
      if (current.rootVersion !== rootVersion(root) || !bootstrap(root.exists ? root.data() : null) || security.exists || privateIdentity.exists || publicIdentity.exists || current.verifiedAssets !== c.content.assets.length || current.publishedChunks !== chunks(c.content.records).length) fail('FULL_RECOVERY_AUTHORITY_CHANGED');
      // All fence reads precede writes, including its release.
      await releaseTransactionVaultRecoveryFence(tx, db, c.binding);
      tx.set(rootRef, projectRecord(c.content.records.find(record => record.scope === 'profile'), uid, assets, types, root.exists ? root.data() : null));
      tx.create(securityRef, input.finalize.security);
      if (input.finalize.sharingIdentity.state === 'present') { tx.create(privateRef, input.finalize.sharingIdentity.privateEnvelope); tx.create(publicRef, input.finalize.sharingIdentity.publicIdentity); }
      tx.update(c.ref, {status: 'complete', authorityDigest, securityDigest: digest(input.finalize.security), completedAt: clock()});
      return {status: 'complete', operationId: input.operationId, duplicate: false};
    });
  }
  // Only immutable, operation-bound part generations can be removed. Restored
  // records and final objects are deliberately retained behind a failed fence.
  async function cleanupParts(uid, input) {
    const c = context(uid, input), plan = await held(c, true);
    if (plan.status !== 'complete') fail('FULL_RECOVERY_CLEANUP_NOT_COMPLETE');
    const asset = c.content.assets[input.assetIndex]; if (!asset) fail('FULL_RECOVERY_ASSET_INVALID');
    for (let i = 0; i < Math.ceil(asset.size / PART_BYTES); i++) {
      const path = partPath(uid, c.binding, asset, i), m = await metadata(path);
      if (!m) continue;
      if (m.metadata?.fullRecoveryBinding !== c.binding.digest) fail('FULL_RECOVERY_OBJECT_UNVERIFIED');
      await deleteStageGeneration(bucket, {storagePath: path}, m.generation);
    }
    return {status: 'cleaned', assetIndex: input.assetIndex};
  }
  const result = Object.freeze({prepare, abortChecking, repreview, uploadPart, finishAsset, publishChunk, finalize, cleanupParts});
  const settings = db._settings || {};
  runtimeTargets.set(result, Object.freeze({projectId: db.projectId, databaseId: db.databaseId || null,
    firestoreHost: settings.host || (settings.ssl === false && settings.servicePath && settings.port ? `${settings.servicePath}:${settings.port}` : null),
    firestoreServicePath: settings.servicePath || null, firestorePort: settings.port ?? null,
    firestoreApiEndpoint: settings.apiEndpoint || null, firestoreUniverseDomain: settings.universeDomain || null,
    firestoreSsl: settings.ssl !== false, storageEndpoint: bucket.storage?.apiEndpoint,
    storageProjectId: bucket.storage?.projectId || null, bucketName: bucket.name}));
  return result;
}
module.exports = {createFullRecoveryRuntime, fullRecoveryRuntimeTarget, bootstrap, chunks, makeBinding, planRef, enumerateDocuments, rawMime, runtimeCanonical, assetDestination};
