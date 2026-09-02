const crypto = require('crypto');

const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_BLOCK_MS = 30 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;

function normalizeRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recoveryCodeHash(value) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(value), 'utf8').digest('hex');
}

function generateRecoveryCode() {
  const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);
  let raw = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    raw += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return raw.match(/.{1,4}/g).join('-');
}

function recoveryAttemptId(email, ipAddress) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedIp = String(ipAddress || 'unknown').trim();
  return crypto.createHash('sha256').update(`${normalizedEmail}\n${normalizedIp}`, 'utf8').digest('hex');
}

function nextRecoveryAttemptState(previous, now = Date.now()) {
  const state = previous || {};
  if (Number(state.blockedUntil || 0) > now) {
    return {allowed: false, blockedUntil: Number(state.blockedUntil)};
  }
  const sameWindow = Number(state.windowStartedAt || 0) > now - RECOVERY_WINDOW_MS;
  const attempts = (sameWindow ? Number(state.attempts || 0) : 0) + 1;
  const windowStartedAt = sameWindow ? Number(state.windowStartedAt) : now;
  if (attempts > RECOVERY_MAX_ATTEMPTS) {
    return {allowed: false, attempts, windowStartedAt, blockedUntil: now + RECOVERY_BLOCK_MS};
  }
  return {allowed: true, attempts, windowStartedAt, blockedUntil: 0};
}

module.exports = {
  RECOVERY_CODE_LENGTH,
  generateRecoveryCode,
  nextRecoveryAttemptState,
  normalizeRecoveryCode,
  recoveryAttemptId,
  recoveryCodeHash,
};
