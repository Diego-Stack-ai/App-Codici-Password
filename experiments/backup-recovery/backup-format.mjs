const encoder = new TextEncoder(); const decoder = new TextDecoder();
const b64 = value => Buffer.from(value).toString('base64');
const bytes = value => new Uint8Array(Buffer.from(value, 'base64'));

async function sha256(value) {
  return Buffer.from(await crypto.subtle.digest('SHA-256', bytes(value))).toString('hex');
}

function assertUnique(items, field, error) {
  const values = items.map(item => item?.[field]);
  if (values.some(value => !value) || new Set(values).size !== values.length) throw new Error(error);
}

async function derive(recoveryKey, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(recoveryKey), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000}, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

export function generateRecoveryKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, '0')).join('').match(/.{1,8}/g).join('-');
}

export async function exportEncryptedBackup({ownerUid, data, recoveryKey, createdAt = Date.now()}) {
  if (!ownerUid || !data || String(recoveryKey).length < 32) throw new Error('BACKUP_INPUT_INVALID');
  const salt = crypto.getRandomValues(new Uint8Array(32)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = {format: 'codici-password-backup', schemaVersion: 1, ownerUid, createdAt, kdf: {name: 'PBKDF2-SHA256', iterations: 600000}, cipher: 'AES-GCM-256'};
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(header))}, await derive(recoveryKey, salt), encoder.encode(JSON.stringify(data)));
  return {...header, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext)};
}

export async function importEncryptedBackup(container, {ownerUid, recoveryKey}) {
  if (container?.format !== 'codici-password-backup' || container.schemaVersion !== 1 || container.ownerUid !== ownerUid || container.kdf?.iterations !== 600000) throw new Error('BACKUP_FORMAT_INVALID');
  const header = {format: container.format, schemaVersion: container.schemaVersion, ownerUid: container.ownerUid, createdAt: container.createdAt, kdf: container.kdf, cipher: container.cipher};
  const clear = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(container.iv), additionalData: encoder.encode(JSON.stringify(header))}, await derive(recoveryKey, bytes(container.salt)), bytes(container.ciphertext));
  return JSON.parse(decoder.decode(clear));
}

export async function createBackupPayload({records = [], attachments = []}) {
  assertUnique(records, 'id', 'BACKUP_RECORD_ID_INVALID');
  assertUnique(attachments, 'id', 'BACKUP_ATTACHMENT_ID_INVALID');
  const recordIds = new Set(records.map(record => record.id));
  const normalizedAttachments = [];
  for (const attachment of attachments) {
    if (!recordIds.has(attachment.recordId) || typeof attachment.content !== 'string') throw new Error('BACKUP_ATTACHMENT_REFERENCE_INVALID');
    const contentBytes = bytes(attachment.content);
    normalizedAttachments.push({...attachment, size: contentBytes.byteLength, digest: await sha256(attachment.content)});
  }
  return {
    payloadSchemaVersion: 1,
    records: structuredClone(records),
    attachments: normalizedAttachments,
    manifest: {
      recordCount: records.length,
      attachmentCount: normalizedAttachments.length,
      attachments: normalizedAttachments.map(({id, recordId, size, digest}) => ({id, recordId, size, digest}))
    }
  };
}

export async function stageBackupRestore(payload, {ownerUid}) {
  if (!ownerUid || payload?.payloadSchemaVersion !== 1 || !Array.isArray(payload.records) || !Array.isArray(payload.attachments)) throw new Error('BACKUP_PAYLOAD_INVALID');
  assertUnique(payload.records, 'id', 'BACKUP_RECORD_ID_INVALID');
  assertUnique(payload.attachments, 'id', 'BACKUP_ATTACHMENT_ID_INVALID');
  const manifest = payload.manifest;
  if (!manifest || manifest.recordCount !== payload.records.length || manifest.attachmentCount !== payload.attachments.length || !Array.isArray(manifest.attachments)) throw new Error('BACKUP_MANIFEST_INVALID');
  assertUnique(manifest.attachments, 'id', 'BACKUP_MANIFEST_INVALID');
  const recordIds = new Set(payload.records.map(record => record.id));
  const manifestById = new Map(manifest.attachments.map(item => [item.id, item]));
  for (const attachment of payload.attachments) {
    const expected = manifestById.get(attachment.id);
    if (!expected || expected.recordId !== attachment.recordId || !recordIds.has(attachment.recordId)) throw new Error('BACKUP_ATTACHMENT_REFERENCE_INVALID');
    const actualSize = bytes(attachment.content).byteLength;
    const actualDigest = await sha256(attachment.content);
    if (expected.size !== actualSize || expected.digest !== actualDigest || attachment.size !== actualSize || attachment.digest !== actualDigest) throw new Error('BACKUP_ATTACHMENT_INTEGRITY_INVALID');
  }
  return Object.freeze({ownerUid, status: 'validated', payload: structuredClone(payload)});
}

export function buildRestoreTransaction(staging, {existingRecordIds = []} = {}) {
  if (staging?.status !== 'validated') throw new Error('BACKUP_STAGING_REQUIRED');
  const collisions = staging.payload.records.map(record => record.id).filter(id => existingRecordIds.includes(id));
  if (collisions.length) throw new Error('BACKUP_RECORD_COLLISION');
  return Object.freeze({ownerUid: staging.ownerUid, records: structuredClone(staging.payload.records), attachments: structuredClone(staging.payload.attachments)});
}
