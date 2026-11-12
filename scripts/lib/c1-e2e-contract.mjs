import {FRAME_DIAG_CODES, validFrameDiagnosticEvent, FRAME_DIAG_MAX} from '../../Frontend/public/assets/js/modules/core/vault-frame-diagnostics.mjs';

export const C1_CASES = Object.freeze(['D02-core', 'D04-core', 'D05-A']);
export const C1_PROFILES = Object.freeze(['chrome-desktop', 'android-emulated', 'iphone-emulated']);
export const C1_AUTH_CODES = Object.freeze([
  'C1_AUTH_HTTP_APPCHECK', 'C1_AUTH_HTTP_IDENTITY', 'C1_AUTH_HTTP_FIRESTORE', 'C1_AUTH_HTTP_OTHER',
  'C1_AUTH_EMAIL_UNVERIFIED', 'C1_AUTH_NOT_READY'
]);
const httpFailureByAuth = Object.freeze({
  C1_AUTH_HTTP_APPCHECK: 'C1_HTTP_FAILURE_APPCHECK',
  C1_AUTH_HTTP_IDENTITY: 'C1_HTTP_FAILURE_IDENTITY',
  C1_AUTH_HTTP_FIRESTORE: 'C1_HTTP_FAILURE_FIRESTORE',
  C1_AUTH_HTTP_OTHER: 'C1_HTTP_FAILURE_OTHER'
});
export const C1_HTTP_FAILURE_CODES = Object.freeze(Object.values(httpFailureByAuth));
export const C1_CODES = Object.freeze([
  'C1_LOCAL_ONLY', 'C1_OPTIONS_INVALID', 'C1_TARGET_DENIED', 'C1_REPORT_INVALID',
  'C1_CONTINUITY_BROKEN', 'C1_DESTINATION_WRONG', 'C1_UNLOCK_MISSING',
  'C1_UNLOCK_REPEATED', 'C1_TECHNICAL', 'C1_PRODUCTION_NOT_IMPLEMENTED',
  'C1_EXECUTION_NOT_AUTHORIZED','C1_PLATFORM_UNSUPPORTED','C1_RELEASE_MISMATCH',
  ...C1_AUTH_CODES,...C1_HTTP_FAILURE_CODES,'C1_MFA_BLOCKED','C1_BOOTSTRAP_MISMATCH','C1_READINESS',
  'C1_NETWORK_FAILURE','C1_HTTP_FAILURE','C1_RUNTIME_FAILURE','C1_MODAL_UNEXPECTED',
  'C1_DIAG_UNAVAILABLE','C1_CONFIG_DOC_ROUTE_UNAVAILABLE','C1_TIMEOUT_NOT_LOCKED',
  'C1_TIMEOUT_BASELINE','C1_LOGOUT_FAILED','C1_REPORT_WRITE','C1_FIXTURE_MISSING','C1_ROUTE_UNAVAILABLE',
  'C1_UNEXPECTED_DIAG','C1_DIAG_TRUNCATED'
]);
// Only exact service hosts select a fixed code. Never retain/return the URL,
// credentials, path, query, response body or a provider's free error message.
export function authHttpFailureCode(url) {
  let host;
  try { host = typeof url === 'string' ? new URL(url).hostname : ''; } catch { host = ''; }
  switch (host) {
    case 'content-firebaseappcheck.googleapis.com':
    case 'firebaseappcheck.googleapis.com': return 'C1_AUTH_HTTP_APPCHECK';
    case 'identitytoolkit.googleapis.com':
    case 'securetoken.googleapis.com': return 'C1_AUTH_HTTP_IDENTITY';
    case 'firestore.googleapis.com': return 'C1_AUTH_HTTP_FIRESTORE';
    default: return 'C1_AUTH_HTTP_OTHER';
  }
}
export function httpFailureCode(status, url) {
  if (!Number.isInteger(status) || status < 400) return null;
  const authCode = authHttpFailureCode(url);
  return status === 401 || status === 403 ? authCode : httpFailureByAuth[authCode];
}
export function fail(code) {
  throw new Error(C1_CODES.includes(code) ? code : 'C1_TECHNICAL');
}
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).sort().join(',') === [...keys].sort().join(',');

// This prototype cannot accept a production URL, profile directory or credentials.
export function assertLoopback(url) {
  try {
    const value = new URL(url);
    if (value.protocol === 'http:' && value.hostname === '127.0.0.1' &&
        value.port && !value.username && !value.password) return value.origin;
  } catch { /* Never echo untrusted input. */ }
  fail('C1_LOCAL_ONLY');
}

// Proposed pre-Master guard, tested with invented metadata only. No SDK/ADC/admin imports.
export function qa2IdentityAllowed(actual, expected) {
  return !!(actual && expected && typeof expected.uid === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(expected.uid) &&
    expected.email === 'codex.qa2@appcodici-password.invalid' &&
    actual.uid === expected.uid && actual.email === expected.email &&
    actual.emailVerified === true && actual.projectId === 'appcodici-password' &&
    actual.canary === true);
}

export function validateDiag(report, now = Date.now()) {
  const fields = ['version','active','permitValid','permitExpiresAt','idleMs','pushReady','lastBlock'];
  if (!exact(report, ['state','enabled','available','events']) || !exact(report.state, fields) ||
      typeof report.enabled !== 'boolean' || typeof report.available !== 'boolean' ||
      !Array.isArray(report.events) || report.events.length > FRAME_DIAG_MAX) fail('C1_REPORT_INVALID');
  const s = report.state;
  if (typeof s.version !== 'string' || !/^v?\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(s.version) ||
      !['active','permitValid','pushReady'].every(k => typeof s[k] === 'boolean') ||
      !(s.permitExpiresAt === null || Number.isSafeInteger(s.permitExpiresAt) && s.permitExpiresAt > 0) ||
      !(s.idleMs === null || Number.isSafeInteger(s.idleMs) && s.idleMs > 0 && s.idleMs <= 43200000) ||
      !(s.lastBlock === null || FRAME_DIAG_CODES.includes(s.lastBlock)) ||
      !report.events.every(event => validFrameDiagnosticEvent(event, now))) fail('C1_REPORT_INVALID');
  // Reconstruct, do not spread input or attach arbitrary errors/metadata.
  return {
    state: Object.fromEntries(fields.map(k => [k, s[k]])),
    enabled: report.enabled, available: report.available,
    events: report.events.map(e => ({code:e.code,at:e.at,version:e.version,page:e.page,environment:e.environment}))
  };
}

export function safeFailure(error) {
  return C1_CODES.includes(error?.message) ? error.message : 'C1_TECHNICAL';
}
