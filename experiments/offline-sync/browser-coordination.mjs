import {createOfflineMutationQueue, openOfflineQueueDatabase} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
const passed = [], uid = `browser-${crypto.randomUUID()}`, name = `codex-offline-queue-${uid}`;
const assert = (value, code) => { if (!value) throw new Error(code); };
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const read = (db, store, key) => requestValue(db.transaction(store).objectStore(store).get(key));
const probe = data => new Promise((resolve, reject) => {
    const worker = new Worker('/worker.mjs', {type: 'module'});
    worker.onmessage = ({data: result}) => { worker.terminate(); result.ok ? resolve(result.result) : reject(new Error(result.code)); };
    worker.onerror = () => { worker.terminate(); reject(new Error('WORKER_FAILED')); };
    worker.postMessage({uid, ...data});
});
let queue, db;
try {
    assert(navigator.locks, 'WEB_LOCKS_REQUIRED_FOR_TEST');
    queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: 'SYNTHETIC-NOT-A-USER-KEY'});
    const operation = {uid, operationId: 'synthetic-operation', recordId: 'synthetic-record', value: 'fixture'};
    await queue.enqueue(operation);
    assert(JSON.stringify(await queue.list()) === JSON.stringify([operation]), 'QUEUE_ROUNDTRIP');
    passed.push('real IndexedDB encrypted queue roundtrip');
    const observer = await openOfflineQueueDatabase(uid);
    const original = await read(observer, 'encryptedOperations', `${uid}:synthetic-operation`);
    const upgrade = indexedDB.open(name, 2);
    upgrade.onupgradeneeded = () => {
        upgrade.result.createObjectStore('queueLeases', {keyPath: 'id'});
        upgrade.result.createObjectStore('effects', {keyPath: 'id'});
    };
    db = await requestValue(upgrade);
    assert(JSON.stringify(await read(db, 'encryptedOperations', original.id)) === JSON.stringify(original), 'CIPHERTEXT_CHANGED');
    let closed = false;
    try { observer.transaction('encryptedOperations'); } catch (error) { closed = error.name === 'InvalidStateError'; }
    assert(closed, 'OLD_CONNECTION_STILL_OPEN');
    passed.push('schema upgrade closes cooperative old handles and preserves ciphertext byte-for-byte');
    try { await openOfflineQueueDatabase(uid); throw new Error('LEGACY_REOPEN_ALLOWED'); }
    catch (error) { assert(error.name === 'VersionError', 'LEGACY_REOPEN_NOT_VERSION_ERROR'); }
    passed.push('version 1 opener refuses upgraded schema without recreation or deletion');
    let clock = 1000;
    for (const useLocks of [true, false]) {
        const coordinator = createHybridQueueCoordinator({database: db, uid, holderId: 'page', now: () => clock,
            ttlMs: 100, locks: useLocks ? navigator.locks : null});
        await coordinator.run(async () => {
            const result = await probe({now: clock, useLocks: !useLocks});
            assert(result.acquired === false, 'MIXED_WORKER_ENTERED');
        });
        passed.push(`page/worker exclusion with page WebLocks=${useLocks}`);
    }
    const coordinator = createHybridQueueCoordinator({database: db, uid, holderId: 'page', now: () => clock,
        ttlMs: 100, locks: navigator.locks});
    let rejected = false;
    try {
        await coordinator.run(async context => {
            clock += 100;
            assert((await probe({now: clock, useLocks: false, write: true})).acquired, 'TAKEOVER_FAILED');
            await new Promise((resolve, reject) => {
                const tx = db.transaction(['queueLeases', 'effects'], 'readwrite'); let failure;
                tx.oncomplete = resolve; tx.onabort = () => reject(failure || new Error('EXPECTED_ABORT'));
                context.guardTransaction(tx, () => { tx.objectStore('effects').put({id: 'effect', holder: 'old'}); }, error => { failure = error; });
            });
        });
    } catch (error) { rejected = error.code === 'LEASE_LOST'; }
    assert(rejected && (await read(db, 'effects', 'effect')).holder === 'worker', 'STALE_WRITE_NOT_FENCED');
    passed.push('expired page cannot overwrite worker takeover in a real multi-store transaction');
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, passed, browser: navigator.userAgent})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message})});
} finally { queue?.close(); db?.close(); }
