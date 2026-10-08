import {deriveOfflineQueueKey, sealOfflineOperation, openOfflineOperation} from '../../Frontend/public/assets/js/modules/data/offline-mutation-queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';

// Candidate only. Caller supplies an existing schema 2 DB, never upgraded here.
// Each mutation checks lease and ciphertext CAS in one multi-store transaction.
const fail = code => Object.assign(new Error(code), {code});
const equal = (a, b) => JSON.stringify(a, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value) ===
    JSON.stringify(b, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
const clone = value => JSON.parse(JSON.stringify(value));
const identity = (uid, operation) => {
    if (operation?.uid !== uid || typeof operation.operationId !== 'string' || !operation.operationId ||
        typeof operation.recordId !== 'string' || !operation.recordId) throw fail('FENCED_QUEUE_SCOPE');
};

export async function createFencedQueueWriter({database, uid, vaultKeyMaterial, ...coordination}) {
    if (database?.name !== `codex-offline-queue-${uid}` || database.version !== 2 ||
        !['queueLeases', 'encryptedOperations'].every(name => database.objectStoreNames.contains(name))) throw fail('FENCED_QUEUE_SCHEMA');
    const schema = database.transaction(['queueLeases', 'encryptedOperations'], 'readonly');
    for (const name of ['queueLeases', 'encryptedOperations']) {
        const store = schema.objectStore(name);
        if (store.keyPath !== 'id' || store.autoIncrement) throw fail('FENCED_QUEUE_SCHEMA');
    }
    let key;
    try { key = await deriveOfflineQueueKey(vaultKeyMaterial, uid); }
    finally { vaultKeyMaterial = null; }
    let closed = false;
    const coordinator = createHybridQueueCoordinator({database, uid, ...coordination});
    return Object.freeze({
        close() { closed = true; key = null; },
        run(task, options = {}) {
        if (closed) return Promise.reject(fail('FENCED_QUEUE_CLOSED'));
        const {isActive = () => true} = options;
        if (typeof isActive !== 'function') return Promise.reject(fail('FENCED_QUEUE_CONFIG'));
        return coordinator.run(async context => {
            async function mutate(kind, supplied, replacement) {
                const expected = clone(supplied), next = replacement == null ? null : clone(replacement);
                identity(uid, expected); if (next) identity(uid, next);
                if (next && (next.recordId !== expected.recordId ||
                    (kind === 'replace' && next.operationId === expected.operationId))) throw fail('FENCED_QUEUE_SCOPE');
                await context.checkCurrent();
                const id = `${uid}:${expected.operationId}`;
                const original = await new Promise((resolve, reject) => {
                    const tx = database.transaction('encryptedOperations', 'readonly');
                    const request = tx.objectStore('encryptedOperations').get(id);
                    tx.oncomplete = () => resolve(request.result);
                    tx.onabort = tx.onerror = () => reject(tx.error || fail('FENCED_QUEUE_READ'));
                });
                await context.checkCurrent();
                if (!original && kind !== 'enqueue') throw fail('FENCED_QUEUE_MISSING');
                if (original && !equal(await openOfflineOperation(original, key, uid), expected)) throw fail('FENCED_QUEUE_CHANGED');
                await context.checkCurrent();
                const sealed = kind === 'remove' ? null : kind === 'enqueue' && original ? original
                    : await sealOfflineOperation(next || expected, key);
                if (sealed && original) sealed.queuedAt = original.queuedAt;
                await context.checkCurrent();
                await new Promise((resolve, reject) => {
                    const tx = database.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                    let failure;
                    const abort = error => { failure = error; tx.abort(); };
                    tx.oncomplete = resolve;
                    tx.onabort = tx.onerror = () => reject(failure || tx.error || fail('FENCED_QUEUE_WRITE'));
                    try {
                        context.guardTransaction(tx, () => {
                            const store = tx.objectStore('encryptedOperations');
                            const current = store.get(id), collision = store.get(sealed?.id || id);
                            let pending = 2;
                            const ready = () => {
                                if (--pending) return;
                                if (!equal(current.result, original)) return abort(fail('FENCED_QUEUE_CHANGED'));
                                if (sealed && sealed.id !== id && collision.result) return abort(fail('FENCED_QUEUE_COLLISION'));
                                // Recheck ownership/session immediately before the actual writes too.
                                context.guardTransaction(tx, () => {
                                    if (kind === 'remove') store.delete(id);
                                    else if (kind !== 'enqueue' || !original) {
                                        if (original) store.delete(id);
                                        store.add(sealed);
                                    }
                                }, error => { failure = error; });
                            };
                            current.onsuccess = collision.onsuccess = ready;
                        }, error => { failure = error; });
                    } catch (error) { abort(error); }
                });
                await context.checkCurrent();
                return next || expected;
            }
            return task(Object.freeze({
                signal: context.signal,
                checkCurrent: context.checkCurrent,
                renew: context.renew,
                async list() {
                    await context.checkCurrent();
                    const containers = await new Promise((resolve, reject) => {
                        const tx = database.transaction('encryptedOperations', 'readonly');
                        const request = tx.objectStore('encryptedOperations').getAll();
                        tx.oncomplete = () => resolve(request.result);
                        tx.onabort = tx.onerror = () => reject(tx.error || fail('FENCED_QUEUE_READ'));
                    });
                    await context.checkCurrent();
                    containers.sort((a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id));
                    const operations = [];
                    try {
                        for (const container of containers) {
                            await context.checkCurrent();
                            operations.push(await openOfflineOperation(container, key, uid));
                            await context.checkCurrent();
                        }
                        return operations;
                    } catch (error) { operations.length = 0; throw error; }
                },
                enqueue: operation => mutate('enqueue', operation),
                remove: expected => mutate('remove', expected),
                replace: (expected, replacement) => mutate('replace', expected, replacement),
                markForReview(expected, reason) {
                    if (!['LEGACY_MUTATION_RESULT_UNVERIFIED', 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'].includes(reason)) throw fail('FENCED_QUEUE_REASON');
                    return mutate('review', expected, {...expected, _queueState: 'reconciliation-required', _reviewReason: reason});
                }
            }));
        }, {...options, isActive: () => !closed && isActive()});
    }});
}
