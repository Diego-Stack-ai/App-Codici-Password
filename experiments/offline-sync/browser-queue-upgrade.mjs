import {createOfflineMutationQueue, deriveOfflineQueueKey, openOfflineOperation, readOfflineQueueContainers} from './queue.js';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';

// M6-A-2 — laboratorio: upgrade **additivo** della coda da schema 1 a schema 2 su IndexedDB reale.
//
// Non attiva nulla nel runtime: `Frontend/public/**`, Functions e Rules restano invariati e
// l'upgrade vive solo in `queue-upgrade-v2.mjs`. Il banco parte da code v1 reali create dal
// runtime (una con un'operazione in stato di riconciliazione), esegue l'upgrade e confronta
// store e contenitori prima/dopo byte per byte; prova anche abort e schema inatteso.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected), code);
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const rejection = async task => { try { await task(); return null; } catch (error) { return error.code || error.message; } };
const schemaOnly = async name => {
    const database = await requestValue(indexedDB.open(name));
    try { return {version: database.version, stores: [...database.objectStoreNames].sort()}; } finally { database.close(); }
};
const createDatabase = (name, version, stores, seed) => {
    const request = indexedDB.open(name, version);
    return new Promise((resolve, reject) => {
        request.onupgradeneeded = () => {
            for (const store of stores) request.result.createObjectStore(store, {keyPath: 'id'});
            seed?.(request.transaction);
        };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
};

// Cancellazione con esito osservabile: se una connessione resta aperta, la richiesta viene
// bloccata e non si conclude — è la sonda per le connessioni lasciate in giro.
const deleteDatabaseChecked = (name, waitMs = 500) => new Promise(resolve => {
    const request = indexedDB.deleteDatabase(name);
    let blocked = false;
    const timer = setTimeout(() => resolve({blocked, pending: true}), waitMs);
    request.onblocked = () => { blocked = true; };
    request.onsuccess = () => { clearTimeout(timer); resolve({blocked}); };
    request.onerror = () => { clearTimeout(timer); resolve({blocked, error: request.error?.name}); };
});

// Coda v1 reale con due operazioni sigillate pendenti, di cui una in riconciliazione.
async function createV1QueueWithPendingOperations(label) {
    const uid = `queue-upgrade-${label}-${crypto.randomUUID()}`;
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    const first = {uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'};
    const second = {uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'};
    await queue.enqueue(first);
    await queue.enqueue(second);
    const marked = await queue.markForReview(second, {reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
    queue.close();
    return {uid, first, marked};
}

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
// Sorveglianza: se una sequenza non si conclude, il banco riporta comunque i verdetti già
// raggiunti invece di farsi uccidere dal timeout del runner senza informazioni.
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

try {
    // ── A. Upgrade additivo: contenitori identici byte per byte, lettura compatibile ──────
    const {uid, first, marked} = await createV1QueueWithPendingOperations('create');
    const before = await inspectQueueSchema({uid});
    same(before.version, 1, 'BEFORE_VERSION');
    same(before.stores, ['encryptedOperations'], 'BEFORE_STORES');
    same(before.rows.length, 2, 'BEFORE_ROW_COUNT');
    assert(new Set(before.rows.map(row => row.id)).size === 2, 'BEFORE_DUPLICATE_IDS');
    const beforeRead = await readOfflineQueueContainers({uid});
    same(beforeRead.version, 1, 'BEFORE_READER_VERSION');
    same(beforeRead.containers.map(row => row.operationId).sort(), ['device:1', 'device:2'], 'BEFORE_READER_IDS');

    const upgrade = await upgradeQueueSchemaToV2({uid});
    same(upgrade, {version: 2, created: ['queueLeases']}, 'UPGRADE_OUTCOME');

    const after = await inspectQueueSchema({uid});
    same(after.version, 2, 'AFTER_VERSION');
    same(after.stores, ['encryptedOperations', 'queueLeases'], 'AFTER_STORES');
    same(after.rows.length, 2, 'AFTER_ROW_COUNT');
    assert(new Set(after.rows.map(row => row.id)).size === 2, 'AFTER_DUPLICATE_IDS');
    same(canonical(after.rows), canonical(before.rows), 'AFTER_ROWS_CHANGED');
    const byId = rows => new Map(rows.map(row => [row.id, row]));
    const oldRows = byId(before.rows), newRows = byId(after.rows);
    assert([...oldRows.keys()].every(id => newRows.get(id)?.iv === oldRows.get(id).iv &&
        newRows.get(id)?.ciphertext === oldRows.get(id).ciphertext), 'AFTER_CIPHERTEXT_CHANGED');
    assert(!JSON.stringify(after.rows).includes('fixture-'), 'AFTER_CLEARTEXT_LEAK');
    passed.push('upgrade additivo v1 → v2 su IndexedDB reale: `queueLeases` creato nella transazione di cambio versione, due righe di `encryptedOperations` identiche byte per byte (stesso `iv`, stesso `ciphertext`), nessuna duplicazione e nessuna cancellazione');

    const afterRead = await readOfflineQueueContainers({uid});
    same(afterRead.version, 2, 'AFTER_READER_VERSION');
    same(canonical(afterRead.containers), canonical(beforeRead.containers), 'AFTER_READER_CONTENT_CHANGED');
    const key = await deriveOfflineQueueKey(KEY, uid);
    const operations = [];
    for (const container of afterRead.containers) operations.push(await openOfflineOperation(container, key, uid));
    assert(canonical(operations.find(operation => operation.operationId === 'device:1')) === canonical(first), 'AFTER_FIRST_OPERATION_CHANGED');
    const reviewed = operations.find(operation => operation.operationId === 'device:2');
    assert(canonical(reviewed) === canonical(marked), 'AFTER_REVIEWED_OPERATION_CHANGED');
    same(reviewed._queueState, 'reconciliation-required', 'AFTER_REVIEW_STATE_LOST');
    same(reviewed._reviewReason, 'LEGACY_MUTATION_RESULT_UNVERIFIED', 'AFTER_REVIEW_REASON_LOST');
    passed.push('il lettore M6-A-1 legge lo schema 2 dopo l’upgrade e i contenuti decifrati sono identici, compreso lo stato di riconciliazione (`_queueState` e `_reviewReason`)');

    const secondUpgrade = await rejection(() => upgradeQueueSchemaToV2({uid}));
    same(secondUpgrade, 'QUEUE_UPGRADE_SCHEMA', 'REPEATED_UPGRADE_NOT_REFUSED');
    const afterSecond = await inspectQueueSchema({uid});
    same(afterSecond.version, 2, 'REPEATED_UPGRADE_VERSION');
    same(canonical(afterSecond.rows), canonical(before.rows), 'REPEATED_UPGRADE_CHANGED_ROWS');
    let writerName = null;
    try { await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY}); } catch (error) { writerName = error.name; }
    same(writerName, 'VersionError', 'OLD_WRITER_ACCEPTED_SCHEMA_2');
    const afterWriter = await inspectQueueSchema({uid});
    same(canonical(afterWriter.rows), canonical(before.rows), 'OLD_WRITER_CHANGED_ROWS');
    passed.push('upgrade ripetuto e scrittore v1 esistente: il secondo upgrade è rifiutato con `QUEUE_UPGRADE_SCHEMA` e lo scrittore v1 fallisce con `VersionError`, senza modificare né cancellare le righe');

    // ── B. Abort dell’upgrade: nessuna versione nuova, coda intatta e ancora usabile ──────
    const aborted = await createV1QueueWithPendingOperations('abort');
    const beforeAbort = await inspectQueueSchema({uid: aborted.uid});
    same(await rejection(() => upgradeQueueSchemaToV2({uid: aborted.uid, mode: 'abort'})), 'QUEUE_UPGRADE_ABORTED', 'ABORT_NOT_REPORTED');
    const afterAbort = await inspectQueueSchema({uid: aborted.uid});
    same(afterAbort.version, 1, 'ABORT_VERSION_CHANGED');
    same(afterAbort.stores, ['encryptedOperations'], 'ABORT_LEASE_STORE_SURVIVED');
    same(canonical(afterAbort.rows), canonical(beforeAbort.rows), 'ABORT_ROWS_CHANGED');
    const abortRead = await readOfflineQueueContainers({uid: aborted.uid});
    same(abortRead.version, 1, 'ABORT_READER_VERSION');
    same(abortRead.containers.map(row => row.operationId).sort(), ['device:1', 'device:2'], 'ABORT_READER_IDS');
    const reopened = await createOfflineMutationQueue({uid: aborted.uid, vaultKeyMaterial: KEY});
    same((await reopened.list()).map(operation => operation.operationId).sort(), ['device:1', 'device:2'], 'ABORT_QUEUE_UNUSABLE');
    reopened.close();
    passed.push('abort dell’upgrade nella transazione di cambio versione: la versione resta 1, `queueLeases` non sopravvive al rollback, le due righe restano identiche e la coda è ancora leggibile e usabile dal runtime v1');

    same(await rejection(() => upgradeQueueSchemaToV2({})), 'QUEUE_UPGRADE_CONFIG', 'CONFIG_NOT_ENFORCED');
    const retried = await upgradeQueueSchemaToV2({uid: aborted.uid});
    same(retried.version, 2, 'RETRY_VERSION');
    const afterRetry = await inspectQueueSchema({uid: aborted.uid});
    same(afterRetry.stores, ['encryptedOperations', 'queueLeases'], 'RETRY_STORES');
    same(canonical(afterRetry.rows), canonical(beforeAbort.rows), 'RETRY_ROWS_CHANGED');
    passed.push('dopo l’abort un nuovo tentativo riesce sulla stessa coda e le righe restano identiche: il fallimento dell’upgrade non richiede riparazioni');

    // ── C. Schema inatteso e coda assente: nessun cambio di versione, fail-closed ─────────
    const foreignUid = `queue-upgrade-foreign-${crypto.randomUUID()}`;
    const foreignName = `codex-offline-queue-${foreignUid}`;
    const foreign = await createDatabase(foreignName, 3, ['encryptedOperations', 'futuri'], transaction => {
        transaction.objectStore('encryptedOperations').put({id: `${foreignUid}:device:1`, uid: foreignUid, operationId: 'device:1',
            schemaVersion: 1, iv: 'SYNTHETIC-IV', ciphertext: 'SYNTHETIC-CIPHERTEXT', queuedAt: 1});
    });
    foreign.close();
    same(await rejection(() => upgradeQueueSchemaToV2({uid: foreignUid})), 'QUEUE_UPGRADE_SCHEMA', 'FOREIGN_SCHEMA_ACCEPTED');
    const foreignAfter = await inspectQueueSchema({uid: foreignUid});
    same(foreignAfter.version, 3, 'FOREIGN_VERSION_CHANGED');
    same(foreignAfter.stores, ['encryptedOperations', 'futuri'], 'FOREIGN_STORES_CHANGED');
    same(canonical(foreignAfter.rows), canonical([{id: `${foreignUid}:device:1`, uid: foreignUid, operationId: 'device:1',
        schemaVersion: 1, iv: 'SYNTHETIC-IV', ciphertext: 'SYNTHETIC-CIPHERTEXT', queuedAt: 1}]), 'FOREIGN_ROWS_CHANGED');
    same(await rejection(() => readOfflineQueueContainers({uid: foreignUid})), 'QUEUE_READER_SCHEMA', 'FOREIGN_READER_ACCEPTED');
    passed.push('schema v3 con store estranei: l’upgrade rifiuta con `QUEUE_UPGRADE_SCHEMA` prima di ogni cambio di versione, la coda resta a v3 con le sue righe e anche il lettore M6-A-1 la rifiuta');

    const brokenUid = `queue-upgrade-broken-${crypto.randomUUID()}`;
    const brokenName = `codex-offline-queue-${brokenUid}`;
    const broken = await createDatabase(brokenName, 1, ['sentinel']);
    broken.close();
    same(await rejection(() => upgradeQueueSchemaToV2({uid: brokenUid})), 'QUEUE_UPGRADE_SCHEMA', 'BROKEN_SCHEMA_ACCEPTED');
    same(await schemaOnly(brokenName), {version: 1, stores: ['sentinel']}, 'BROKEN_SCHEMA_CHANGED');

    const missingUid = `queue-upgrade-missing-${crypto.randomUUID()}`;
    const missingName = `codex-offline-queue-${missingUid}`;
    same(await rejection(() => upgradeQueueSchemaToV2({uid: missingUid})), 'QUEUE_UPGRADE_MISSING', 'MISSING_NOT_REFUSED');
    const missingProbe = indexedDB.open(missingName, 1);
    let missingUpgraded = false;
    missingProbe.onupgradeneeded = () => { missingUpgraded = true; };
    const missingDatabase = await requestValue(missingProbe);
    missingDatabase.close();
    assert(missingUpgraded && (await schemaOnly(missingName)).stores.length === 0, 'MISSING_CREATED_DATABASE');
    await new Promise(resolve => { const request = indexedDB.deleteDatabase(missingName); request.onsuccess = request.onerror = request.onblocked = () => resolve(); });
    passed.push('coda v1 senza lo store atteso e coda assente: nessun cambio di versione, nessuno store creato, fail-closed in entrambi i casi');

    // ── D. Blocco reale: segnale al chiamante, rilascio tardivo, coda intatta e nessuna
    //      connessione lasciata aperta (correzione M6-A-2 R1) ────────────────────────────────
    for (const {label, timeoutMs, expected} of [
        {label: 'blocked', timeoutMs: 2000, expected: ['QUEUE_UPGRADE_BLOCKED']},
        {label: 'timeout', timeoutMs: 1, expected: ['QUEUE_UPGRADE_TIMEOUT', 'QUEUE_UPGRADE_BLOCKED']}
    ]) {
        const held = await createV1QueueWithPendingOperations(label);
        const heldName = `codex-offline-queue-${held.uid}`;
        const heldBefore = await inspectQueueSchema({uid: held.uid});
        // Connessione v1 tenuta aperta **senza** chiusura su `versionchange`: l'upgrade va in blocco.
        const holder = await requestValue(indexedDB.open(heldName));
        same(holder.version, 1, `HELD_${label}_HOLDER_VERSION`);
        const code = await rejection(() => upgradeQueueSchemaToV2({uid: held.uid, timeoutMs}));
        assert(expected.includes(code), `HELD_${label}_UNEXPECTED_${code}`);
        holder.close();
        // Barriera deterministica: un'apertura senza versione si accoda **dopo** il cambio di
        // versione rimasto in sospeso, quindi quando risponde la sequenza è conclusa.
        const heldAfter = await inspectQueueSchema({uid: held.uid});
        same(heldAfter.version, 1, `HELD_${label}_LATE_VERSION_CHANGED`);
        same(heldAfter.stores, ['encryptedOperations'], `HELD_${label}_LATE_LEASE_STORE`);
        same(canonical(heldAfter.rows), canonical(heldBefore.rows), `HELD_${label}_LATE_ROWS_CHANGED`);
        const heldRead = await readOfflineQueueContainers({uid: held.uid});
        same(heldRead.version, 1, `HELD_${label}_READER_VERSION`);
        same(heldRead.containers.map(row => row.operationId).sort(), ['device:1', 'device:2'], `HELD_${label}_READER_IDS`);
        const heldWriter = await createOfflineMutationQueue({uid: held.uid, vaultKeyMaterial: KEY});
        same((await heldWriter.list()).map(operation => operation.operationId).sort(), ['device:1', 'device:2'], `HELD_${label}_QUEUE_UNUSABLE`);
        heldWriter.close();
        const heldDeletion = await deleteDatabaseChecked(heldName);
        assert(!heldDeletion.blocked && heldDeletion.pending !== true, `HELD_${label}_LEAKED_CONNECTION`);
        passed.push(`blocco reale (${label}): con una connessione v1 tenuta aperta il chiamante riceve ${code}; dopo il rilascio tardivo il database resta a versione 1 senza store del lease, con le righe identiche, ancora leggibile dal lettore M6-A-1 e usabile dallo scrittore v1, e la cancellazione non resta bloccata — nessuna connessione lasciata aperta`);
    }

    // Scadenza e avvio dell'upgrade: il chiamante non può ricevere un errore mentre lo schema
    // cambia, e un errore ricevuto non può convivere con un database portato a v2.
    const raced = await createV1QueueWithPendingOperations('raced');
    const racedBefore = await inspectQueueSchema({uid: raced.uid});
    let racedCode = null, racedVersion = null;
    try { racedVersion = (await upgradeQueueSchemaToV2({uid: raced.uid, timeoutMs: 1})).version; }
    catch (error) { racedCode = error.code || error.message; }
    const racedAfter = await inspectQueueSchema({uid: raced.uid});
    same(canonical(racedAfter.rows), canonical(racedBefore.rows), 'SHORT_BUDGET_ROWS_CHANGED');
    if (racedCode === null) {
        same([racedVersion, racedAfter.version], [2, 2], 'SHORT_BUDGET_SUCCESS_WITHOUT_UPGRADE');
        same(racedAfter.stores, ['encryptedOperations', 'queueLeases'], 'SHORT_BUDGET_STORES');
    } else {
        same(racedCode, 'QUEUE_UPGRADE_TIMEOUT', 'SHORT_BUDGET_UNEXPECTED_CODE');
        same([racedAfter.version, racedAfter.stores], [1, ['encryptedOperations']], 'SHORT_BUDGET_FAILED_BUT_UPGRADED');
    }
    passed.push(`budget di scadenza di 1 ms su una coda avviabile: esito coerente — ${racedCode === null ? 'upgrade portato a termine e riportato come riuscito (versione 2)' : 'scadenza riportata al chiamante con database rimasto a versione 1'}; in nessun caso il chiamante riceve un errore mentre lo schema cambia`);

    // ── E. Richiesta di cambio versione **esterna** in sospeso: la sonda del candidato resta
    //      accodata, quindi deve scadere invece di restare appesa (difetto trovato dal banco in
    //      M6-A-2 R1); quando la richiesta esterna porta il database a v2, il successo tardivo
    //      della sonda deve chiudere la connessione.
    const externalBlocked = await createV1QueueWithPendingOperations('external');
    const externalName = `codex-offline-queue-${externalBlocked.uid}`;
    const externalBefore = await inspectQueueSchema({uid: externalBlocked.uid});
    const blockHolder = await requestValue(indexedDB.open(externalName));
    const externalRequest = indexedDB.open(externalName, 2);
    let externalCreated = false;
    externalRequest.onupgradeneeded = () => { externalCreated = true; externalRequest.result.createObjectStore('queueLeases', {keyPath: 'id'}); };
    same(await rejection(() => upgradeQueueSchemaToV2({uid: externalBlocked.uid, timeoutMs: 150})), 'QUEUE_UPGRADE_TIMEOUT', 'EXTERNAL_NOT_BOUNDED');
    blockHolder.close();
    const external = await requestValue(externalRequest);
    assert(externalCreated, 'EXTERNAL_DID_NOT_UPGRADE');
    same([external.version, [...external.objectStoreNames].sort()], [2, ['encryptedOperations', 'queueLeases']], 'EXTERNAL_SCHEMA');
    external.close();
    const externalAfter = await inspectQueueSchema({uid: externalBlocked.uid});
    same(canonical(externalAfter.rows), canonical(externalBefore.rows), 'EXTERNAL_ROWS_CHANGED');
    const externalDeletion = await deleteDatabaseChecked(externalName);
    assert(!externalDeletion.blocked && externalDeletion.pending !== true, 'EXTERNAL_LEAKED_CONNECTION');
    passed.push('richiesta di cambio versione esterna in sospeso: la sonda del candidato scade invece di restare appesa (nessuna richiesta di cambio versione creata da noi, righe identiche) e il successo tardivo della sonda chiude la connessione — la cancellazione del database non resta bloccata');

    // ── F. Stabilità del cambio versione: upgrade ripetuti **senza contese esterne** ────────
    // Nessun retry: un solo blocco interno inatteso è un fallimento della prova. I blocchi
    // deliberati (connessione v1 tenuta aperta, richiesta di cambio versione esterna) restano
    // confinati ai gruppi D ed E, dove sono attesi e asseriti.
    const repetitions = 12;
    for (let round = 0; round < repetitions; round++) {
        const repeatUid = `queue-upgrade-repeat-${round}-${crypto.randomUUID()}`;
        const repeatQueue = await createOfflineMutationQueue({uid: repeatUid, vaultKeyMaterial: KEY});
        await repeatQueue.enqueue({uid: repeatUid, operationId: 'seed', recordId: 'record-seed', value: 'seed'});
        repeatQueue.close();
        const repeatBefore = await inspectQueueSchema({uid: repeatUid});
        let repeatUpgrade = null, repeatCode = null;
        try { repeatUpgrade = await upgradeQueueSchemaToV2({uid: repeatUid}); }
        catch (error) { repeatCode = error.code || error.message; }
        assert(repeatCode === null, `REPEAT_${round}_INTERNAL_BLOCK:${repeatCode}`);
        same(repeatUpgrade.version, 2, `REPEAT_${round}_VERSION`);
        const repeatAfter = await inspectQueueSchema({uid: repeatUid});
        same([repeatAfter.version, repeatAfter.stores], [2, ['encryptedOperations', 'queueLeases']], `REPEAT_${round}_SCHEMA`);
        same(canonical(repeatAfter.rows), canonical(repeatBefore.rows), `REPEAT_${round}_ROWS_CHANGED`);
        same((await readOfflineQueueContainers({uid: repeatUid})).containers.length, 1, `REPEAT_${round}_READER`);
    }
    passed.push(`${repetitions} upgrade consecutivi su code v1 distinte, senza contese esterne e senza retry: zero blocchi interni inattesi, versione 2 con entrambi gli store e righe identiche in ogni ripetizione`);

    await report({ok: true, passed, browser: navigator.userAgent});
} catch (error) {
    await report({ok: false, passed, code: error.code || error.message});
}
