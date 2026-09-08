const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = value => {
  let binary = '';
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const base64ToBytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const randomBytes = length => crypto.getRandomValues(new Uint8Array(length));

function context(recordId, recipientId) {
  if (!recordId || !recipientId) throw new Error('SHARING_CONTEXT_REQUIRED');
  return encoder.encode(`CodiciPassword:record-share:v1:${recordId}:${recipientId}`);
}

async function importRecordKey(raw, usages) {
  return crypto.subtle.importKey('raw', raw, {name: 'AES-GCM'}, false, usages);
}

async function deriveEnvelopeKey(privateKey, publicKey, salt, info, usages) {
  const sharedSecret = await crypto.subtle.deriveBits({name: 'ECDH', public: publicKey}, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name: 'HKDF', hash: 'SHA-256', salt, info},
    material,
    {name: 'AES-GCM', length: 256},
    false,
    usages
  );
}

export async function generateIdentityKeyPair() {
  return crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
}

export function generateRecordKey() {
  return randomBytes(32);
}

export async function encryptRecordPayload(payload, recordKey, recordId) {
  const iv = randomBytes(12);
  const aad = encoder.encode(`CodiciPassword:record:v1:${recordId}`);
  const key = await importRecordKey(recordKey, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: aad},
    key,
    encoder.encode(JSON.stringify(payload))
  );
  return {version: 1, cipher: 'AES-GCM-256', iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)};
}

export async function decryptRecordPayload(encrypted, recordKey, recordId) {
  if (encrypted?.version !== 1 || encrypted?.cipher !== 'AES-GCM-256') throw new Error('RECORD_FORMAT_INVALID');
  const key = await importRecordKey(recordKey, ['decrypt']);
  const clear = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: base64ToBytes(encrypted.iv), additionalData: encoder.encode(`CodiciPassword:record:v1:${recordId}`)},
    key,
    base64ToBytes(encrypted.ciphertext)
  );
  return JSON.parse(decoder.decode(clear));
}

export async function wrapRecordKeyForRecipient(recordKey, recipientPublicKey, recordId, recipientId) {
  const ephemeral = await generateIdentityKeyPair();
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const info = context(recordId, recipientId);
  const wrappingKey = await deriveEnvelopeKey(ephemeral.privateKey, recipientPublicKey, salt, info, ['encrypt']);
  const wrappedKey = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: info}, wrappingKey, recordKey);
  return {
    version: 1,
    agreement: 'ECDH-P256',
    keyWrap: 'HKDF-SHA256+A256GCM',
    recipientId,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(wrappedKey),
    ephemeralPublicKey: await crypto.subtle.exportKey('jwk', ephemeral.publicKey)
  };
}

export async function unwrapRecordKeyForRecipient(envelope, recipientPrivateKey, recordId, recipientId) {
  if (envelope?.version !== 1 || envelope?.recipientId !== recipientId) throw new Error('ENVELOPE_RECIPIENT_INVALID');
  const ephemeralPublicKey = await crypto.subtle.importKey(
    'jwk', envelope.ephemeralPublicKey, {name: 'ECDH', namedCurve: 'P-256'}, false, []
  );
  const info = context(recordId, recipientId);
  const wrappingKey = await deriveEnvelopeKey(
    recipientPrivateKey, ephemeralPublicKey, base64ToBytes(envelope.salt), info, ['decrypt']
  );
  const raw = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: info},
    wrappingKey,
    base64ToBytes(envelope.wrappedKey)
  );
  return new Uint8Array(raw);
}
