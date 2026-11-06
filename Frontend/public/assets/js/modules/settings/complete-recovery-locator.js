const ID = /^[A-Za-z0-9._:-]{1,160}$/;
function validate(value, uid) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'backupId,contentDigest,operationId,uid' || value.uid !== uid ||
        ![value.uid, value.operationId, value.backupId].every(item => typeof item === 'string' && ID.test(item)) ||
        typeof value.contentDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.contentDigest)) throw new Error('RECOVERY_LOCATOR_INVALID');
    return {uid: value.uid, operationId: value.operationId, backupId: value.backupId, contentDigest: value.contentDigest};
}
export function createCompleteRecoveryLocatorStore({uid, storage} = {}) {
    if (typeof uid !== 'string' || !ID.test(uid)) throw new Error('RECOVERY_OWNER_INVALID');
    const key = `codex_complete_recovery_locator_v1:${uid}`;
    return Object.freeze({
        load() {
            try { const raw = storage?.getItem(key); return raw ? validate(JSON.parse(raw), uid) : null; }
            catch { return null; }
        },
        remember(value) {
            const locator = validate(value, uid);
            if (!storage || typeof storage.setItem !== 'function') throw new Error('RECOVERY_LOCATOR_UNAVAILABLE');
            try { storage.setItem(key, JSON.stringify(locator)); }
            catch { throw new Error('RECOVERY_LOCATOR_UNAVAILABLE'); }
        },
        clear(value) {
            const current = this.load();
            if (!current || current.operationId !== value?.operationId || current.contentDigest !== value?.contentDigest || value.uid !== uid) {
                throw new Error('RECOVERY_LOCATOR_INVALID');
            }
            try { storage.removeItem(key); }
            catch { throw new Error('RECOVERY_LOCATOR_UNAVAILABLE'); }
        }
    });
}
