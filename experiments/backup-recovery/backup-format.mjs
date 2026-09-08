const encoder = new TextEncoder(); const decoder = new TextDecoder();
const b64 = value => Buffer.from(value).toString('base64');
const bytes = value => new Uint8Array(Buffer.from(value, 'base64'));

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
