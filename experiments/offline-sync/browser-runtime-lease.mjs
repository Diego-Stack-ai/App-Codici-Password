import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {createOfflineMutationQueue, readOfflineQueueContainers, withOfflineQueueLease} from './queue.js';
import {createOfflineMutationSynchronizer} from './Frontend/public/assets/js/modules/data/offline-mutation-sync.js';
import {createOfflineMutationClientCore} from './Frontend/public/assets/js/modules/data/offline-mutation-client-core.js';

// M6-2 — laboratorio: il **coordinatore ibrido** dietro l'**interfaccia reale** della coda.
//
// Non attiva nulla: `Frontend/public/**`, Functions e Rules restano invariati. Il banco
// esercita `withOfflineQueueLease` (e il `withLease` iniettato nella coda reale) nei due
// rami — Web Locks disponibile e `navigator.locks` realmente assente — iniettando il
// coordinatore di laboratorio come `locks`/`withLease`. Dati sintetici, profilo usa e getta.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const passed = [];
const assert = (value, code) => { if (!value) throw new Error(code); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected), code);

// Il coordinatore di laboratorio dietro il contratto della piattaforma: `request(name,
// options, callback)`. Quando il lease non si ottiene, l'interfaccia riceve `no lock`
// esattamente come con Web Locks occupato (`ifAvailable: true`).
const asLocks = coordinator => Object.freeze({
    async request(_name, _options, callback) {
        const outcome = await coordinator.run(() => callback({name: 'hybrid-lab'}));
        return outcome?.acquired ? outcome.value : callback(undefined);
    }
});

async function openLeaseDatabase(name) {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
        request.result.createObjectStore('queueLeases', {keyPath: 'id'});
        request.result.createObjectStore('effects', {keyPath: 'id'});
    };
    return requestValue(request);
}

// Rete di sicurezza: le transazioni bloccate non sono annullabili senza Web Locks, quindi il
// coordinatore limita l'acquisizione. Questo stub non conclude finché non gli si dice di farlo.
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

const nativeLocks = navigator.locks;
let leaseDb, coreLeaseDb, core, reader;
try {
    // ── A. Web Locks disponibile: comportamento attuale del runtime, invariato ────────────
    const nativeUid = `runtime-native-${crypto.randomUUID()}`;
    assert(typeof navigator.locks?.request === 'function', 'PAGE_WEB_LOCKS_MISSING');
    same(await withOfflineQueueLease(nativeUid, async () => 'native-1'), {acquired: true, value: 'native-1'},
        'NATIVE_ACQUIRE');
    let nativeEntered = false, releaseNative;
    const nativeHolder = withOfflineQueueLease(nativeUid, async () => {
        nativeEntered = true;
        await new Promise(resolve => { releaseNative = resolve; });
        return 'held';
    });
    while (!nativeEntered) await tick();
    same(await withOfflineQueueLease(nativeUid, async () => 'blocked'), {acquired: false}, 'NATIVE_EXCLUSION');
    releaseNative();
    assert((await nativeHolder).value === 'held', 'NATIVE_HOLDER');
    passed.push('Web Locks disponibile: withOfflineQueueLease esegue sotto il lock di piattaforma e un secondo ingresso ottiene {acquired:false}');

    // ── B. navigator.locks realmente assente: il runtime attuale NON usa il fallback ──────
    Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
    assert(typeof navigator.locks === 'undefined', 'PAGE_WEB_LOCKS_PRESENT');
    const absentUid = `runtime-absent-${crypto.randomUUID()}`;
    let absentRan = false, absentCode;
    try { await withOfflineQueueLease(absentUid, async () => { absentRan = true; }); }
    catch (error) { absentCode = error.message; }
    assert(absentCode === 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', 'RUNTIME_FALLBACK_CLAIMED');
    assert(!absentRan, 'RUNTIME_TASK_RAN_WITHOUT_LOCKS');
    passed.push('navigator.locks realmente assente: il runtime distribuito rifiuta con OFFLINE_QUEUE_LOCKS_UNAVAILABLE e non esegue nulla');

    // ── C. Assenza + coordinatore ibrido iniettato come `locks` ──────────────────────────
    const uid = `runtime-hybrid-${crypto.randomUUID()}`;
    leaseDb = await openLeaseDatabase(`codex-offline-lease-runtime-${uid}`);
    const clock = {value: 1000};
    const coordinator = holderId => createHybridQueueCoordinator({database: leaseDb, uid, holderId,
        now: () => clock.value, ttlMs: 100, locks: undefined});

    same(await withOfflineQueueLease(uid, async () => 'hybrid-1', asLocks(coordinator('page-a'))),
        {acquired: true, value: 'hybrid-1'}, 'HYBRID_ACQUIRE');
    same(await withOfflineQueueLease(uid, async () => 'hybrid-2', asLocks(coordinator('page-a'))),
        {acquired: true, value: 'hybrid-2'}, 'HYBRID_LEASE_NOT_RELEASED_AFTER_SUCCESS');
    passed.push('assenza + coordinatore iniettato: l’interfaccia reale esegue il task sotto il lease IndexedDB e lo rilascia dopo il successo');

    let heldEntered = false, releaseHeld, heldRuns = 0;
    const held = withOfflineQueueLease(uid, async () => {
        heldEntered = true; heldRuns++;
        await new Promise(resolve => { releaseHeld = resolve; });
        return 'held';
    }, asLocks(coordinator('page-a')));
    while (!heldEntered) await tick();
    same(await withOfflineQueueLease(uid, async () => { heldRuns++; return 'blocked'; }, asLocks(coordinator('page-b'))),
        {acquired: false}, 'HYBRID_EXCLUSION');
    assert(heldRuns === 1, 'HYBRID_EXCLUSION_RAN_TWICE');
    releaseHeld();
    assert((await held).value === 'held', 'HYBRID_HOLDER');
    passed.push('assenza + coordinatore iniettato: due richieste concorrenti da titolari distinti — una sola esegue, l’altra riceve {acquired:false} senza attendere');

    let failedCode;
    try {
        await withOfflineQueueLease(uid, async () => { throw Object.assign(new Error('SYNTHETIC_TASK_FAILURE'), {code: 'SYNTHETIC_TASK_FAILURE'}); },
            asLocks(coordinator('page-a')));
    } catch (error) { failedCode = error.code; }
    assert(failedCode === 'SYNTHETIC_TASK_FAILURE', 'HYBRID_ERROR_NOT_PROPAGATED');
    same(await withOfflineQueueLease(uid, async () => 'after-error', asLocks(coordinator('page-a'))),
        {acquired: true, value: 'after-error'}, 'HYBRID_LEASE_HELD_AFTER_ERROR');
    passed.push('assenza + coordinatore iniettato: l’errore del task attraversa l’interfaccia e il lease viene rilasciato (l’ingresso successivo riesce)');

    // ── C-bis. Acquisizione bloccata: timeout e lease tardivo rifiutato ───────────────────
    const stalled = stallingDatabase();
    const stalledUid = `runtime-stalled-${crypto.randomUUID()}`;
    const stalledCoordinator = createHybridQueueCoordinator({database: stalled.database, uid: stalledUid,
        holderId: 'stalled', now: stalled.now, ttlMs: 100, acquireTimeoutMs: 30, locks: undefined});
    let stalledRan = false, stalledCode;
    try { await withOfflineQueueLease(stalledUid, async () => { stalledRan = true; }, asLocks(stalledCoordinator)); }
    catch (error) { stalledCode = error.code; }
    assert(stalledCode === 'HYBRID_ACQUIRE_TIMEOUT', 'TIMEOUT_NOT_PROPAGATED');
    assert(!stalledRan, 'TIMEOUT_TASK_RAN');
    assert(stalled.data.get('effects').size === 0, 'TIMEOUT_EFFECTS');
    stalled.release();
    await new Promise(resolve => setTimeout(resolve, 80));
    assert(stalled.completions > 0, 'LATE_LEASE_TRANSACTION_NEVER_COMPLETED');
    assert(!stalledRan, 'LATE_LEASE_RAN_TASK');
    assert(stalled.data.get('effects').size === 0, 'LATE_LEASE_EFFECTS');
    passed.push('assenza + coordinatore iniettato: acquisizione bloccata → HYBRID_ACQUIRE_TIMEOUT attraverso l’interfaccia, task mai eseguito e lease tardivo rilasciato senza effetti');

    // ── E. Criterio aperto: la coda del runtime non ha lo store del lease ────────────────
    const queueUid = `runtime-schema-${crypto.randomUUID()}`;
    const queue = await createOfflineMutationQueue({uid: queueUid, vaultKeyMaterial: KEY});
    const queueDb = await requestValue(indexedDB.open(`codex-offline-queue-${queueUid}`));
    const stores = [...queueDb.objectStoreNames].sort();
    queueDb.close(); queue.close();
    same(stores, ['encryptedOperations'], 'RUNTIME_QUEUE_STORES');
    assert(!stores.includes('queueLeases'), 'RUNTIME_QUEUE_HAS_LEASE_STORE');
    passed.push('schema della coda distribuita: solo `encryptedOperations` (versione 1), nessuno store `queueLeases` — l’adozione del fallback richiede una decisione sullo schema, non presa qui');

    // ── D. Coda reale + `withLease` del client-core con il coordinatore iniettato ────────
    const coreUid = `runtime-core-${crypto.randomUUID()}`;
    coreLeaseDb = await openLeaseDatabase(`codex-offline-lease-core-${coreUid}`);
    const coreCoordinator = holderId => createHybridQueueCoordinator({database: coreLeaseDb, uid: coreUid,
        holderId, now: () => clock.value, ttlMs: 100, locks: undefined});
    core = await createOfflineMutationClientCore({
        uid: coreUid, vaultKeyMaterial: KEY, enabled: true,
        createQueue: createOfflineMutationQueue,
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: (id, task) => withOfflineQueueLease(id, task, asLocks(coreCoordinator('core'))),
        createChannel: () => ({notify() {}, close() {}}),
        send: async () => ({status: 'applied'}),
        isOnline: () => false, isActive: () => true
    });
    await core.enqueue({uid: coreUid, operationId: 'core-operation', recordId: 'core-record', value: 'fixture'});
    let coreHeldEntered = false, releaseCoreHeld;
    const coreHeld = withOfflineQueueLease(coreUid, async () => {
        coreHeldEntered = true;
        await new Promise(resolve => { releaseCoreHeld = resolve; });
    }, asLocks(coreCoordinator('other-holder')));
    while (!coreHeldEntered) await tick();
    let busyCode;
    try { await core.discard('core-operation'); } catch (error) { busyCode = error.message; }
    assert(busyCode === 'OFFLINE_QUEUE_BUSY', 'CORE_BUSY_NOT_SURFACED');
    releaseCoreHeld(); await coreHeld;
    await core.discard('core-operation');
    reader = await createOfflineMutationQueue({uid: coreUid, vaultKeyMaterial: KEY});
    assert((await reader.list()).length === 0, 'CORE_DISCARD_LEFT_OPERATION');
    passed.push('coda reale + `withLease` iniettato: `discard` acquisisce dal coordinatore, segnala OFFLINE_QUEUE_BUSY quando il lease è occupato e rimuove l’operazione quando lo ottiene');

    // ── F. Lettore compatibile del runtime (M6-A-1) su IndexedDB reale ───────────────────
    // Il banco prepara i database (solo laboratorio), il runtime li legge e basta. La stessa
    // batteria gira con Web Locks assente e con Web Locks di piattaforma presente: il lettore
    // non deve dipenderne. Nessun upgrade, nessuna scrittura, schema ignoto → fallisce chiuso.
    const restore = value => Object.defineProperty(navigator, 'locks', {value, configurable: true});
    const openDatabase = async (name, version) => {
        const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
        let upgraded = false;
        request.onupgradeneeded = () => { upgraded = true; };
        const database = await requestValue(request);
        return {database, upgraded};
    };
    const inspect = async (name, store) => {
        const {database, upgraded} = await openDatabase(name);
        try {
            const rows = await requestValue(database.transaction(store, 'readonly').objectStore(store).getAll());
            return {upgraded, version: database.version, stores: [...database.objectStoreNames].sort(), rows};
        } finally { database.close(); }
    };
    const createDatabase = (name, version, stores, seed) => {
        const request = indexedDB.open(name, version);
        return new Promise((resolve, reject) => {
            request.onupgradeneeded = () => {
                for (const store of stores) request.result.createObjectStore(store, {keyPath: 'id'});
                seed?.(request.transaction);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };
    const deleteDatabase = name => new Promise(resolve => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    const rejection = async task => { try { await task(); return null; } catch (error) { return error.message; } };

    async function readerBattery(label) {
        // 1) coda v1 reale con due operazioni sigillate: il lettore le restituisce senza chiave
        const uid = `runtime-reader-${label}-${crypto.randomUUID()}`;
        const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
        await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
        await queue.enqueue({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'});
        queue.close();
        const read = await readOfflineQueueContainers({uid});
        same(read.version, 1, 'READER_V1_VERSION');
        same(read.containers.map(row => row.operationId).sort(), ['device:1', 'device:2'], 'READER_V1_IDS');
        assert(read.containers.every(row => row.uid === uid && row.schemaVersion === 1 &&
            row.id === `${uid}:${row.operationId}` && typeof row.iv === 'string' && typeof row.ciphertext === 'string'),
            'READER_V1_CONTAINER_SHAPE');
        assert(!JSON.stringify(read.containers).includes('fixture-'), 'READER_V1_LEAKED_CLEARTEXT');
        const after = await inspect(`codex-offline-queue-${uid}`, 'encryptedOperations');
        assert(!after.upgraded && after.version === 1, 'READER_V1_TRIGGERED_UPGRADE');
        same(after.stores, ['encryptedOperations'], 'READER_V1_STORES_CHANGED');
        same(after.rows.map(row => row.id).sort(), [`${uid}:device:1`, `${uid}:device:2`], 'READER_V1_ROWS_CHANGED');
        assert(after.rows.every(row => row.iv === read.containers.find(item => item.id === row.id).iv), 'READER_V1_ROWS_REWRITTEN');

        // 2) database mancante: resta mancante, nessuno store creato
        const missingUid = `runtime-reader-missing-${crypto.randomUUID()}`;
        const missingName = `codex-offline-queue-${missingUid}`;
        same(await rejection(() => readOfflineQueueContainers({uid: missingUid})), 'QUEUE_READER_MISSING', 'READER_MISSING_CODE');
        const probe = await openDatabase(missingName, 1);
        assert(probe.upgraded && probe.database.objectStoreNames.length === 0, 'READER_MISSING_CREATED_DATABASE');
        probe.database.close();
        await deleteDatabase(missingName);

        // 3) schema v2 con store del lease: accettato; un v2 senza `queueLeases` fallisce chiuso
        const v2Uid = `runtime-reader-v2-${crypto.randomUUID()}`;
        const v2Name = `codex-offline-queue-${v2Uid}`;
        const seeded = await createDatabase(v2Name, 2, ['encryptedOperations', 'queueLeases'],
            transaction => transaction.objectStore('encryptedOperations').put({id: `${v2Uid}:device:1`, uid: v2Uid,
                operationId: 'device:1', schemaVersion: 1, iv: 'SYNTHETIC-IV', ciphertext: 'SYNTHETIC-CIPHERTEXT', queuedAt: 1}));
        seeded.close();
        const version2 = await readOfflineQueueContainers({uid: v2Uid});
        same(version2.version, 2, 'READER_V2_VERSION');
        same(version2.containers.map(row => row.operationId), ['device:1'], 'READER_V2_IDS');
        const noLeaseUid = `runtime-reader-nolease-${crypto.randomUUID()}`;
        const noLease = await createDatabase(`codex-offline-queue-${noLeaseUid}`, 2, ['encryptedOperations']);
        noLease.close();
        same(await rejection(() => readOfflineQueueContainers({uid: noLeaseUid})), 'QUEUE_READER_SCHEMA', 'READER_V2_LEASE_STORE_NOT_REQUIRED');

        // 4) versione futura: fallisce chiuso e non tocca il database (né cancella né ricrea)
        const v3Uid = `runtime-reader-v3-${crypto.randomUUID()}`;
        const v3Name = `codex-offline-queue-${v3Uid}`;
        const future = await createDatabase(v3Name, 3, ['encryptedOperations', 'futuri']);
        future.close();
        same(await rejection(() => readOfflineQueueContainers({uid: v3Uid})), 'QUEUE_READER_SCHEMA', 'READER_V3_CODE');
        const untouched = await inspect(v3Name, 'encryptedOperations');
        assert(!untouched.upgraded && untouched.version === 3, 'READER_V3_TOUCHED_DATABASE');
        same(untouched.stores, ['encryptedOperations', 'futuri'], 'READER_V3_STORES_CHANGED');

        // 5) contenitore malformato o di un altro proprietario: fallisce chiuso e non rimuove righe
        const badUid = `runtime-reader-bad-${crypto.randomUUID()}`;
        const badName = `codex-offline-queue-${badUid}`;
        const alien = await createDatabase(badName, 1, ['encryptedOperations'], transaction => {
            const store = transaction.objectStore('encryptedOperations');
            store.put({id: `${badUid}:device:1`, uid: 'altro-proprietario', operationId: 'device:1', schemaVersion: 1,
                iv: 'SYNTHETIC-IV', ciphertext: 'SYNTHETIC-CIPHERTEXT', queuedAt: 1});
            store.put({id: `${badUid}:device:2`, uid: badUid, operationId: 'device:2', schemaVersion: 1, iv: 'SYNTHETIC-IV', queuedAt: 2});
        });
        alien.close();
        same(await rejection(() => readOfflineQueueContainers({uid: badUid})), 'QUEUE_READER_CONTAINER', 'READER_MALFORMED_CODE');
        const stillThere = await inspect(badName, 'encryptedOperations');
        same(stillThere.rows.map(row => row.id).sort(), [`${badUid}:device:1`, `${badUid}:device:2`], 'READER_MALFORMED_REMOVED_ROWS');
    }

    restore(undefined);
    await readerBattery('nolocks');
    passed.push('Web Locks assente: il lettore compatibile v1/v2 restituisce i contenitori sigillati reali, non migra, non scrive, lascia intatto il database e fallisce chiuso su schema ignoto o contenitore malformato');
    restore(nativeLocks);
    await readerBattery('native');
    passed.push('Web Locks di piattaforma presente: la stessa batteria del lettore dà lo stesso esito — il lettore non consulta e non richiede Web Locks');
    const poisoned = `runtime-reader-poison-${crypto.randomUUID()}`;
    const poisonedName = `codex-offline-queue-${poisoned}`;
    const seededRaw = await createDatabase(poisonedName, 1, ['encryptedOperations']);
    seededRaw.close();
    restore({request() { throw new Error('READER_CONSULTED_LOCKS'); }});
    const poisonedRead = await readOfflineQueueContainers({uid: poisoned});
    same(poisonedRead.containers, [], 'READER_POISONED_CONTAINERS');
    passed.push('Web Locks sostituito da uno stub che lancia: la lettura riesce comunque — nessuna chiamata a `navigator.locks` da parte del lettore');
    restore(nativeLocks);

    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: true, passed,
        browser: navigator.userAgent, webLocks: typeof navigator.locks})});
} catch (error) {
    await fetch('/result', {method: 'POST', body: JSON.stringify({ok: false, passed, code: error.code || error.message,
        webLocks: typeof navigator.locks})});
} finally {
    core?.close(); reader?.close(); leaseDb?.close(); coreLeaseDb?.close();
}
