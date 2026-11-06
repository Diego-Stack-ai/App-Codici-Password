'use strict';

const RECOVERY_TARGET = Object.freeze({projectId: 'appcodici-password', databaseId: '(default)',
  bucketName: 'appcodici-password.firebasestorage.app', appId: '1:343696844738:web:3e62fa1fdd9375535b985b',
  region: 'europe-west1'});
// Code-owned rollout only. No request, environment variable or browser setting
// can populate the cohort. Changing this policy is a separate reviewed release.
const RECOVERY_PRODUCTION_POLICY = Object.freeze({stage: 'disabled', canaryOwners: Object.freeze([])});
function freezeRecoveryPolicy(value) {
  if (!value || !['disabled', 'canary'].includes(value.stage) || !Array.isArray(value.canaryOwners) ||
      value.canaryOwners.length > 2 || Object.keys(value).sort().join(',') !== 'canaryOwners,stage') {
    throw new Error('FULL_RECOVERY_POLICY_INVALID');
  }
  const uids = new Set(), emails = new Set();
  const canaryOwners = value.canaryOwners.map(owner => {
    if (!owner || Object.keys(owner).sort().join(',') !== 'email,uid' ||
        !/^qa-recovery-[a-z0-9-]{1,100}$/.test(owner.uid || '') ||
        !/^codex\.recovery\.[a-z0-9][a-z0-9.-]{0,100}@example\.invalid$/.test(owner.email || '') ||
        uids.has(owner.uid) || emails.has(owner.email)) throw new Error('FULL_RECOVERY_POLICY_INVALID');
    uids.add(owner.uid); emails.add(owner.email);
    return Object.freeze({uid: owner.uid, email: owner.email});
  });
  return Object.freeze({stage: value.stage, canaryOwners: Object.freeze(canaryOwners)});
}
function isRecoveryCanary(request, policy) {
  return policy.stage === 'canary' && request?.auth?.token?.email_verified === true &&
    request.auth.token.firebase?.sign_in_provider === 'password' && request?.app?.appId === RECOVERY_TARGET.appId &&
    policy.canaryOwners.some(owner => owner.uid === request.auth.uid &&
      typeof request.auth.token.email === 'string' && owner.email === request.auth.token.email.toLowerCase());
}
module.exports = {RECOVERY_TARGET, RECOVERY_PRODUCTION_POLICY, freezeRecoveryPolicy, isRecoveryCanary};
