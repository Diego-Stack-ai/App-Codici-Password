import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {deriveOfflineQueueKey, openOfflineOperation} from './queue.js';

// Dedicated laboratory proof for the contract fallback: the page (and every
// Worker it spawns) runs with the Web Locks API genuinely absent, so each
// coordinator resolves its default to `undefined` and relies on the shared
// IndexedDB lease alone. Synthetic data, disposable profile, loopback only.
Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
const passed = [], uid = `nolocks-${crypto.randomUUID()}`, name = `codex-offline-queue-${uid}`;
const assert = (value, code) => { if (!value) throw new Error(code); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const read = (db, store, key) => requestValue(db.transaction(store).objectStore(store).get(key));
const writeLease = (db, record) => new Promise((resolve, reject) => {
    const tx = db.transaction('queueLeases', 'readwrite');
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('LEASE_WRITE_FAILED'));
    tx.objectStore('queueLeases').put(record);
});
const probe = data => new Promise((resolve, reject) => {
    const worker = new Worker('/worker.mjs', {type: 'module'});
    worker.onmessage = ({data: outcome}) => { worker.terminate(); outcome.ok ? resolve(outcome.result)
        : reject(Object.assign(new Error(outcome.code), {code: outcome.code})); };
    worker.onerror = () => { worker.terminate(); reject(new Error('WORKER_FAILED')); };
    worker.postMessage({uid, ...data});
});
// Blocked/suspended transactions cannot be cancelled without Web Locks: the
// coordinator must bound acquisition itself. This stub never settles until told.
function stallingDatabase() {
    let open, completions = 0;
    const clock = 1000, data = new Map([['queueLeases', new Map()], ['effects', new Map()]]);
    const gate = new Promise(resolve => { open = resolve; });
    let tail = Promise.resolve();
    const database = {transaction(names, mode) {
        names = Array.isArray(names) ? names : [names];
        const requests = [];
        const tx = {db: database, mode, aborted: false, abort() { this.aborted = true; }, objectStore(storeName) {
            if (!names.includes(storeName)) throw new Error('STORE_NOT_IN_TRANSACTION');
            const enqueue = (action, key, value) => { const request = {}; requests.push({storeName, action, key, value, request}); return request; };
            return {get: key => enqueue('get', key), put: value => enqueue('put', value.id, value)};
        }};
        tail = tail.then(() => gate).then(() => new Promise(resolve => setTimeout(() => {
            const drafts = new Map(names.map(key => [key, structuredClone(data.get(key))]));
            while (requests.length && !tx.aborted) {
                const {storeName, action, key, value, request} = requests.shift();
                if (action === 'get') request.result = structuredClone(drafts.get(storeName).get(key));
                else drafts.get(storeName).set(key, structuredClone(value));
                try { request.onsuccess?.(); } catch (error) { tx.error = error; tx.abort(); }
            }
            if (!tx.aborted && mode === 'readwrite') for (const [key, draft] of drafts) data.set(key, draft);
            completions++;
            tx.aborted ? tx.onabort?.() : tx.oncomplete?.();
            resolve();
        })));
        return tx;
    }};
    return {data, database, release: () => open(), get completions() { return completions; }, now: () => clock};
}
let db, writer;
try {
    assert(typeof navigator.locks === 'undefined', 'PAGE_WEB_LOCKS_PRESENT');
    passed.push('page runs with the Web Locks API genuinely absent');
    const upgrade = indexedDB.open(name, 2);
    upgrade.onupgradeneeded = () => {
        upgrade.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
        upgrade.result.createObjectStore('queueLeases', {keyPath: 'id'});
        upgrade.result.createObjectStore('effects', {keyPath: 'id'});
    };
    db = await requestValue(upgrade);
    let clock = 1000;
    // No `locks` option at all: the default parameter must resolve to the missing API.
    const fallback = holderId => createHybridQueueCoordinator({database: db, uid, holderId, now: () => clock, ttlMs: 100});
    const realFallback = holderId => createHybridQueueCoordinator({database: db, uid, holderId, now: Date.now, ttlMs: 600});
    const operation = {uid, operationId: 'nolocks-operation', recordId: 'nolocks-record', value: 'fixture'};
    writer = await createFencedQueueWriter({database: db, uid, holderId: 'writer', vaultKeyMaterial: 'SYNTHETIC-NOT-A-USER-KEY', now: () => clock, ttlMs: 100});
    await writer.run(async api => {
        await api.enqueue(operation);
        const container = await read(db, 'encryptedOperations', `${uid}:nolocks-operation`);
        assert(container && !JSON.stringify(container).includes('fixture'), 'FALLBACK_PLAINTEXT_LEAK');
        const key = await deriveOfflineQueueKey('SYNTHETIC-NOT-A-USER-KEY', uid);
        assert(JSON.stringify(await openOfflineOperation(container, key, uid)) === JSON.stringify(operation), 'FALLBACK_ROUNDTRIP');
        await api.remove(operation);
    });
    passed.push('encrypted queue mutations are coordinated by the IndexedDB lease alone');

    // Page holds the lock-less lease: a lock-less Worker must not enter.
    await fallback('page').run(async () => {
        assert((await probe({now: clock, stripLocks: true})).acquired === false, 'WORKER_ENTERED_PAGE_HOLD');
    });
    // Worker holds the lease: the page must not enter either.
    const holding = probe({realClock: true, stripLocks: true, holdMs: 900, ttlMs: 600});
    for (let i = 0; i < 200; i++) { if ((await read(db, 'queueLeases', uid))?.holderId === 'worker') break; await tick(); }
    assert((await read(db, 'queueLeases', uid))?.holderId === 'worker', 'WORKER_LEASE_NOT_HELD');
    let calls = 0;
    assert(JSON.stringify(await realFallback('page').run(() => { calls++; return 'entered'; })) ===
        JSON.stringify({acquired: false}), 'PAGE_ENTERED_WORKER_HOLD');
    assert(calls === 0, 'PAGE_RAN_UNDER_WORKER_HOLD');
    // Real expiry (ttl 600 ms) lets the page take over; the resumed Worker is fenced.
    await new Promise(resolve => setTimeout(resolve, 650));
    await realFallback('page').run(async context => {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(['queueLeases', 'effects'], 'readwrite'); let failure;
            tx.oncomplete = resolve; tx.onabort = () => reject(failure || new Error('EXPECTED_ABORT'));
            context.guardTransaction(tx, () => { tx.objectStore('effects').put({id: 'effect', holder: 'page'}); }, error => { failure = error; });
        });
    });
    const workerOutcome = await holding.catch(error => error.code);
    assert(workerOutcome === 'LEASE_LOST', 'RESUMED_WORKER_NOT_FENCED');
    assert((await read(db, 'effects', 'effect')).holder === 'page', 'FENCED_WORKER_WROTE');
    passed.push('page and lock-less worker exclude each other and an expired holder is fenced after takeover');

    // Crash/resume: a lease abandoned by a dead context is reclaimed only after
    // expiry, with a strictly greater generation.
    await writeLease(db, {id: uid, version: 1, holderId: 'crashed', token: 5, updatedAt: clock, expiresAt: clock + 100});
    assert((await probe({now: clock, stripLocks: true})).acquired === false, 'CRASHED_LEASE_NOT_HELD');
    clock += 100;
    assert((await probe({now: clock, stripLocks: true})).acquired, 'CRASHED_LEASE_NOT_RECLAIMED');
    const resumed = await read(db, 'queueLeases', uid);
    assert(resumed.token === 6 && resumed.holderId === null, 'CRASH_RESUME_GENERATION');
    passed.push('crash/resume reclaims an abandoned lease after expiry with a monotonic generation');

    const stalled = stallingDatabase();
    let stalledCalls = 0;
    const started = Date.now();
    await createHybridQueueCoordinator({database: stalled.database, uid, holderId: 'stalled', now: stalled.now,
        ttlMs: 100, acquireTimeoutMs: 40, locks: undefined}).run(() => { stalledCalls++; })
        .then(() => { throw new Error('STALL_ACCEPTED'); }, error => assert(error.code === 'HYBRID_ACQUIRE_TIMEOUT', 'STALL_ERROR'));
    assert(stalledCalls === 0 && Date.now() - started >= 30, 'STALL_RAN_TASK');
    stalled.release();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert(stalledCalls === 0 && stalled.completions > 0, 'LATE_CALLBACK_RAN_TASK');
    assert((stalled.data.get('queueLeases').get(uid)?.holderId ?? null) === null, 'LATE_LEASE_STILL_HELD');
    passed.push('blocked acquisition expires fail-closed and a late completion cannot run the task');

    let lockCalls = 0, requested = false;
    const hangingUid = `${uid}-hanging`;
    await createHybridQueueCoordinator({database: stalled.database, uid: hangingUid, holderId: 'hanging', now: stalled.now,
        ttlMs: 100, acquireTimeoutMs: 20,
        locks: {request: () => { requested = true; return new Promise(() => {}); }}}).run(() => { lockCalls++; })
        .then(() => { throw new Error('HANGING_LOCK_ACCEPTED'); }, error => assert(error.code === 'HYBRID_ACQUIRE_TIMEOUT', 'HANGING_LOCK_ERROR'));
    assert(requested && lockCalls === 0, 'HANGING_LOCK_RAN_TASK');
    assert(!stalled.data.get('queueLeases').has(hangingUid), 'HANGING_LOCK_CREATED_LEASE');
    passed.push('a Web Lock request that never settles also expires fail-closed');

    const otherUid = `${uid}-other`;
    const otherUpgrade = indexedDB.open(`codex-offline-queue-${otherUid}`, 2);
    otherUpgrade.onupgradeneeded = () => {
        otherUpgrade.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
        otherUpgrade.result.createObjectStore('queueLeases', {keyPath: 'id'});
    };
    const otherDb = await requestValue(otherUpgrade);
    try {
        let releaseOwner, ownerEntered = false;
        const owner = fallback('owner-a').run(async () => {
            ownerEntered = true;
            await new Promise(resolve => { releaseOwner = resolve; });
            return 'a';
        });
        while (!ownerEntered) await tick();
        const other = createHybridQueueCoordinator({database: otherDb, uid: otherUid, holderId: 'owner-b',
            now: () => clock, ttlMs: 100, locks: undefined}).run(() => 'b');
        assert(JSON.stringify(await other) === JSON.stringify({acquired: true, value: 'b'}), 'OTHER_UID_BLOCKED');
        releaseOwner();
        assert((await owner).value === 'a', 'OWNER_UID_TASK');
        assert((await read(db, 'queueLeases', uid)).holderId === null, 'OWNER_UID_LEASE_HELD');
    } finally { otherDb.close(); }
    passed.push('a different UID never waits for another UID lease in the fallback path');

    await writer.run(async api => { await api.enqueue(operation); });
    const queued = await read(db, 'encryptedOperations', `${uid}:nolocks-operation`);
    let active = true, sessionRejected = false;
    await fallback('session').run(async context => { active = false; await context.checkCurrent(); }, {isActive: () => active})
        .catch(error => { sessionRejected = error.code === 'HYBRID_SESSION_INACTIVE'; });
    assert(sessionRejected, 'SESSION_ACCEPTED');
    assert(JSON.stringify(await read(db, 'encryptedOperations', queued.id)) === JSON.stringify(queued), 'SESSION_CHANGED_CIPHERTEXT');
    passed.push('session invalidation preserves the encrypted queue and refuses the fallback context');

    db.close(); db = undefined;
    const reopened = await requestValue(indexedDB.open(name));
    try {
        assert(reopened.version === 2, 'REOPEN_VERSION');
        assert(JSON.stringify(await read(reopened, 'encryptedOperations', queued.id)) === JSON.stringify(queued), 'REOPEN_CIPHERTEXT');
        assert((await read(reopened, 'queueLeases', uid)).token >= 2, 'REOPEN_TOKEN');
    } finally { reopened.close(); }
    passed.push('reopening the connection keeps the ciphertext and the lease generation');

    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, passed, browser: navigator.userAgent,
        webLocks: typeof navigator.locks})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message,
        webLocks: typeof navigator.locks})});
} finally { writer?.close(); db?.close(); }
