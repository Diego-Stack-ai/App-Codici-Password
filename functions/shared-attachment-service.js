const crypto = require('crypto');

const SAFE_ID = /^[A-Za-z0-9_-]{1,180}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function invalid(HttpsError, message = 'Richiesta allegati condivisi non valida.') {
  throw new HttpsError('invalid-argument', message);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => keys.includes(key)) && keys.every(key => key in value);
}

function validId(value) {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function expectedKeyId(publicJwk) {
  const canonical = JSON.stringify({crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y});
  return crypto.createHash('sha256').update(canonical).digest('base64url');
}

function validatePublicIdentity(value, uid, HttpsError) {
  const keys = ['schemaVersion', 'agreement', 'uid', 'keyId', 'publicJwk', 'createdAt'];
  if (!exactKeys(value, keys) || value.schemaVersion !== 1 || value.agreement !== 'ECDH-P256' ||
      value.uid !== uid || !BASE64URL.test(value.keyId || '') || !Number.isSafeInteger(value.createdAt) ||
      !exactKeys(value.publicJwk, ['key_ops', 'ext', 'kty', 'x', 'y', 'crv']) ||
      value.publicJwk.kty !== 'EC' || value.publicJwk.crv !== 'P-256' || value.publicJwk.ext !== true ||
      !Array.isArray(value.publicJwk.key_ops) || value.publicJwk.key_ops.length !== 0 ||
      !BASE64URL.test(value.publicJwk.x || '') || !BASE64URL.test(value.publicJwk.y || '') ||
      expectedKeyId(value.publicJwk) !== value.keyId) invalid(HttpsError, 'Identità pubblica non valida.');
}

function validatePrivateEnvelope(value, uid, keyId, HttpsError) {
  const keys = ['schemaVersion', 'cipher', 'uid', 'keyId', 'salt', 'iv', 'ciphertext', 'createdAt'];
  if (!exactKeys(value, keys) || value.schemaVersion !== 1 || value.cipher !== 'HKDF-SHA256+A256GCM' ||
      value.uid !== uid || value.keyId !== keyId || !Number.isSafeInteger(value.createdAt) ||
      !BASE64.test(value.salt || '') || !BASE64.test(value.iv || '') || !BASE64.test(value.ciphertext || '') ||
      value.salt.length > 100 || value.iv.length > 40 || value.ciphertext.length > 2048) {
    invalid(HttpsError, 'Busta privata non valida.');
  }
}

function validateRecipientEnvelope(value, recipientUid, HttpsError) {
  const keys = ['version', 'agreement', 'keyWrap', 'recipientId', 'salt', 'iv', 'wrappedKey', 'ephemeralPublicKey'];
  if (!exactKeys(value, keys) || value.version !== 1 || value.agreement !== 'ECDH-P256' ||
      value.keyWrap !== 'HKDF-SHA256+A256GCM' || value.recipientId !== recipientUid ||
      !BASE64.test(value.salt || '') || !BASE64.test(value.iv || '') || !BASE64.test(value.wrappedKey || '') ||
      value.salt.length > 100 || value.iv.length > 40 || value.wrappedKey.length > 160 ||
      !exactKeys(value.ephemeralPublicKey, ['key_ops', 'ext', 'kty', 'x', 'y', 'crv']) ||
      value.ephemeralPublicKey.kty !== 'EC' || value.ephemeralPublicKey.crv !== 'P-256' ||
      value.ephemeralPublicKey.ext !== true || !Array.isArray(value.ephemeralPublicKey.key_ops) ||
      value.ephemeralPublicKey.key_ops.length !== 0 ||
      !BASE64URL.test(value.ephemeralPublicKey.x || '') || !BASE64URL.test(value.ephemeralPublicKey.y || '')) {
    invalid(HttpsError, 'Busta destinatario non valida.');
  }
}

function sameIdentity(left, right) {
  return left?.uid === right.uid && left?.keyId === right.keyId &&
    JSON.stringify(left?.publicJwk) === JSON.stringify(right.publicJwk);
}

function createSharedAttachmentService({db, deleteField, HttpsError}) {
  async function register(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso richiesto.');
    const uid = request.auth.uid;
    const publicIdentity = request.data?.publicIdentity;
    const privateEnvelope = request.data?.privateEnvelope;
    validatePublicIdentity(publicIdentity, uid, HttpsError);
    validatePrivateEnvelope(privateEnvelope, uid, publicIdentity.keyId, HttpsError);
    const publicRef = db.collection('cryptoPublicKeys').doc(uid);
    const privateRef = db.collection('users').doc(uid).collection('cryptoIdentity').doc('current');
    return db.runTransaction(async transaction => {
      const [currentPublic, currentPrivate] = await Promise.all([
        transaction.get(publicRef), transaction.get(privateRef)
      ]);
      if (currentPublic.exists !== currentPrivate.exists) {
        throw new HttpsError('failed-precondition', 'Identità crittografica incompleta.');
      }
      if (currentPublic.exists) {
        if (!sameIdentity(currentPublic.data(), publicIdentity) ||
            currentPrivate.data()?.keyId !== publicIdentity.keyId) {
          throw new HttpsError('failed-precondition', 'La sostituzione dell’identità richiede recupero esplicito.');
        }
        return {created: false, keyId: publicIdentity.keyId};
      }
      transaction.create(publicRef, publicIdentity);
      transaction.create(privateRef, privateEnvelope);
      return {created: true, keyId: publicIdentity.keyId};
    });
  }

  async function publish(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso richiesto.');
    const {scope, accountId, attachmentId, companyId, envelopes} = request.data || {};
    if (!['private', 'company'].includes(scope) || !validId(accountId) || !validId(attachmentId) ||
        (scope === 'private' ? companyId !== undefined : !validId(companyId)) ||
        !envelopes || typeof envelopes !== 'object' || Array.isArray(envelopes)) invalid(HttpsError);
    const entries = Object.entries(envelopes);
    if (!entries.length || entries.length > 20) invalid(HttpsError);
    for (const [recipientUid, envelope] of entries) {
      if (!validId(recipientUid)) invalid(HttpsError);
      validateRecipientEnvelope(envelope, recipientUid, HttpsError);
    }
    const ownerRoot = db.collection('users').doc(request.auth.uid);
    const accountRef = scope === 'private'
      ? ownerRoot.collection('accounts').doc(accountId)
      : ownerRoot.collection('aziende').doc(companyId).collection('accounts').doc(accountId);
    const attachmentRef = accountRef.collection('attachments').doc(attachmentId);
    return db.runTransaction(async transaction => {
      const [accountSnapshot, attachmentSnapshot] = await Promise.all([
        transaction.get(accountRef), transaction.get(attachmentRef)
      ]);
      if (!accountSnapshot.exists || !attachmentSnapshot.exists) {
        throw new HttpsError('not-found', 'Account o allegato non trovato.');
      }
      const account = accountSnapshot.data();
      const accepted = new Set(Array.isArray(account.sharedWithUids) ? account.sharedWithUids : []);
      if (account.isArchived === true || entries.some(([recipientUid]) => !accepted.has(recipientUid))) {
        throw new HttpsError('failed-precondition', 'Destinatario non attivo per questo Account.');
      }
      const attachment = attachmentSnapshot.data();
      if (!attachment.encryption || attachment.encryption.version !== 1) {
        throw new HttpsError('failed-precondition', 'Allegato non cifrato nel formato supportato.');
      }
      const merged = {};
      for (const [recipientUid, envelope] of Object.entries(attachment.recipientKeyEnvelopes || {})) {
        if (accepted.has(recipientUid)) merged[recipientUid] = envelope;
      }
      for (const [recipientUid, envelope] of entries) merged[recipientUid] = envelope;
      // I vecchi metadati contenevano un download token pubblico (`url`).
      // Un destinatario potrebbe conservarlo e aggirare una revoca successiva,
      // quindi la pubblicazione delle buste lo elimina atomicamente.
      transaction.update(attachmentRef, {
        recipientKeyEnvelopes: merged,
        sharedReadyRecipientUids: Object.keys(merged),
        url: deleteField()
      });
      return {updated: entries.length};
    });
  }

  return {register, publish};
}

module.exports = {createSharedAttachmentService, expectedKeyId};
