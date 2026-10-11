const {createHash} = require('node:crypto');
const {createBackupRestoreBinding, verifyBackupRestoreReceipt} = require('./backup-restore-receipt');
const {validateRestoreChunk} = require('./backup-restore-service');
const {prepareBackupRestoreV2Plan, reconstructBackupRestoreV2Commands,
  verifyBackupRestoreV2Plan} = require('./backup-restore-v2-plan');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function digest(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function deterministicPlanId(uid, inputs) {
  if (!Array.isArray(inputs) || !inputs.length) fail('BACKUP_RESTORE_V2_PLAN_INVALID');
  const identity = `${uid}\n${inputs.map(input => `${input?.backupId || ''}:${input?.operationId || ''}`).join('\n')}`;
  return digest(identity);
}

function createBackupRestoreV2Runtime({db, now = Date.now}) {
  if (!db || typeof db.doc !== 'function' || typeof db.runTransaction !== 'function') {
    fail('BACKUP_RESTORE_V2_NOT_CONFIGURED');
  }
  const ref = (uid, planId) => db.doc(`backupRestorePlans/${uid}/plans/${digest(planId)}`);
  const receiptRef = (uid, operationId) => db.doc(`mutationResults/${uid}/operations/${operationId}`);
  const load = async (uid, planId) => {
    const snapshot = await ref(uid, planId).get();
    if (!snapshot.exists) fail('BACKUP_RESTORE_V2_PLAN_MISSING');
    return snapshot.data();
  };
  return Object.freeze({
    async execute(uid, data) {
      if (!data || data.expectedOwnerUid !== uid || typeof data.action !== 'string') {
        fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
      }
      const allowed = names => Object.keys(data).every(key => names.includes(key));
      if (data.action === 'create') {
        if (!allowed(['expectedOwnerUid', 'action', 'inputs'])) fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
        return this.create(uid, data.inputs);
      }
      if (data.action === 'reconstruct') {
        if (!allowed(['expectedOwnerUid', 'action', 'planId', 'backupId', 'records'])) {
          fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
        }
        return this.reconstruct(uid, data.planId, data.backupId, data.records);
      }
      if (data.action === 'inspect') {
        if (!allowed(['expectedOwnerUid', 'action', 'planId', 'inputs'])) {
          fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
        }
        return this.inspect(uid, data.planId, data.inputs);
      }
      if (data.action === 'removeExpired') {
        if (!allowed(['expectedOwnerUid', 'action', 'planId'])) fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
        return this.removeExpired(uid, data.planId);
      }
      fail('BACKUP_RESTORE_V2_REQUEST_INVALID');
    },
    async create(uid, inputs) {
      const commands = structuredClone(inputs);
      const planId = deterministicPlanId(uid, commands);
      const candidate = prepareBackupRestoreV2Plan(uid, planId, commands, now());
      const reference = ref(uid, planId);
      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const plan = verifyBackupRestoreV2Plan(snapshot.data(), uid, planId, commands, now());
          return {planId, expiresAtMs: plan.expiresAtMs, duplicate: true};
        }
        transaction.create(reference, candidate);
        return {planId, expiresAtMs: candidate.expiresAtMs, duplicate: false};
      });
    },
    async reconstruct(uid, planId, backupId, records) {
      return reconstructBackupRestoreV2Commands(await load(uid, planId), uid, planId, backupId,
        structuredClone(records), now());
    },
    async inspect(uid, planId, inputs) {
      const commands = structuredClone(inputs);
      verifyBackupRestoreV2Plan(await load(uid, planId), uid, planId, commands, now());
      const snapshots = await Promise.all(commands.map(input => receiptRef(uid, input.operationId).get()));
      return {chunks: commands.map((input, index) => {
        if (!snapshots[index].exists) return {operationId: input.operationId, status: 'unconfirmed'};
        const command = validateRestoreChunk(input, uid);
        try {
          verifyBackupRestoreReceipt(snapshots[index].data(), createBackupRestoreBinding({uid, command}));
          return {operationId: input.operationId, status: 'confirmed'};
        } catch { fail('BACKUP_RESTORE_V2_RECEIPT_INVALID'); }
      })};
    },
    async removeExpired(uid, planId) {
      const reference = ref(uid, planId);
      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return {status: 'absent'};
        const plan = snapshot.data();
        if (plan.ownerUid !== uid || plan.planId !== planId || !Number.isSafeInteger(plan.expiresAtMs)) {
          fail('BACKUP_RESTORE_V2_PLAN_INVALID');
        }
        if (now() < plan.expiresAtMs) return {status: 'retained'};
        transaction.delete(reference);
        return {status: 'removed'};
      });
    }
  });
}

module.exports = {createBackupRestoreV2Runtime, deterministicPlanId};
