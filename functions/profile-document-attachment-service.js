const crypto = require('crypto');

const MAX_CLEAR_BYTES = 10 * 1024 * 1024;
const MAX_CIPHER_BYTES = MAX_CLEAR_BYTES + 64;
const MAX_PER_DOCUMENT = 10;
const ID = /^[A-Za-z0-9_-]{1,256}$/;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ENCRYPTION_FIELDS = ['version', 'cipher', 'keyWrap', 'contentIv', 'wrapSalt', 'wrapIv', 'wrappedFileKey', 'originalType', 'originalSize'];

function failure(HttpsError, code, message, reason) {
  throw new HttpsError(code, message, reason ? {reason} : undefined);
}

function validBase64(value, minimum, maximum) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum &&
    value.length % 4 === 0 && B64.test(value);
}

function canonicalEncryption(value, mimeType, size) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== ENCRYPTION_FIELDS.length ||
      Object.keys(value).some(key => !ENCRYPTION_FIELDS.includes(key)) ||
      value.version !== 1 || value.cipher !== 'AES-GCM-256' || value.keyWrap !== 'HKDF-SHA256+A256GCM' ||
      value.originalType !== mimeType || value.originalSize !== size ||
      !validBase64(value.contentIv, 16, 16) || !validBase64(value.wrapIv, 16, 16) ||
      !validBase64(value.wrapSalt, 44, 44) || !validBase64(value.wrappedFileKey, 64, 128)) {
    throw new Error('ENCRYPTION_INVALID');
  }
  return Object.fromEntries(ENCRYPTION_FIELDS.map(key => [key, value[key]]));
}

function decodePayload(value) {
  if (!validBase64(value, 1, Math.ceil(MAX_CIPHER_BYTES / 3) * 4 + 4)) throw new Error('PAYLOAD_INVALID');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > MAX_CIPHER_BYTES || bytes.toString('base64') !== value) throw new Error('PAYLOAD_INVALID');
  return bytes;
}

function expectedStoragePath(uid, documentId, attachmentId) {
  return `users/${uid}/profile-documents/${documentId}/attachments/${attachmentId}`;
}

function profileContainsDocument(profile, documentId) {
  const documents = Array.isArray(profile?.documenti) ? profile.documenti : [];
  return documents.filter(item => item && item.id === documentId).length === 1;
}

function createProfileDocumentAttachmentService({db, bucket, timestamp, assertUnlocked, HttpsError}) {
  if (!db || !bucket || !timestamp || !assertUnlocked || !HttpsError) throw new Error('PROFILE_DOCUMENT_ATTACHMENT_SERVICE_INVALID');

  const requireOwner = request => {
    if (!request.auth?.uid) failure(HttpsError, 'unauthenticated', 'Accesso richiesto.');
    return request.auth.uid;
  };

  async function upload(request) {
    const uid = requireOwner(request);
    const data = request.data || {};
    const {documentId, attachmentId, mimeType, size, storagePath, encryptedName} = data;
    if (!ID.test(documentId || '') || !ID.test(attachmentId || '') || !MIME.has(mimeType) ||
        !Number.isSafeInteger(size) || size <= 0 || size > MAX_CLEAR_BYTES ||
        storagePath !== expectedStoragePath(uid, documentId, attachmentId) ||
        typeof encryptedName !== 'string' || encryptedName.length < 8 || encryptedName.length > 4096) {
      failure(HttpsError, 'invalid-argument', 'Allegato non valido.', 'ATTACHMENT_INVALID');
    }
    let encryption, bytes;
    try {
      encryption = canonicalEncryption(data.encryption, mimeType, size);
      bytes = decodePayload(data.payloadBase64);
      if (bytes.length !== size + 16) throw new Error('PAYLOAD_SIZE_MISMATCH');
    }
    catch { failure(HttpsError, 'invalid-argument', 'Allegato cifrato non valido.', 'ATTACHMENT_INVALID'); }
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const userRef = db.collection('users').doc(uid);
    const recordRef = userRef.collection('profileDocumentAttachments').doc(attachmentId);
    await db.runTransaction(async transaction => {
      await assertUnlocked(transaction, db, uid);
      const [profile, existing, attachments] = await Promise.all([
        transaction.get(userRef), transaction.get(recordRef),
        transaction.get(userRef.collection('profileDocumentAttachments').where('documentId', '==', documentId).limit(MAX_PER_DOCUMENT + 1))
      ]);
      if (!profile.exists || !profileContainsDocument(profile.data(), documentId)) {
        failure(HttpsError, 'failed-precondition', 'Il documento non è più disponibile.', 'DOCUMENT_NOT_FOUND');
      }
      if (existing.exists) {
        const current = existing.data();
        if (current.digest === digest && current.storagePath === storagePath && current.status === 'ready') return;
        failure(HttpsError, 'already-exists', 'Identificatore allegato già utilizzato.', 'ATTACHMENT_EXISTS');
      }
      if (attachments.size >= MAX_PER_DOCUMENT) failure(HttpsError, 'resource-exhausted', 'Limite allegati raggiunto.', 'ATTACHMENT_LIMIT');
      transaction.create(recordRef, {ownerId: uid, documentId, storagePath, mimeType, size, encryptedName,
        encryption, digest, status: 'reserved', schemaVersion: 1, createdAt: timestamp()});
    });

    const file = bucket.file(storagePath);
    try {
      await file.save(bytes, {resumable: false, contentType: 'application/octet-stream',
        metadata: {metadata: {encrypted: 'v1'}}, preconditionOpts: {ifGenerationMatch: 0}});
      const [metadata] = await file.getMetadata();
      await db.runTransaction(async transaction => {
        await assertUnlocked(transaction, db, uid);
        const snapshot = await transaction.get(recordRef);
        const current = snapshot.data();
        if (!snapshot.exists || current.status !== 'reserved' || current.digest !== digest || current.storagePath !== storagePath) {
          failure(HttpsError, 'aborted', 'Caricamento non confermabile.', 'ATTACHMENT_STATE_CHANGED');
        }
        transaction.update(recordRef, {status: 'ready', generation: String(metadata.generation), readyAt: timestamp()});
      });
      return {status: 'confirmed', attachmentId};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      try { await recordRef.delete(); } catch {}
      try { await file.delete({ignoreNotFound: true}); } catch {}
      failure(HttpsError, 'internal', 'Caricamento non completato.', 'ATTACHMENT_UPLOAD_FAILED');
    } finally { bytes.fill(0); }
  }

  async function remove(request) {
    const uid = requireOwner(request);
    const {attachmentId} = request.data || {};
    if (!ID.test(attachmentId || '')) failure(HttpsError, 'invalid-argument', 'Allegato non valido.');
    const recordRef = db.collection('users').doc(uid).collection('profileDocumentAttachments').doc(attachmentId);
    let record;
    await db.runTransaction(async transaction => {
      await assertUnlocked(transaction, db, uid);
      const snapshot = await transaction.get(recordRef);
      if (!snapshot.exists) return;
      record = snapshot.data();
      if (record.ownerId !== uid || record.storagePath !== expectedStoragePath(uid, record.documentId, attachmentId) || record.status !== 'ready') {
        failure(HttpsError, 'failed-precondition', 'Allegato non eliminabile.', 'ATTACHMENT_STATE_INVALID');
      }
      transaction.update(recordRef, {status: 'deleting', deletingAt: timestamp()});
    });
    if (!record) return {status: 'confirmed', attachmentId};
    try {
      await bucket.file(record.storagePath).delete({ignoreNotFound: true,
        ...(record.generation ? {ifGenerationMatch: Number(record.generation)} : {})});
      await recordRef.delete();
      return {status: 'confirmed', attachmentId};
    } catch {
      try { await recordRef.update({status: 'ready', deletingAt: null}); } catch {}
      failure(HttpsError, 'aborted', 'Eliminazione non completata. Riprova.', 'ATTACHMENT_DELETE_FAILED');
    }
  }

  return Object.freeze({upload, remove});
}

module.exports = {createProfileDocumentAttachmentService, expectedStoragePath, MAX_CLEAR_BYTES, MAX_PER_DOCUMENT};
