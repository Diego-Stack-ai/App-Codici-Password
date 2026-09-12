// Prototype only: no persistence and no Firebase identity provider.
export function createMemoryVault({unlockKey, decryptRecord, encryptValue, now = Date.now, timeoutMs = 60_000, onLock = () => {}}) {
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
        async encrypt(owner, value) {
            const epoch = generation;
            assertCurrent(owner, epoch);
            if (typeof value !== 'string' || !value) throw new Error('PLAINTEXT_REQUIRED');
            if (typeof encryptValue !== 'function') throw new Error('ENCRYPTION_UNAVAILABLE');
            const ciphertext = await encryptValue(key, value);
            assertCurrent(owner, epoch);
            if (typeof ciphertext !== 'string' || !ciphertext) throw new Error('CIPHERTEXT_REQUIRED');
            return ciphertext;
        },
        touch() {
            if (isUnlocked()) expiresAt = now() + timeoutMs;
        }
    });
}
