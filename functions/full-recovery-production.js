'use strict';

const {hasRecentAuthentication} = require('./recovery-security');
const {assertCallableBodyCapacity, fail} = require('./full-recovery-model');
const {createFullRecoveryRuntime} = require('./full-recovery-runtime');
const {createProductionFullRecoveryAdapter} = require('./full-recovery-adapter');
const {createFullRecoveryCallable} = require('./full-recovery-callable');
const {createRecoveryAssetReaderService} = require('./recovery-asset-reader');
const {RECOVERY_TARGET, RECOVERY_PRODUCTION_POLICY, freezeRecoveryPolicy, isRecoveryCanary} = require('./full-recovery-policy');
const {toRecoveryHttpsError} = require('./full-recovery-errors');

const RECOVERY_CALLABLE_OPTIONS = Object.freeze({region: RECOVERY_TARGET.region, enforceAppCheck: true,
  memory: '512MiB', concurrency: 1, maxInstances: 1, timeoutSeconds: 120});
const RECOVERY_CLIENT_TIMEOUT_MS = 130000;
function requireIdentity(request, prefix, now) {
  const uid = request?.auth?.uid, token = request?.auth?.token;
  if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid)) fail(`${prefix}_UNAUTHENTICATED`);
  if (token?.email_verified !== true || typeof token.email !== 'string' || !token.email.trim()) {
    fail(prefix === 'RECOVERY_ASSET' ? 'RECOVERY_ASSET_VERIFIED_EMAIL_REQUIRED' : 'FULL_RECOVERY_EMAIL_UNVERIFIED');
  }
  if (request?.app?.appId !== RECOVERY_TARGET.appId) fail(`${prefix}_APP_CHECK_REQUIRED`);
  if (!hasRecentAuthentication(token, now)) fail(`${prefix}_RECENT_AUTH_REQUIRED`);
  const owner = prefix === 'RECOVERY_ASSET' ? request.data?.expectedOwnerUid : request.data?.content?.ownerUid;
  if (owner !== uid || request.data?.finalize && request.data.finalize.ownerUid !== uid) fail(`${prefix}_OWNER_MISMATCH`);
}
// Registration is inert with the code-owned policy below. SDK construction and
// every I/O are deferred until a reviewed canary identity passes all guards.
function createProductionRecoveryCallables({onCall, HttpsError, getFirestore, getStorage,
  Timestamp, FieldValue, clock = Date.now, policy = RECOVERY_PRODUCTION_POLICY} = {}) {
  if ([onCall, HttpsError, getFirestore, getStorage, Timestamp, FieldValue?.serverTimestamp, clock].some(value => typeof value !== 'function')) {
    throw new Error('FULL_RECOVERY_ADAPTER_REQUIRED');
  }
  const rollout = freezeRecoveryPolicy(policy);
  let services;
  function getServices() {
    if (!services) {
      const db = getFirestore(), bucket = getStorage().bucket(RECOVERY_TARGET.bucketName);
      const runtime = createFullRecoveryRuntime({db, bucket, clock, types: {
        timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
        bytes: value => Buffer.from(value), now: () => FieldValue.serverTimestamp()
      }});
      const productionAdapter = createProductionFullRecoveryAdapter({runtime, policy: rollout});
      services = Object.freeze({restore: createFullRecoveryCallable({productionAdapter, clock}),
        reader: createRecoveryAssetReaderService({db, bucket, now: clock, configuredBucket: RECOVERY_TARGET.bucketName, enabled: true})});
    }
    return services;
  }
  const handler = prefix => async request => {
    try {
      requireIdentity(request, prefix, clock());
      if (!isRecoveryCanary(request, rollout)) fail(`${prefix}_DISABLED`);
      assertCallableBodyCapacity(request.data);
      const current = getServices();
      return await (prefix === 'RECOVERY_ASSET' ? current.reader.handle(request) : current.restore(request));
    } catch (error) { throw toRecoveryHttpsError(error, prefix, HttpsError); }
  };
  return Object.freeze({
    manageFullVaultRecovery: onCall(RECOVERY_CALLABLE_OPTIONS, handler('FULL_RECOVERY')),
    readRecoveryBackupAsset: onCall(RECOVERY_CALLABLE_OPTIONS, handler('RECOVERY_ASSET'))
  });
}
module.exports = {createProductionRecoveryCallables, RECOVERY_CALLABLE_OPTIONS, RECOVERY_CLIENT_TIMEOUT_MS, requireIdentity};
