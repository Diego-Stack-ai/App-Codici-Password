'use strict';

const {hasRecentAuthentication} = require('./recovery-security');
const {PART_BYTES, base64, exact, fail, assertCallableBodyCapacity} = require('./full-recovery-model');
const {isLocalFullRecoveryAdapter, isProductionFullRecoveryAdapter} = require('./full-recovery-adapter');
const ACTIONS = new Set(['prepare', 'abortChecking', 'repreview', 'uploadPart', 'finishAsset', 'publishChunk', 'finalize', 'cleanupParts']);
function createFullRecoveryCallable({localAdapter = null, productionAdapter = null, clock = Date.now} = {}) {
  return async request => {
    // Identity and ownership are evaluated before activation, without side effects.
    const uid = request?.auth?.uid, token = request?.auth?.token;
    if (!uid) fail('FULL_RECOVERY_UNAUTHENTICATED');
    if (token?.email_verified !== true) fail('FULL_RECOVERY_EMAIL_UNVERIFIED');
    if (!request?.app?.appId) fail('FULL_RECOVERY_APP_CHECK_REQUIRED');
    if (!hasRecentAuthentication(token, clock())) fail('FULL_RECOVERY_RECENT_AUTH_REQUIRED');
    const data = request.data;
    if (data?.content?.ownerUid !== uid || data?.finalize && data.finalize.ownerUid !== uid) fail('FULL_RECOVERY_OWNER_MISMATCH');
    const adapter = isLocalFullRecoveryAdapter(localAdapter) && productionAdapter === null ? localAdapter :
      localAdapter === null && isProductionFullRecoveryAdapter(productionAdapter) && productionAdapter.authorize(request) ? productionAdapter : null;
    if (!adapter) fail('FULL_RECOVERY_DISABLED');
    assertCallableBodyCapacity(data);
    if (!ACTIONS.has(data.action)) fail('FULL_RECOVERY_ACTION_INVALID');
    exact(data, ['action', 'operationId', 'content', ...({repreview: ['confirmation'], uploadPart: ['assetIndex', 'partIndex', 'bytes'], finishAsset: ['assetIndex'], publishChunk: ['chunkIndex'], finalize: ['finalize'], cleanupParts: ['assetIndex']}[data.action] || [])]);
    let bytes;
    try {
      if (data.action === 'uploadPart') {
        bytes = base64(data.bytes, undefined, PART_BYTES);
        if (bytes.length > PART_BYTES) fail('FULL_RECOVERY_PART_INVALID');
        return await adapter.runtime.uploadPart(uid, data, bytes);
      }
      if (Object.hasOwn(data, 'bytes')) fail('FULL_RECOVERY_SCHEMA_INVALID');
      return await adapter.runtime[data.action](uid, data);
    } finally { bytes?.fill(0); }
  };
}
module.exports = {createFullRecoveryCallable};
