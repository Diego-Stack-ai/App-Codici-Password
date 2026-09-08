import {createHash, createHmac, randomBytes} from 'node:crypto';

const COMMON = new Set(['password', 'password1', '12345678', 'qwerty123', 'admin123']);

export function createHealthSessionKey() {
  return randomBytes(32);
}

function fingerprint(secret, sessionKey) {
  return createHmac('sha256', sessionKey).update(secret).digest('hex');
}

function isWeak(secret) {
  if (secret.length < 12 || COMMON.has(secret.toLowerCase())) return true;
  return !/[a-z]/.test(secret) || !/[A-Z]/.test(secret) || !/[0-9]/.test(secret) || !/[^A-Za-z0-9]/.test(secret);
}

export function analyzeCredentialHealth(records, {now = Date.now(), staleDays = 365, sessionKey = createHealthSessionKey()} = {}) {
  const seen = new Map();
  const results = records.map(record => {
    const secret = String(record.password ?? '');
    const flags = [];
    if (secret && isWeak(secret)) flags.push('weak');
    if (secret && Number.isFinite(record.passwordUpdatedAt) && now - record.passwordUpdatedAt >= staleDays * 86400000) flags.push('dated');
    const token = secret ? fingerprint(secret, sessionKey) : null;
    if (token) seen.set(token, [...(seen.get(token) ?? []), record.id]);
    return {recordId: record.id, flags, token};
  });
  for (const result of results) {
    if (result.token && (seen.get(result.token)?.length ?? 0) > 1) result.flags.push('duplicate');
    delete result.token;
  }
  return results;
}

export function buildBreachRangeQuery(secret) {
  const digest = createHash('sha1').update(secret).digest('hex').toUpperCase();
  return Object.freeze({prefix: digest.slice(0, 5), suffix: digest.slice(5)});
}

export function classifyCredentialType(value) {
  if (value?.kind === 'service-passkey') return {kind: 'service-passkey', canUnlockVault: false};
  if (value?.kind === 'vault-unlock-passkey') return {kind: 'vault-unlock-passkey', canUnlockVault: true};
  return {kind: 'password', canUnlockVault: false};
}
