// Laboratory only. Reads ciphertext snapshots; never upgrades or writes a queue.
const fail = code => Object.assign(new Error(code), {code});
export async function readCompatibleQueue({uid, indexedDb = globalThis.indexedDB, signal,
    isActive = () => true, timeoutMs = 10000} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || typeof isActive !== 'function' ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw fail('QUEUE_READER_CONFIG');
    const check = () => { if (signal?.aborted || !isActive()) throw fail('QUEUE_READER_SESSION'); };
    check();
    return new Promise((resolve, reject) => {
        let settled = false, database, transaction, containers = [];
        const finish = (error, version) => {
            if (settled) return;
            settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
            if (error) { try { transaction?.abort(); } catch {} }
            database?.close();
            if (error) { containers.length = 0; reject(error); }
            else resolve({version, containers});
        };
        const abort = () => finish(fail('QUEUE_READER_SESSION'));
        const timer = setTimeout(() => finish(fail('QUEUE_READER_TIMEOUT')), timeoutMs);
        signal?.addEventListener('abort', abort, {once: true});
        let request;
        try { request = indexedDb.open(`codex-offline-queue-${uid}`); }
        catch (error) { finish(error); return; }
        request.onupgradeneeded = () => {
            // Missing databases must remain missing, not become empty schema 1 stores.
            request.transaction.abort(); finish(fail('QUEUE_READER_MISSING'));
        };
        request.onerror = () => finish(request.error || fail('QUEUE_READER_OPEN'));
        request.onblocked = () => finish(fail('QUEUE_READER_BLOCKED'));
        request.onsuccess = () => {
            database = request.result;
            if (settled) { database.close(); return; }
            database.onversionchange = () => finish(fail('QUEUE_READER_VERSION_CHANGED'));
            try {
                check();
                if (![1, 2].includes(database.version)) throw fail('QUEUE_READER_SCHEMA');
                const stores = database.version === 2 ? ['encryptedOperations', 'queueLeases'] : ['encryptedOperations'];
                if (stores.some(name => !database.objectStoreNames.contains(name))) throw fail('QUEUE_READER_SCHEMA');
                transaction = database.transaction(stores, 'readonly');
                transaction.onabort = transaction.onerror = () => finish(fail('QUEUE_READER_TRANSACTION'));
                transaction.oncomplete = () => {
                    try { check(); finish(null, database.version); } catch (error) { finish(error); }
                };
                for (const name of stores) {
                    const store = transaction.objectStore(name);
                    if (store.keyPath !== 'id' || store.autoIncrement) throw fail('QUEUE_READER_SCHEMA');
                }
                const cursor = transaction.objectStore('encryptedOperations').openCursor();
                cursor.onerror = () => finish(fail('QUEUE_READER_READ'));
                cursor.onsuccess = () => {
                    if (settled) return;
                    try {
                        check();
                        const row = cursor.result;
                        if (!row) return;
                        const value = row.value;
                        if (value?.uid !== uid || value.schemaVersion !== 1 || typeof value.operationId !== 'string' ||
                            !value.operationId || value.id !== `${uid}:${value.operationId}` ||
                            typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') throw fail('QUEUE_READER_CONTAINER');
                        containers.push(value); row.continue();
                    } catch (error) { finish(error); }
                };
            } catch (error) { finish(error); }
        };
    });
}
