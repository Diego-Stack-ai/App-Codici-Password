'use strict';

const {createHash, createPublicKey} = require('node:crypto');
const {URL} = require('node:url');
const {restorePath, decodeFirestoreValue} = require('./backup-restore-service');
const {preserveRestoreAuthority} = require('./backup-restore-authority');
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const DOC_ID = /^[A-Za-z0-9_-]{1,256}$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_ASSET_BYTES = 32 * 1024 * 1024 + 16;
const PART_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_BYTES = 20 * 1024 * 1024;
const MAX_CALLABLE_BODY_BYTES = 24 * 1024 * 1024;
const RESUME_MS = 30 * 24 * 60 * 60 * 1000;
const APP_BUCKET = 'appcodici-password.firebasestorage.app';
const fail = code => { throw Object.assign(new Error(code), {code}); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function jsonUtf8Bytes(value) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { fail('FULL_RECOVERY_VALUE_INVALID'); }
  if (typeof serialized !== 'string') fail('FULL_RECOVERY_VALUE_INVALID');
  return Buffer.byteLength(serialized, 'utf8');
}
function assertContentCapacity(content) {
  if (jsonUtf8Bytes(content) > MAX_CONTENT_BYTES) fail('FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
  return content;
}
function assertCallableBodyCapacity(data) {
  if (jsonUtf8Bytes({data}) > MAX_CALLABLE_BODY_BYTES) fail('FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
  return data;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest = value => hash(canonical(value));
function exact(value, keys, code = 'FULL_RECOVERY_SCHEMA_INVALID') {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(code);
}
function identifier(value) { if (typeof value !== 'string' || !ID.test(value)) fail('FULL_RECOVERY_IDENTIFIER_INVALID'); return value; }
function base64(value, length, max = 32768) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(max / 3) * 4) fail('FULL_RECOVERY_BASE64_INVALID');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (length !== undefined && bytes.length !== length)) fail('FULL_RECOVERY_BASE64_INVALID');
  return bytes;
}
function storagePath(path, uid) {
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith(`users/${uid}/`) ||
      /[\\\u0000-\u001f\u007f?#]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') ||
      !/^(?:avatar_[^/]+|(?:accounts|aziende|aziende_allegati|scadenze|profile-documents)\/.+|restoreObjects\/[a-f0-9]{64}(?:\/objects\/[a-f0-9]{64})?)$/.test(path.slice(`users/${uid}/`.length))) fail('FULL_RECOVERY_STORAGE_PATH_INVALID');
  return path;
}
function recordKey(record, uid) {
  const path = destinationPath(record, uid);
  if (record.scope === 'profile') return JSON.stringify(['profile']);
  if (record.scope === 'profile-document-attachment') return JSON.stringify([record.scope, record.id]);
  if (['private-account-widget', 'company-account-widget'].includes(record.scope)) return JSON.stringify(['account-widget', record.id]);
  const context = record.scope === 'company-account' ? [record.companyId] : record.scope === 'company-account-attachment' ? [record.companyId, record.accountId] : record.scope === 'private-account-attachment' ? [record.accountId] : [];
  if (!path) fail('FULL_RECOVERY_SCOPE_INVALID');
  return JSON.stringify([record.scope, ...context, record.id]);
}
function destinationPath(record, uid) {
  identifier(uid);
  if (record.scope === 'profile-document-attachment') {
    if (!DOC_ID.test(record.id || '')) fail('FULL_RECOVERY_PROFILE_ATTACHMENT_INVALID');
    return `users/${uid}/profileDocumentAttachments/${record.id}`;
  }
  if (record.scope === 'profile' && record.id !== uid) fail('FULL_RECOVERY_OWNER_MISMATCH');
  if (record.scope === 'settings' && /security|biometric|device|mfa|auth|recovery|key/i.test(record.id || '')) fail('FULL_RECOVERY_SECURITY_RECORD_FORBIDDEN');
  try { return restorePath(uid, record); } catch { fail('FULL_RECOVERY_SCOPE_INVALID'); }
}
function safeValue(value, depth = 0) {
  if (depth > 60) fail('FULL_RECOVERY_VALUE_INVALID');
  if (value === null || ['string', 'boolean'].includes(typeof value)) {
    if (typeof value === 'string' && (value.startsWith('CPVK2:') || /^-----BEGIN .*PRIVATE KEY/.test(value))) fail('FULL_RECOVERY_SECRET_FORBIDDEN');
    return;
  }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('FULL_RECOVERY_VALUE_INVALID'); return; }
  if (!value || typeof value !== 'object' || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) fail('FULL_RECOVERY_VALUE_INVALID');
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype', 'vaultKeyMaterial', 'masterPassword', 'recoveryKey', 'privateJwk', 'privateKey', 'primaryKey', 'legacyKey', 'fileKey', 'recordKey', 'kek'].includes(key)) fail('FULL_RECOVERY_SECRET_FORBIDDEN');
    safeValue(child, depth + 1);
  }
}
function encryption(value) {
  if (!value || value.version !== 1 || value.cipher !== 'AES-GCM-256' || value.keyWrap !== 'HKDF-SHA256+A256GCM' ||
      !Number.isSafeInteger(value.originalSize) || value.originalSize < 1 || typeof value.originalType !== 'string' || !value.originalType) fail('FULL_RECOVERY_ENCRYPTION_INVALID');
  base64(value.wrapSalt, 32).fill(0); base64(value.wrapIv, 12).fill(0); base64(value.wrappedFileKey, 48).fill(0);
  if (!value.chunked) {
    exact(value, ['version', 'cipher', 'keyWrap', 'contentIv', 'wrapSalt', 'wrapIv', 'wrappedFileKey', 'originalType', 'originalSize']);
    base64(value.contentIv, 12).fill(0);
    if (value.originalSize > MAX_ASSET_BYTES - 16) fail('FULL_RECOVERY_ENCRYPTION_INVALID');
  }
}
function atPath(data, path) {
  if (!Array.isArray(path) || !path.length || path.length > 60) fail('FULL_RECOVERY_REFERENCE_INVALID');
  let parent = data;
  for (const field of path) {
    if (!parent || typeof parent !== 'object' || !((typeof field === 'string' && !['__proto__', 'constructor', 'prototype'].includes(field)) || (Number.isSafeInteger(field) && field >= 0)) || !Object.hasOwn(parent, field)) fail('FULL_RECOVERY_REFERENCE_INVALID');
    parent = parent[field];
  }
  return parent;
}
function encryptedName(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  if (value.startsWith('CPFE2.')) return true;
  try { const bytes = base64(value); const valid = bytes.length >= 45; bytes.fill(0); return valid; }
  catch { return false; }
}
function externalUrl(value) {
  try { const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(parsed.protocol); }
  catch { return false; }
}
function firebaseUrlOwnership(value, uid, configuredBucket) {
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`); } catch { return null; }
  if (url.hostname !== 'firebasestorage.googleapis.com' || !['http:', 'https:'].includes(url.protocol)) return null;
  const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
  if (!match) return 'unknown';
  try {
    const bucket = decodeURIComponent(match[1]), path = decodeURIComponent(match[2]);
    return [APP_BUCKET, configuredBucket].includes(bucket) && path.startsWith(`users/${uid}/`) ? 'owned' : 'external';
  } catch { return 'unknown'; }
}
function validateContent(payload, uid, configuredBucket = APP_BUCKET) {
  // Reject the complete serialized payload before hashing, Base64/typed-value
  // decoding or any runtime operation. Per-record limits do not bound refs.
  assertContentCapacity(payload);
  exact(payload, ['ownerUid', 'backupId', 'profile', 'manifestDigest', 'sourceDigest', 'records', 'assets', 'references', 'contentDigest']);
  identifier(uid); identifier(payload.backupId);
  if (payload.ownerUid !== uid || payload.profile !== 'complete-recovery') fail('FULL_RECOVERY_OWNER_MISMATCH');
  if (!SHA.test(payload.manifestDigest || '') || !SHA.test(payload.contentDigest || '')) fail('FULL_RECOVERY_COMMITMENT_INVALID');
  base64(payload.sourceDigest, 32).fill(0);
  const {contentDigest, ...content} = payload;
  if (digest(content) !== contentDigest) fail('FULL_RECOVERY_COMMITMENT_INVALID');
  if (!Array.isArray(payload.records) || !payload.records.length || payload.records.length > 10000) fail('FULL_RECOVERY_RECORD_LIMIT');
  if (!Array.isArray(payload.assets) || payload.assets.length > 10000 || Buffer.byteLength(JSON.stringify(payload.assets)) > 2 * 1024 * 1024 || !Array.isArray(payload.references)) fail('FULL_RECOVERY_ASSET_LIMIT');
  const records = new Map(), destinations = new Set(); let total = 0;
  for (const record of payload.records) {
    const context = {'company-account': ['companyId'], 'private-account-attachment': ['accountId'], 'company-account-attachment': ['companyId', 'accountId'], 'private-account-widget': ['accountId'], 'company-account-widget': ['companyId', 'accountId'], 'shared-vault-data-link': ['sharedDataId']}[record?.scope] || [];
    exact(record, ['kind', 'scope', 'id', 'data', ...context]);
    if (record.kind !== 'record' || !record.data || Array.isArray(record.data)) fail('FULL_RECOVERY_RECORD_INVALID');
    for (const field of ['id', ...context]) if (record.scope !== 'profile-document-attachment') identifier(record[field]);
    safeValue(record.data);
    // Use the established decoder for precision and typed-value validation.
    decodeFirestoreValue(record.data, {timestamp: () => null, bytes: () => null});
    const bytes = Buffer.byteLength(JSON.stringify(record));
    if (bytes > 800 * 1024 || (total += bytes) > 16 * 1024 * 1024) fail('FULL_RECOVERY_RECORD_LIMIT');
    const key = recordKey(record, uid), path = destinationPath(record, uid);
    if (records.has(key) || destinations.has(path)) fail('FULL_RECOVERY_RECORD_DUPLICATE');
    records.set(key, record); destinations.add(path);
  }
  const profiles = payload.records.filter(record => record.scope === 'profile');
  if (profiles.length !== 1) fail('FULL_RECOVERY_PROFILE_REQUIRED');
  const externalReferences = new Set();
  for (const reference of payload.references) {
    if (reference.kind === 'external-url') exact(reference, ['recordKey', 'fieldPath', 'kind', 'url']);
    else if (reference.kind === 'embedded-data') exact(reference, ['recordKey', 'fieldPath', 'kind']);
    else fail('FULL_RECOVERY_REFERENCE_INVALID');
    const record = records.get(reference.recordKey), value = record && atPath(record.data, reference.fieldPath);
    if (reference.kind === 'external-url' ? typeof value !== 'string' || value !== reference.url || !externalUrl(value) : typeof value !== 'string' || !value.startsWith('data:')) fail('FULL_RECOVERY_REFERENCE_INVALID');
    if (reference.kind === 'external-url') {
      const ownership = firebaseUrlOwnership(value, uid, configuredBucket);
      if (ownership === 'owned' || ownership === 'unknown') fail('FULL_RECOVERY_OLD_URL_FORBIDDEN');
      const key = canonical([reference.recordKey, reference.fieldPath]);
      if (externalReferences.has(key)) fail('FULL_RECOVERY_REFERENCE_INVALID');
      externalReferences.add(key);
    }
  }
  const usedReferences = new Set(), assetPaths = new Set();
  for (const asset of payload.assets) {
    exact(asset, ['kind', 'storagePath', 'assetClass', 'contentType', 'size', 'sha256', 'sourceGeneration', 'references']);
    storagePath(asset.storagePath, uid);
    if (asset.kind !== 'asset' || !['raw-media', 'raw-file', 'encrypted-file', 'profile-document'].includes(asset.assetClass) || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_ASSET_BYTES || !SHA.test(asset.sha256 || '') || typeof asset.sourceGeneration !== 'string' || !/^[1-9][0-9]*$/.test(asset.sourceGeneration) || typeof asset.contentType !== 'string' || !asset.contentType || !Array.isArray(asset.references) || !asset.references.length || assetPaths.has(asset.storagePath)) fail('FULL_RECOVERY_ASSET_INVALID');
    assetPaths.add(asset.storagePath);
    if (['encrypted-file', 'profile-document'].includes(asset.assetClass) && asset.contentType !== 'application/octet-stream') fail('FULL_RECOVERY_ASSET_MIME_INVALID');
    if (asset.assetClass === 'raw-media' && (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(asset.contentType) || asset.size > 5 * 1024 * 1024)) fail('FULL_RECOVERY_ASSET_MIME_INVALID');
    for (const reference of asset.references) {
      exact(reference, ['recordKey', 'fieldPath', 'kind']);
      const record = records.get(reference.recordKey), identity = canonical([reference.recordKey, reference.fieldPath]);
      if (!record || usedReferences.has(identity) || !['storage-path', 'download-url'].includes(reference.kind)) fail('FULL_RECOVERY_REFERENCE_INVALID');
      const value = atPath(record.data, reference.fieldPath), last = reference.fieldPath.at(-1);
      if ((reference.kind === 'storage-path' && (last !== 'storagePath' || value !== asset.storagePath)) || (reference.kind === 'download-url' && value !== null)) fail('FULL_RECOVERY_REFERENCE_INVALID');
      if (record.scope === 'profile' && ['photoURL', 'avatar'].includes(last) && !asset.storagePath.startsWith(`users/${uid}/avatar_`)) fail('FULL_RECOVERY_REFERENCE_INVALID');
      let parent = record.data, inherited = null;
      for (const field of reference.fieldPath.slice(0, -1)) { inherited = parent?.encryption || inherited; parent = parent[field]; }
      const crypt = parent?.encryption || inherited;
      const rawMedia = reference.kind === 'download-url' && ['photoURL', 'avatar', 'logo', 'referentePhoto'].includes(last);
      let classification = record.scope === 'profile-document-attachment' ? 'profile-document' : rawMedia ? 'raw-media' : crypt ? 'encrypted-file' : 'raw-file';
      if (record.scope === 'deadline' && parent?.linkedSource?.type === 'profileDocumentAttachment') {
        const primary = payload.records.find(item => item.scope === 'profile-document-attachment' && item.data.storagePath === asset.storagePath), deadline = record.data;
        if (!primary || parent.linkedSource.id !== primary.id || crypt?.chunked || (deadline.sourceRef === undefined && deadline.sourceType === undefined) ||
            (deadline.sourceRef !== undefined && (deadline.sourceRef?.type !== 'profileDocument' || deadline.sourceRef.id !== primary.data.documentId)) ||
            (deadline.sourceType !== undefined && (deadline.sourceType !== 'profileDocument' || deadline.sourceDocumentId !== primary.data.documentId)) || canonical(crypt) !== canonical(primary.data.encryption)) fail('FULL_RECOVERY_PROFILE_ATTACHMENT_ALIAS_INVALID');
        classification = 'profile-document';
      }
      if (asset.assetClass !== classification) fail('FULL_RECOVERY_ASSET_INVALID');
      if (crypt) {
        encryption(crypt);
        const expected = crypt.chunked ? parent.encryptedSize : crypt.originalSize + 16;
        if (expected !== asset.size || asset.contentType !== 'application/octet-stream') fail('FULL_RECOVERY_ASSET_INVALID');
      } else if (['encrypted-file', 'profile-document'].includes(asset.assetClass)) fail('FULL_RECOVERY_ENCRYPTION_INVALID');
      usedReferences.add(identity);
    }
  }
  for (const [key, record] of records) {
    const visit = (value, path = []) => {
      if (!value || typeof value !== 'object') return;
      if (value.encryption?.chunked) {
        const e = value.encryption; encryption(e);
        if (e.chunkVersion !== 1 || !ID.test(e.chunkBinding || '') || !Number.isSafeInteger(e.chunkCount) || e.chunkCount < 1 || e.chunkCount > 1024 || !Array.isArray(value.chunks) || value.chunks.length !== e.chunkCount || !Number.isSafeInteger(e.chunkSize) || e.chunkSize < 1 || e.chunkSize > 32 * 1024 * 1024 || !e.originalType.startsWith('video/') || e.originalSize > 512 * 1024 * 1024) fail('FULL_RECOVERY_CHUNKS_INVALID');
        let sum = 0; const paths = new Set();
        value.chunks.forEach((chunk, i) => { if (chunk.index !== i || !Number.isSafeInteger(chunk.clearSize) || chunk.clearSize < 1 || chunk.clearSize > e.chunkSize || chunk.encryptedSize !== chunk.clearSize + 16 || paths.has(chunk.storagePath)) fail('FULL_RECOVERY_CHUNKS_INVALID'); base64(chunk.contentIv, 12).fill(0); sum += chunk.clearSize; paths.add(chunk.storagePath); });
        if (sum !== e.originalSize) fail('FULL_RECOVERY_CHUNKS_INVALID');
      }
      for (const [field, child] of Object.entries(value)) {
        const next = [...path, Array.isArray(value) ? Number(field) : field];
        if (field === 'storagePath' && !usedReferences.has(canonical([key, next]))) fail('FULL_RECOVERY_REFERENCE_INVALID');
        if (typeof child === 'string') {
          const ownership = firebaseUrlOwnership(child, uid, configuredBucket);
          if (ownership && (ownership !== 'external' || !externalReferences.has(canonical([key, next])))) fail('FULL_RECOVERY_OLD_URL_FORBIDDEN');
        }
        visit(child, next);
      }
    }; visit(record.data);
    if (record.scope === 'profile-document-attachment') {
      const d = record.data, matching = payload.assets.filter(asset => asset.storagePath === d.storagePath);
      if (d.ownerId !== uid || d.status !== 'ready' || d.schemaVersion !== 1 || !DOC_ID.test(d.documentId || '') || (profiles[0].data.documenti || []).filter(item => item?.id === d.documentId).length !== 1 || d.storagePath !== `users/${uid}/profile-documents/${d.documentId}/attachments/${record.id}` || !Number.isSafeInteger(d.size) || d.size < 1 || d.encryption?.originalSize !== d.size || d.encryption?.originalType !== d.mimeType || !encryptedName(d.encryptedName) || matching.length !== 1 || matching[0].assetClass !== 'profile-document' || matching[0].sha256 !== d.digest || matching[0].sourceGeneration !== d.generation) fail('FULL_RECOVERY_PROFILE_ATTACHMENT_INVALID');
    }
  }
  return payload;
}
function validateFinalize(value, content, uid) {
  exact(value, ['ownerUid', 'backupId', 'profile', 'manifestDigest', 'sourceDigest', 'contentDigest', 'sourceSecurityBinding', 'security', 'sharingIdentity']);
  for (const field of ['ownerUid', 'backupId', 'profile', 'manifestDigest', 'sourceDigest', 'contentDigest']) if (value[field] !== content[field]) fail('FULL_RECOVERY_COMMITMENT_INVALID');
  if (value.ownerUid !== uid || !SHA.test(value.sourceSecurityBinding || '')) fail('FULL_RECOVERY_COMMITMENT_INVALID');
  exact(value.security, ['vaultKeyEnvelope', 'verifier']);
  const e = value.security.vaultKeyEnvelope, v = value.security.verifier;
  exact(e, ['version', 'type', 'kdf', 'iterations', 'cipher', 'salt', 'iv', 'wrappedKey', 'keyOrigin', 'updatedAt']);
  exact(v, ['version', 'type', 'kdf', 'iterations', 'cipher', 'salt', 'iv', 'ciphertext', 'createdAt', 'updatedAt']);
  for (const item of [e, v]) {
    if (item.version !== 2 || item.kdf !== 'PBKDF2-SHA256' || item.iterations !== 600000 || item.cipher !== 'AES-GCM-256' || !Number.isSafeInteger(item.updatedAt) || item.updatedAt < 0) fail('FULL_RECOVERY_SECURITY_INVALID');
    base64(item.salt, 16).fill(0); base64(item.iv, 12).fill(0);
  }
  if (e.type !== 'vault-key-envelope' || !['random', 'random-with-legacy-fallback'].includes(e.keyOrigin) || v.type !== 'vault-verifier' || !Number.isSafeInteger(v.createdAt) || v.createdAt < 0) fail('FULL_RECOVERY_SECURITY_INVALID');
  const wrapped = base64(e.wrappedKey);
  if (wrapped.length < 60 || wrapped.length > 16400) fail('FULL_RECOVERY_SECURITY_INVALID'); wrapped.fill(0);
  base64(v.ciphertext, Buffer.byteLength('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1') + 16).fill(0);
  const identity = value.sharingIdentity;
  if (identity?.state === 'absent') exact(identity, ['state']);
  else {
    exact(identity, ['state', 'publicIdentity', 'privateEnvelope']);
    if (identity.state !== 'present') fail('FULL_RECOVERY_IDENTITY_INVALID');
    const p = identity.publicIdentity, q = identity.privateEnvelope;
    exact(p, ['schemaVersion', 'agreement', 'uid', 'keyId', 'publicJwk', 'createdAt']); exact(q, ['schemaVersion', 'cipher', 'uid', 'keyId', 'salt', 'iv', 'ciphertext', 'createdAt']);
    if (p.schemaVersion !== 1 || q.schemaVersion !== 1 || p.agreement !== 'ECDH-P256' || q.cipher !== 'HKDF-SHA256+A256GCM' || p.uid !== uid || q.uid !== uid || p.keyId !== q.keyId || !/^[A-Za-z0-9_-]{43}$/.test(p.keyId || '') || !Number.isSafeInteger(p.createdAt) || p.createdAt < 0 || !Number.isSafeInteger(q.createdAt) || q.createdAt < 0) fail('FULL_RECOVERY_IDENTITY_INVALID');
    const jwk = p.publicJwk;
    if (!jwk || Object.keys(jwk).some(key => !['kty', 'crv', 'x', 'y', 'ext', 'key_ops'].includes(key)) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !/^[A-Za-z0-9_-]{43}$/.test(jwk.x || '') || !/^[A-Za-z0-9_-]{43}$/.test(jwk.y || '') || (jwk.ext !== undefined && typeof jwk.ext !== 'boolean') || (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length))) fail('FULL_RECOVERY_IDENTITY_INVALID');
    try { createPublicKey({key: jwk, format: 'jwk'}); } catch { fail('FULL_RECOVERY_IDENTITY_INVALID'); }
    if (createHash('sha256').update(JSON.stringify({crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y})).digest('base64url') !== p.keyId) fail('FULL_RECOVERY_IDENTITY_INVALID');
    base64(q.salt, 32).fill(0); base64(q.iv, 12).fill(0); const sealed = base64(q.ciphertext); if (sealed.length < 17 || sealed.length > 16384) fail('FULL_RECOVERY_IDENTITY_INVALID'); sealed.fill(0);
  }
  return value;
}
function projectRecord(record, uid, assets, types, current = null) {
  const data = structuredClone(record.data), key = recordKey(record, uid);
  for (const asset of assets) for (const reference of asset.references) if (reference.recordKey === key) {
    let parent = data;
    for (const field of reference.fieldPath.slice(0, -1)) parent = parent[field];
    parent[reference.fieldPath.at(-1)] = reference.kind === 'storage-path' ? asset.destinationPath : asset.downloadUrl;
  }
  if (record.scope === 'profile-document-attachment') {
    const asset = assets.find(item => item.references.some(ref => ref.recordKey === key));
    data.generation = asset.generation; data.readyAt = types.now(); data.updatedAt = types.now();
  }
  const path = destinationPath(record, uid);
  const projected = preserveRestoreAuthority(path, decodeFirestoreValue(data, types), current);
  if (record.scope === 'profile') {
    for (const field of Object.keys(projected)) if (/^(?:settings_biometric|mfa|totp|recoveryCodes|devices|pushTokens|fcmTokens|auth|vaultKeyEnvelope|verifier)/i.test(field)) delete projected[field];
    for (const field of ['email', 'passwordPolicyVersion', 'language', 'theme']) if (current && Object.hasOwn(current, field)) projected[field] = current[field];
  }
  // Content backups cannot reinstate grants or recipients for common data links.
  if (['shared-vault-data', 'shared-vault-data-link'].includes(record.scope)) {
    for (const field of ['sharedWith', 'sharedWithUids', 'sharedWithEmailByUid', 'recipients', 'grants', 'acceptedCount', 'sharingCycle']) delete projected[field];
    projected.visibility = 'private';
  }
  return projected;
}
module.exports = {MAX_ASSET_BYTES, PART_BYTES, MAX_CONTENT_BYTES, MAX_CALLABLE_BODY_BYTES, RESUME_MS, jsonUtf8Bytes, assertContentCapacity, assertCallableBodyCapacity, fail, hash, digest, canonical, exact, identifier, base64, recordKey, destinationPath, validateContent, validateFinalize, projectRecord};
