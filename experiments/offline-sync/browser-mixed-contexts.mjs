import {createOfflineMutationQueue, deriveOfflineQueueKey, readOfflineQueueContainers, sealOfflineOperation, withOfflineQueueLease} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';

// M6-A-3 — laboratorio: matrice **mista** build v1 attuale / candidato ibrido su due contesti
// reali (questa scheda e un Worker) nello stesso profilo e stesso `uid` sintetico, con Web Locks
// presente e con l'API assente. Non attiva nulla: `Frontend/public/**`, PWA, Rules, Functions e
// dati reali restano invariati. Il "processo" è di laboratorio: sigilla un contenitore e lo
// scrive in `encryptedOperations` **dentro** la sezione critica del protocollo in prova.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected), code);
// Confronto degli esiti dei protocolli: il messaggio porta con sé il valore osservato, così un
// esito inatteso è leggibile nel rapporto del banco senza doverlo riprodurre.
const sameOutcome = (actual, expected, code) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${code}:${JSON.stringify(actual)}`);
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
// Sorveglianza: se una sequenza non si conclude, il banco riporta comunque i verdetti raggiunti.
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

const nativeLocks = navigator.locks;
const setLocks = value => Object.defineProperty(navigator, 'locks', {value, configurable: true});
const queueName = uid => `codex-offline-queue-${uid}`;
const containerIds = async uid => (await readOfflineQueueContainers({uid})).containers.map(row => row.operationId).sort();

const writeSealed = async (uid, container) => {
    const database = await requestValue(indexedDB.open(queueName(uid)));
    try {
        await new Promise((resolve, reject) => {
            const tx = database.transaction('encryptedOperations', 'readwrite');
            tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('WRITE_ABORTED'));
            tx.objectStore('encryptedOperations').put(container);
        });
    } finally { database.close(); }
};
// Processo di laboratorio della scheda: sigilla e scrive dentro la sezione critica. Se il
// protocollo le passa un contesto di lease, la scrittura passa da `guardTransaction` sulla
// **stessa** connessione del coordinatore (`guardTransaction` rifiuta una connessione diversa).
const pageTask = (uid, operationId, holdMs, leaseDatabase = null) => async context => {
    if (holdMs) await sleep(holdMs);
    const container = await sealOfflineOperation({uid, operationId, recordId: `record-${operationId}`, value: 'page'},
        await deriveOfflineQueueKey(KEY, uid));
    if (context?.guardTransaction) {
        assert(leaseDatabase, 'PAGE_LEASE_DATABASE_REQUIRED');
        await new Promise((resolve, reject) => {
            const tx = leaseDatabase.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
            tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('PAGE_WRITE_ABORTED'));
            context.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); }, error => reject(error));
        });
    } else {
        await writeSealed(uid, container);
    }
    return operationId;
};

// Secondo contesto: Worker dedicato, avviato per singola operazione, con segnale di ingresso e
// (con `gated`) rilascio esplicito: la matrice non dipende da tempi arbitrari.
const startWorkerTask = data => {
    const worker = new Worker('/mixed-worker.mjs', {type: 'module'});
    let enter, finish;
    const entered = new Promise(resolve => { enter = resolve; });
    const result = new Promise(resolve => { finish = resolve; });
    worker.onmessage = ({data: message}) => {
        if (message.entered) { enter(true); return; }
        worker.terminate(); finish(message);
    };
    worker.onerror = () => { worker.terminate(); finish({ok: false, code: 'WORKER_FAILED'}); };
    worker.postMessage(data);
    return {entered, result, release: () => worker.postMessage({release: true})};
};
const workerCall = data => startWorkerTask(data).result;

// Coda sintetica: una operazione pendente sigillata, poi l'upgrade additivo di laboratorio
// (M6-A-2) così esistono sia `encryptedOperations` sia `queueLeases` — lo schema che il
// candidato ibrido richiede.
//
// **Nessun retry (correzione M6-A-2 R2).** Un blocco interno qui è un difetto del candidato, non
// una condizione da nascondere: la preparazione viene eseguita una volta sola e qualunque errore
// fa fallire il verdetto. I blocchi **deliberati** (connessione tenuta aperta, richiesta di
// cambio versione esterna) vivono nel banco M6-A-2, dove sono attesi e asseriti.
const prepareQueue = async label => {
    const uid = `mixed-${label}-${crypto.randomUUID()}`;
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'seed', recordId: 'record-seed', value: 'seed'});
    queue.close();
    let upgrade = null;
    try { upgrade = await upgradeQueueSchemaToV2({uid}); }
    catch (error) { throw new Error(`PREPARE_${label}_INTERNAL_BLOCK:${error.code || error.message}`); }
    same(upgrade.version, 2, `PREPARE_${label}_VERSION`);
    return uid;
};
// Titolare lato scheda per il protocollo v1: entra, annuncia, aspetta il rilascio, scrive.
const pageHolder = uid => {
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const run = withOfflineQueueLease(uid, async () => {
        enter(true);
        await gate;
        return pageTask(uid, 'page-holder', 0)();
    });
    return {entered, run, release};
};

try {
    same(typeof nativeLocks?.request, 'function', 'PAGE_WEB_LOCKS_MISSING');

    // ── A1. Web Locks presente, la build vecchia tiene il lock di piattaforma ────────────
    const bridgeUid = await prepareQueue('bridge');
    const withBridgeHolder = pageHolder(bridgeUid);
    await withBridgeHolder.entered;
    same(await containerIds(bridgeUid), ['seed'], 'BRIDGE_HOLDER_WROTE_EARLY');
    const bridgedAttempt = await workerCall({id: 1, role: 'hybrid', uid: bridgeUid, holderId: 'worker-bridge',
        bridge: true, operationId: 'worker-a1', holdMs: 0});
    assert(bridgedAttempt.ok === true, `BRIDGE_WORKER_FAILED_${bridgedAttempt.code}`);
    sameOutcome(bridgedAttempt.outcome, {acquired: false}, 'BRIDGE_NOT_EXCLUDED');
    same(await containerIds(bridgeUid), ['seed'], 'BRIDGE_WORKER_WROTE_WHILE_EXCLUDED');
    withBridgeHolder.release();
    same((await withBridgeHolder.run).acquired, true, 'BRIDGE_HOLDER_NOT_ACQUIRED');
    same(await containerIds(bridgeUid), ['page-holder', 'seed'], 'BRIDGE_HOLDER_WRITE_MISSING');
    passed.push('A1, Web Locks presente con ponte: mentre la build v1 tiene il lock di piattaforma, il candidato ibrido NON esegue ({acquired:false}) e non scrive nulla; la build v1 scrive la sua operazione');

    // ── A1-controllo. Lo stesso tentativo **senza ponte**: il solo lease non esclude ─────
    const holeUid = await prepareQueue('a1-hole');
    const holeHolder = pageHolder(holeUid);
    await holeHolder.entered;
    const leaseOnlyAttempt = await workerCall({id: 2, role: 'hybrid', uid: holeUid, holderId: 'worker-lease-only',
        bridge: false, operationId: 'worker-a1c', holdMs: 0});
    sameOutcome(leaseOnlyAttempt.outcome, {acquired: true, value: 'worker-a1c'},
        `LEASE_ONLY_NOT_ADMITTED lease=${JSON.stringify(leaseOnlyAttempt.lease)} webLocks=${leaseOnlyAttempt.webLocks}`);
    holeHolder.release();
    await holeHolder.run;
    same(await containerIds(holeUid), ['page-holder', 'seed', 'worker-a1c'], 'LEASE_ONLY_WRITES_MISSING');
    passed.push('A1 controllo discriminante, senza ponte (solo lease): il candidato ESEGUE e scrive mentre la build v1 tiene il lock di piattaforma — il lease da solo non garantisce la convivenza, come già segnalato in M6-ADOZIONE-PIANO R1 §5');

    // ── A2. Il candidato tiene il ponte (lock + lease): la build vecchia resta fuori ─────
    const holdUid = await prepareQueue('a2-hold');
    const holding = startWorkerTask({id: 3, role: 'hybrid', uid: holdUid, holderId: 'worker-hold',
        bridge: true, gated: true, operationId: 'worker-a2'});
    await holding.entered;
    same(await withOfflineQueueLease(holdUid, pageTask(holdUid, 'page-a2', 0)), {acquired: false}, 'BRIDGE_PAGE_NOT_EXCLUDED');
    holding.release();
    const holdingResult = await holding.result;
    assert(holdingResult.ok === true, `HOLD_WORKER_FAILED_${holdingResult.code}`);
    sameOutcome(holdingResult.outcome, {acquired: true, value: 'worker-a2'}, 'HOLD_WORKER_NOT_ACQUIRED');
    same(await containerIds(holdUid), ['seed', 'worker-a2'], 'BRIDGE_PAGE_WROTE_WHILE_EXCLUDED');
    passed.push('A2, Web Locks presente con ponte: mentre il candidato tiene lock di piattaforma e lease, la build v1 riceve {acquired:false} e non scrive nulla');

    // ── A2-controllo. Candidato con solo lease: la build vecchia entra, e i due si sovrappongono
    const overlapUid = await prepareQueue('a2-overlap');
    const leaseHolding = startWorkerTask({id: 4, role: 'hybrid', uid: overlapUid, holderId: 'worker-overlap',
        bridge: false, gated: true, operationId: 'worker-a2c'});
    await leaseHolding.entered;
    same((await withOfflineQueueLease(overlapUid, pageTask(overlapUid, 'page-a2c', 0))).acquired, true, 'LEASE_ONLY_PAGE_NOT_ADMITTED');
    leaseHolding.release();
    const leaseHoldingResult = await leaseHolding.result;
    sameOutcome(leaseHoldingResult.outcome, {acquired: true, value: 'worker-a2c'}, 'OVERLAP_WORKER_NOT_ACQUIRED');
    same(await containerIds(overlapUid), ['page-a2c', 'seed', 'worker-a2c'], 'OVERLAP_WRITES_MISSING');
    passed.push('A2 controllo discriminante, candidato con solo lease: la build v1 ENTRA e scrive mentre il candidato tiene il lease — i due protocolli elaborano in parallelo, quindi il ponte è necessario');

    // ── B1. Web Locks assente: la build vecchia rifiuta in entrambi i contesti ───────────
    const absentUid = await prepareQueue('b1-absent');
    setLocks(undefined);
    same(typeof navigator.locks, 'undefined', 'PAGE_LOCKS_NOT_REMOVED');
    let pageRefusal = null;
    try { await withOfflineQueueLease(absentUid, pageTask(absentUid, 'page-b1', 0)); }
    catch (error) { pageRefusal = error.code || error.message; }
    same(pageRefusal, 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', 'PAGE_V1_DID_NOT_REFUSE');
    const workerRefusal = await workerCall({id: 5, role: 'v1', uid: absentUid, stripLocks: true, operationId: 'worker-b1', holdMs: 0});
    assert(workerRefusal.ok === true, `ABSENT_WORKER_FAILED_${workerRefusal.code}`);
    sameOutcome([workerRefusal.outcome, workerRefusal.webLocks], [{error: 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE'}, 'undefined'], 'WORKER_V1_DID_NOT_REFUSE');
    same(await containerIds(absentUid), ['seed'], 'ABSENT_CONTEXTS_WROTE');
    passed.push('B1, Web Locks assente (API rimossa davvero nella scheda e nel Worker): la build v1 rifiuta con OFFLINE_QUEUE_LOCKS_UNAVAILABLE in entrambi i contesti e non scrive nulla');

    // ── B2. Web Locks assente: il candidato usa solo il lease, che esclude l'altro candidato
    const leaseUid = await prepareQueue('b2-lease');
    const leaseHoldingB2 = startWorkerTask({id: 6, role: 'hybrid', uid: leaseUid, holderId: 'worker-lease',
        bridge: false, stripLocks: true, gated: true, operationId: 'worker-b2'});
    await leaseHoldingB2.entered;
    const pageDatabase = await requestValue(indexedDB.open(queueName(leaseUid)));
    const pageCoordinator = createHybridQueueCoordinator({database: pageDatabase, uid: leaseUid, holderId: 'page-lease', locks: null});
    same(await pageCoordinator.run(pageTask(leaseUid, 'page-b2-excluded', 0, pageDatabase)), {acquired: false}, 'LEASE_ONLY_SECOND_EXECUTED');
    leaseHoldingB2.release();
    const leaseHoldingB2Result = await leaseHoldingB2.result;
    assert(leaseHoldingB2Result.ok === true, `LEASE_WORKER_FAILED_${leaseHoldingB2Result.code}`);
    sameOutcome(leaseHoldingB2Result.outcome, {acquired: true, value: 'worker-b2'}, 'LEASE_WORKER_NOT_ACQUIRED');
    same(leaseHoldingB2Result.webLocks, 'undefined', 'LEASE_WORKER_LOCKS_PRESENT');
    same(await pageCoordinator.run(pageTask(leaseUid, 'page-b2', 0, pageDatabase)), {acquired: true, value: 'page-b2'}, 'LEASE_AFTER_RELEASE_FAILED');
    pageDatabase.close();
    same(await containerIds(leaseUid), ['page-b2', 'seed', 'worker-b2'], 'LEASE_WRITES_MISSING');
    passed.push('B2, Web Locks assente: il candidato nel Worker esegue usando SOLO il lease IndexedDB; un secondo candidato nella scheda riceve {acquired:false} senza scrivere e, dopo il rilascio, riesce ({acquired:true})');

    setLocks(nativeLocks);

    // ── C. Fatti registrati: VersionError della build vecchia su coda v2, lease assente su v1
    // [M6-A-8a] La build **precedente** apre con versione 1: è quella che rifiuta lo schema v2,
    // mentre lo scrittore attuale (compatibile) apre la stessa coda senza migrare nulla.
    const compatibleWriter = await createOfflineMutationQueue({uid: leaseUid, vaultKeyMaterial: KEY});
    same(compatibleWriter.version, 2, 'WRITER_NOT_COMPATIBLE_V2');
    compatibleWriter.close();
    let oldBuildFailure = null;
    try { await requestValue(indexedDB.open(`codex-offline-queue-${leaseUid}`, 1)); }
    catch (error) { oldBuildFailure = error.name || error.code || error.message; }
    same(oldBuildFailure, 'VersionError', 'OLD_BUILD_NOT_VERSION_ERROR');
    const v1Uid = `mixed-c-v1-${crypto.randomUUID()}`;
    const v1Queue = await createOfflineMutationQueue({uid: v1Uid, vaultKeyMaterial: KEY});
    await v1Queue.enqueue({uid: v1Uid, operationId: 'seed', recordId: 'record-seed', value: 'seed'});
    v1Queue.close();
    const v1Database = await requestValue(indexedDB.open(queueName(v1Uid)));
    let leaseOnV1 = null;
    try { await createHybridQueueCoordinator({database: v1Database, uid: v1Uid, holderId: 'lab', locks: null}).run(async () => 'no-op'); }
    catch (error) { leaseOnV1 = error.name || error.code || error.message; }
    v1Database.close();
    assert(leaseOnV1, 'LEASE_ON_V1_DID_NOT_FAIL');
    same((await upgradeQueueSchemaToV2({uid: v1Uid})).version, 2, 'C_UPGRADE_VERSION');
    passed.push(`C fatti registrati: su una coda già v2 la build v1 attuale fallisce con ${oldBuildFailure} (apre con versione 1); su una coda v1 il candidato ibrido fallisce con ${leaseOnV1} (manca lo store del lease) e solo dopo l'upgrade additivo la stessa coda torna utilizzabile — in una convivenza reale la copia vecchia ancora aperta resta il punto critico`);

    await report({ok: true, passed, browser: navigator.userAgent, pageWebLocks: typeof navigator.locks});
} catch (error) {
    setLocks(nativeLocks);
    await report({ok: false, passed, code: error.code || error.message});
}
