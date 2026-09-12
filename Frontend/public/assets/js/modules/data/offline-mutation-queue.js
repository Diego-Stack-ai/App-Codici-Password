const DB_VERSION = 1;
const STORE = 'encryptedOperations';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(value) {
    let binary = '';
    for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function assertIdentity(uid, operation) {
    if (!uid || operation?.uid !== uid || !operation.operationId || !operation.recordId) {
        throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
    }
}

function comparableJson(value) {
    return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export async function deriveOfflineQueueKey(vaultKeyMaterial, uid) {
    if (!vaultKeyMaterial || !uid) throw new Error('OFFLINE_QUEUE_KEY_REQUIRED');
    const material = await crypto.subtle.importKey(
        'raw', encoder.encode(String(vaultKeyMaterial)), 'HKDF', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey({
        name: 'HKDF', hash: 'SHA-256',
        salt: encoder.encode(`CodiciPassword:offline-queue:salt:${uid}`),
        info: encoder.encode('CodiciPassword:offline-queue:v1')
    }, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

export async function sealOfflineOperation(operation, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = encoder.encode(`CodiciPassword:offline-operation:v1:${operation.uid}:${operation.operationId}`);
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: aad}, key, encoder.encode(JSON.stringify(operation))
    );
    return {
        id: `${operation.uid}:${operation.operationId}`,
        uid: operation.uid,
        operationId: operation.operationId,
        schemaVersion: 1,
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext),
        queuedAt: Date.now()
    };
}

export async function openOfflineOperation(container, key, uid) {
    if (container?.schemaVersion !== 1 || container.uid !== uid) throw new Error('OFFLINE_QUEUE_SCOPE_INVALID');
    const aad = encoder.encode(`CodiciPassword:offline-operation:v1:${uid}:${container.operationId}`);
    const clear = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: base64ToBytes(container.iv), additionalData: aad
    }, key, base64ToBytes(container.ciphertext));
    const operation = JSON.parse(decoder.decode(clear));
    assertIdentity(uid, operation);
    if (operation.operationId !== container.operationId) throw new Error('OFFLINE_OPERATION_ID_MISMATCH');
    return operation;
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('INDEXED_DB_REQUEST_FAILED'));
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error || new Error('INDEXED_DB_TRANSACTION_ABORTED'));
        transaction.onerror = () => reject(transaction.error || new Error('INDEXED_DB_TRANSACTION_FAILED'));
    });
}

async function openDatabase(uid, indexedDb = globalThis.indexedDB) {
    if (!indexedDb) throw new Error('INDEXED_DB_UNAVAILABLE');
    const request = indexedDb.open(`codex-offline-queue-${uid}`, DB_VERSION);
    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
            const store = request.result.createObjectStore(STORE, {keyPath: 'id'});
            store.createIndex('queuedAt', 'queuedAt');
        }
    };
    return requestResult(request);
}

export async function createOfflineMutationQueue({uid, vaultKeyMaterial, indexedDb} = {}) {
    if (!uid) throw new Error('OFFLINE_QUEUE_UID_REQUIRED');
    const [database, key] = await Promise.all([
        openDatabase(uid, indexedDb), deriveOfflineQueueKey(vaultKeyMaterial, uid)
    ]);
    async function swap(expectedOperation, replacement, {isActive = () => true} = {}, sameId = false) {
            const checkActive = () => { if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED'); };
            checkActive();
            const expected = JSON.parse(JSON.stringify(expectedOperation));
            const next = JSON.parse(JSON.stringify(replacement));
            assertIdentity(uid, expected);
            assertIdentity(uid, next);
            if (expected.recordId !== next.recordId || (expected.operationId === next.operationId) !== sameId) {
                throw new Error('OFFLINE_REPLACEMENT_SCOPE_INVALID');
            }
            const read = database.transaction(STORE, 'readonly');
            const readDone = transactionDone(read);
            const [original] = await Promise.all([requestResult(read.objectStore(STORE).get(`${uid}:${expected.operationId}`)), readDone]);
            checkActive();
            if (!original) throw new Error('OFFLINE_REPLACEMENT_MISSING');
            const decoded = await openOfflineOperation(original, key, uid);
            checkActive();
            if (comparableJson(decoded) !== comparableJson(expected)) throw new Error('OFFLINE_REPLACEMENT_CHANGED');
            const sealed = await sealOfflineOperation(next, key);
            checkActive();
            sealed.queuedAt = original.queuedAt;

            // Crypto must finish before IndexedDB starts: the final transaction only performs the CAS and writes.
            const tx = database.transaction(STORE, 'readwrite');
            const done = transactionDone(tx);
            const store = tx.objectStore(STORE);
            const current = store.get(original.id);
            const collision = store.get(sealed.id);
            let remaining = 2, failure;
            const commit = () => {
                if (--remaining) return;
                try { checkActive(); } catch (error) { failure = error; return tx.abort(); }
                if (!current.result || comparableJson(current.result) !== comparableJson(original)) {
                    failure = new Error('OFFLINE_REPLACEMENT_CHANGED');
                } else if (!sameId && collision.result) {
                    failure = new Error('OFFLINE_REPLACEMENT_EXISTS');
                }
                if (failure) return tx.abort();
                store.delete(original.id);
                store.add(sealed);
            };
            current.onsuccess = commit;
            collision.onsuccess = commit;
            try { await done; } catch (error) { throw failure || error; }
            return sealed.operationId;
    }
    return {
        async enqueue(operation) {
            assertIdentity(uid, operation);
            const container = await sealOfflineOperation(operation, key);
            const tx = database.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(container);
            await transactionDone(tx);
            return container.operationId;
        },
        replace(expectedOperation, replacement, options) {
            return swap(expectedOperation, replacement, options);
        },
        async markForReview(expectedOperation, options) {
            const expected = JSON.parse(JSON.stringify(expectedOperation));
            const marked = {...expected, _queueState: 'reconciliation-required'};
            await swap(expected, marked, options, true);
            return marked;
        },
        async list() {
            const tx = database.transaction(STORE, 'readonly');
            const containers = await requestResult(tx.objectStore(STORE).index('queuedAt').getAll());
            await transactionDone(tx);
            const operations = [];
            for (const container of containers) operations.push(await openOfflineOperation(container, key, uid));
            return operations;
        },
        async remove(operationId) {
            const tx = database.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(`${uid}:${operationId}`);
            await transactionDone(tx);
        },
        close() { database.close(); }
    };
}

export async function withOfflineQueueLease(uid, task, locks = globalThis.navigator?.locks) {
    if (!locks?.request) throw new Error('OFFLINE_QUEUE_LOCKS_UNAVAILABLE');
    return locks.request(`codex-offline-queue-${uid}`, {mode: 'exclusive', ifAvailable: true}, lock => {
        if (!lock) return {acquired: false};
        return Promise.resolve(task()).then(value => ({acquired: true, value}));
    });
}

export function createOfflineQueueChannel(uid, onChange, Broadcast = globalThis.BroadcastChannel) {
    if (!Broadcast) return {notify() {}, close() {}};
    const channel = new Broadcast(`codex-offline-queue-${uid}`);
    channel.onmessage = event => {
        if (event.data?.uid === uid && event.data?.type === 'changed') onChange?.();
    };
    return {
        notify() { channel.postMessage({type: 'changed', uid}); },
        close() { channel.close(); }
    };
}
