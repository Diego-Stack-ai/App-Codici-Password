'use strict';

const {fail} = require('./full-recovery-model');
const {fullRecoveryRuntimeTarget} = require('./full-recovery-runtime');
const {RECOVERY_TARGET, freezeRecoveryPolicy, isRecoveryCanary} = require('./full-recovery-policy');
const localAdapters = new WeakSet();
const productionAdapters = new WeakSet();
function loopback(host) { return typeof host === 'string' && /^(?:127\.0\.0\.1|localhost|\[::1\]):[1-9][0-9]{0,4}$/.test(host) && Number(host.split(':').at(-1)) <= 65535; }
// Explicit local construction only: process.env never opens an activation gate.
// This does not export a Firebase Function or install an index entry point.
function createLocalFullRecoveryAdapter({runtime, localTestOnly, projectId, firestoreHost, storageHost} = {}) {
  if (localTestOnly !== true || typeof projectId !== 'string' || !/^demo-[a-z0-9-]{1,60}$/.test(projectId) || !loopback(firestoreHost) || !loopback(storageHost) || !runtime || ['prepare', 'abortChecking', 'repreview', 'uploadPart', 'finishAsset', 'publishChunk', 'finalize', 'cleanupParts'].some(key => typeof runtime[key] !== 'function')) fail('FULL_RECOVERY_LOCAL_CONFIGURATION_REQUIRED');
  const target = fullRecoveryRuntimeTarget(runtime);
  if (!target || target.projectId !== projectId || target.firestoreHost !== firestoreHost || target.storageEndpoint !== `http://${storageHost}` || ![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(target.bucketName)) fail('FULL_RECOVERY_LOCAL_TARGET_MISMATCH');
  const adapter = Object.freeze({runtime, projectId}); localAdapters.add(adapter); return adapter;
}
function isLocalFullRecoveryAdapter(value) { return localAdapters.has(value); }
function createProductionFullRecoveryAdapter({runtime, policy} = {}) {
  const frozenPolicy = freezeRecoveryPolicy(policy), target = fullRecoveryRuntimeTarget(runtime);
  if (!target || target.projectId !== RECOVERY_TARGET.projectId || target.databaseId !== RECOVERY_TARGET.databaseId ||
      target.bucketName !== RECOVERY_TARGET.bucketName || target.storageProjectId !== RECOVERY_TARGET.projectId ||
      !['https://storage.googleapis.com', 'https://storage.googleapis.com/'].includes(target.storageEndpoint) ||
      ![null, 'firestore.googleapis.com', 'firestore.googleapis.com:443'].includes(target.firestoreHost) ||
      ![null, 'firestore.googleapis.com'].includes(target.firestoreServicePath) ||
      ![null, 'firestore.googleapis.com', 'firestore.googleapis.com:443'].includes(target.firestoreApiEndpoint) ||
      ![null, 'googleapis.com'].includes(target.firestoreUniverseDomain) ||
      ![null, 443].includes(target.firestorePort) || target.firestoreSsl !== true) fail('FULL_RECOVERY_PRODUCTION_TARGET_MISMATCH');
  const adapter = Object.freeze({runtime, projectId: RECOVERY_TARGET.projectId,
    authorize: request => isRecoveryCanary(request, frozenPolicy)});
  productionAdapters.add(adapter); return adapter;
}
function isProductionFullRecoveryAdapter(value) { return productionAdapters.has(value); }
module.exports = {createLocalFullRecoveryAdapter, isLocalFullRecoveryAdapter,
  createProductionFullRecoveryAdapter, isProductionFullRecoveryAdapter};
