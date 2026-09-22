import {createOfflineMutationQueue, deriveOfflineQueueKey, openOfflineOperation, readOfflineQueueContainers,
    sealOfflineOperation} from './queue.js';
import {inspectOfflineQueueSchema, upgradeOfflineQueueSchema} from './offline-mutation-upgrade.js';
import {inspectPrivateAccountPilotQueue, upgradePrivateAccountPilotQueue} from './private-account-pilot-queue.js';
import {createOfflineMutationClientCore} from './offline-mutation-client-core.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';

// M6-A-7 — laboratorio: l'upgrade additivo **del runtime** (`offline-mutation-upgrade.js`, porting
// del candidato M6-A-2 R2) invocato esplicitamente, su IndexedDB reale. Verifica che crei solo
// `queueLeases`, che i contenitori sigillati restino identici, che blocchi e schemi inattesi
// falliscano chiusi e che il runtime **non** avvii l'upgrade da sé.
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
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const queueName = uid => `codex-offline-queue-${uid}`;
const newUid = label => `runtime-upgrade-${label}-${crypto.randomUUID()}`;
const containerIds = async uid => (await readOfflineQueueContainers({uid})).containers.map(row => row.operationId).sort();
const decrypted = async (uid, containers) => {
    const key = await deriveOfflineQueueKey(KEY, uid);
    const operations = [];
    for (const container of containers) operations.push(await openOfflineOperation(container, key, uid));
    return operations;
};
const deleteDatabaseChecked = (name, waitMs = 500) => new Promise(resolve => {
    const request = indexedDB.deleteDatabase(name);
    let blocked = false;
    const timer = setTimeout(() => resolve({blocked, pending: true}), waitMs);
    request.onblocked = () => { blocked = true; };
    request.onsuccess = () => { clearTimeout(timer); resolve({blocked}); };
    request.onerror = () => { clearTimeout(timer); resolve({blocked, error: request.error?.name}); };
});
// Coda v1 reale con due operazioni sigillate pendenti, una in riconciliazione.
const createV1Queue = async label => {
    const uid = newUid(label);
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    await queue.enqueue({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'});
    await queue.markForReview({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'},
        {reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
    queue.close();
    return uid;
};

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

try {
    // ── A. v1 con operazioni pendenti → v2 integro e leggibile ────────────────────────────
    const uidA = await createV1Queue('additive');
    const before = await inspectOfflineQueueSchema({uid: uidA});
    same([before.version, before.stores, before.rows.length], [1, ['encryptedOperations'], 2], 'A_BEFORE');
    same(await rejection(() => upgradeOfflineQueueSchema({uid: uidA, mode: 'abort'})), 'QUEUE_UPGRADE_ABORTED', 'A_ABORT_NOT_REPORTED');
    const afterAbort = await inspectOfflineQueueSchema({uid: uidA});
    same([afterAbort.version, afterAbort.stores, canonical(afterAbort.rows)], [1, ['encryptedOperations'], canonical(before.rows)], 'A_ABORT_CHANGED');
    sameOutcome(await upgradeOfflineQueueSchema({uid: uidA}), {version: 2, created: ['queueLeases']}, 'A_UPGRADE_OUTCOME');
    const after = await inspectOfflineQueueSchema({uid: uidA});
    same([after.version, after.stores], [2, ['encryptedOperations', 'queueLeases']], 'A_AFTER_SCHEMA');
    same(canonical(after.rows), canonical(before.rows), 'A_ROWS_CHANGED');
    const byId = rows => new Map(rows.map(row => [row.id, row]));
    const oldRows = byId(before.rows), newRows = byId(after.rows);
    assert([...oldRows.keys()].every(id => newRows.get(id)?.iv === oldRows.get(id).iv &&
        newRows.get(id)?.ciphertext === oldRows.get(id).ciphertext), 'A_CIPHERTEXT_CHANGED');
    const read = await readOfflineQueueContainers({uid: uidA});
    same([read.version, read.containers.map(row => row.operationId).sort()], [2, ['device:1', 'device:2']], 'A_READER');
    const operations = await decrypted(uidA, read.containers);
    same([operations.find(operation => operation.operationId === 'device:2')._queueState,
        operations.find(operation => operation.operationId === 'device:2')._reviewReason],
    ['reconciliation-required', 'LEGACY_MUTATION_RESULT_UNVERIFIED'], 'A_RECONCILIATION_LOST');
    same(await rejection(() => upgradeOfflineQueueSchema({uid: uidA})), 'QUEUE_UPGRADE_SCHEMA', 'A_SECOND_UPGRADE_ACCEPTED');
    passed.push('upgrade del runtime su coda v1 reale con due operazioni sigillate (una in riconciliazione): creato solo `queueLeases`, `encryptedOperations` identico byte per byte, riconciliazione conservata, lettura compatibile a v2; l’abort non cambia nulla e un secondo upgrade è rifiutato');

    // ── B. Il runtime **non** avvia l'upgrade se non è invocato ───────────────────────────
    const uidB = await createV1Queue('no-auto');
    const client = await createOfflineMutationClientCore({
        uid: uidB, vaultKeyMaterial: KEY, enabled: true,
        createQueue: createOfflineMutationQueue,
        createQueueReader: options => import('./queue.js').then(queue => queue.createOfflineQueueReader(options)),
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: (id, task) => import('./queue.js').then(queue => queue.withOfflineQueueLease(id, task)),
        createChannel: () => ({notify() {}, close() {}}),
        send: async () => ({status: 'conflict', currentRevision: 1}),
        isOnline: () => true
    });
    const duringClient = await inspectOfflineQueueSchema({uid: uidB});
    const flushB = await client.flush();
    assert(flushB?.value?.status === 'conflict', `B_FLUSH_NOT_CONFLICT:${JSON.stringify(flushB)}`);
    const afterClient = await inspectOfflineQueueSchema({uid: uidB});
    same([duringClient.version, duringClient.stores], [1, ['encryptedOperations']], 'B_CLIENT_UPGRADED');
    same([afterClient.version, afterClient.stores], [1, ['encryptedOperations']], 'B_FLUSH_UPGRADED');
    same(canonical(afterClient.rows), canonical(duringClient.rows), 'B_FLUSH_CHANGED_ROWS');
    client.close();
    passed.push('nessun avvio automatico: costruire il client reale (lettore compatibile + sincronizzatore) e sincronizzare su una coda v1 **non** esegue l’upgrade — versione, store e righe restano quelli di prima');

    // ── C. Blocco da vecchia connessione, errore tardivo e retry dopo il rilascio ────────
    const uidC = await createV1Queue('blocked');
    const beforeC = await inspectOfflineQueueSchema({uid: uidC});
    const holder = await requestValue(indexedDB.open(queueName(uidC)));
    same(holder.version, 1, 'C_HOLDER_VERSION');
    same(await rejection(() => upgradeOfflineQueueSchema({uid: uidC})), 'QUEUE_UPGRADE_BLOCKED', 'C_NOT_BLOCKED');
    // Finché la richiesta di cambio versione resta in sospeso, una lettura senza versione non
    // fallisce: **attende** (limite del lettore → `QUEUE_READER_TIMEOUT`). È il comportamento già
    // registrato in M6-A-4 e va dichiarato, non nascosto.
    same(await rejection(() => readOfflineQueueContainers({uid: uidC, timeoutMs: 1500})), 'QUEUE_READER_TIMEOUT', 'C_READER_WHILE_BLOCKED');
    passed.push('blocco **deliberato** da una connessione v1 trattenuta: l’upgrade è riportato come `QUEUE_UPGRADE_BLOCKED` e, finché la richiesta resta in sospeso, la coda non è leggibile dalla copia nuova (`QUEUE_READER_TIMEOUT`, limitato) — nessuna coda vuota e nessun dato perso');

    holder.close();
    // Dopo il rilascio la richiesta in sospeso viene annullata (guardia R1): la coda resta a v1.
    const afterLate = await inspectOfflineQueueSchema({uid: uidC});
    same([afterLate.version, afterLate.stores], [1, ['encryptedOperations']], 'C_LATE_UPGRADE_COMMITTED');
    same(canonical(afterLate.rows), canonical(beforeC.rows), 'C_LATE_ROWS_CHANGED');
    same(await containerIds(uidC), ['device:1', 'device:2'], 'C_BLOCKED_LOST_OR_DUPLICATED');
    sameOutcome(await upgradeOfflineQueueSchema({uid: uidC}), {version: 2, created: ['queueLeases']}, 'C_RETRY_FAILED');
    same(canonical((await inspectOfflineQueueSchema({uid: uidC})).rows), canonical(beforeC.rows), 'C_RETRY_ROWS_CHANGED');
    passed.push('errore tardivo e retry: dopo il rilascio della connessione vecchia la richiesta in sospeso viene annullata (la coda resta a versione 1 con le stesse righe, ancora leggibili) e un nuovo upgrade riesce con contenitori identici');

    // ── D. Schema v2 già presente e schema non supportato ───────────────────────────────
    same(await rejection(() => upgradeOfflineQueueSchema({uid: uidC})), 'QUEUE_UPGRADE_SCHEMA', 'D_V2_NOT_REFUSED');
    same([(await inspectOfflineQueueSchema({uid: uidC})).stores], [['encryptedOperations', 'queueLeases']], 'D_V2_CHANGED');
    const uidD = newUid('unsupported');
    const foreign = indexedDB.open(queueName(uidD), 3);
    const foreignDatabase = await new Promise((resolve, reject) => {
        foreign.onupgradeneeded = () => {
            foreign.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
            foreign.result.createObjectStore('futuri', {keyPath: 'id'});
            foreign.transaction.objectStore('encryptedOperations').put({id: `${uidD}:device:1`, uid: uidD, operationId: 'device:1',
                schemaVersion: 1, iv: 'SYNTHETIC-IV', ciphertext: 'SYNTHETIC-CIPHERTEXT', queuedAt: 1});
        };
        foreign.onsuccess = () => resolve(foreign.result);
        foreign.onerror = () => reject(foreign.error);
    });
    foreignDatabase.close();
    same(await rejection(() => upgradeOfflineQueueSchema({uid: uidD})), 'QUEUE_UPGRADE_SCHEMA', 'D_FOREIGN_ACCEPTED');
    const afterForeign = await inspectOfflineQueueSchema({uid: uidD});
    same([afterForeign.version, afterForeign.stores, afterForeign.rows.length], [3, ['encryptedOperations', 'futuri'], 1], 'D_FOREIGN_CHANGED');
    // Il lettore compatibile **rifiuta** anche lui lo schema ignoto: indisponibilità, non coda vuota.
    same(await rejection(() => readOfflineQueueContainers({uid: uidD})), 'QUEUE_READER_SCHEMA', 'D_FOREIGN_READER_ACCEPTED');
    same(await rejection(() => upgradeOfflineQueueSchema({uid: newUid('missing')})), 'QUEUE_UPGRADE_MISSING', 'D_MISSING_CREATED');
    passed.push('schema v2 già presente rifiutato (`QUEUE_UPGRADE_SCHEMA`, nessuno store ricreato) e schema non supportato (v3 con store estranei) rifiutato senza toccare il database; coda assente resta assente');

    // ── E. Nessuna connessione residua ──────────────────────────────────────────────────
    for (const [label, uid] of [['additive', uidA], ['no-auto', uidB], ['blocked', uidC]]) {
        const deletion = await deleteDatabaseChecked(queueName(uid));
        assert(!deletion.blocked && deletion.pending !== true, `E_LEAKED_CONNECTION_${label}`);
    }
    passed.push('nessuna connessione lasciata aperta dalle sequenze provate (la cancellazione dei database sintetici non resta bloccata)');

    // ── F. Percorso **del pilota** (export reale), coda assente — correzione R1 ───────────
    const missingUid = newUid('pilot-missing');
    const missingName = queueName(missingUid);
    same(await rejection(() => upgradePrivateAccountPilotQueue({uid: missingUid})), 'QUEUE_UPGRADE_MISSING', 'F_MISSING_NOT_REFUSED');
    same(await rejection(() => inspectPrivateAccountPilotQueue({uid: missingUid})), 'QUEUE_UPGRADE_MISSING', 'F_INSPECT_MISSING');
    const databases = await indexedDB.databases();
    assert(!databases.some(entry => entry.name === missingName), 'F_MISSING_DATABASE_CREATED');
    const missingProbe = indexedDB.open(missingName, 1);
    let missingUpgraded = false;
    missingProbe.onupgradeneeded = () => { missingUpgraded = true; };
    const missingDatabase = await requestValue(missingProbe);
    missingDatabase.close();
    assert(missingUpgraded, 'F_MISSING_DATABASE_EXISTS');
    await new Promise(resolve => { const request = indexedDB.deleteDatabase(missingName); request.onsuccess = request.onerror = request.onblocked = () => resolve(); });
    passed.push('percorso del **pilota** su coda assente: `upgradePrivateAccountPilotQueue` e la sua sonda falliscono con `QUEUE_UPGRADE_MISSING` e **nessun database viene creato** (verificato con `indexedDB.databases()` e con una sonda di apertura a versione 1)');

    // ── G. Percorso del pilota: blocco, scadenza e v1→v2 integro ─────────────────────────
    const uidG = await createV1Queue('pilot-blocked');
    const beforeG = await inspectOfflineQueueSchema({uid: uidG});
    const pilotHolder = await requestValue(indexedDB.open(queueName(uidG)));
    same(await rejection(() => upgradePrivateAccountPilotQueue({uid: uidG})), 'QUEUE_UPGRADE_BLOCKED', 'G_NOT_BLOCKED');
    // La sonda del pilota è limitata: non resta appesa dietro la richiesta in sospeso.
    same(await rejection(() => upgradePrivateAccountPilotQueue({uid: uidG, timeoutMs: 1500})), 'QUEUE_UPGRADE_TIMEOUT', 'G_NOT_BOUNDED');
    pilotHolder.close();
    const afterG = await inspectOfflineQueueSchema({uid: uidG});
    same([afterG.version, afterG.stores], [1, ['encryptedOperations']], 'G_LATE_UPGRADE_COMMITTED');
    same(canonical(afterG.rows), canonical(beforeG.rows), 'G_LATE_ROWS_CHANGED');
    sameOutcome(await upgradePrivateAccountPilotQueue({uid: uidG}), {version: 2, created: ['queueLeases'], previousVersion: 1}, 'G_PILOT_UPGRADE_FAILED');
    const afterG2 = await inspectOfflineQueueSchema({uid: uidG});
    same(canonical(afterG2.rows), canonical(beforeG.rows), 'G_PILOT_ROWS_CHANGED');
    const byId2 = rows => new Map(rows.map(row => [row.id, row]));
    const oldG = byId2(beforeG.rows), newG = byId2(afterG2.rows);
    assert([...oldG.keys()].every(id => newG.get(id)?.iv === oldG.get(id).iv && newG.get(id)?.ciphertext === oldG.get(id).ciphertext), 'G_PILOT_BYTES_CHANGED');
    same(await containerIds(uidG), ['device:1', 'device:2'], 'G_PILOT_CONTAINERS_CHANGED');
    passed.push('percorso del **pilota** con coda v1 reale: blocco deliberato → `QUEUE_UPGRADE_BLOCKED`, sonda **limitata** → `QUEUE_UPGRADE_TIMEOUT` (nessuna attesa indefinita), poi upgrade riuscito con contenitori sigillati identici byte per byte e `previousVersion: 1`');

    // ── H. Percorso del pilota: nessun avvio automatico ──────────────────────────────────
    const uidH = await createV1Queue('pilot-no-auto');
    const beforeH = await inspectOfflineQueueSchema({uid: uidH});
    const pilotStates = [];
    const pilotClient = await createOfflineMutationClientCore({
        uid: uidH, vaultKeyMaterial: KEY, enabled: true,
        createQueue: createOfflineMutationQueue,
        createQueueReader: options => import('./queue.js').then(queue => queue.createOfflineQueueReader(options)),
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: (id, task) => import('./queue.js').then(queue => queue.withOfflineQueueLease(id, task)),
        createChannel: () => ({notify() {}, close() {}}),
        send: async () => ({status: 'conflict', currentRevision: 1}),
        isOnline: () => true,
        onState: state => pilotStates.push(state)
    });
    await pilotClient.flush();
    pilotClient.close();
    const afterH = await inspectOfflineQueueSchema({uid: uidH});
    same([afterH.version, afterH.stores], [1, ['encryptedOperations']], 'H_AUTOMATIC_UPGRADE');
    same(canonical(afterH.rows), canonical(beforeH.rows), 'H_ROWS_CHANGED');
    passed.push('percorso del pilota: costruire il client e sincronizzare su una coda v1 **non** avvia l’upgrade (versione, store e righe invariati); l’upgrade resta solo su invocazione esplicita');

    await report({ok: true, passed, browser: navigator.userAgent});
} catch (error) {
    await report({ok: false, passed, code: error?.code || error?.message});
}
