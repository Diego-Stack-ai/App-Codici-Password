// Prototype only: no persistence and no Firebase identity provider.
export function createMemoryVault({unlockKey, decryptRecord, encryptValue, openQueueWithKey, now = Date.now, timeoutMs = 60_000, onLock = () => {}}) {
    let key = null, uid = null, generation = 0, expiresAt = 0, unlocking = null;
    const queues = new Set();
    const disposeQueue = queue => { try { Promise.resolve(queue?.close?.()).catch(() => {}); } catch {} };
    function lock(reason = 'manual') {
        generation++;
        key = null;
        uid = null;
        expiresAt = 0;
        const pending = unlocking;
        unlocking = null;
        pending?.abort();
        for (const close of [...queues]) close();
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
        async openQueue(owner, {signal, domain} = {}) {
            const epoch = generation;
            assertCurrent(owner, epoch);
            if (typeof openQueueWithKey !== 'function') throw new Error('QUEUE_UNAVAILABLE');
            if (!signal || typeof signal.addEventListener !== 'function' ||
                !['private-account', 'offline-sync'].includes(domain)) throw new Error('QUEUE_CONTEXT_INVALID');
            const controller = new AbortController();
            let resource, closed = false;
            const close = () => {
                if (closed) return;
                closed = true; controller.abort(); queues.delete(close);
                signal.removeEventListener('abort', close);
                const previous = resource; resource = null; disposeQueue(previous);
            };
            const check = () => {
                assertCurrent(owner, epoch);
                if (closed || signal.aborted) throw new Error('QUEUE_DISPOSED');
            };
            queues.add(close); signal.addEventListener('abort', close, {once: true});
            try {
                check();
                const opened = await openQueueWithKey(key, {uid: owner, domain, signal: controller.signal,
                    isActive: () => { try { check(); return true; } catch { close(); return false; } }});
                if (closed) { disposeQueue(opened); throw new Error('QUEUE_DISPOSED'); }
                resource = opened; check();
                const methods = ['enqueue', 'flush', 'pendingForRecord', 'discard', 'replace'];
                if (!resource || typeof resource.close !== 'function' || methods.some(name => typeof resource[name] !== 'function')) throw new Error('QUEUE_CLIENT_INVALID');
                // Only scoped methods leave the Vault boundary; never factory
                // properties, key material, database handles or SDK instances.
                return Object.freeze({close, ...Object.fromEntries(methods.map(name => [name, async (...args) => {
                    check(); const result = await resource[name](...args); check(); return result;
                }]))});
            } catch (error) { close(); throw error; }
        },
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
