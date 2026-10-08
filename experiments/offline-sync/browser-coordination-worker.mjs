import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
onmessage = async ({data}) => {
    let db;
    try {
        // `stripLocks` removes the platform API before the coordinator resolves
        // its default, so the worker exercises the fallback exactly like a
        // browser that never shipped Web Locks.
        if (data.stripLocks) Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
        db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(`codex-offline-queue-${data.uid}`, 2);
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const coordinator = createHybridQueueCoordinator({database: db, uid: data.uid, holderId: 'worker',
            locks: data.stripLocks ? undefined : data.useLocks ? navigator.locks : null,
            now: data.realClock ? Date.now : () => data.now, ttlMs: data.ttlMs || 100,
            ...(data.acquireTimeoutMs ? {acquireTimeoutMs: data.acquireTimeoutMs} : {})});
        const result = await coordinator.run(async context => {
            if (data.holdMs) await new Promise(resolve => setTimeout(resolve, data.holdMs));
            if (data.write) await new Promise((resolve, reject) => {
                const tx = db.transaction(['queueLeases', 'effects'], 'readwrite');
                tx.oncomplete = resolve; tx.onabort = () => reject(new Error('WORKER_WRITE_ABORTED'));
                context.guardTransaction(tx, () => { tx.objectStore('effects').put({id: 'effect', holder: 'worker'}); });
            });
            return 'worker';
        });
        postMessage({ok: true, result});
    } catch (error) { postMessage({ok: false, code: error.code || error.name}); }
    finally { db?.close(); }
};
