import {createOfflineMutationQueue, deriveOfflineQueueKey, openOfflineOperation, readOfflineQueueContainers,
    sealOfflineOperation} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';
import {createRollbackQueueBuild, readWithPreviousV1Reader} from './rollback-v2-compatible.mjs';

// M6-A-5 — laboratorio: **rollback** a una build con fallback disattivato ma lettore v1/v2
// compatibile, su una coda già aggiornata a v2 con operazioni sigillate pendenti. Verifica che il
// rollback non scriva né accodi senza il lease richiesto, non invii e non cancelli nulla, e che le
// operazioni restino leggibili con contenitori invariati; prova inoltre che il **lettore v1
// precedente** fallisce su v2 e che quello stato è riferito come indisponibilità.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected), code);
const sameOutcome = (actual, expected, code) => assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${code}:${JSON.stringify(actual)}`);
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
// Gli errori di WebCrypto sono DOMException con messaggio vuoto: il codice va preso dal nome.
const codeOf = error => error?.code || (error?.name && error.name !== 'Error' ? error.name : error?.message);
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const containerIds = async uid => (await readOfflineQueueContainers({uid})).containers.map(row => row.operationId).sort();
const sealFor = async (operation, key) => sealOfflineOperation(operation, key);
const decrypt = async (uid, containers) => {
    const key = await deriveOfflineQueueKey(KEY, uid);
    const operations = [];
    for (const container of containers) operations.push(await openOfflineOperation(container, key, uid));
    return operations;
};

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

try {
    // Coda **già aggiornata a v2** con due operazioni sigillate pendenti, una in riconciliazione.
    const uid = `rollback-${crypto.randomUUID()}`;
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    await queue.enqueue({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'});
    await queue.markForReview({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'},
        {reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
    queue.close();
    same((await upgradeQueueSchemaToV2({uid})).version, 2, 'ROLLBACK_PREPARE_VERSION');
    const before = await inspectQueueSchema({uid});
    same([before.version, before.rows.length], [2, 2], 'ROLLBACK_PREPARE_ROWS');

    // Trasporto spia: la build di rollback non deve mai chiamarlo.
    const transport = {calls: 0, send() { this.calls += 1; return {status: 'applied'}; }};
    const build = createRollbackQueueBuild({uid, reader: readOfflineQueueContainers, transport,
        keys: {derive: () => deriveOfflineQueueKey(KEY, uid), seal: (operation, key) => sealFor(operation, key)}});

    // ── 1. Lettura compatibile della coda v2: operazioni presenti e contenitori invariati ──
    const read = await build.read();
    same([read.available, read.version], [true, 2], 'ROLLBACK_READ_UNAVAILABLE');
    same(read.operations.map(row => row.operationId).sort(), ['device:1', 'device:2'], 'ROLLBACK_READ_OPERATIONS');
    same(canonical(read.operations), canonical((await readOfflineQueueContainers({uid})).containers), 'ROLLBACK_READ_CONTAINERS_CHANGED');
    const operations = await decrypt(uid, read.operations);
    same([operations.find(operation => operation.operationId === 'device:2')._queueState,
        operations.find(operation => operation.operationId === 'device:2')._reviewReason],
    ['reconciliation-required', 'LEGACY_MUTATION_RESULT_UNVERIFIED'], 'ROLLBACK_READ_REVIEW_LOST');
    passed.push('rollback su coda v2: il lettore compatibile v1/v2 legge le due operazioni sigillate pendenti con contenitori identici e stato di riconciliazione conservato');

    // ── 2. Nessuna scrittura/accodamento senza il lease richiesto (e contrasto positivo) ──
    const refused = await rejection(() => build.enqueue({uid, operationId: 'device:3', recordId: 'record-3', value: 'fixture-3'}));
    same(refused, 'QUEUE_WRITE_REQUIRES_LEASE', 'ROLLBACK_WROTE_WITHOUT_LEASE');
    const afterRefusal = await inspectQueueSchema({uid});
    same([afterRefusal.rows.length, canonical(afterRefusal.rows)], [2, canonical(before.rows)], 'ROLLBACK_REFUSAL_CHANGED_DATA');
    same(await containerIds(uid), ['device:1', 'device:2'], 'ROLLBACK_REFUSAL_ADDED_OPERATION');
    // Contrasto: con un lease **lab** valido la stessa build scrive — il rifiuto dipende davvero
    // dal lease mancante, non da un percorso di scrittura rotto. La build condivide la connessione
    // del lease, perché `guardTransaction` rifiuta una connessione diversa.
    const database = await requestValue(indexedDB.open(`codex-offline-queue-${uid}`));
    const buildWithLease = createRollbackQueueBuild({uid, reader: readOfflineQueueContainers, transport, database,
        keys: {derive: () => deriveOfflineQueueKey(KEY, uid), seal: (operation, key) => sealFor(operation, key)}});
    const coordinator = createHybridQueueCoordinator({database, uid, holderId: 'rollback-lab', locks: null});
    const written = await coordinator.run(async context => buildWithLease.enqueue(
        {uid, operationId: 'device:3', recordId: 'record-3', value: 'fixture-3'}, {lease: context}));
    database.close();
    sameOutcome(written, {acquired: true, value: 'device:3'}, 'ROLLBACK_LEASE_WRITE_FAILED');
    same(await containerIds(uid), ['device:1', 'device:2', 'device:3'], 'ROLLBACK_LEASE_WRITE_MISSING');
    passed.push('rollback senza fallback: `enqueue` rifiuta con `QUEUE_WRITE_REQUIRES_LEASE` e **non** modifica né aggiunge nulla; con un lease valido la stessa build scrive una sola operazione (contrasto discriminante)');

    // ── 3. Nessun invio e nessuna cancellazione ───────────────────────────────────────────
    sameOutcome(await build.synchronise(), {sent: 0, reason: 'ROLLBACK_FALLBACK_DISABLED'}, 'ROLLBACK_SENT');
    same(transport.calls, 0, 'ROLLBACK_TRANSPORT_CALLED');
    const after = await inspectQueueSchema({uid});
    same(after.version, 2, 'ROLLBACK_VERSION_CHANGED');
    const originalStillThere = before.rows.every(row => after.rows.some(other => other.id === row.id &&
        other.iv === row.iv && other.ciphertext === row.ciphertext));
    assert(originalStillThere, 'ROLLBACK_LOST_OR_CHANGED_CONTAINER');
    const operationsAfter = await decrypt(uid, (await readOfflineQueueContainers({uid})).containers);
    same([operationsAfter.find(operation => operation.operationId === 'device:1').value,
        operationsAfter.find(operation => operation.operationId === 'device:2')._queueState],
    ['fixture-1', 'reconciliation-required'], 'ROLLBACK_OPERATIONS_CHANGED');
    passed.push('nessun invio (`synchronise` non chiama mai il trasporto, zero chiamate) e nessuna cancellazione: i due contenitori originali restano byte per byte al loro posto, con stato di riconciliazione invariato');

    // ── 4. Lettore v1 **precedente** su v2: indisponibilità dichiarata, mai coda vuota ────
    same(await rejection(() => readWithPreviousV1Reader({uid})), 'QUEUE_UNAVAILABLE_SCHEMA', 'ROLLBACK_PREVIOUS_READER_ACCEPTED_V2');
    const previousBuild = createRollbackQueueBuild({uid, reader: readWithPreviousV1Reader,
        keys: {derive: () => deriveOfflineQueueKey(KEY, uid), seal: (operation, key) => sealFor(operation, key)}});
    const previousRead = await previousBuild.read();
    same([previousRead.available, previousRead.operations, previousRead.reason],
        [false, null, 'QUEUE_UNAVAILABLE_SCHEMA'], 'ROLLBACK_UNAVAILABILITY_SHAPE');
    assert(previousRead.operations !== null || previousRead.available === false, 'ROLLBACK_HID_OPERATIONS');
    same(await containerIds(uid), ['device:1', 'device:2', 'device:3'], 'ROLLBACK_UNAVAILABILITY_LOST_DATA');
    passed.push('lettore v1 **precedente** su coda v2: fallisce con `QUEUE_UNAVAILABLE_SCHEMA` e lo stato è riferito come indisponibilità (`available:false`, `operations:null`) — mai coda vuota, mai salvataggio riuscito — mentre i contenitori restano tutti presenti');

    await report({ok: true, passed, browser: navigator.userAgent});
} catch (error) {
    await report({ok: false, passed, code: codeOf(error)});
}
