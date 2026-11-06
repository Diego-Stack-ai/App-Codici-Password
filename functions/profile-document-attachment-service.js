const crypto = require('crypto');
const {deleteStageGeneration} = require('./backup-attachment-stage');

const MAX_CLEAR_BYTES = 32 * 1024 * 1024;
const MAX_CIPHER_BYTES = MAX_CLEAR_BYTES + 64;
const MAX_PER_DOCUMENT = 10;
const ID = /^[A-Za-z0-9_-]{1,256}$/;
const MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]);
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
    const reservationId = crypto.randomUUID();
    const reservation = await db.runTransaction(async transaction => {
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
        if (current.digest === digest && current.storagePath === storagePath && current.status === 'ready') return {duplicate: true};
        failure(HttpsError, 'already-exists', 'Identificatore allegato già utilizzato.', 'ATTACHMENT_EXISTS');
      }
      if (attachments.size >= MAX_PER_DOCUMENT) failure(HttpsError, 'resource-exhausted', 'Limite allegati raggiunto.', 'ATTACHMENT_LIMIT');
      transaction.create(recordRef, {ownerId: uid, documentId, storagePath, mimeType, size, encryptedName,
        encryption, digest, reservationId, status: 'reserved', schemaVersion: 1, createdAt: timestamp()});
      return {duplicate: false};
    });

    if (reservation.duplicate) { bytes.fill(0); return {status: 'confirmed', attachmentId}; }
    const file = bucket.file(storagePath);
    let generation;
    const ownsReservation = current => current?.reservationId === reservationId && current.digest === digest &&
      current.storagePath === storagePath && current.status === 'reserved';
    try {
      await file.save(bytes, {resumable: false, contentType: 'application/octet-stream',
        metadata: {metadata: {encrypted: 'v1', reservationId, digest}}, preconditionOpts: {ifGenerationMatch: 0}});
      const [metadata] = await file.getMetadata();
      if (metadata.metadata?.reservationId !== reservationId || metadata.metadata?.digest !== digest ||
          typeof metadata.generation !== 'string' || !/^[1-9][0-9]*$/.test(metadata.generation)) {
        failure(HttpsError, 'aborted', 'Caricamento non verificabile.', 'ATTACHMENT_STATE_CHANGED');
      }
      generation = metadata.generation;
      await db.runTransaction(async transaction => {
        await assertUnlocked(transaction, db, uid);
        const snapshot = await transaction.get(recordRef);
        if (!snapshot.exists || !ownsReservation(snapshot.data())) {
          failure(HttpsError, 'aborted', 'Caricamento non confermabile.', 'ATTACHMENT_STATE_CHANGED');
        }
        transaction.update(recordRef, {status: 'ready', generation, readyAt: timestamp()});
      });
      return {status: 'confirmed', attachmentId};
    } catch (error) {
      // An uncertain save/metadata lookup retains the durable reservation. Never
      // delete an unverified live object or another operation's ready record.
      if (generation) {
        try {
          const owned = await db.runTransaction(async transaction => {
            await assertUnlocked(transaction, db, uid);
            const snapshot = await transaction.get(recordRef);
            return snapshot.exists && ownsReservation(snapshot.data());
          });
          if (owned) {
            await deleteStageGeneration(bucket, {storagePath}, generation);
            await db.runTransaction(async transaction => {
              await assertUnlocked(transaction, db, uid);
              const snapshot = await transaction.get(recordRef);
              if (snapshot.exists && ownsReservation(snapshot.data())) transaction.delete(recordRef);
            });
          }
        } catch { /* Keep the marker until storage cleanup is verified. */ }
      }
      if (error instanceof HttpsError) throw error;
      failure(HttpsError, 'internal', 'Caricamento non completato.', 'ATTACHMENT_UPLOAD_FAILED');
    } finally { bytes.fill(0); }
  }

  async function remove(request) {
    const uid = requireOwner(request);
    const {attachmentId} = request.data || {};
    if (!ID.test(attachmentId || '')) failure(HttpsError, 'invalid-argument', 'Allegato non valido.');
    const recordRef = db.collection('users').doc(uid).collection('profileDocumentAttachments').doc(attachmentId);
    const record = await db.runTransaction(async transaction => {
      await assertUnlocked(transaction, db, uid);
      const snapshot = await transaction.get(recordRef);
      if (!snapshot.exists) return null;
      const current = snapshot.data();
      if (current.ownerId !== uid || current.storagePath !== expectedStoragePath(uid, current.documentId, attachmentId) ||
          !['ready', 'deleting'].includes(current.status) || typeof current.generation !== 'string' ||
          !/^[1-9][0-9]*$/.test(current.generation) || typeof current.digest !== 'string' ||
          !/^[a-f0-9]{64}$/.test(current.digest) || (current.status === 'deleting' &&
            (typeof current.deletionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(current.deletionId)))) {
        failure(HttpsError, 'failed-precondition', 'Allegato non eliminabile.', 'ATTACHMENT_STATE_INVALID');
      }
      if (current.status === 'deleting') return current;
      const deleting = {...current, status: 'deleting', deletionId: crypto.randomUUID()};
      transaction.update(recordRef, {status: 'deleting', deletionId: deleting.deletionId, deletingAt: timestamp()});
      return deleting;
    });
    if (!record) return {status: 'confirmed', attachmentId};
    const ownsDeletion = current => current?.ownerId === uid && current.status === 'deleting' &&
      current.deletionId === record.deletionId && current.storagePath === record.storagePath &&
      current.generation === record.generation && current.digest === record.digest;
    try {
      // Every retry targets the same immutable generation. A concurrent old
      // DELETE cannot affect a replacement generation after another confirms.
      await deleteStageGeneration(bucket, {storagePath: record.storagePath}, record.generation);
      let absent = false;
      try { await bucket.file(record.storagePath).getMetadata(); }
      catch (error) { if (Number(error?.code) === 404) absent = true; else throw error; }
      if (!absent) failure(HttpsError, 'aborted', 'Oggetto allegato cambiato.', 'ATTACHMENT_STORAGE_CHANGED');
      await db.runTransaction(async transaction => {
        await assertUnlocked(transaction, db, uid);
        const snapshot = await transaction.get(recordRef);
        if (!snapshot.exists) return; // Another matching attempt already confirmed.
        if (!ownsDeletion(snapshot.data())) {
          failure(HttpsError, 'aborted', 'Eliminazione non confermabile.', 'ATTACHMENT_STATE_CHANGED');
        }
        transaction.delete(recordRef);
      });
      return {status: 'confirmed', attachmentId};
    } catch {
      // Never restore ready after an uncertain DELETE. The durable binding is
      // resumable; only exact-generation deletion plus verified absence clears it.
      failure(HttpsError, 'aborted', 'Eliminazione non completata. Riprova.', 'ATTACHMENT_DELETE_FAILED');
    }
  }

  return Object.freeze({upload, remove});
}

module.exports = {createProfileDocumentAttachmentService, expectedStoragePath, MAX_CLEAR_BYTES, MAX_PER_DOCUMENT};
