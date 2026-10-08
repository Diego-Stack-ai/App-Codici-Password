const DB_VERSION = 1;
const STORE = 'encryptedOperations';
const LEASE_STORE = 'queueLeases';
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

export async function openOfflineQueueDatabase(uid, indexedDb = globalThis.indexedDB,
    {signal, isActive = () => true, timeoutMs = 10000} = {}) {
    if (!indexedDb) throw new Error('INDEXED_DB_UNAVAILABLE');
    if (!uid || typeof isActive !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
        throw new Error('OFFLINE_QUEUE_CONFIG_INVALID');
    }
    const check = () => {
        if (signal?.aborted || !isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
    };
    check();
    return new Promise((resolve, reject) => {
        let settled = false;
        // [M6-A-8a] Apertura **senza imporre una versione**: un database v1 o v2 esistente viene usato
        // così com'è (né downgrade né upgrade automatico); uno assente nasce v1 con lo stesso store
        // di prima. L'upgrade a v2 resta un'azione esplicita e separata.
        const request = indexedDb.open(`codex-offline-queue-${uid}`);
        const finish = (error, database) => {
            if (settled) { database?.close(); return; }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            if (error) reject(error); else resolve(database);
        };
        const abort = () => finish(new Error('OFFLINE_SESSION_CHANGED'));
        const timer = setTimeout(() => finish(new Error('OFFLINE_QUEUE_OPEN_TIMEOUT')), timeoutMs);
        signal?.addEventListener('abort', abort, {once: true});
        request.onblocked = () => finish(new Error('OFFLINE_QUEUE_DATABASE_BLOCKED'));
        request.onerror = () => finish(request.error || new Error('INDEXED_DB_REQUEST_FAILED'));
        request.onupgradeneeded = () => {
            try {
                if (settled) { request.transaction.abort(); return; }
                check();
                if (!request.result.objectStoreNames.contains(STORE)) {
                    const store = request.result.createObjectStore(STORE, {keyPath: 'id'});
                    store.createIndex('queuedAt', 'queuedAt');
                }
            } catch (error) { request.transaction.abort(); finish(error); }
        };
        request.onsuccess = () => {
            const database = request.result;
            // Cooperate with a future upgrade; old handles cannot start new transactions.
            database.onversionchange = () => database.close();
            try {
                check();
                // [M6-A-8a] Lo scrittore convive con uno schema **già** aggiornato: ammessi v1
                // (solo operazioni) e v2 (operazioni + store del lease, nello stesso database).
                // Nessun downgrade, nessun upgrade automatico; qualunque altro schema — o store
                // attesi mancanti — fallisce **chiuso** con indisponibilità dichiarata.
                const stores = database.version === 2 ? [STORE, LEASE_STORE] : [STORE];
                if (![1, 2].includes(database.version) || stores.some(name => !database.objectStoreNames.contains(name))) {
                    throw new Error('OFFLINE_QUEUE_SCHEMA_UNSUPPORTED');
                }
                // [M6-A-8a R1] Non basta la **presenza**: la struttura di ciascuno store atteso deve
                // essere quella prevista (`keyPath === 'id'`, nessun `autoIncrement`), la stessa che
                // verifica il lettore compatibile. Altrimenti lo scrittore rifiuta **prima** di
                // qualunque scrittura o conferma, invece di accodare su una coda che poi non sarebbe
                // leggibile per la sincronizzazione.
                const transaction = database.transaction(stores, 'readonly');
                for (const name of stores) {
                    const store = transaction.objectStore(name);
                    if (store.keyPath !== 'id' || store.autoIncrement) throw new Error('OFFLINE_QUEUE_SCHEMA_UNSUPPORTED');
                }
            } catch (error) { database.close(); finish(error); return; }
            finish(null, database);
        };
    });
}

// [M6-A-1] Lettore compatibile v1/v2, in sola lettura: apre senza versione (un database
// mancante resta mancante), non crea store, non migra e non scrive. Schema non riconosciuto
// o contenitore malformato falliscono chiusi, senza cancellare o ricreare il database.
export async function readOfflineQueueContainers({uid, indexedDb = globalThis.indexedDB, signal, isActive = () => true, timeoutMs = 10000} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || typeof isActive !== 'function' ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('QUEUE_READER_CONFIG');
    const check = () => { if (signal?.aborted || !isActive()) throw new Error('QUEUE_READER_SESSION'); };
    check();
    return new Promise((resolve, reject) => {
        let settled = false, database = null, transaction = null;
        const containers = [];
        const finish = (error, version) => {
            if (settled) { database?.close(); return; }
            settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
            if (error) { try { transaction?.abort(); } catch { /* transazione già conclusa */ } containers.length = 0; }
            database?.close();
            if (error) reject(error); else resolve({version, containers});
        };
        const abort = () => finish(new Error('QUEUE_READER_SESSION'));
        const timer = setTimeout(() => finish(new Error('QUEUE_READER_TIMEOUT')), timeoutMs);
        signal?.addEventListener('abort', abort, {once: true});
        let request;
        try { request = indexedDb.open(`codex-offline-queue-${uid}`); }
        catch (error) { finish(error); return; }
        request.onupgradeneeded = () => { request.transaction.abort(); finish(new Error('QUEUE_READER_MISSING')); };
        request.onerror = () => finish(request.error || new Error('QUEUE_READER_OPEN'));
        request.onblocked = () => finish(new Error('QUEUE_READER_BLOCKED'));
        request.onsuccess = () => {
            database = request.result;
            if (settled) { database.close(); return; }
            database.onversionchange = () => finish(new Error('QUEUE_READER_VERSION_CHANGED'));
            try {
                check();
                if (![1, 2].includes(database.version)) throw new Error('QUEUE_READER_SCHEMA');
                const stores = database.version === 2 ? [STORE, 'queueLeases'] : [STORE];
                if (stores.some(name => !database.objectStoreNames.contains(name))) throw new Error('QUEUE_READER_SCHEMA');
                transaction = database.transaction(stores, 'readonly');
                transaction.onabort = transaction.onerror = () => finish(new Error('QUEUE_READER_TRANSACTION'));
                transaction.oncomplete = () => { try { check(); finish(null, database.version); } catch (error) { finish(error); } };
                for (const name of stores) {
                    const store = transaction.objectStore(name);
                    if (store.keyPath !== 'id' || store.autoIncrement) throw new Error('QUEUE_READER_SCHEMA');
                }
                const cursorRequest = transaction.objectStore(STORE).openCursor();
                cursorRequest.onerror = () => finish(new Error('QUEUE_READER_READ'));
                cursorRequest.onsuccess = () => {
                    if (settled) return;
                    try {
                        check();
                        // `result` è il cursore finché ci sono righe, `null` alla fine.
                        const cursor = cursorRequest.result;
                        if (!cursor) return;
                        const value = cursor.value;
                        if (value?.uid !== uid || value.schemaVersion !== 1 || typeof value.operationId !== 'string' ||
                            !value.operationId || value.id !== `${uid}:${value.operationId}` ||
                            typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') {
                            throw new Error('QUEUE_READER_CONTAINER');
                        }
                        containers.push(value); cursor.continue();
                    } catch (error) { finish(error); }
                };
            } catch (error) { finish(error); }
        };
    });
}

// [M6-A-6] Percorso di **sola lettura** dell'app, basato sul lettore compatibile v1/v2 di M6-A-1:
// apre la coda senza imporre una versione (non crea, non aggiorna, non cancella e non riscrive il
// database) e restituisce uno **stato esplicito**. Se lo schema non è leggibile — sconosciuto,
// malformato o copia non compatibile — l'esito è `available: false` con `operations: null` e il
// motivo: **mai** una coda vuota e **mai** un salvataggio riuscito.
export async function createOfflineQueueReader({uid, vaultKeyMaterial, indexedDb, signal, isActive = () => true, timeoutMs = 10000} = {}) {
    if (!uid) throw new Error('OFFLINE_QUEUE_UID_REQUIRED');
    const key = await deriveOfflineQueueKey(vaultKeyMaterial, uid);
    return {
        async read() {
            try {
                const {version, containers} = await readOfflineQueueContainers({uid, indexedDb, signal, isActive, timeoutMs});
                const operations = [];
                for (const container of containers) operations.push(await openOfflineOperation(container, key, uid));
                return {available: true, version, operations, reason: null};
            } catch (error) {
                return {available: false, version: null, operations: null, reason: error?.code || error?.message};
            }
        }
    };
}

export async function createOfflineMutationQueue({uid, vaultKeyMaterial, indexedDb, signal, isActive = () => true} = {}) {
    if (!uid) throw new Error('OFFLINE_QUEUE_UID_REQUIRED');
    // Derive first: a failed key must not leave an unowned DB connection open.
    const key = await deriveOfflineQueueKey(vaultKeyMaterial, uid);
    const database = await openOfflineQueueDatabase(uid, indexedDb, {signal, isActive});
    // [M6-A-8c R1] Fencing del lease sulle scritture della coda. Quando il chiamante fornisce un
    // **contesto di lease** (solo il percorso del pilota con il fallback attivo), la transazione
    // readwrite finale nasce dalla **stessa connessione** del coordinatore e comprende lo store del
    // lease: `guardTransaction` verifica nella stessa transazione che il token sia ancora nostro e
    // solo allora esegue il confronto e la scrittura. Un titolare scaduto o subentrato riceve
    // `LEASE_LOST` e la transazione viene annullata: **zero** inserimenti, sostituzioni o rimozioni.
    // Senza contesto — percorso Web Locks e ogni altro chiamante — il codice è quello di sempre.
    function writeTransaction(lease) {
        return lease
            ? lease.transaction([STORE, LEASE_STORE], 'readwrite')
            : database.transaction(STORE, 'readwrite');
    }
    function guarded(tx, lease, onValid, onInvalid) {
        if (lease) { lease.guardTransaction(tx, onValid, onInvalid); return; }
        onValid();
    }
    async function swap(expectedOperation, replacement, {isActive = () => true, lease = null} = {}, sameId = false) {
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
            const tx = writeTransaction(lease);
            const done = transactionDone(tx);
            const store = tx.objectStore(STORE);
            let remaining = 2, failure;
            const run = () => {
                const current = store.get(original.id);
                const collision = store.get(sealed.id);
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
            };
            guarded(tx, lease, run, error => { failure = error; });
            try { await done; } catch (error) { throw failure || error; }
            return sealed.operationId;
    }
    return {
        async enqueue(operation, {isActive = () => true, lease = null} = {}) {
            const check = () => { if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED'); };
            check();
            const expected = JSON.parse(JSON.stringify(operation));
            assertIdentity(uid, expected);
            const read = database.transaction(STORE, 'readonly');
            const readDone = transactionDone(read);
            const [original] = await Promise.all([requestResult(read.objectStore(STORE).get(`${uid}:${expected.operationId}`)), readDone]);
            check();
            if (original && comparableJson(await openOfflineOperation(original, key, uid)) !== comparableJson(expected)) {
                throw new Error('OFFLINE_OPERATION_ID_REUSED');
            }
            const container = original || await sealOfflineOperation(expected, key);
            check();
            const tx = writeTransaction(lease);
            const done = transactionDone(tx), store = tx.objectStore(STORE);
            let failure;
            const run = () => {
                const current = store.get(container.id);
                current.onsuccess = () => {
                    try { check(); } catch (error) { failure = error; return tx.abort(); }
                    if (comparableJson(current.result) !== comparableJson(original)) {
                        failure = new Error('OFFLINE_OPERATION_CHANGED'); return tx.abort();
                    }
                    if (!original) store.add(container);
                };
            };
            guarded(tx, lease, run, error => { failure = error; });
            try { await done; } catch (error) { throw failure || error; }
            return container.operationId;
        },
        replace(expectedOperation, replacement, options) {
            return swap(expectedOperation, replacement, options);
        },
        async markForReview(expectedOperation, options) {
            const expected = JSON.parse(JSON.stringify(expectedOperation));
            const reason = options?.reviewReason;
            if (reason !== undefined && !['LEGACY_MUTATION_RESULT_UNVERIFIED', 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED', 'PRIVATE_ACCOUNT_MUTATION_INVALID'].includes(reason)) {
                throw new Error('OFFLINE_REVIEW_REASON_INVALID');
            }
            const marked = {...expected, _queueState: 'reconciliation-required', ...(reason ? {_reviewReason: reason} : {})};
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
        async remove(expectedOperation, {isActive = () => true, lease = null} = {}) {
            const check = () => { if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED'); };
            check();
            const expected = JSON.parse(JSON.stringify(expectedOperation));
            assertIdentity(uid, expected);
            const read = database.transaction(STORE, 'readonly');
            const readDone = transactionDone(read);
            const [original] = await Promise.all([requestResult(read.objectStore(STORE).get(`${uid}:${expected.operationId}`)), readDone]);
            check();
            if (!original) throw new Error('OFFLINE_ACK_MISSING');
            if (comparableJson(await openOfflineOperation(original, key, uid)) !== comparableJson(expected)) {
                throw new Error('OFFLINE_ACK_CHANGED');
            }
            check();
            const tx = writeTransaction(lease);
            const done = transactionDone(tx), store = tx.objectStore(STORE);
            let failure;
            const run = () => {
                const current = store.get(original.id);
                current.onsuccess = () => {
                    try { check(); } catch (error) { failure = error; return tx.abort(); }
                    if (!current.result || comparableJson(current.result) !== comparableJson(original)) {
                        failure = new Error('OFFLINE_ACK_CHANGED'); return tx.abort();
                    }
                    store.delete(original.id);
                };
            };
            guarded(tx, lease, run, error => { failure = error; });
            try { await done; } catch (error) { throw failure || error; }
        },
        // [M6-A-8a] Versione effettiva dello schema usato dallo scrittore (1 o 2).
        version: database.version,
        // [M6-A-6 R1] La connessione dello scrittore può essere chiusa **dopo** l'apertura da un
        // upgrade concorrente (reazione a `versionchange`). La coda non è più operabile e la
        // sincronizzazione deve rifiutare **prima** di qualsiasi effetto, non dopo un invio.
        isOperable() {
            try { database.transaction(STORE); return true; }
            catch { return false; }
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
