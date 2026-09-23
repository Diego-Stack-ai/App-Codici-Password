import {createOfflineMutationQueue, createOfflineQueueReader, deriveOfflineQueueKey, readOfflineQueueContainers,
    sealOfflineOperation, withOfflineQueueLease} from './offline-mutation-queue.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';
import {inspectOfflineQueueSchema, upgradeOfflineQueueSchema} from './offline-mutation-upgrade.js';

// [M6-A-8e] Banco dedicato della matrice **copie miste** (casi 6, 6-bis e 6-ter del piano M6):
// copia **vecchia** v1/Web-Locks-only e copia **nuova** corrente con opt-in del lease, sullo stesso
// profilo e stesso UID, più il **rollback v2-compatibile** e il caso della vecchia connessione
// tenuta aperta durante l'upgrade. Pagina e Worker usano i **moduli runtime correnti**; il Worker
// non importa nulla da `experiments/` come implementazione. Nessun Service Worker, PWA, dato reale.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const nativeLocks = navigator.locks;
const setLocks = value => Object.defineProperty(navigator, 'locks', {value, configurable: true});
setLocks(undefined); // la pagina parte senza Web Locks: è il caso del pilota
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
    throw new Error('MIXED_CURRENT_WAIT');
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const nameOf = uid => `codex-offline-queue-${uid}`;
const rowsOf = async uid => canonical((await inspectOfflineQueueSchema({uid})).rows.slice().sort((left, right) => left.id.localeCompare(right.id)));
const leaseOf = async uid => {
    const database = await requestValue(indexedDB.open(nameOf(uid)));
    try {
        if (!database.objectStoreNames.contains('queueLeases')) return null;
        return (await requestValue(database.transaction('queueLeases', 'readonly').objectStore('queueLeases').get(uid))) ?? null;
    } finally { database.close(); }
};
const deleteDatabase = name => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onblocked = () => reject(new Error('MIXED_CURRENT_HANDLE_LEFT'));
    request.onerror = () => reject(request.error || new Error('MIXED_CURRENT_DELETE'));
});
const buildV1Queue = async (uid, operationIds) => {
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    for (const operationId of operationIds) {
        await queue.enqueue({uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`});
    }
    queue.close();
};
// Il secondo contesto: un Worker **fresco per job** (realm pulito, `stripLocks` opzionale).
const startJob = (data, {onEvent, timeoutMs = 8000} = {}) => {
    const worker = new Worker('/mixed-current-worker.mjs', {type: 'module'});
    let settle, timer;
    const result = new Promise(resolve => { settle = resolve; });
    const finish = message => { clearTimeout(timer); worker.terminate(); settle(message); };
    timer = setTimeout(() => finish({ok: false, code: 'WORKER_JOB_TIMEOUT', op: data.op, id: data.id}), timeoutMs);
    worker.onmessage = ({data: message}) => {
        if (message.event) { onEvent?.(message); return; }
        finish(message);
    };
    worker.onerror = () => finish({ok: false, code: 'WORKER_FAILED', op: data.op});
    worker.postMessage(data);
    // Il rilascio porta lo `uid`: il Worker tiene un'istanza per UID e il bootstrap scarta i
    // messaggi senza UID.
    return {result, release: () => worker.postMessage({release: true, uid: data.uid})};
};
const job = async (data, options) => await startJob(data, options).result;
// Ruolo della **pagina**: copia nuova (opt-in) e copia di piattaforma senza fallback.
const pageNewRun = (uid, options, task) => resolveOfflineQueueLease({uid, leaseFallback: true, ...options})(uid, task);
const pageNewMutation = async (uid, {action, operationId, lease}) => {
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    try {
        const reader = await createOfflineQueueReader({uid, vaultKeyMaterial: KEY});
        const expected = (await reader.read()).operations.find(operation => operation.operationId === operationId);
        if (action === 'remove') return await queue.remove(expected, {isActive: () => true, lease});
        return await queue.markForReview(expected, {isActive: () => true, lease});
    } finally { queue.close(); }
};

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 20000);

try {
    const uid = `mixed-current-${crypto.randomUUID()}`;
    const ping = await job({op: 'ping', uid});
    same([ping.ok, ping.webLocks], [true, 'object'], 'MIXED_WORKER_LOCKS_PRESENT');
    const stripPing = await job({op: 'ping', uid, stripLocks: true});
    same([stripPing.ok, stripPing.webLocks], [true, 'undefined'], 'MIXED_WORKER_STRIP');
    assert(typeof navigator.locks === 'undefined', 'MIXED_PAGE_LOCKS_PRESENT');
    await buildV1Queue(uid, ['device:1', 'device:2']);
    const v1 = await inspectOfflineQueueSchema({uid});
    same([v1.version, v1.stores, v1.rows.length], [1, ['encryptedOperations'], 2], 'MIXED_V1_LAYOUT');
    same((await job({op: 'old-open', uid})).version, 1, 'MIXED_OLD_OPENS_V1');
    same((await job({op: 'old-read-v1', uid})).ids, ['device:1', 'device:2'], 'MIXED_OLD_READS_V1');
    passed.push('coda v1 reale con due contenitori sigillati: la copia **vecchia** (apertura a versione 1, lettore solo-v1) la legge; la pagina parte **senza** `navigator.locks` e il Worker sa lavorare sia con l’API di piattaforma presente sia con l’API rimossa nel proprio realm (entrambe le condizioni verificate)');

    // ── 6-bis: Web Locks presente, ponte condiviso ────────────────────────────────────────
    setLocks(nativeLocks);
    const bridgeRows = await rowsOf(uid);
    let pageRelease, pageEntered = false;
    const pageGate = new Promise(resolve => { pageRelease = resolve; });
    const pageHold = pageNewRun(uid, {holderId: 'page-new', now: () => 1000, ttlMs: 30000}, async () => {
        pageEntered = true; await pageGate; return 'page';
    });
    await waitFor(() => pageEntered);
    const oldBlocked = await job({op: 'old-write', uid, operationId: 'device:9'});
    same([oldBlocked.ok, oldBlocked.outcome?.acquired], [true, false], 'MIXED_OLD_IN');
    same(await rowsOf(uid), bridgeRows, 'MIXED_OLD_WROTE_WHILE_EXCLUDED');
    pageRelease();
    same((await pageHold).acquired, true, 'MIXED_PAGE_HOLD');
    const oldAfter = await job({op: 'old-write', uid, operationId: 'device:9'});
    same([oldAfter.ok, oldAfter.outcome?.acquired, oldAfter.ids], [true, true, ['device:1', 'device:2', 'device:9']], 'MIXED_OLD_AFTER');
    // Direzione opposta: la copia vecchia tiene il lock di piattaforma, la nuova non entra.
    let oldResolve, oldHeld = false, pageWrote = false;
    const oldSignal = new Promise(resolve => { oldResolve = resolve; });
    const oldHold = startJob({op: 'old-hold', uid, write: false}, {onEvent: () => { oldHeld = true; oldResolve(); }});
    await oldSignal;
    const pageBlocked = await pageNewRun(uid, {holderId: 'page-new2', now: () => 1000, acquireTimeoutMs: 60}, async () => {
        pageWrote = true; return 'page';
    });
    same([pageBlocked.acquired, pageWrote], [false, false], 'MIXED_PAGE_IN');
    oldHold.release();
    const oldHoldReply = await oldHold.result;
    same([oldHoldReply.ok, oldHoldReply.code ?? null, oldHeld], [true, null, true], 'MIXED_OLD_HOLD');
    const pageFree = await pageNewRun(uid, {holderId: 'page-new3', now: () => 1000}, async () => 'page');
    same(pageFree.acquired, true, 'MIXED_PAGE_AFTER');
    passed.push('**6-bis con Web Locks presente**: il **ponte è il lock di piattaforma condiviso** — nuova→vecchia e vecchia→nuova si escludono in entrambe le direzioni, il contesto escluso **non scrive** (contenitori identici durante l’esclusione) e dopo il rilascio la scrittura avviene');

    // ── 6-ter: senza Web Locks ────────────────────────────────────────────────────────────
    // ── Upgrade additivo con il runtime corrente (il percorso lease richiede la v2) ───────
    setLocks(undefined);
    const rowsBeforeUpgrade = await rowsOf(uid);
    const upgrade = await upgradeOfflineQueueSchema({uid});
    same([upgrade.version, upgrade.created], [2, ['queueLeases']], 'MIXED_UPGRADE');
    const v2 = await inspectOfflineQueueSchema({uid});
    same([v2.version, v2.stores], [2, ['encryptedOperations', 'queueLeases']], 'MIXED_V2_LAYOUT');
    same(await rowsOf(uid), rowsBeforeUpgrade, 'MIXED_UPGRADE_ROWS');

    setLocks(undefined);
    const noLocksRows = await rowsOf(uid);
    const oldNoLocks = await job({op: 'old-write', uid, operationId: 'device:91', stripLocks: true});
    same([oldNoLocks.ok, oldNoLocks.code], [false, 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE'], 'MIXED_OLD_NOLOCKS');
    same(await rowsOf(uid), noLocksRows, 'MIXED_OLD_NOLOCKS_WROTE');
    same(await rejection(() => withOfflineQueueLease(uid, async () => 'ran')), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', 'MIXED_DEFAULT_NOLOCKS');
    const newMark = await pageNewRun(uid, {holderId: 'page-new4', now: () => 2000, ttlMs: 30000}, async lease => {
        await pageNewMutation(uid, {action: 'markForReview', operationId: 'device:1', lease});
        return lease.token;
    });
    same(newMark.acquired, true, 'MIXED_NEW_LEASE');
    assert((await leaseOf(uid)).holderId === null, 'MIXED_NEW_LEASE_RELEASED');
    // La marcatura **risigilla** il contenitore (nuovo IV): cambiano i byte, non l'insieme delle
    // operazioni. L'identità byte per byte è pretesa nei percorsi **rifiutati**.
    same((await inspectOfflineQueueSchema({uid})).rows.map(row => row.operationId).sort(),
        ['device:1', 'device:2', 'device:9'], 'MIXED_NEW_CHANGED_IDS');
    passed.push('**6-ter senza Web Locks**: la copia vecchia rifiuta con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` e **non scrive**; anche la copia nuova **senza opt-in** rifiuta (`withOfflineQueueLease`), quindi non c’è elaborazione insicura della stessa coda; con l’opt-in la copia nuova lavora sotto il lease IndexedDB e nessuno dichiara una riuscita che non c’è stata');

    // ── Upgrade alla v2 con il runtime corrente + copia vecchia davanti a v2 ──────────────
    // Lo schema è già stato aggiornato a v2 nel blocco dell'upgrade: qui si prova la copia
    // **vecchia** davanti alla v2.
    const rowsForOldCopy = await rowsOf(uid);
    same(v2.version, 2, 'MIXED_OLD_V2_LAYOUT');
    setLocks(nativeLocks);
    const oldOnV2 = await job({op: 'old-open', uid});
    same([oldOnV2.ok, oldOnV2.code], [false, 'VersionError'], 'MIXED_OLD_ON_V2');
    const oldReaderV2 = await job({op: 'old-read-v1', uid});
    same([oldReaderV2.ok, oldReaderV2.code], [false, 'QUEUE_UNAVAILABLE_SCHEMA'], 'MIXED_V1_READER_V2');
    const oldWriteV2 = await job({op: 'old-write', uid, operationId: 'device:92'});
    same([oldWriteV2.ok, oldWriteV2.code], [false, 'VersionError'], 'MIXED_OLD_WRITE_V2');
    same(await rowsOf(uid), rowsForOldCopy, 'MIXED_OLD_WROTE_ON_V2');
    setLocks(undefined);
    passed.push('**upgrade additivo** con il runtime corrente (`upgradeOfflineQueueSchema`, lo stesso codice che il pilota riesporta): creato solo `queueLeases`, contenitori **byte-identici**; la **copia vecchia** davanti allo schema v2 fallisce in modo esplicito (`VersionError` all’apertura a versione 1 e `QUEUE_UNAVAILABLE_SCHEMA` dal lettore solo-v1, **mai** una coda vuota) e **non scrive**, lasciando coda e contenitori intatti');

    // ── Caso 6: rollback v2-compatibile ───────────────────────────────────────────────────
    const rollbackRows = await rowsOf(uid);
    const rollbackLeaseBefore = await leaseOf(uid);
    const rollbackRead = await job({op: 'rollback-read', uid});
    same([rollbackRead.ok, rollbackRead.available, rollbackRead.version, rollbackRead.ids], [true, true, 2, ['device:1', 'device:2', 'device:9']], 'MIXED_ROLLBACK_READ');
    const rollbackSync = await job({op: 'rollback-sync', uid, stripLocks: true});
    same([rollbackSync.ok, rollbackSync.code, rollbackSync.sent], [false, 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', []], 'MIXED_ROLLBACK_SYNC');
    const rollbackMutate = await job({op: 'rollback-mutate', uid, operationId: 'device:1', stripLocks: true});
    same([rollbackMutate.ok, rollbackMutate.code], [false, 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE'], 'MIXED_ROLLBACK_MUTATE');
    same(await rowsOf(uid), rollbackRows, 'MIXED_ROLLBACK_ROWS');
    same(await leaseOf(uid), rollbackLeaseBefore, 'MIXED_ROLLBACK_LEASE');
    setLocks(nativeLocks);
    const rollbackWithLocks = await job({op: 'rollback-sync', uid});
    // Con il lock di piattaforma il rollback entra nella sezione critica e legge la coda v2: si ferma
    // sull'operazione marcata per revisione, **senza** inviarla (nessun falso invio).
    same([rollbackWithLocks.ok, rollbackWithLocks.outcome?.value?.status, rollbackWithLocks.sent],
        [true, 'reconciliation-required', []], 'MIXED_ROLLBACK_LOCKS');
    setLocks(undefined);
    passed.push('**rollback v2-compatibile**: legge lo schema v2 dal lettore compatibile (mai modellato come lettore solo-v1) ma **rifiuta** sincronizzazione e mutazioni senza il lock richiesto (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, zero invii, contenitori e record del lease invariati); con il lock di piattaforma entra nella sezione critica, legge la coda v2 e si ferma sull’operazione marcata per revisione **senza** inviarla');

    // ── Vecchia connessione aperta durante upgrade/versionchange ──────────────────────────
    const heldUid = `mixed-current-held-${crypto.randomUUID()}`;
    await buildV1Queue(heldUid, ['device:1', 'device:2']);
    const heldRows = await rowsOf(heldUid);
    const heldConnection = await requestValue(indexedDB.open(nameOf(heldUid), 1));
    same(heldConnection.version, 1, 'MIXED_HELD_OPEN');
    same(await rejection(() => upgradeOfflineQueueSchema({uid: heldUid})), 'QUEUE_UPGRADE_BLOCKED', 'MIXED_BLOCKED');
    // Finché la richiesta di cambio versione è **in sospeso** ogni nuova apertura resta accodata
    // dietro di essa: lo stato si legge dalla connessione vecchia, che è quella che blocca.
    same([heldConnection.version, heldConnection.objectStoreNames.contains('queueLeases')], [1, false], 'MIXED_BLOCKED_VERSION');
    const alive = await requestValue(heldConnection.transaction('encryptedOperations', 'readonly').objectStore('encryptedOperations').getAll());
    same(canonical(alive.slice().sort((left, right) => left.id.localeCompare(right.id))), heldRows, 'MIXED_BLOCKED_ROWS');
    heldConnection.close();
    await new Promise(resolve => setTimeout(resolve, 400));
    same([(await inspectOfflineQueueSchema({uid: heldUid})).version, await rowsOf(heldUid)], [1, heldRows], 'MIXED_LATE_UPGRADE');
    const retry = await upgradeOfflineQueueSchema({uid: heldUid});
    same([retry.version, retry.created], [2, ['queueLeases']], 'MIXED_RETRY');
    same([(await inspectOfflineQueueSchema({uid: heldUid})).version, await rowsOf(heldUid)], [2, heldRows], 'MIXED_RETRY_ROWS');
    const coopUid = `mixed-current-coop-${crypto.randomUUID()}`;
    await buildV1Queue(coopUid, ['device:1', 'device:2']);
    const coopRows = await rowsOf(coopUid);
    const coopConnection = await requestValue(indexedDB.open(nameOf(coopUid), 1));
    coopConnection.onversionchange = () => coopConnection.close();
    const coop = await upgradeOfflineQueueSchema({uid: coopUid});
    same([coop.version, await rowsOf(coopUid)], [2, coopRows], 'MIXED_COOPERATIVE');
    await deleteDatabase(nameOf(heldUid));
    await deleteDatabase(nameOf(coopUid));
    await deleteDatabase(nameOf(uid));
    passed.push('**vecchia connessione durante l’upgrade**: con la connessione **trattenuta** l’upgrade riporta `QUEUE_UPGRADE_BLOCKED` e la coda resta a v1 con contenitori identici (nessun aggiornamento silenzioso); l’esito tardivo dopo la chiusura **non** aggiorna nulla (la richiesta tardiva viene annullata) e un nuovo tentativo riesce con contenitori byte-identici; con la connessione **cooperativa** l’upgrade riesce al primo tentativo. Nessun handle lasciato: la cancellazione dei database sintetici non resta bloccata');

    await report({ok: true, passed, browser: navigator.userAgent, pageWebLocks: typeof navigator.locks, workerWebLocks: ping.webLocks});
} catch (error) {
    await report({ok: false, passed, code: codeOf(error), detail: detailOf(error)});
}
