'use strict';

const {createHash} = require('node:crypto');
const {generationFile} = require('./backup-attachment-stage');
const {hasRecentAuthentication} = require('./recovery-security');
const {assertTransactionGlobalPurgeUnlocked} = require('./archive-purge-global-lock');
const {assertTransactionVaultRecoveryUnlocked} = require('./vault-recovery-fence');

// Candidate boundary only. No callable registration, environment switch,
// writes, download tokens, Vault material, or automatic production activation.
const RECOVERY_ASSET_BUCKET = 'appcodici-password.firebasestorage.app';
const MAX_RECOVERY_ASSET_BYTES = 32 * 1024 * 1024 + 16;
const MAX_RECOVERY_ASSET_PART_BYTES = 2 * 1024 * 1024;
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const GENERATION = /^[1-9][0-9]{0,39}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const safeCodes = new Set(['UNAUTHENTICATED', 'OWNER_MISMATCH', 'APP_CHECK_REQUIRED', 'VERIFIED_EMAIL_REQUIRED',
  'RECENT_AUTH_REQUIRED', 'DISABLED', 'NOT_CONFIGURED', 'REQUEST_INVALID', 'PATH_INVALID', 'METADATA_INVALID',
  'SOURCE_MISSING', 'SOURCE_CHANGED', 'SOURCE_UNVERIFIED', 'RANGE_INVALID', 'BUSY', 'READ_FAILED']
  .map(code => `RECOVERY_ASSET_${code}`));
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function sanitized(error) {
  const code = safeCodes.has(error?.code) ? error.code :
    ['PURGE_LOCK_ACTIVE', 'RECOVERY_FENCE_ACTIVE', 'RECOVERY_FENCE_BUSY'].includes(error?.code) ? 'RECOVERY_ASSET_BUSY' :
      Number(error?.code) === 404 ? 'RECOVERY_ASSET_SOURCE_MISSING' :
        Number(error?.code) === 412 ? 'RECOVERY_ASSET_SOURCE_CHANGED' : 'RECOVERY_ASSET_READ_FAILED';
  const result = new Error(code); result.code = code; return result;
}
function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      required.some(key => !Object.hasOwn(value, key)) ||
      Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('RECOVERY_ASSET_REQUEST_INVALID');
}
function ownedPath(path, uid) {
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith(`users/${uid}/`) ||
      /[\\?#\u0000-\u001f\u007f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) fail('RECOVERY_ASSET_PATH_INVALID');
  return path;
}
function canonicalMetadata(metadata, path, bucket) {
  const size = typeof metadata?.size === 'string' && /^(?:0|[1-9][0-9]*)$/.test(metadata.size) ? Number(metadata.size) : metadata?.size;
  const encrypted = metadata?.metadata?.encrypted;
  if (!metadata || metadata.name !== path || metadata.bucket !== bucket ||
      !Number.isSafeInteger(size) || size < 1 || size > MAX_RECOVERY_ASSET_BYTES ||
      typeof metadata.generation !== 'string' || !GENERATION.test(metadata.generation) ||
      typeof metadata.metageneration !== 'string' || !GENERATION.test(metadata.metageneration) ||
      typeof metadata.contentType !== 'string' || metadata.contentType.length > 160 ||
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(metadata.contentType) ||
      (metadata.contentEncoding !== undefined && metadata.contentEncoding !== '') ||
      (encrypted !== undefined && encrypted !== 'v1')) fail('RECOVERY_ASSET_METADATA_INVALID');
  const value = {storagePath: path, bucket, size, contentType: metadata.contentType,
    generation: metadata.generation, metageneration: metadata.metageneration};
  if (encrypted !== undefined) value.encrypted = encrypted;
  return {...value, binding: createHash('sha256').update(JSON.stringify(value)).digest('hex')};
}

function createRecoveryAssetReaderService({db, bucket, now = Date.now, configuredBucket = RECOVERY_ASSET_BUCKET, enabled = false} = {}) {
  const active = enabled === true;
  function authorize(request) {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || !ID.test(uid)) fail('RECOVERY_ASSET_UNAUTHENTICATED');
    if (request.data?.expectedOwnerUid !== uid) fail('RECOVERY_ASSET_OWNER_MISMATCH');
    if (typeof request.app?.appId !== 'string' || !request.app.appId) fail('RECOVERY_ASSET_APP_CHECK_REQUIRED');
    const token = request.auth.token;
    if (token?.email_verified !== true || typeof token.email !== 'string' || !token.email.trim()) fail('RECOVERY_ASSET_VERIFIED_EMAIL_REQUIRED');
    if (typeof now !== 'function' || !hasRecentAuthentication(token, now())) fail('RECOVERY_ASSET_RECENT_AUTH_REQUIRED');
    if (!active) fail('RECOVERY_ASSET_DISABLED');
    if (!db || typeof db.runTransaction !== 'function' || !bucket || typeof bucket.file !== 'function' ||
        bucket.name !== configuredBucket || typeof configuredBucket !== 'string' || !configuredBucket) fail('RECOVERY_ASSET_NOT_CONFIGURED');
    return uid;
  }
  async function execute(request, action) {
    const uid = authorize(request), data = {...request.data};
    const common = ['action', 'expectedOwnerUid', 'storagePath'];
    exactKeys(data, action === 'inspect' ? common : [...common, 'generation', 'binding', 'offset', 'length', 'totalSize'],
      action === 'inspect' ? ['expectedGeneration'] : []);
    if (data.action !== action) fail('RECOVERY_ASSET_REQUEST_INVALID');
    const path = ownedPath(data.storagePath, uid);
    if ((data.expectedGeneration !== undefined && (typeof data.expectedGeneration !== 'string' || !GENERATION.test(data.expectedGeneration))) ||
        (action === 'readPart' && (typeof data.generation !== 'string' || !GENERATION.test(data.generation) ||
          typeof data.binding !== 'string' || !SHA256.test(data.binding)))) fail('RECOVERY_ASSET_REQUEST_INVALID');
    if (action === 'readPart' && (!Number.isSafeInteger(data.offset) || data.offset < 0 ||
        !Number.isSafeInteger(data.length) || data.length < 1 || data.length > MAX_RECOVERY_ASSET_PART_BYTES ||
        !Number.isSafeInteger(data.totalSize) || data.totalSize < 1 || data.totalSize > MAX_RECOVERY_ASSET_BYTES ||
        data.offset > data.totalSize - data.length)) fail('RECOVERY_ASSET_RANGE_INVALID');
    const guard = async () => {
      if (authorize(request) !== uid) fail('RECOVERY_ASSET_OWNER_MISMATCH');
      await db.runTransaction(async transaction => {
        await assertTransactionGlobalPurgeUnlocked(transaction, db, uid);
        await assertTransactionVaultRecoveryUnlocked(transaction, db, uid);
      });
      if (authorize(request) !== uid) fail('RECOVERY_ASSET_OWNER_MISMATCH');
    };
    const readMetadata = async file => {
      await guard();
      const response = await file.getMetadata();
      await guard();
      return canonicalMetadata(response?.[0], path, configuredBucket);
    };
    // The latest lookup selects a revision; it is never used for media reads.
    // All media and subsequent metadata reads name the exact string generation.
    const current = await readMetadata(bucket.file(path));
    const generation = action === 'inspect' ? data.expectedGeneration || current.generation : data.generation;
    if (current.generation !== generation) fail('RECOVERY_ASSET_SOURCE_CHANGED');
    const file = generationFile(bucket, path, generation);
    const pinned = await readMetadata(file);
    if (pinned.generation !== generation || pinned.binding !== current.binding ||
        (action === 'readPart' && (pinned.binding !== data.binding || pinned.size !== data.totalSize))) fail('RECOVERY_ASSET_SOURCE_CHANGED');
    let bytes;
    try {
      await guard();
      // Provider integrity applies to whole-object reads. SDK explicitly cannot
      // apply it to ranges: the browser verifies inspect's full SHA-256 at EOF.
      const options = action === 'inspect' ? {validation: 'crc32c', decompress: false} :
        {start: data.offset, end: data.offset + data.length - 1, validation: false, decompress: false};
      [bytes] = await file.download(options);
      await guard();
      if (!Buffer.isBuffer(bytes) || bytes.length !== (action === 'inspect' ? pinned.size : data.length)) fail('RECOVERY_ASSET_SOURCE_UNVERIFIED');
      const afterPinned = await readMetadata(file), afterCurrent = await readMetadata(bucket.file(path));
      if (afterPinned.generation !== generation || afterPinned.binding !== pinned.binding || afterCurrent.binding !== pinned.binding) fail('RECOVERY_ASSET_SOURCE_CHANGED');
      if (action === 'readPart') return {storagePath: path, generation, binding: pinned.binding,
        offset: data.offset, length: data.length, totalSize: pinned.size, content: bytes.toString('base64')};
      const result = {storagePath: path, size: pinned.size, contentType: pinned.contentType,
        generation, binding: pinned.binding, sha256: createHash('sha256').update(bytes).digest('hex')};
      if (pinned.encrypted !== undefined) result.encrypted = pinned.encrypted;
      return result;
    } finally {
      if (ArrayBuffer.isView(bytes)) Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).fill(0);
      else if (bytes instanceof ArrayBuffer) Buffer.from(bytes).fill(0);
    }
  }
  const run = (request, action) => Promise.resolve().then(() => execute(request, action)).catch(error => { throw sanitized(error); });
  return Object.freeze({inspect: request => run(request, 'inspect'), readPart: request => run(request, 'readPart'),
    handle: request => run(request, request?.data?.action === 'inspect' ? 'inspect' : 'readPart')});
}

module.exports = {createRecoveryAssetReaderService, RECOVERY_ASSET_BUCKET, MAX_RECOVERY_ASSET_BYTES, MAX_RECOVERY_ASSET_PART_BYTES,
  RECOVERY_ASSET_SAFE_CODES: Object.freeze([...safeCodes])};
