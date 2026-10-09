const LEGACY_ITERATIONS = 100000;
const V2_ITERATIONS = 600000;
const PREFIX = 'CPFE2.';
const encoder = new TextEncoder(), decoder = new TextDecoder();
const b64 = bytes => Buffer.from(bytes).toString('base64');
const unb64 = value => new Uint8Array(Buffer.from(value, 'base64'));

async function key(password, salt, iterations) {
  const bytes = encoder.encode(String(password).normalize('NFC').trim());
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, material,
      {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  } finally { bytes.fill(0); }
}

export async function encryptFieldV2Lab(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(password, salt, V2_ITERATIONS),
    encoder.encode(String(plaintext)));
  const envelope = {version: 2, kdf: 'PBKDF2-SHA256', iterations: V2_ITERATIONS,
    cipher: 'AES-GCM-256', salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext))};
  return PREFIX + b64(encoder.encode(JSON.stringify(envelope)));
}

export async function decryptFieldCompatibleLab(value, password) {
  let salt, iv, ciphertext, iterations, format;
  if (typeof value === 'string' && value.startsWith(PREFIX)) {
    let envelope;
    try { envelope = JSON.parse(decoder.decode(unb64(value.slice(PREFIX.length)))); } catch { throw Error('FIELD_ENVELOPE_INVALID'); }
    if (envelope?.version !== 2 || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== V2_ITERATIONS ||
        envelope.cipher !== 'AES-GCM-256') throw Error('FIELD_ENVELOPE_INVALID');
    salt = unb64(envelope.salt); iv = unb64(envelope.iv); ciphertext = unb64(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw Error('FIELD_ENVELOPE_INVALID');
    iterations = V2_ITERATIONS; format = 'v2';
  } else {
    const combined = unb64(String(value));
    if (combined.length < 45) throw Error('FIELD_LEGACY_INVALID');
    salt = combined.slice(0, 16); iv = combined.slice(16, 28); ciphertext = combined.slice(28);
    iterations = LEGACY_ITERATIONS; format = 'legacy-v1';
  }
  const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv, tagLength: 128},
    await key(password, salt, iterations), ciphertext);
  return Object.freeze({plaintext: decoder.decode(plaintext), format, needsMigration: format === 'legacy-v1'});
}

export async function planFieldMigrationLab(value, password) {
  const decoded = await decryptFieldCompatibleLab(value, password);
  if (!decoded.needsMigration) return Object.freeze({status: 'current', replacement: null});
  return Object.freeze({status: 'replace-after-cas', replacement: await encryptFieldV2Lab(decoded.plaintext, password)});
}
