// Prototype only: no persistence and no Firebase identity provider.
export function createMemoryVault({unlockKey, decryptRecord, now = Date.now, timeoutMs = 60_000, onLock = () => {}}) {
    let key = null, uid = null, generation = 0, expiresAt = 0, unlocking = null;
    function lock(reason = 'manual') {
        generation++;
        key = null;
        uid = null;
        expiresAt = 0;
        const pending = unlocking;
        unlocking = null;
        pending?.abort();
        onLock(reason);
    }
    function isUnlocked() {
        if (key && now() >= expiresAt) lock('timeout');
        return key !== null;
    }
    function assertCurrent(owner, epoch) {
        if (!isUnlocked() || owner !== uid || epoch !== generation) throw new Error('VAULT_LOCKED');
    }
    return Object.freeze({
        lock,
        isUnlocked,
        async unlock(owner) {
            lock('unlock-start');
            const epoch = generation;
            const current = new AbortController();
            unlocking = current;
            let candidate;
            try { candidate = await unlockKey(owner, {signal: current.signal}); }
            finally { if (unlocking === current) unlocking = null; }
            if (epoch !== generation) throw new Error('UNLOCK_CANCELLED');
            if (!owner || !candidate) throw new Error('UNLOCK_FAILED');
            uid = owner;
            key = candidate;
            expiresAt = now() + timeoutMs;
        },
        async read(owner, record) {
            const epoch = generation;
            assertCurrent(owner, epoch);
            const value = await decryptRecord(key, record);
            assertCurrent(owner, epoch);
            return value;
        },
        touch() {
            if (isUnlocked()) expiresAt = now() + timeoutMs;
        }
    });
}
