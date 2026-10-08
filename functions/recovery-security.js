const crypto = require('crypto');

const RECOVERY_CODE_LENGTH = 16;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_BLOCK_MS = 30 * 60 * 1000;
const RECOVERY_MAX_ATTEMPTS = 5;

function hasRecentAuthentication(token, now = Date.now()) {
  const seconds = token?.auth_time;
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isSafeInteger(now) || now < 0) return false;
  const currentSeconds = Math.floor(now / 1000);
  return seconds <= currentSeconds && currentSeconds - seconds <= 300;
}

function normalizeRecoveryCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recoveryCodeHash(value) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(value), 'utf8').digest('hex');
}

function generateRecoveryCode() {
  let raw = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    raw += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  }
  return raw.match(/.{1,4}/g).join('-');
}

function recoveryAttemptId(email, ipAddress) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedIp = String(ipAddress || 'unknown').trim();
  return crypto.createHash('sha256').update(`${normalizedEmail}\n${normalizedIp}`, 'utf8').digest('hex');
}

function nextRecoveryAttemptState(previous, now = Date.now()) {
  const validInteger = value => Number.isSafeInteger(value) && value >= 0;
  if (!validInteger(now) || now > Number.MAX_SAFE_INTEGER - RECOVERY_BLOCK_MS) {
    throw new Error('RECOVERY_ATTEMPT_STATE');
  }
  const state = previous == null ? {attempts: 0, windowStartedAt: now, blockedUntil: 0} : previous;
  if (typeof state !== 'object' || Array.isArray(state) ||
      !validInteger(state.attempts) || !validInteger(state.windowStartedAt) ||
      !validInteger(state.blockedUntil) || state.attempts >= Number.MAX_SAFE_INTEGER) {
    throw new Error('RECOVERY_ATTEMPT_STATE');
  }
  if (state.blockedUntil > now) {
    return {allowed: false, attempts: state.attempts, windowStartedAt: state.windowStartedAt, blockedUntil: state.blockedUntil};
  }
  const sameWindow = state.windowStartedAt > now - RECOVERY_WINDOW_MS;
  const attempts = (sameWindow ? state.attempts : 0) + 1;
  const windowStartedAt = sameWindow ? state.windowStartedAt : now;
  if (attempts > RECOVERY_MAX_ATTEMPTS) {
    return {allowed: false, attempts, windowStartedAt, blockedUntil: now + RECOVERY_BLOCK_MS};
  }
  return {allowed: true, attempts, windowStartedAt, blockedUntil: 0};
}

module.exports = {
  RECOVERY_CODE_LENGTH,
  hasRecentAuthentication,
  generateRecoveryCode,
  nextRecoveryAttemptState,
  normalizeRecoveryCode,
  recoveryAttemptId,
  recoveryCodeHash,
};
