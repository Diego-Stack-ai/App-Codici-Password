import {createOfflineMutationQueue, createOfflineQueueReader, deriveOfflineQueueKey, openOfflineOperation,
    sealOfflineOperation} from './offline-mutation-queue.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';

// [M6-A-8d] Banco pagina + Worker dedicato sul caso tecnico 5 della matrice `M6-ADOZIONE-PIANO R1`:
// entrambi i contesti sono **senza `navigator.locks`**, sullo **stesso** database v2 e sullo stesso
// UID, e usano i **moduli runtime reali** approvati (`offline-mutation-queue.js`,
// `offline-mutation-lease.js`, `offline-mutation-client-core.js`, `offline-mutation-sync.js`) — non
// il candidato di `experiments/`. Il Worker è `pilot-lease-worker.mjs`, senza alcun adattatore
// runtime nuovo. Nessun Service Worker, nessuna PWA, nessun dato reale, nessuna rete.
Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected),
    `${code}:${JSON.stringify(value)}`);
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };
const codeOf = error => error?.code || error?.message || error?.name;
const detailOf = error => String(error?.stack || error?.message || error).slice(0, 400);
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('IDB_REQUEST'));
});
const waitFor = async (predicate, timeoutMs = 6000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 5)); }
    throw new Error('PILOT_LEASE_WORKER_WAIT');
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const nameOf = uid => `codex-offline-queue-${uid}`;
const rowsOf = async uid => inspectQueueSchema({uid}).then(state => state.rows.map(row => row.id).sort());
const readLease = uid => requestValue(indexedDB.open(nameOf(uid))).then(database => {
    if (!database.objectStoreNames.contains('queueLeases')) { database.close(); return null; }
    return requestValue(database.transaction('queueLeases', 'readonly').objectStore('queueLeases').get(uid))
        .then(value => { database.close(); return value ?? null; });
});
const withDatabase = async (uid, task) => {
    const database = await requestValue(indexedDB.open(nameOf(uid)));
    try { return await task(database); } finally { database.close(); }
};
// Controllore del Worker: una richiesta per comando, risposta correlata dall'`id`, eventi intermedi
// (`held`) distinti dalla risposta finale.
function spawnWorker() {
    const instance = new Worker('/pilot-lease-worker.mjs', {type: 'module'});
    const pending = new Map();
    instance.onmessage = ({data}) => {
        const entry = pending.get(data.id);
        if (!entry) return;
        if (data.event) { entry.onEvent?.(data); return; }
        pending.delete(data.id); entry.resolve(data);
    };
    instance.onerror = event => {
        for (const entry of pending.values()) entry.resolve({ok: false, code: `WORKER_ERROR:${event.message}`});
        pending.clear();
    };
    let sequence = 0;
    const command = (payload, {onEvent, detached = false, timeoutMs = 8000} = {}) => {
        const id = `w${++sequence}`;
        const promise = new Promise(resolve => {
            pending.set(id, {resolve, onEvent});
            setTimeout(() => { if (pending.delete(id)) resolve({ok: false, code: 'WORKER_COMMAND_TIMEOUT'}); }, timeoutMs);
        });
        instance.postMessage({...payload, id});
        return detached ? null : promise;
    };
    return {command, post: payload => instance.postMessage(payload), terminate: () => instance.terminate()};
}
// Confine e mutazioni della **pagina**, con gli stessi moduli runtime del Worker.
const pageBoundary = ({uid, holderId, now, ttlMs = 30000, acquireTimeoutMs = 10000, isActive}) =>
    resolveOfflineQueueLease({uid, leaseFallback: true, holderId, now, ttlMs, acquireTimeoutMs, isActive});
const pageRun = (options, task) => pageBoundary(options)(options.uid, task);
const clearQueue = uid => withDatabase(uid, database => new Promise((resolve, reject) => {
    const transaction = database.transaction('encryptedOperations', 'readwrite');
    transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(transaction.error);
    transaction.objectStore('encryptedOperations').clear();
}));
const pageOperations = async uid => (await createOfflineQueueReader({uid, vaultKeyMaterial: KEY})).read();
async function pageMutation({uid, action, operationId, replacementOperationId, lease}) {
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    try {
        const result = await pageOperations(uid);
        const expected = result.operations.find(operation => operation.operationId === operationId);
        if (!expected) throw new Error('PAGE_OPERATION_MISSING');
        if (action === 'remove') return await queue.remove(expected, {isActive: () => true, lease});
        if (action === 'markForReview') return await queue.markForReview(expected, {isActive: () => true, lease});
        return await queue.replace(expected, {...expected, operationId: replacementOperationId, value: 'page'}, {isActive: () => true, lease});
    } finally { queue.close(); }
}
const seed = async (uid, operationIds) => {
    const key = await deriveOfflineQueueKey(KEY, uid);
    const containers = [];
    for (const operationId of operationIds) {
        containers.push(await sealOfflineOperation({uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`}, key));
    }
    await withDatabase(uid, database => new Promise((resolve, reject) => {
        const transaction = database.transaction('encryptedOperations', 'readwrite');
        transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(transaction.error);
        for (const container of containers) transaction.objectStore('encryptedOperations').put(container);
    }));
};
const buildV1 = async uid => {
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'v1'});
    queue.close();
};

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 35000);

const worker = spawnWorker();
try {
    assert(typeof navigator.locks === 'undefined', 'PAGE_WEB_LOCKS_PRESENT');
    const ping = await worker.command({op: 'ping'});
    same([ping.ok, ping.webLocks], [true, 'undefined'], 'WORKER_WEB_LOCKS_PRESENT');
    const uid = `pilot-lease-worker-${crypto.randomUUID()}`;
    const v1 = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await v1.enqueue({uid, operationId: 'device:seed', recordId: 'record-seed', value: 'seed'});
    v1.close();
    same((await upgradeQueueSchemaToV2({uid})).version, 2, 'PILOT_LEASE_WORKER_UPGRADE');
    await clearQueue(uid);
    await seed(uid, ['device:1']);
    same(await rowsOf(uid), [`${uid}:device:1`], 'PILOT_LEASE_WORKER_SEED');
    passed.push('pagina e Worker **senza** `navigator.locks` (API rimossa nei due realm e verificata: `typeof` vale `undefined` in entrambi) sullo **stesso** database v2 e sullo stesso UID, con i moduli runtime reali del pilota su entrambi i lati');

    // ── 1. Esclusione pagina → Worker e Worker → pagina ──────────────────────────────────
    let pageRelease, pageEntered = false;
    const pageGate = new Promise(resolve => { pageRelease = resolve; });
    const pageHold = pageRun({uid, holderId: 'page-A', now: () => 1000}, async () => {
        pageEntered = true; await pageGate; return 'page';
    });
    await waitFor(() => pageEntered);
    const workerBlocked = await worker.command({op: 'probe', uid, holderId: 'worker-A', now: 1000, ttlMs: 30000, acquireTimeoutMs: 60});
    same([workerBlocked.ok, workerBlocked.outcome?.acquired, workerBlocked.ran], [true, false, false], 'WORKER_NOT_EXCLUDED');
    pageRelease();
    same((await pageHold).acquired, true, 'PAGE_HOLD');
    const workerFree = await worker.command({op: 'probe', uid, holderId: 'worker-A', now: 1000, ttlMs: 30000});
    same([workerFree.ok, workerFree.outcome?.acquired, workerFree.ran], [true, true, true], 'WORKER_AFTER_RELEASE');
    same((await readLease(uid)).holderId, null, 'WORKER_RELEASED');

    let heldResolve, heldToken = null, workerHeld = false;
    const heldSignal = new Promise(resolve => { heldResolve = resolve; });
    const workerHold = worker.command({op: 'hold', uid, holderId: 'worker-B', now: 2000, ttlMs: 30000},
        {onEvent: event => { heldToken = event.token; workerHeld = true; heldResolve(); }});
    await heldSignal;
    assert(workerHeld && Number.isSafeInteger(heldToken), 'WORKER_HELD_EVENT');
    const pageBlocked = await pageRun({uid, holderId: 'page-B', now: () => 2000, acquireTimeoutMs: 60}, async () => 'page');
    same(pageBlocked.acquired, false, 'PAGE_NOT_EXCLUDED');
    worker.post({release: true});
    const workerHoldOutcome = await workerHold;
    same([workerHoldOutcome.ok, workerHoldOutcome.outcome?.acquired], [true, true], 'WORKER_HOLD_OUTCOME');
    const pageFree = await pageRun({uid, holderId: 'page-B', now: () => 2000}, async () => 'page');
    same(pageFree.acquired, true, 'PAGE_AFTER_RELEASE');
    passed.push('esclusione reciproca fra pagina e Worker nelle **due direzioni**: mentre il titolare tiene il lease l’altro contesto riceve `{acquired:false}` senza eseguire nulla (task mai eseguito), e dopo il rilascio acquisisce');

    // ── 2. Mutazioni sotto token nel Worker (enqueue, replace, markForReview, remove) ────
    const tokenOf = async () => (await readLease(uid))?.token ?? 0;
    const beforeEnqueue = await tokenOf();
    const enqueued = await worker.command({op: 'mutate', uid, holderId: 'worker-C', now: 3000, ttlMs: 30000, action: 'enqueue', operationId: 'device:9'});
    same([enqueued.ok, enqueued.before, enqueued.after], [true, ['device:1'], ['device:1', 'device:9']], 'WORKER_ENQUEUE');
    assert(await tokenOf() > beforeEnqueue, 'WORKER_ENQUEUE_TOKEN');
    same((await readLease(uid)).holderId, null, 'WORKER_ENQUEUE_RELEASE');
    const replaced = await worker.command({op: 'mutate', uid, holderId: 'worker-C', now: 3000, ttlMs: 30000, action: 'replace', operationId: 'device:9', replacementOperationId: 'device:10'});
    same([replaced.ok, replaced.after], [true, ['device:1', 'device:10']], 'WORKER_REPLACE');
    const marked = await worker.command({op: 'mutate', uid, holderId: 'worker-C', now: 3000, ttlMs: 30000, action: 'markForReview', operationId: 'device:10'});
    same([marked.ok, marked.after], [true, ['device:1', 'device:10']], 'WORKER_MARK');
    const markedRow = (await inspectQueueSchema({uid})).rows.find(row => row.id.endsWith(':device:10'));
    const markedOperation = await openOfflineOperation(markedRow, await deriveOfflineQueueKey(KEY, uid), uid);
    same(markedOperation._queueState, 'reconciliation-required', 'WORKER_MARK_STATE');
    const removed = await worker.command({op: 'mutate', uid, holderId: 'worker-C', now: 3000, ttlMs: 30000, action: 'remove', operationId: 'device:10'});
    same([removed.ok, removed.after], [true, ['device:1']], 'WORKER_REMOVE');
    same((await readLease(uid)).holderId, null, 'WORKER_REMOVE_RELEASE');
    passed.push('nel Worker le quattro mutazioni (`enqueue`, `replace`, `markForReview`, `remove`) riescono **sotto token** — il contatore del lease avanza a ogni operazione e il record torna `holderId:null` — e la coda cambia esattamente come atteso (marcatura di riconciliazione verificata decifrando il contenitore)');

    // ── 3. Takeover dopo la scadenza: il vecchio titolare ottiene LEASE_LOST ─────────────
    let staleResolve, staleHeld = false;
    const staleSignal = new Promise(resolve => { staleResolve = resolve; });
    const workerStale = worker.command({op: 'hold', uid, holderId: 'worker-D', now: 4000, ttlMs: 50,
        action: 'remove', operationId: 'device:1', advanceTo: 5000},
        {onEvent: () => { staleHeld = true; staleResolve(); }});
    await staleSignal;
    let pageTakeoverRelease, pageTakeoverEntered = false;
    const pageTakeoverGate = new Promise(resolve => { pageTakeoverRelease = resolve; });
    const pageTakeover = pageRun({uid, holderId: 'page-D', now: () => 5000}, async lease => {
        pageTakeoverEntered = true;
        await pageTakeoverGate;
        await pageMutation({uid, action: 'remove', operationId: 'device:1', lease});
        return lease.token;
    });
    await waitFor(() => pageTakeoverEntered);
    worker.post({release: true});
    const staleOutcome = await workerStale;
    same([staleOutcome.ok, staleOutcome.code, staleHeld], [false, 'LEASE_LOST', true], 'WORKER_STALE_CODE');
    same([staleOutcome.before, staleOutcome.after], [['device:1'], ['device:1']], 'WORKER_STALE_WROTE');
    pageTakeoverRelease();
    same((await pageTakeover).acquired, true, 'PAGE_TAKEOVER_RUN');
    same(await rowsOf(uid), [], 'PAGE_TAKEOVER_REMOVE');
    passed.push('takeover dopo la scadenza: il Worker, che aveva il token vecchio, ottiene `LEASE_LOST` e compie **zero** rimozioni (contenitori identici prima e dopo), mentre il **nuovo** titolare in pagina subentra e completa la rimozione nella stessa transazione fenced');

    // ── 4. Worker terminato mentre tiene il lease ───────────────────────────────────────
    await seed(uid, ['device:20']);
    const doomed = spawnWorker();
    let doomedResolve, doomedHeld = false;
    const doomedSignal = new Promise(resolve => { doomedResolve = resolve; });
    doomed.command({op: 'hold', uid, holderId: 'worker-E', now: 6000, ttlMs: 100},
        {detached: true, onEvent: () => { doomedHeld = true; doomedResolve(); }});
    await doomedSignal;
    assert(doomedHeld, 'DOOMED_NOT_HELD');
    const rowsWhileHeld = canonical((await inspectQueueSchema({uid})).rows);
    doomed.terminate();
    const pageTooEarly = await pageBoundary({uid, holderId: 'page-E', now: () => 6050, acquireTimeoutMs: 60})(uid, async () => 'page');
    same(pageTooEarly.acquired, false, 'PAGE_ENTERED_WITH_DEAD_HOLDER');
    same(canonical((await inspectQueueSchema({uid})).rows), rowsWhileHeld, 'DEAD_WORKER_WROTE');
    const pageAfterDeath = await pageRun({uid, holderId: 'page-E2', now: () => 6200}, async lease => {
        await pageMutation({uid, action: 'markForReview', operationId: 'device:20', lease});
        return 'ok';
    });
    same(pageAfterDeath.acquired, true, 'PAGE_AFTER_DEATH');
    passed.push('Worker **terminato** mentre tiene il lease: finché il lease è vivo la pagina **non** entra (nessuna falsa riuscita) e il contesto morto non ha scritto nulla (contenitori identici); oltre la scadenza il nuovo titolare subentra e prosegue. Il vecchio contesto è morto, quindi `LEASE_LOST` è provato nel caso con titolare ancora vivo qui sopra (limite dichiarato)');

    // ── 5. Rilascio dopo errore, timeout di acquisizione, sessione scaduta ───────────────
    const failing = await worker.command({op: 'failing', uid, holderId: 'worker-F', now: 7000, ttlMs: 30000});
    same([failing.ok, failing.code, failing.ran], [false, 'SYNTHETIC_TASK_FAILURE', true], 'WORKER_FAILING');
    const released = await readLease(uid);
    same([released.holderId, released.expiresAt], [null, 0], 'WORKER_ERROR_RELEASE');
    const afterError = await worker.command({op: 'probe', uid, holderId: 'worker-F2', now: 7000, ttlMs: 30000});
    same([afterError.ok, afterError.outcome?.acquired], [true, true], 'WORKER_AFTER_ERROR');

    const blocker = withDatabase(uid, database => {
        const transaction = database.transaction('queueLeases', 'readwrite');
        const store = transaction.objectStore('queueLeases');
        const until = Date.now() + 400;
        const pump = () => { const request = store.get(uid); request.onsuccess = () => { if (Date.now() < until) pump(); }; };
        pump();
        return new Promise(resolve => { transaction.oncomplete = () => resolve(); transaction.onabort = () => resolve(); });
    });
    const timedOut = await worker.command({op: 'blocked', uid, holderId: 'worker-G', now: 8000, acquireTimeoutMs: 60});
    same([timedOut.ok, timedOut.code, timedOut.ran], [false, 'LEASE_ACQUIRE_TIMEOUT', false], 'WORKER_TIMEOUT');
    await blocker;
    await waitFor(async () => { const record = await readLease(uid); return !record || record.holderId !== 'worker-G'; });

    const inactive = await worker.command({op: 'session', uid, holderId: 'worker-H', now: 9000, ttlMs: 30000});
    same([inactive.ok, inactive.code, inactive.ran], [false, 'LEASE_SESSION_INACTIVE', false], 'WORKER_SESSION_BEFORE');
    const during = await worker.command({op: 'session', uid, holderId: 'worker-H2', now: 9000, ttlMs: 30000, during: true});
    same([during.ok, during.code, during.ran], [false, 'LEASE_SESSION_INACTIVE', true], 'WORKER_SESSION_DURING');
    same((await readLease(uid)).holderId, null, 'WORKER_SESSION_RELEASE');
    passed.push('rilascio dopo errore del task (il lease torna libero e l’ingresso successivo riesce), **timeout di acquisizione** con il blocco deliberato di una transazione readwrite trattenuta dalla pagina (task mai eseguito, nessun lease trattenuto dopo il rilascio del blocco) e **sessione scaduta** prima e durante il task (`LEASE_SESSION_INACTIVE`, nessuna scrittura, lease rilasciato)');

    // ── 6. Coda v1, database assente e schema malformato: fail-closed ────────────────────
    const v1Uid = `pilot-lease-worker-v1-${crypto.randomUUID()}`;
    await buildV1(v1Uid);
    const v1Before = canonical((await inspectQueueSchema({uid: v1Uid})).rows);
    const v1Result = await worker.command({op: 'mutate', uid: v1Uid, holderId: 'worker-I', now: 10000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    same([v1Result.ok, v1Result.code], [false, 'LEASE_SCHEMA_V1'], 'WORKER_V1');
    const v1After = await inspectQueueSchema({uid: v1Uid});
    same([v1After.version, v1After.stores], [1, ['encryptedOperations']], 'WORKER_V1_UPGRADED');
    same(canonical(v1After.rows), v1Before, 'WORKER_V1_ROWS');

    const absentUid = `pilot-lease-worker-absent-${crypto.randomUUID()}`;
    const absentResult = await worker.command({op: 'mutate', uid: absentUid, holderId: 'worker-J', now: 10000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    same([absentResult.ok, absentResult.code], [false, 'LEASE_DATABASE_MISSING'], 'WORKER_ABSENT');
    assert(!(await indexedDB.databases()).map(entry => entry.name).includes(nameOf(absentUid)), 'WORKER_ABSENT_CREATED');

    const malformedUid = `pilot-lease-worker-malformed-${crypto.randomUUID()}`;
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(nameOf(malformedUid), 2);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
            request.result.createObjectStore('queueLeases', {keyPath: 'chiave'});
        };
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error || new Error('MALFORMED_CREATE'));
    });
    const malformedResult = await worker.command({op: 'mutate', uid: malformedUid, holderId: 'worker-K', now: 10000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    same([malformedResult.ok, malformedResult.code], [false, 'LEASE_SCHEMA_MALFORMED'], 'WORKER_MALFORMED');
    const malformedAfter = await inspectQueueSchema({uid: malformedUid});
    same([malformedAfter.version, malformedAfter.stores, malformedAfter.rows.length], [2, ['encryptedOperations', 'queueLeases'], 0], 'WORKER_MALFORMED_REPAIRED');
    passed.push('rifiuti dichiarati dal Worker senza upgrade, creazione o riparazione: coda **v1 reale** (`LEASE_SCHEMA_V1`, resta v1 con il solo store delle operazioni e righe identiche), **database assente** (`LEASE_DATABASE_MISSING`, nessun database creato — verificato con `indexedDB.databases()`), **schema malformato** (`LEASE_SCHEMA_MALFORMED`, struttura invariata)');

    // ── 7. Superficie del client nel Worker: accodamento con conferma e trasporto in errore ─
    await clearQueue(uid);
    const clientEnqueued = await worker.command({op: 'client-enqueue', uid, holderId: 'worker-L0', now: 11000, ttlMs: 30000, operationId: 'device:30'});
    same([clientEnqueued.ok, clientEnqueued.outcome?.value?.status], [true, 'saved'], 'WORKER_CLIENT_ENQUEUE');
    same(clientEnqueued.after, [], 'WORKER_CLIENT_ENQUEUE_ROWS');
    same((await readLease(uid)).holderId, null, 'WORKER_CLIENT_ENQUEUE_RELEASE');
    await seed(uid, ['device:12']);
    const flushed = await worker.command({op: 'flush', uid, holderId: 'worker-L', now: 11000, ttlMs: 30000});
    same([flushed.ok, flushed.outcome?.value?.status], [true, 'saved'], 'WORKER_FLUSH');
    same(flushed.after, [], 'WORKER_FLUSH_ROWS');
    same((await readLease(uid)).holderId, null, 'WORKER_FLUSH_RELEASE');
    await seed(uid, ['device:11']);
    const failed = await worker.command({op: 'flush', uid, holderId: 'worker-M', now: 11000, ttlMs: 30000, send: 'fail'});
    same([failed.ok, failed.outcome?.value?.status], [true, 'recoverable-error'], 'WORKER_FLUSH_FAIL');
    same(failed.after, ['device:11'], 'WORKER_FLUSH_FAIL_ROWS');
    same((await readLease(uid)).holderId, null, 'WORKER_FLUSH_FAIL_RELEASE');
    const recovered = await worker.command({op: 'flush', uid, holderId: 'worker-N', now: 11000, ttlMs: 30000});
    same([recovered.ok, recovered.outcome?.value?.status], [true, 'saved'], 'WORKER_FLUSH_RECOVERED');
    same(recovered.after, [], 'WORKER_FLUSH_RECOVERED_ROWS');
    passed.push('conferma sotto token nel Worker: la sincronizzazione reale invia e rimuove l’operazione (`saved`); con un trasporto in errore riporta `recoverable-error`, **conserva** la coda e rilascia il lease; il contesto successivo recupera e completa');

    worker.terminate();
    await report({ok: true, passed, browser: navigator.userAgent, pageWebLocks: typeof navigator.locks,
        workerWebLocks: ping.webLocks});
} catch (error) {
    worker.terminate();
    await report({ok: false, passed, code: codeOf(error), detail: detailOf(error)});
}
