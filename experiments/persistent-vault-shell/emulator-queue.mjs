import {createFirebaseFencedQueueClient} from '../offline-sync/firebase-fenced-queue-client.mjs';

// Only the fixed loopback laboratory may provision an empty demo queue. An
// existing queue is never upgraded; production rollout remains separate.
export async function openEmulatorQueue({auth, functions, ...scope}) {
    if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell') throw new Error('LOCAL_EMULATOR_ONLY');
    if (!scope.uid || !scope.signal || scope.signal.aborted || auth.currentUser?.uid !== scope.uid) throw new Error('DEMO_QUEUE_SESSION');
    const database = await new Promise((resolve, reject) => {
        let failed = false;
        const request = indexedDB.open(`codex-offline-queue-${scope.uid}`, 2);
        request.onupgradeneeded = event => {
            if (event.oldVersion !== 0 || failed || scope.signal.aborted || auth.currentUser?.uid !== scope.uid) { request.transaction.abort(); return; }
            request.result.createObjectStore('queueLeases', {keyPath: 'id'});
            request.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
        };
        request.onblocked = () => { failed = true; reject(new Error('DEMO_QUEUE_BLOCKED')); };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result); };
    });
    let client;
    try {
        if (scope.signal.aborted || auth.currentUser?.uid !== scope.uid) throw new Error('DEMO_QUEUE_SESSION');
        if (database.version !== 2) throw new Error('DEMO_QUEUE_SCHEMA');
        client = await createFirebaseFencedQueueClient({...scope, database, auth, functions, holderId: crypto.randomUUID()});
        let closed = false, pending = 0, databaseClosed = false;
        const finishClose = () => {
            if (closed && pending === 0 && !databaseClosed) { databaseClosed = true; database.close(); }
        };
        // Revoke immediately, but let interrupted operations release their IDB
        // lease before closing the connection. Otherwise navigation strands a
        // lease until expiry and the next Account cannot recover its queue.
        const close = () => { if (closed) return; closed = true; scope.signal.removeEventListener('abort', close); try { client.close(); } finally { finishClose(); } };
        const methods = {};
        for (const name of ['pendingForRecord', 'flush', 'enqueue', 'replace', 'discard']) {
            methods[name] = async (...args) => {
                if (closed || scope.signal.aborted || auth.currentUser?.uid !== scope.uid) { close(); throw new Error('DEMO_QUEUE_SESSION'); }
                pending++;
                try {
                    const result = await client[name](...args);
                    if (closed || scope.signal.aborted || auth.currentUser?.uid !== scope.uid) { close(); throw new Error('DEMO_QUEUE_SESSION'); }
                    return result;
                }
                finally { pending--; finishClose(); }
            };
        }
        database.onversionchange = close;
        scope.signal.addEventListener('abort', close, {once: true});
        return Object.freeze({...client, ...methods, close});
    } catch (error) { database.close(); throw error; }
    finally { scope.vaultKeyMaterial = null; }
}
