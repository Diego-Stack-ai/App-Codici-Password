import {createOfflineMutationQueue, openOfflineQueueDatabase, deriveOfflineQueueKey, openOfflineOperation} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {readCompatibleQueue} from './compatible-queue-reader.mjs';
import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {createFencedQueueClient} from './fenced-queue-client.mjs';
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
    const v1 = await readCompatibleQueue({uid});
    assert(v1.version === 1 && JSON.stringify(v1.containers) === JSON.stringify([original]), 'COMPAT_V1');
    passed.push('compatible reader preserves schema 1 ciphertext');
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
    const v2 = await readCompatibleQueue({uid});
    assert(v2.version === 2 && JSON.stringify(v2.containers) === JSON.stringify([original]), 'COMPAT_V2');
    passed.push('compatible reader reads schema 2 without downgrade and preserves ciphertext');
    const absentUid = `${uid}-missing`;
    try { await readCompatibleQueue({uid: absentUid}); throw new Error('MISSING_ACCEPTED'); }
    catch (error) { assert(error.code === 'QUEUE_READER_MISSING', 'MISSING_ERROR'); }
    assert(!(await indexedDB.databases()).some(item => item.name === `codex-offline-queue-${absentUid}`), 'MISSING_CREATED');
    passed.push('compatible reader never creates an absent queue');
    let checks = 0;
    try { await readCompatibleQueue({uid, isActive: () => ++checks < 3}); throw new Error('SESSION_ACCEPTED'); }
    catch (error) { assert(error.code === 'QUEUE_READER_SESSION', 'SESSION_ERROR'); }
    assert(JSON.stringify(await read(db, 'encryptedOperations', original.id)) === JSON.stringify(original), 'SESSION_MUTATED');
    passed.push('session invalidation rejects snapshot without mutating ciphertext');
    for (const schema of [2, 3]) {
        const invalidUid = `${uid}-schema-${schema}`;
        const invalidRequest = indexedDB.open(`codex-offline-queue-${invalidUid}`, schema);
        invalidRequest.onupgradeneeded = () => invalidRequest.result.createObjectStore('sentinel', {keyPath: 'id'});
        const invalidDb = await requestValue(invalidRequest);
        invalidDb.close();
        try { await readCompatibleQueue({uid: invalidUid}); throw new Error('SCHEMA_ACCEPTED'); }
        catch (error) { assert(error.code === 'QUEUE_READER_SCHEMA', 'SCHEMA_ERROR'); }
        const unchanged = await requestValue(indexedDB.open(`codex-offline-queue-${invalidUid}`));
        assert(unchanged.version === schema && unchanged.objectStoreNames.contains('sentinel') &&
            !unchanged.objectStoreNames.contains('encryptedOperations'), 'SCHEMA_MUTATED');
        unchanged.close();
    }
    passed.push('malformed schema 2 and unknown schema 3 are refused without repairs');
    let clock = 1000;
    const writer = await createFencedQueueWriter({database: db, uid, holderId: 'writer',
        vaultKeyMaterial: 'SYNTHETIC-NOT-A-USER-KEY', now: () => clock, ttlMs: 100, locks: null});
    const pending = {...operation, operationId: 'pending'}, replacement = {...operation, operationId: 'replacement'};
    let retained;
    await writer.run(async api => {
        retained = api;
        await api.enqueue(pending);
        const initial = await read(db, 'encryptedOperations', `${uid}:pending`);
        await api.enqueue(pending);
        assert(JSON.stringify(await read(db, 'encryptedOperations', initial.id)) === JSON.stringify(initial), 'ENQUEUE_RESEALED');
        const marked = await api.markForReview(pending, 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');
        const reviewContainer = await read(db, 'encryptedOperations', initial.id);
        const reviewKey = await deriveOfflineQueueKey('SYNTHETIC-NOT-A-USER-KEY', uid);
        assert(JSON.stringify(await openOfflineOperation(reviewContainer, reviewKey, uid)) === JSON.stringify(marked), 'REVIEW_CIPHER_ROUNDTRIP');
        assert(!JSON.stringify(reviewContainer).includes('PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'), 'REVIEW_REASON_EXPOSED');
        await api.replace(marked, replacement);
        assert(!(await read(db, 'encryptedOperations', initial.id)), 'REPLACE_LEFT_OLD');
        await api.remove(replacement);
    });
    assert(!(await read(db, 'encryptedOperations', `${uid}:replacement`)), 'REMOVE_FAILED');
    passed.push('all four encrypted queue mutations use guarded transactions; identical enqueue preserves ciphertext');
    try { await retained.enqueue(pending); throw new Error('RETAINED_WRITER_ACCEPTED'); }
    catch (error) { assert(error.code === 'HYBRID_CONTEXT_CLOSED', 'RETAINED_WRITER_ERROR'); }
    passed.push('retained queue writer cannot mutate after its lease context closes');
    await writer.run(async api => {
        await api.enqueue(pending); await api.enqueue(replacement);
        for (const [run, code] of [
            [() => api.enqueue({...pending, value: 'different'}), 'FENCED_QUEUE_CHANGED'],
            [() => api.replace(pending, replacement), 'FENCED_QUEUE_COLLISION'],
            [() => api.remove({...pending, value: 'different'}), 'FENCED_QUEUE_CHANGED']]) {
            try { await run(); throw new Error('BAD_WRITE_ACCEPTED'); }
            catch (error) { assert(error.code === code, 'BAD_WRITE_ERROR'); }
        }
        assert(await read(db, 'encryptedOperations', `${uid}:pending`), 'CONFLICT_REMOVED');
    });
    passed.push('reuse, replacement collision and stale acknowledgements preserve queued data');
    let lost = false;
    try {
        await writer.run(async api => {
            clock += 100;
            assert((await probe({now: clock, useLocks: false})).acquired, 'WRITER_TAKEOVER_FAILED');
            await api.remove(pending);
        });
    } catch (error) { lost = error.code === 'LEASE_LOST'; }
    assert(lost && await read(db, 'encryptedOperations', `${uid}:pending`), 'STALE_WRITER_REMOVED_QUEUE');
    passed.push('worker takeover fences a suspended encrypted queue writer');
    const beforeCancel = await read(db, 'encryptedOperations', `${uid}:pending`);
    let sessionActive = true, sessionRejected = false;
    try {
        await writer.run(async api => { sessionActive = false; await api.remove(pending); }, {isActive: () => sessionActive});
    } catch (error) { sessionRejected = error.code === 'HYBRID_SESSION_INACTIVE'; }
    assert(sessionRejected && JSON.stringify(await read(db, 'encryptedOperations', beforeCancel.id)) === JSON.stringify(beforeCancel), 'SESSION_QUEUE_CHANGED');
    passed.push('session invalidation preserves ciphertext and refuses acknowledgement');
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
    await writer.run(async api => { for (const item of await api.list()) await api.remove(item); });
    const states = [], receipts = new Map();
    let online = false, mode = 'applied', sends = 0, applied = 0, releaseSend, activeClient = true;
    const clientOptions = {database: db, uid, holderId: 'sync-client', vaultKeyMaterial: 'SYNTHETIC-NOT-A-USER-KEY',
        now: () => clock, ttlMs: 100, locks: null, isOnline: () => online, isActive: () => activeClient,
        onState: state => states.push(state.state), send: async command => {
            sends++;
            if (mode === 'conflict') return {status: 'conflict'};
            if (mode === 'scope') throw Object.assign(new Error('scope'), {code: 'functions/failed-precondition', details: {reason: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'}});
            if (mode === 'pending') await new Promise(resolve => { releaseSend = resolve; });
            if (!receipts.has(command.operationId)) { applied++; receipts.set(command.operationId, {status: 'applied'}); }
            if (mode === 'lost-response') { mode = 'applied'; throw new Error('NETWORK_RESPONSE_LOST'); }
            return receipts.get(command.operationId);
        }};
    let client = await createFencedQueueClient(clientOptions);
    const syncOperation = suffix => ({...operation, operationId: `sync-${suffix}`});
    await client.enqueue(syncOperation('offline'));
    assert(sends === 0 && states.at(-1) === 'offline', 'OFFLINE_SENT');
    online = true; await client.flush();
    assert(states.at(-1) === 'saved' && !(await read(db, 'encryptedOperations', `${uid}:sync-offline`)), 'SYNC_NOT_ACKED');
    passed.push('canonical synchronizer sends offline queue after reconnect and acknowledges under lease');
    mode = 'lost-response';
    await client.enqueue(syncOperation('retry'));
    assert(states.at(-1) === 'recoverable-error' && await read(db, 'encryptedOperations', `${uid}:sync-retry`), 'LOST_RESPONSE_REMOVED');
    const effects = applied;
    await client.flush();
    assert(applied === effects && !(await read(db, 'encryptedOperations', `${uid}:sync-retry`)), 'RETRY_DUPLICATED');
    passed.push('simulated lost response retains command; trusted idempotent retry acknowledges once');
    mode = 'conflict'; await client.enqueue(syncOperation('conflict'));
    assert(states.at(-1) === 'conflict' && await read(db, 'encryptedOperations', `${uid}:sync-conflict`), 'CONFLICT_NOT_RETAINED');
    await client.discard(syncOperation('conflict'));
    passed.push('server conflict retains encrypted command until explicit discard');
    mode = 'scope'; await client.enqueue(syncOperation('scope'));
    assert(states.at(-1) === 'reconciliation-required', 'SCOPE_NOT_MARKED');
    client.close(); client = await createFencedQueueClient(clientOptions);
    const beforeReopen = sends;
    await client.flush();
    assert(sends === beforeReopen && states.at(-1) === 'reconciliation-required', 'REVIEW_RESENT');
    await writer.run(async api => { for (const item of await api.list()) await api.remove(item); });
    passed.push('persisted scope-review marker blocks automatic resend after client reopen');
    mode = 'pending'; online = false; await client.enqueue(syncOperation('takeover')); online = true;
    const inFlight = client.flush();
    assert(client.flush() === inFlight, 'PARALLEL_FLUSH');
    while (!releaseSend) await new Promise(resolve => setTimeout(resolve, 0));
    clock += 100; assert((await probe({now: clock, useLocks: false})).acquired, 'SYNC_TAKEOVER_FAILED');
    states.length = 0; releaseSend();
    try { await inFlight; throw new Error('LATE_REPLY_ACCEPTED'); }
    catch (error) { assert(['LEASE_LOST', 'HYBRID_CONTEXT_CLOSED'].includes(error.code), 'LATE_REPLY_ERROR'); }
    assert(!states.includes('saved') && await read(db, 'encryptedOperations', `${uid}:sync-takeover`), 'LATE_REPLY_REMOVED');
    passed.push('worker takeover during send prevents late acknowledgement and saved state');
    mode = 'applied'; await client.flush();
    mode = 'pending'; releaseSend = null; online = false; await client.enqueue(syncOperation('closed')); online = true;
    const closing = client.flush();
    while (!releaseSend) await new Promise(resolve => setTimeout(resolve, 0));
    client.close(); states.length = 0; releaseSend();
    try { await closing; throw new Error('CLOSED_REPLY_ACCEPTED'); }
    catch (error) { assert(error.code === 'HYBRID_SESSION_INACTIVE', 'CLOSED_REPLY_ERROR'); }
    assert(states.length === 0 && await read(db, 'encryptedOperations', `${uid}:sync-closed`), 'CLOSED_REPLY_REMOVED');
    passed.push('closing client during send suppresses stale UI states and preserves pending ciphertext');
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, passed, browser: navigator.userAgent})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message})});
} finally { queue?.close(); db?.close(); }
