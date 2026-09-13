import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
onmessage = async ({data}) => {
    let db;
    try {
        db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(`codex-offline-queue-${data.uid}`, 2);
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const coordinator = createHybridQueueCoordinator({database: db, uid: data.uid, holderId: 'worker',
            locks: data.useLocks ? navigator.locks : null, now: data.realClock ? Date.now : () => data.now, ttlMs: 100});
        const result = await coordinator.run(async context => {
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
