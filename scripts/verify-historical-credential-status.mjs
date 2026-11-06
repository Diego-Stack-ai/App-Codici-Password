import {X509Certificate} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// No private credential is read or used. These are public Google metadata URLs.
const issuer = 'gmail-sender@halogen-acumen-473312-f4.iam.gserviceaccount.com';
export const HISTORICAL_CERTIFICATE_URLS = Object.freeze([
  'https://www.googleapis.com/robot/v1/metadata/x509/' + encodeURIComponent(issuer),
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/' + encodeURIComponent(issuer)
]);
export const CONTROL_CERTIFICATE_URL =
  'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken%40system.gserviceaccount.com';

async function fetchMetadata(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
      headers: {Accept: 'application/json', 'Cache-Control': 'no-cache'}
    });
    return {status: response.status, payload: await response.json()};
  } catch {
    // Never print an uncontrolled response body or error message in CI logs.
    throw new Error('HISTORICAL_CREDENTIAL_STATUS_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

function validCertificateMap(payload, now) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const certificates = Object.entries(payload);
  if (certificates.length < 1 || certificates.length > 100) return false;
  return certificates.every(([keyId, pem]) => {
    if (!/^[a-f0-9]{40}$/i.test(keyId) || typeof pem !== 'string') return false;
    try {
      const certificate = new X509Certificate(pem);
      return Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo);
    } catch {
      return false;
    }
  });
}

export async function verifyHistoricalCredentialStatus({
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  now = Date.now()
} = {}) {
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 || timeoutMs > 30000 || !Number.isFinite(now)) {
    throw new Error('HISTORICAL_CREDENTIAL_STATUS_INVALID_OPTIONS');
  }
  const [control, ...targets] = await Promise.all([
    CONTROL_CERTIFICATE_URL,
    ...HISTORICAL_CERTIFICATE_URLS
  ].map(url => fetchMetadata(fetchImpl, url, timeoutMs)));
  if (control.status !== 200 || !validCertificateMap(control.payload, now)) {
    throw new Error('HISTORICAL_CREDENTIAL_CONTROL_FAILED');
  }
  if (!targets.every(({status, payload}) => status === 404 &&
      payload?.error?.code === 404 && payload.error.status === 'NOT_FOUND' &&
      payload.error.message === 'Requested entity was not found.')) {
    throw new Error('HISTORICAL_CREDENTIAL_ISSUER_ABSENCE_NOT_CONFIRMED');
  }
  return {checkedAt: new Date(now).toISOString(), issuerAbsent: true,
    targetStatuses: targets.map(item => item.status), controlStatus: control.status};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyHistoricalCredentialStatus().then(result => {
    console.log('Historical credential status: issuer absent at provider; ' +
      'two metadata 404 responses, valid control 200; checked at ' + result.checkedAt +
      '. Historical incident review remains open.');
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
