// Candidate only: not imported by the application and does not upgrade its DB.
// The caller supplies a DB with a keyPath:'id' lease store in the SAME database
// as queued operations. Only mutations inside guardTransaction are fenced.
// A timer/lease cannot provide exclusive callbacks or prevent every stale send.
const fail = code => Object.assign(new Error(code), {code});
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value);

export function createIndexedDbQueueLease({database, storeName = 'queueLeases', uid, holderId,
    now = Date.now, ttlMs = 30_000} = {}) {
    if (!database?.transaction || !identifier(uid) || !identifier(holderId) || !identifier(storeName) ||
        typeof now !== 'function' || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw fail('LEASE_CONFIG_INVALID');

    function time() {
        const value = now();
        if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value + ttlMs)) throw fail('LEASE_CLOCK_INVALID');
        return value;
    }
    function validate(record, at) {
        if (record === undefined) return;
        if (!record || record.id !== uid || record.version !== 1 || !Number.isSafeInteger(record.token) || record.token < 1 ||
            !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0 ||
            !Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0 ||
            !(record.holderId === null ? record.expiresAt === 0 : identifier(record.holderId) && record.expiresAt > record.updatedAt)) {
            throw fail('LEASE_RECORD_INVALID');
        }
        // Backward wall-clock movement fails closed; it cannot extend ownership.
        if (at < record.updatedAt) throw fail('LEASE_CLOCK_REVERSED');
    }
    function transaction(mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, mode), store = tx.objectStore(storeName);
            let result, error;
            tx.oncomplete = () => resolve(result);
            tx.onabort = tx.onerror = () => reject(error || tx.error || fail('LEASE_TRANSACTION_ABORTED'));
            const request = store.get(uid);
            request.onsuccess = () => {
                try {
                    const at = time(); validate(request.result, at);
                    result = callback(request.result, at, store);
                } catch (cause) { error = cause; tx.abort(); }
            };
        });
    }
    function owned(record, token, at) {
        return !!record && record.holderId === holderId && record.token === token && record.expiresAt > at;
    }
    function handle(token) {
        return Object.freeze({token,
            isCurrent: () => transaction('readonly', (record, at) => owned(record, token, at)),
            renew: () => transaction('readwrite', (record, at, store) => {
                if (!owned(record, token, at)) return false;
                store.put({...record, updatedAt: at, expiresAt: at + ttlMs});
                return true;
            }),
            release: () => transaction('readwrite', (record, at, store) => {
                if (!owned(record, token, at)) return false;
                // Preserve the counter: deleting the lease would permit ABA.
                store.put({...record, holderId: null, expiresAt: 0, updatedAt: at});
                return true;
            }),
            // onValid must synchronously enqueue ONLY IndexedDB mutations on tx.
            // Aborting rolls those writes back, not network calls or other external
            // effects already started by a callback. Promise detection is misuse
            // detection, not cancellation of asynchronous work.
            guardTransaction(tx, onValid, onInvalid = () => {}) {
                if (tx.db !== database || tx.mode !== 'readwrite' || typeof onValid !== 'function' || typeof onInvalid !== 'function') {
                    throw fail('LEASE_GUARD_INVALID');
                }
                const request = tx.objectStore(storeName).get(uid);
                request.onsuccess = () => {
                    try {
                        const at = time(); validate(request.result, at);
                        if (!owned(request.result, token, at)) throw fail('LEASE_LOST');
                        const result = onValid();
                        if (result && typeof result.then === 'function') throw fail('LEASE_ASYNC_MUTATION_FORBIDDEN');
                    } catch (error) {
                        tx.abort();
                        onInvalid(error);
                    }
                };
            }
        });
    }
    return Object.freeze({
        acquire: () => transaction('readwrite', (record, at, store) => {
            if (record?.holderId !== null && record?.expiresAt > at) return null;
            const token = (record?.token || 0) + 1;
            if (!Number.isSafeInteger(token)) throw fail('LEASE_TOKEN_EXHAUSTED');
            store.put({id: uid, version: 1, holderId, token, updatedAt: at, expiresAt: at + ttlMs});
            return handle(token);
        })
    });
}
