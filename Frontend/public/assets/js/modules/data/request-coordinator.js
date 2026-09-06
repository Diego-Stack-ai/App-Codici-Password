const pendingReads = new Map();

// Deduplica solo le letture contemporanee: Firestore conserva la responsabilità della cache persistente.
export function coalesceRead(key, operation) {
    if (!key || typeof operation !== 'function') throw new Error('DATA_READ_INVALID');
    if (pendingReads.has(key)) return pendingReads.get(key);
    const pending = Promise.resolve().then(operation).finally(() => {
        if (pendingReads.get(key) === pending) pendingReads.delete(key);
    });
    pendingReads.set(key, pending);
    return pending;
}

export function clearPendingReads() { pendingReads.clear(); }
export function pendingReadCount() { return pendingReads.size; }
