import {createOfflineMutationQueue, deriveOfflineQueueKey, sealOfflineOperation} from './queue.js';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';
import {createOfflineMutationLeaseCoordinator} from './offline-mutation-lease.mjs';

// [M6-A-8b] Banco browser (IndexedDB **reale**, dati sintetici, profilo usa e getta) del
// coordinatore lease isolato su **layout v2 reale**: una coda dell'app con operazioni sigillate
// aggiornata a v2 con `queueLeases` nello **stesso** database. Verifica apertura e percorso
// protetto, rifiuti dichiarati (v1, coda assente, schema malformato), contesa fra due contesti,
// rilascio dopo errore, timeout di acquisizione coerente, token anti-ABA e fencing con zero
// scritture su `encryptedOperations`. Nessun file di `Frontend/public/**` è collegato a questo
// modulo e nessun fallback è abilitato dal banco.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected),
    `${code}:${JSON.stringify(value)}`);
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };
const codeOf = error => error?.code || error?.name || error?.message;
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('IDB_REQUEST'));
});
const waitFor = async (predicate, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('LEASE_BENCH_WAIT');
};
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const nameOf = uid => `codex-offline-queue-${uid}`;
const guardedWrite = (coordinator, context, mutate = () => {}) => new Promise(resolve => {
    const tx = coordinator.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
    let reason = null;
    tx.oncomplete = () => resolve({reason, committed: true});
    tx.onabort = () => resolve({reason, committed: false});
    tx.onerror = () => resolve({reason, committed: false});
    context.guardTransaction(tx, () => mutate(tx.objectStore('encryptedOperations')), error => { reason = error.code; });
});
const withDatabase = async (uid, task) => {
    const database = await requestValue(indexedDB.open(nameOf(uid)));
    try { return await task(database); } finally { database.close(); }
};
const readLease = uid => withDatabase(uid, async database => (database.objectStoreNames.contains('queueLeases')
    ? (await requestValue(database.transaction('queueLeases', 'readonly').objectStore('queueLeases').get(uid)) ?? null)
    : null));
const writeLease = (uid, record) => withDatabase(uid, async database => {
    const transaction = database.transaction('queueLeases', 'readwrite');
    transaction.objectStore('queueLeases').put(record);
    await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('LEASE_BENCH_WRITE'));
    });
});
const rowsOf = uid => inspectQueueSchema({uid}).then(state => canonical(state.rows));
const deleteDatabase = name => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onblocked = () => reject(new Error('LEASE_BENCH_CONNECTION_LEAK'));
    request.onerror = () => reject(request.error || new Error('LEASE_BENCH_DELETE'));
});

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

try {
    const uid = `mutation-lease-${crypto.randomUUID()}`;
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    await queue.enqueue({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'});
    queue.close();
    same((await upgradeQueueSchemaToV2({uid})).version, 2, 'LEASE_BENCH_UPGRADE');
    const layout = await inspectQueueSchema({uid});
    same([layout.version, layout.stores, layout.rows.length], [2, ['encryptedOperations', 'queueLeases'], 2], 'LEASE_BENCH_LAYOUT');

    // ── 1. Apertura sul layout v2 reale e percorso protetto con scrittura fenced ──────────
    const coordinator = createOfflineMutationLeaseCoordinator({uid, holderId: 'page-a'});
    same(await coordinator.open(), {version: 2}, 'LEASE_BENCH_OPEN');
    const key = await deriveOfflineQueueKey(KEY, uid);
    const sealed = await sealOfflineOperation({uid, operationId: 'device:3', recordId: 'record-3', value: 'fixture-3'}, key);
    const protectedRun = await coordinator.run(async context => {
        const guarded = await guardedWrite(coordinator, context, store => store.put(sealed));
        same(guarded, {reason: null, committed: true}, 'LEASE_BENCH_GUARDED_WRITE');
        return context.token;
    });
    same(protectedRun.acquired, true, 'LEASE_BENCH_RUN');
    assert(Number.isSafeInteger(protectedRun.value) && protectedRun.value >= 1, 'LEASE_BENCH_RUN_TOKEN');
    const afterLease = await readLease(uid);
    same([afterLease.holderId, afterLease.expiresAt, afterLease.token], [null, 0, protectedRun.value], 'LEASE_BENCH_RELEASE');
    const rows = await inspectQueueSchema({uid});
    same([rows.version, rows.rows.length], [2, 3], 'LEASE_BENCH_ROWS');
    assert(layout.rows.every(row => rows.rows.some(next => next.id === row.id && next.iv === row.iv && next.ciphertext === row.ciphertext)),
        'LEASE_BENCH_ROWS_CHANGED');
    passed.push('layout v2 **reale** (coda dell’app aggiornata a v2, `queueLeases` nello stesso database): il coordinatore isolato apre e accetta lo schema senza migrare, esegue una scrittura protetta sulla coda vera e rilascia il lease (record a `holderId:null`, token conservato)');

    // ── 2. Rifiuti dichiarati su coda v1 reale, coda assente e schema malformato ──────────
    const v1Uid = `mutation-lease-v1-${crypto.randomUUID()}`;
    const v1Queue = await createOfflineMutationQueue({uid: v1Uid, vaultKeyMaterial: KEY});
    await v1Queue.enqueue({uid: v1Uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture'});
    v1Queue.close();
    const v1Before = await inspectQueueSchema({uid: v1Uid});
    same(await rejection(() => createOfflineMutationLeaseCoordinator({uid: v1Uid, holderId: 'page-a'}).open()),
        'LEASE_SCHEMA_V1', 'LEASE_BENCH_V1');
    const v1After = await inspectQueueSchema({uid: v1Uid});
    same([v1After.version, canonical(v1After.rows)], [1, canonical(v1Before.rows)], 'LEASE_BENCH_V1_CHANGED');
    assert(!v1After.stores.includes('queueLeases'), 'LEASE_BENCH_V1_UPGRADED');

    const absentUid = `mutation-lease-absent-${crypto.randomUUID()}`;
    same(await rejection(() => createOfflineMutationLeaseCoordinator({uid: absentUid, holderId: 'page-a'}).open()),
        'LEASE_DATABASE_MISSING', 'LEASE_BENCH_ABSENT');
    assert(!(await indexedDB.databases()).map(entry => entry.name).includes(nameOf(absentUid)), 'LEASE_BENCH_ABSENT_CREATED');

    const malformedUid = `mutation-lease-malformed-${crypto.randomUUID()}`;
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(nameOf(malformedUid), 2);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('encryptedOperations', {keyPath: 'id'});
            request.result.createObjectStore('queueLeases', {keyPath: 'chiave'});
        };
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error || new Error('LEASE_BENCH_MALFORMED_CREATE'));
    });
    same(await rejection(() => createOfflineMutationLeaseCoordinator({uid: malformedUid, holderId: 'page-a'}).open()),
        'LEASE_SCHEMA_MALFORMED', 'LEASE_BENCH_MALFORMED');
    const malformedState = await inspectQueueSchema({uid: malformedUid});
    same([malformedState.version, malformedState.stores], [2, ['encryptedOperations', 'queueLeases']], 'LEASE_BENCH_MALFORMED_CHANGED');
    passed.push('rifiuti dichiarati su IndexedDB reale: coda v1 → `LEASE_SCHEMA_V1` (resta v1, senza store del lease, righe identiche), coda assente → `LEASE_DATABASE_MISSING` (nessun database creato, verificato con `indexedDB.databases()`), v2 con struttura errata → `LEASE_SCHEMA_MALFORMED` (nessuna riparazione)');

    // ── 3. Contesa fra due contesti nella stessa pagina ───────────────────────────────────
    const other = createOfflineMutationLeaseCoordinator({uid, holderId: 'page-b'});
    let releaseGate, entered = false, otherRan = false;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    const rowsBefore = await rowsOf(uid);
    const holderRun = coordinator.run(async () => { entered = true; await gate; return 'holder'; });
    await waitFor(() => entered);
    const heldLease = await readLease(uid);
    same(heldLease.holderId, 'page-a', 'LEASE_BENCH_HOLDER');
    same(await other.run(async () => { otherRan = true; }), {acquired: false, reason: 'LEASE_BUSY'}, 'LEASE_BENCH_BUSY');
    assert(!otherRan, 'LEASE_BENCH_BUSY_RAN');
    same(await rowsOf(uid), rowsBefore, 'LEASE_BENCH_BUSY_WROTE');
    // La diagnosi precedente si bloccava qui: il gate va rilasciato **prima** di attendere il titolare.
    releaseGate();
    same(await holderRun, {acquired: true, value: 'holder'}, 'LEASE_BENCH_HOLDER_RUN');
    const acquiredByOther = await other.run(async () => 'second');
    same(acquiredByOther, {acquired: true, value: 'second'}, 'LEASE_BENCH_AFTER');
    const afterContention = await readLease(uid);
    assert(afterContention.token > protectedRun.value, 'LEASE_BENCH_TOKEN_ABA');
    same(await rowsOf(uid), rowsBefore, 'LEASE_BENCH_CONTENTION_WROTE');
    passed.push('contesa fra due contesti reali: mentre il titolare tiene il lease il secondo rifiuta `LEASE_BUSY` senza eseguire né scrivere; dopo il rilascio (fatto **prima** di attendere il titolare, come chiesto) il secondo acquisisce e il token avanza — nessuna scrittura su `encryptedOperations` in tutta la contesa');

    // ── 4. Rilascio dopo errore ───────────────────────────────────────────────────────────
    const failureCode = await rejection(() => coordinator.run(async () => {
        throw Object.assign(new Error('SYNTHETIC_TASK_FAILURE'), {code: 'SYNTHETIC_TASK_FAILURE'});
    }));
    same(failureCode, 'SYNTHETIC_TASK_FAILURE', 'LEASE_BENCH_TASK_ERROR');
    const releasedLease = await readLease(uid);
    same([releasedLease.holderId, releasedLease.expiresAt], [null, 0], 'LEASE_BENCH_ERROR_RELEASE');
    same(await rowsOf(uid), rowsBefore, 'LEASE_BENCH_ERROR_WROTE');
    const afterError = await other.run(async () => 'after-error');
    same(afterError, {acquired: true, value: 'after-error'}, 'LEASE_BENCH_AFTER_ERROR');
    passed.push('rilascio dopo errore: l’errore del task attraversa il coordinatore, il lease viene rilasciato (`holderId:null`, `expiresAt:0`) e l’ingresso successivo riesce; nessuna scrittura su `encryptedOperations`');

    // ── 5. Fencing: takeover del record prima di `guardTransaction` ───────────────────────
    const handle = await coordinator.acquire();
    assert(!!handle, 'LEASE_BENCH_ACQUIRE');
    await writeLease(uid, {id: uid, version: 1, holderId: 'page-z', token: handle.token + 1,
        updatedAt: Date.now(), expiresAt: Date.now() + 30000});
    const fencedRows = await rowsOf(uid);
    const fenced = await guardedWrite(coordinator, handle, store => store.put(sealed));
    same(fenced, {reason: 'LEASE_LOST', committed: false}, 'LEASE_BENCH_FENCING');
    same(await rowsOf(uid), fencedRows, 'LEASE_BENCH_FENCING_WROTE');
    same((await readLease(uid)).holderId, 'page-z', 'LEASE_BENCH_FENCING_RECORD');
    same(await handle.release(), false, 'LEASE_BENCH_FENCING_RELEASE');
    await writeLease(uid, {id: uid, version: 1, holderId: null, token: handle.token + 2, updatedAt: Date.now(), expiresAt: 0});
    passed.push('fencing sul layout reale: con il record del lease sostituito da un **altro titolare** prima di `guardTransaction`, la transazione viene annullata con `LEASE_LOST` e `encryptedOperations` resta identico byte per byte; il titolare decaduto non può rilasciare il lease altrui');

    // ── 6. Token anti-ABA e timeout di acquisizione coerente ──────────────────────────────
    const beforeToken = (await readLease(uid)).token;
    const nextHandle = await coordinator.acquire();
    assert(!!nextHandle && nextHandle.token > beforeToken, 'LEASE_BENCH_ABA');
    same(await nextHandle.release(), true, 'LEASE_BENCH_ABA_RELEASE');
    // Blocco **deliberato**: una transazione readwrite trattenuta sullo store del lease tiene in
    // coda l'acquisizione del coordinatore, quindi la scadenza copre davvero l'attesa.
    const blocker = withDatabase(uid, database => {
        const transaction = database.transaction('queueLeases', 'readwrite');
        const store = transaction.objectStore('queueLeases');
        const until = Date.now() + 400;
        const pump = () => { const request = store.get(uid); request.onsuccess = () => { if (Date.now() < until) pump(); }; };
        pump();
        return new Promise(resolve => { transaction.oncomplete = () => resolve(); transaction.onabort = () => resolve(); });
    });
    const blocked = createOfflineMutationLeaseCoordinator({uid, holderId: 'page-timeout', acquireTimeoutMs: 60});
    await blocked.open(); // l'apertura è già avvenuta: la scadenza copre la sola acquisizione
    let timeoutRan = false;
    const started = Date.now();
    same(await rejection(() => blocked.run(async () => { timeoutRan = true; })), 'LEASE_ACQUIRE_TIMEOUT', 'LEASE_BENCH_TIMEOUT');
    assert(Date.now() - started < 400, 'LEASE_BENCH_TIMEOUT_LATE');
    assert(!timeoutRan, 'LEASE_BENCH_TIMEOUT_TASK_RAN');
    await blocker; // il blocco deliberato finisce e l'acquisizione tardiva arriva **dopo** la scadenza
    // Finestra di assestamento: un'acquisizione tardiva deve essere rilasciata, mai trattenuta.
    await new Promise(resolve => setTimeout(resolve, 250));
    await waitFor(async () => { const lease = await readLease(uid); return !lease || lease.holderId !== 'page-timeout'; });
    blocked.close();
    const finalState = await inspectQueueSchema({uid});
    same([finalState.version, canonical(finalState.rows)], [2, canonical(rows.rows)], 'LEASE_BENCH_FINAL');
    passed.push(`token anti-ABA: il rilascio conserva il contatore e l’acquisizione successiva avanza (${beforeToken} → ${nextHandle.token}); con una transazione readwrite **trattenuta** sullo store del lease e un budget di acquisizione di 60 ms il coordinatore riporta \`LEASE_ACQUIRE_TIMEOUT\` senza eseguire il task, e il lease tardivo arrivato dopo il rilascio del blocco viene rilasciato — in nessun caso resta in mano al titolare`);

    // ── 7. Nessuna connessione lasciata aperta ────────────────────────────────────────────
    coordinator.close();
    other.close();
    await deleteDatabase(nameOf(uid));
    same(await rejection(() => createOfflineMutationLeaseCoordinator({uid, holderId: 'page-a'}).open()),
        'LEASE_DATABASE_MISSING', 'LEASE_BENCH_DELETE_LEAK');
    passed.push('chiusura: le connessioni del coordinatore non bloccano la cancellazione dei database sintetici (dopo la cancellazione il coordinatore rifiuta con `LEASE_DATABASE_MISSING`)');

    await report({ok: true, passed, browser: navigator.userAgent});
} catch (error) {
    await report({ok: false, passed, code: codeOf(error)});
}
