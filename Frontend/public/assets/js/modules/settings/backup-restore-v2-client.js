// Code-owned activation; there is no request, storage or environment override.
// Production remains unchanged until an explicitly authorized deploy.
export function isBackupRestoreV2Enabled() { return true; }

function owner(uid) {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid)) {
        throw new Error('BACKUP_RESTORE_V2_INVALID_OWNER');
    }
    return uid;
}

export function createBackupRestoreV2PlanRequest(uid, commands) {
    if (!Array.isArray(commands) || !commands.length) throw new Error('BACKUP_RESTORE_V2_PLAN_INVALID');
    return Object.freeze({expectedOwnerUid: owner(uid), action: 'create', inputs: commands});
}

export function inspectBackupRestoreV2PlanRequest(uid, planId, commands) {
    if (typeof planId !== 'string' || !planId || !Array.isArray(commands) || !commands.length) {
        throw new Error('BACKUP_RESTORE_V2_PLAN_INVALID');
    }
    return Object.freeze({expectedOwnerUid: owner(uid), action: 'inspect', planId, inputs: commands});
}

export function reconstructBackupRestoreV2PlanRequest(uid, planId, backupId, records) {
    if (typeof planId !== 'string' || !planId || typeof backupId !== 'string' || !backupId ||
        !Array.isArray(records) || !records.length) throw new Error('BACKUP_RESTORE_V2_PLAN_INVALID');
    return Object.freeze({expectedOwnerUid: owner(uid), action: 'reconstruct', planId, backupId, records});
}

export function reconstructedBackupRestoreV2Commands(value) {
    if (!value || !Array.isArray(value.inputs) || !value.inputs.length || !Number.isSafeInteger(value.expiresAtMs)) {
        throw new Error('BACKUP_RESTORE_V2_RECONSTRUCTION_INVALID');
    }
    return Object.freeze(value.inputs);
}

export function confirmedBackupRestoreV2Prefix(value, commands) {
    if (!value || !Array.isArray(value.chunks) || value.chunks.length !== commands.length) {
        throw new Error('BACKUP_RESTORE_V2_INSPECTION_INVALID');
    }
    let confirmed = 0;
    for (let index = 0; index < value.chunks.length; index += 1) {
        const chunk = value.chunks[index];
        if (!chunk || chunk.operationId !== commands[index]?.operationId ||
            !['confirmed', 'unconfirmed'].includes(chunk.status)) {
            throw new Error('BACKUP_RESTORE_V2_INSPECTION_INVALID');
        }
        if (chunk.status === 'confirmed') {
            if (confirmed !== index) throw new Error('BACKUP_RESTORE_V2_INSPECTION_INVALID');
            confirmed += 1;
        }
    }
    return confirmed;
}

const LOCATOR_KEY = 'm8-backup-restore-v2-plan';

export function retainBackupRestoreV2Locator(storage, uid, backupId, value) {
    if (!storage || typeof storage.setItem !== 'function' || typeof backupId !== 'string' || !backupId ||
        typeof value?.planId !== 'string' || !value.planId || !Number.isSafeInteger(value.expiresAtMs)) {
        throw new Error('BACKUP_RESTORE_V2_PLAN_INVALID');
    }
    storage.setItem(LOCATOR_KEY, JSON.stringify({uid: owner(uid), backupId, planId: value.planId,
        expiresAtMs: value.expiresAtMs}));
}

export function loadBackupRestoreV2Locator(storage, uid, now = Date.now()) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
        const value = JSON.parse(storage.getItem(LOCATOR_KEY));
        if (value?.uid !== owner(uid) || typeof value.backupId !== 'string' || !value.backupId ||
            typeof value.planId !== 'string' || !value.planId || !Number.isSafeInteger(value.expiresAtMs) ||
            value.expiresAtMs <= now) return null;
        return Object.freeze(value);
    } catch { return null; }
}

export function clearBackupRestoreV2Locator(storage, uid, planId) {
    const current = loadBackupRestoreV2Locator(storage, uid, 0);
    if (current?.planId === planId && typeof storage?.removeItem === 'function') storage.removeItem(LOCATOR_KEY);
}
