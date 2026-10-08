const {createHash} = require('node:crypto');

// Candidate only: not exported as a callable or used by the application yet.
// Activation requires immutable Storage Rules, atomic reference publication,
// coordinated purge/cleanup and compatible readers. Metadata is not a digest
// proof: prepareStage must never be interpreted as publication authorization.

const MAX_BYTES = 25 * 1024 * 1024 + 1024;
const STAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error(code), {code}); };

function stageIdentity(uid, input) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid) ||
      input?.expectedOwnerUid !== uid) fail('BACKUP_OWNER_MISMATCH');
  const path = input.storagePath;
  if (typeof path !== 'string' || !path.startsWith(`users/${uid}/`) || path.length > 1024 ||
      path.includes('\\') || /[\u0000-\u001f\u007f%]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) fail('BACKUP_STORAGE_PATH_INVALID');
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256) ||
      !Number.isSafeInteger(input.size) || input.size < 1 || input.size > MAX_BYTES ||
      typeof input.operationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(input.operationId)) fail('BACKUP_STAGE_INVALID');
  const sourceHash = hash(path);
  // Retries retain this operationId; a new import gets a different namespace.
  // Never renew an expired reservation implicitly or reuse its storage path.
  const id = hash(JSON.stringify([uid, input.operationId, sourceHash, input.sha256, input.size]));
  return {id, operationId: input.operationId, sourceHash, sha256: input.sha256, size: input.size,
    storagePath: `users/${uid}/restoreObjects/${id}`};
}

function stageRef(store, uid, id) {
  return store.collection('backupObjects').doc(uid).collection('items').doc(id);
}

function verifyStageDescriptor(value, identity) {
  if (!value || !['pending', 'published'].includes(value.status) ||
      ['id', 'operationId', 'sourceHash', 'sha256', 'size', 'storagePath'].some(key => value[key] !== identity[key])) {
    fail('BACKUP_STAGE_UNVERIFIED');
  }
  return value;
}

async function readStageMetadata(bucket, identity) {
  let metadata;
  try { [metadata] = await bucket.file(identity.storagePath).getMetadata(); }
  catch (error) { if (Number(error.code) === 404) return null; throw error; }
  if (String(metadata.size) !== String(identity.size) ||
      typeof metadata.generation !== 'string' || !/^[1-9][0-9]*$/.test(metadata.generation)) {
    fail('BACKUP_STAGE_UNVERIFIED');
  }
  return metadata;
}

async function prepareStage({store, bucket, uid, input, now, timestamp}) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + STAGE_TTL_MS)) fail('BACKUP_STAGE_INVALID');
  const identity = stageIdentity(uid, input), reference = stageRef(store, uid, identity.id);
  // Published objects remain immutable. A missing published object is not
  // recreated implicitly: that is a storage integrity failure, not a new upload.
  const descriptor = await store.runTransaction(async tx => {
    const snapshot = await tx.get(reference);
    if (snapshot.exists) {
      const previous = verifyStageDescriptor(snapshot.data(), identity);
      if (previous.status === 'pending') {
        const expiry = previous.expiresAt?.toMillis?.();
        if (!Number.isSafeInteger(expiry) || expiry <= now) fail('BACKUP_STAGE_EXPIRED');
      }
      return previous;
    }
    const value = {...identity, status: 'pending', createdAt: timestamp(now), expiresAt: timestamp(now + STAGE_TTL_MS)};
    tx.create(reference, value);
    return value;
  });
  const metadata = await readStageMetadata(bucket, identity);
  if (!metadata && descriptor.status === 'published') fail('BACKUP_STAGE_PUBLISHED_MISSING');
  return {...identity, uploadRequired: !metadata};
}

async function verifyStageBytes(bucket, identity) {
  const metadata = await readStageMetadata(bucket, identity);
  if (!metadata) fail('BACKUP_STAGE_MISSING');
  // Pin the exact generation; never coerce a 64-bit generation to Number.
  const [bytes] = await generationFile(bucket, identity.storagePath, metadata.generation).download();
  try {
    if (bytes.length !== identity.size || hash(bytes) !== identity.sha256) fail('BACKUP_STAGE_DIGEST_MISMATCH');
  } finally { bytes.fill(0); }
  return metadata.generation;
}

// Server-side candidate only. The HTTP/callable boundary and atomic Firestore
// publication are deliberately not enabled yet. Never return bytes to a client.
// The caller owns/clears its buffer; verifyStageBytes clears its own download.
async function uploadStage({store, bucket, uid, input, bytes, now, timestamp, assertUploadAllowed = () => {}, beforeUpload = async () => {}}) {
  if (typeof assertUploadAllowed !== 'function' || typeof beforeUpload !== 'function') fail('BACKUP_STAGE_INVALID');
  const identity = stageIdentity(uid, input);
  if (!Buffer.isBuffer(bytes) || bytes.length !== identity.size || hash(bytes) !== identity.sha256) {
    fail('BACKUP_STAGE_DIGEST_MISMATCH');
  }
  const prepared = await prepareStage({store, bucket, uid, input, now, timestamp});
  if (prepared.uploadRequired) {
    await beforeUpload();
    // Synchronous caller guard after metadata I/O, immediately before starting
    // the write. This cannot cancel an upload already in flight or authorize GC.
    assertUploadAllowed();
    try {
      await bucket.file(identity.storagePath).save(bytes, {
        resumable: false,
        preconditionOpts: {ifGenerationMatch: 0},
        metadata: {contentType: 'application/octet-stream'}
      });
    } catch (error) {
      // Another attempt may have created the SAME immutable object. Verify its
      // bytes below; never overwrite it or mistake a transport failure for 412.
      if (Number(error.code) !== 412) throw error;
    }
  }
  const generation = await verifyStageBytes(bucket, identity);
  return {...identity, generation};
}

// Preserve exact generation through the SDK's per-file request interceptor.
// Adapters without this facility still fail closed if they round the value.
function generationFile(bucket, path, generation) {
  if (typeof generation !== 'string' || !/^[1-9][0-9]*$/.test(generation)) fail('BACKUP_STAGE_UNVERIFIED');
  const file = bucket.file(path, {generation});
  if ('generation' in file && String(file.generation) !== generation) {
    if (!Array.isArray(file.interceptors)) fail('BACKUP_STAGE_GENERATION_UNSUPPORTED');
    file.interceptors.push({request(options) {
      if (options.method && options.method !== 'GET') fail('BACKUP_STAGE_GENERATION_UNSUPPORTED');
      return {...options, qs: {...options.qs, generation}};
    }});
  }
  return file;
}

module.exports = {MAX_BYTES, STAGE_TTL_MS, stageIdentity, stageRef, verifyStageDescriptor, generationFile,
  prepareStage, verifyStageBytes, uploadStage};
