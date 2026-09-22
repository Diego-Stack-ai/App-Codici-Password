import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {createOfflineMutationLeaseCoordinator} from './offline-mutation-lease.mjs';

// [M6-A-8b] Prove Node sul **modulo reale** `offline-mutation-lease.mjs`, con dati sintetici e una
// fixture IndexedDB in memoria che riproduce il contratto osservato: apertura senza versione (un
// database assente resta assente), transazioni con bozza e commit solo alla conclusione, abort con
// rollback, richieste differite (per il timeout) e iniezione di un guasto di transazione.
// Nessun dato reale, nessun browser, nessuna scrittura su `encryptedOperations` da parte del
// coordinatore.

const UID = 'owner-a';
const HOLDER = 'page-a';
const NAME = `codex-offline-queue-${UID}`;
const container = (operationId, extra = {}) => ({id: `${UID}:${operationId}`, uid: UID, operationId,
    schemaVersion: 1, iv: 'FIXTURE-IV', ciphertext: 'FIXTURE-CIPHERTEXT', queuedAt: 1, ...extra});

function fixture({version = 2, names = null, missing = false, structure = {}, rows = {}} = {}) {
    const calls = {opens: [], created: [], upgradeAborts: 0, aborts: 0, writes: [], transactions: []};
    const definitions = names ?? (version === 2 ? ['encryptedOperations', 'queueLeases'] : ['encryptedOperations']);
    const storeDefinitions = definitions.map(storeName => ({name: storeName,
        keyPath: structure[storeName]?.keyPath ?? 'id', autoIncrement: structure[storeName]?.autoIncrement ?? false}));
    const data = new Map(definitions.map(storeName => [storeName, new Map(Object.entries(rows[storeName] ?? {}))]));
    let clock = 1000, failStore = null, stalled = false;
    const deferred = [];
    const indexedDb = {open(requested) {
        calls.opens.push(requested);
        const request = {transaction: {abort() { calls.upgradeAborts += 1; }}};
        if (missing) { setImmediate(() => { request.onupgradeneeded?.(); request.onerror?.(); }); return request; }
        const connection = {version, onversionchange: null, close() { connection.closed = true; },
            objectStoreNames: Object.assign([...definitions], {contains: candidate => definitions.includes(candidate)}),
            transaction(requestedStores, mode) {
                const wanted = Array.isArray(requestedStores) ? requestedStores : [requestedStores];
                if (wanted.some(storeName => !definitions.includes(storeName))) throw new Error('NotFoundError');
                calls.transactions.push({stores: [...wanted], mode});
                const requests = [];
                const transaction = {db: connection, mode, aborted: false, error: null,
                    oncomplete: null, onabort: null, onerror: null,
                    abort() { transaction.aborted = true; },
                    objectStore(storeName) {
                        if (!wanted.includes(storeName)) throw new Error('NotFoundError');
                        const definition = storeDefinitions.find(entry => entry.name === storeName);
                        const enqueue = (action, key, value) => { const record = {}; requests.push({storeName, action, key, value, record}); return record; };
                        return {keyPath: definition.keyPath, autoIncrement: definition.autoIncrement,
                            get: key => enqueue('get', key), put: value => enqueue('put', value.id, value),
                            delete: key => enqueue('delete', key)};
                    }};
                const drafts = new Map(wanted.map(storeName => [storeName, structuredClone(data.get(storeName))]));
                const step = () => {
                    if (stalled) { deferred.push(step); return; }
                    if (transaction.aborted) { transaction.onabort?.(); return; }
                    if (!requests.length) {
                        if (mode === 'readwrite') for (const [storeName, draft] of drafts) data.set(storeName, draft);
                        transaction.oncomplete?.();
                        return;
                    }
                    const {storeName, action, key, value, record} = requests.shift();
                    if (failStore === storeName) {
                        failStore = null; transaction.aborted = true; calls.aborts += 1;
                        transaction.error = Object.assign(new Error('LEASE_TRANSACTION_FAILED'), {code: 'LEASE_TRANSACTION_FAILED'});
                        transaction.onabort?.();
                        return;
                    }
                    if (action === 'get') record.result = structuredClone(drafts.get(storeName).get(key));
                    else if (action === 'put') { drafts.get(storeName).set(key, structuredClone(value)); calls.writes.push(`${storeName}:put`); }
                    else { drafts.get(storeName).delete(key); calls.writes.push(`${storeName}:delete`); }
                    try { record.onsuccess?.(); } catch (error) {
                        transaction.error = error; transaction.aborted = true; calls.aborts += 1; transaction.onabort?.();
                        return;
                    }
                    setImmediate(step);
                };
                setImmediate(step);
                return transaction;
            }};
        setImmediate(() => { request.result = connection; request.onsuccess?.(); });
        return request;
    }};
    const coordinator = (holderId = HOLDER, options = {}) => createOfflineMutationLeaseCoordinator({
        uid: UID, holderId, indexedDb, databaseName: NAME, now: () => clock, ttlMs: 100, ...options});
    return {
        calls, indexedDb, coordinator,
        data: storeName => data.get(storeName) ?? new Map(),
        record: () => (data.get('queueLeases')?.has(UID) ? structuredClone(data.get('queueLeases').get(UID)) : undefined),
        takeover(holderId, token) { data.get('queueLeases').set(UID, {...data.get('queueLeases').get(UID), holderId, token}); },
        get clock() { return clock; }, set clock(value) { clock = value; },
        set failStore(storeName) { failStore = storeName; },
        stall() { stalled = true; },
        releaseStall() { stalled = false; for (const step of deferred.splice(0)) setImmediate(step); }
    };
}

// Scrittura protetta del **chiamante**: la transazione nasce dalla connessione del coordinatore e il
// fencing verifica il lease nella stessa transazione. Restituisce il motivo del rifiuto, se c'è.
const guardedWrite = (coordinator, context, mutate = () => {}) => new Promise(resolve => {
    const tx = coordinator.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
    let reason = null;
    tx.oncomplete = () => resolve({reason, committed: true});
    tx.onabort = () => resolve({reason, committed: false});
    tx.onerror = () => resolve({reason, committed: false});
    context.guardTransaction(tx, () => mutate(tx.objectStore('encryptedOperations')), error => { reason = error.code; });
});

const waitFor = async (predicate, timeoutMs = 3000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, 2));
    }
    throw new Error('WAIT_TIMEOUT');
};
const writesOn = (calls, storeName) => calls.writes.filter(write => write.startsWith(`${storeName}:`));

test('apertura v2 e percorso protetto: il task gira sotto lease, rilasciato alla fine', async () => {
    const f = fixture({rows: {encryptedOperations: {[`${UID}:device:1`]: container('device:1')}}});
    const before = structuredClone([...f.data('encryptedOperations')]);
    const coordinator = f.coordinator();
    assert.deepEqual(await coordinator.open(), {version: 2}, 'solo lo schema v2 è accettato');
    assert.equal(coordinator.version(), 2);
    const outcome = await coordinator.run(async context => {
        assert.equal(context.token, 1);
        const guarded = await guardedWrite(coordinator, context, store => store.put(container('device:2')));
        assert.deepEqual(guarded, {reason: null, committed: true}, 'la scrittura protetta deve concludersi');
        return 'saved';
    });
    assert.deepEqual(outcome, {acquired: true, value: 'saved'});
    assert.equal(f.record().holderId, null, 'il lease deve essere rilasciato');
    assert.equal(f.record().expiresAt, 0);
    assert.equal(f.record().token, 1, 'il token si conserva anche dopo il rilascio');
    assert.deepEqual(f.data('encryptedOperations').get(`${UID}:device:1`), before[0][1], 'la coda preesistente resta intatta');
    assert.equal(f.data('encryptedOperations').size, 2, 'la sola scrittura è quella esplicita del chiamante');
    assert.equal(writesOn(f.calls, 'encryptedOperations').length, 1, 'il coordinatore non scrive mai su encryptedOperations');
    coordinator.close();
    assert.throws(() => coordinator.transaction(['queueLeases'], 'readonly'), /LEASE_DATABASE_UNAVAILABLE/);
});

test('rifiuti dichiarati: coda assente, v1, v3, store mancanti e struttura errata', async () => {
    const cases = [
        {name: 'coda assente', options: {missing: true}, code: 'LEASE_DATABASE_MISSING', upgradeAborts: 1},
        {name: 'schema v1', options: {version: 1, names: ['encryptedOperations']}, code: 'LEASE_SCHEMA_V1'},
        {name: 'schema v3', options: {version: 3, names: ['encryptedOperations', 'queueLeases']}, code: 'LEASE_SCHEMA_UNSUPPORTED'},
        {name: 'v2 senza store del lease', options: {version: 2, names: ['encryptedOperations']}, code: 'LEASE_SCHEMA_MALFORMED'},
        {name: 'v2 con chiave errata', options: {version: 2, structure: {encryptedOperations: {keyPath: 'chiave'}}}, code: 'LEASE_SCHEMA_MALFORMED'},
        {name: 'v2 con incremento attivo', options: {version: 2, structure: {queueLeases: {autoIncrement: true}}}, code: 'LEASE_SCHEMA_MALFORMED'}
    ];
    for (const {name, options, code, upgradeAborts = 0} of cases) {
        const f = fixture({rows: {encryptedOperations: {[`${UID}:device:1`]: container('device:1')}}, ...options});
        const before = structuredClone([...f.data('encryptedOperations')]);
        const coordinator = f.coordinator();
        let ran = false;
        await assert.rejects(coordinator.run(async () => { ran = true; }), new RegExp(code), name);
        assert.equal(ran, false, `${name}: il task non deve mai girare`);
        assert.equal(f.record(), undefined, `${name}: nessun lease creato`);
        assert.deepEqual(f.calls.created, [], `${name}: nessuno store creato`);
        assert.deepEqual(f.calls.writes, [], `${name}: nessuna scrittura`);
        assert.equal(f.calls.upgradeAborts, upgradeAborts, `${name}: upgrade annullato senza creare nulla`);
        assert.deepEqual([...f.data('encryptedOperations')], before, `${name}: encryptedOperations intatto`);
        await assert.rejects(coordinator.acquire(), new RegExp(code), `${name}: anche l'acquisizione diretta rifiuta`);
    }
});

test('sessione scaduta: nessun task, nessuna scrittura, lease rilasciato', async () => {
    const f = fixture();
    const coordinator = f.coordinator();
    let ran = 0;
    await assert.rejects(coordinator.run(async () => { ran += 1; }, {isActive: () => false}), /LEASE_SESSION_INACTIVE/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(coordinator.run(async () => { ran += 1; }, {signal: controller.signal}), /LEASE_SESSION_INACTIVE/);
    await assert.rejects(coordinator.acquire({isActive: () => false}), /LEASE_SESSION_INACTIVE/);
    assert.equal(ran, 0);
    assert.equal(f.record(), undefined, 'nessun lease creato da una sessione non attiva');
    assert.deepEqual(f.calls.writes, []);
    // Sessione che cade **durante** il task: nessuna riuscita riferita al chiamante.
    let active = true;
    await assert.rejects(coordinator.run(async () => { active = false; return 'mai riferito'; }, {isActive: () => active}),
        /LEASE_SESSION_INACTIVE/);
    assert.equal(f.record().holderId, null, 'il lease va rilasciato anche quando la sessione cade');
});

test('contesa fra due contesti: uno solo esegue, l\'altro rifiuta LEASE_BUSY', async () => {
    const f = fixture();
    const holder = f.coordinator('page-a'), other = f.coordinator('page-b');
    let releaseGate, entered = false, otherRan = false;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    const running = holder.run(async () => { entered = true; await gate; return 'holder'; });
    await waitFor(() => entered);
    assert.equal(f.record().holderId, 'page-a');
    const before = structuredClone([...f.data('encryptedOperations')]);
    assert.deepEqual(await other.run(async () => { otherRan = true; }), {acquired: false, reason: 'LEASE_BUSY'});
    assert.equal(otherRan, false, 'il secondo contesto non deve eseguire nulla');
    assert.deepEqual(f.calls.writes.filter(write => write.startsWith('encryptedOperations')), [], 'nessuna scrittura durante la contesa');
    assert.deepEqual([...f.data('encryptedOperations')], before);
    // La diagnosi precedente si bloccava qui: il gate va rilasciato **prima** di attendere il titolare.
    releaseGate();
    assert.deepEqual(await running, {acquired: true, value: 'holder'});
    assert.equal(f.record().holderId, null, 'il titolare rilascia il lease');
    assert.deepEqual(await other.run(async () => 'after-release'), {acquired: true, value: 'after-release'});
    assert.equal(f.record().token, 2, 'il token avanza: il rilascio non azzera il contatore');
});

test('rilascio dopo errore: il lease torna libero e il token avanza (anti-ABA)', async () => {
    const f = fixture();
    const failure = Object.assign(new Error('SYNTHETIC_TASK_FAILURE'), {code: 'SYNTHETIC_TASK_FAILURE'});
    const first = f.coordinator('page-a');
    await assert.rejects(first.run(async () => { throw failure; }), error => error === failure);
    assert.equal(f.record().holderId, null, 'il lease va rilasciato anche dopo un errore del task');
    assert.equal(f.record().expiresAt, 0);
    assert.equal(f.record().token, 1);
    assert.deepEqual(f.calls.writes.filter(write => write.startsWith('encryptedOperations')), []);
    assert.deepEqual(await f.coordinator('page-b').run(async () => 'after-error'), {acquired: true, value: 'after-error'});
    assert.equal(f.record().token, 2);
});

test('timeout di acquisizione: nessun task e lease tardivo rilasciato senza effetti', async () => {
    const f = fixture();
    const coordinator = f.coordinator(HOLDER, {acquireTimeoutMs: 20});
    let ran = false;
    f.stall();
    await assert.rejects(coordinator.run(async () => { ran = true; }, {}), /LEASE_ACQUIRE_TIMEOUT/);
    assert.equal(ran, false, 'il task non deve mai girare');
    assert.deepEqual(f.calls.writes, [], 'nessuna scrittura durante l\'attesa');
    assert.equal(f.record(), undefined, 'l\'acquisizione bloccata non ha ancora scritto nulla');
    // Il blocco si scioglie: il lease arriva **dopo** la scadenza e va rilasciato, senza eseguire il task.
    f.releaseStall();
    await waitFor(() => f.record()?.holderId === null);
    assert.equal(f.record().token, 1);
    assert.equal(ran, false, 'un lease tardivo non può far girare il task');
    assert.deepEqual(f.calls.writes.filter(write => write.startsWith('encryptedOperations')), []);
});

test('fencing: il takeover prima di guardTransaction perde il lease e non scrive nulla', async () => {
    const f = fixture();
    const coordinator = f.coordinator('page-a');
    const handle = await coordinator.acquire();
    assert.equal(handle.token, 1);
    // La diagnosi precedente non perdeva davvero il lease: qui il record viene sostituito con un
    // **altro titolare** prima di `guardTransaction`.
    f.takeover('page-b', 2);
    const outcome = await guardedWrite(coordinator, handle, store => store.put(container('device:9')));
    assert.deepEqual(outcome, {reason: 'LEASE_LOST', committed: false}, 'il fencing deve rifiutare LEASE_LOST');
    assert.equal(f.data('encryptedOperations').size, 0, 'zero scritture su encryptedOperations');
    assert.equal(f.record().holderId, 'page-b', 'il record del nuovo titolare resta invariato');
    assert.equal(await handle.isCurrent(), false);
    assert.equal(await handle.release(), false, 'un titolare decaduto non può rilasciare il lease altrui');
    assert.equal(await handle.checkCurrent().then(() => 'ok', error => error.code), 'LEASE_CONTEXT_CLOSED');
    assert.deepEqual(await guardedWrite(coordinator, handle, store => store.put(container('device:9'))),
        {reason: 'LEASE_CONTEXT_CLOSED', committed: false});
    assert.equal(f.data('encryptedOperations').size, 0);
});

test('guardTransaction rifiuta una transazione estranea, una in sola lettura e callback non valide', async () => {
    const f = fixture();
    const coordinator = f.coordinator('page-a');
    const handle = await coordinator.acquire();
    const foreign = f.coordinator('page-c');
    await foreign.open();
    let callbacks = 0;
    assert.throws(() => handle.guardTransaction(foreign.transaction(['queueLeases', 'encryptedOperations'], 'readwrite'),
        () => { callbacks += 1; }), /LEASE_GUARD_INVALID/);
    assert.throws(() => handle.guardTransaction(coordinator.transaction(['queueLeases'], 'readonly'),
        () => { callbacks += 1; }), /LEASE_GUARD_INVALID/);
    assert.throws(() => handle.guardTransaction(coordinator.transaction(['queueLeases', 'encryptedOperations'], 'readwrite'),
        'non-una-funzione'), /LEASE_GUARD_INVALID/);
    assert.equal(callbacks, 0);
    assert.equal(f.data('encryptedOperations').size, 0);
    // Contrasto: con la transazione corretta la stessa mutazione passa.
    assert.deepEqual(await guardedWrite(coordinator, handle, store => store.put(container('device:1'))),
        {reason: null, committed: true});
    assert.equal(f.data('encryptedOperations').size, 1);
});

test('transazione fallita: rifiuto dichiarato, nessuna riuscita e nessuna scrittura', async () => {
    const f = fixture();
    const coordinator = f.coordinator();
    f.failStore = 'queueLeases';
    await assert.rejects(coordinator.acquire(), /LEASE_TRANSACTION_FAILED/);
    assert.equal(f.record(), undefined, 'nessun lease creato da una transazione fallita');
    assert.deepEqual(f.calls.writes, []);
    // Guasto durante la scrittura protetta: la transazione del chiamante si annulla e `run` rifiuta.
    await assert.rejects(coordinator.run(async context => {
        f.failStore = 'encryptedOperations';
        const guarded = await guardedWrite(coordinator, context, store => store.put(container('device:9')));
        assert.deepEqual(guarded, {reason: null, committed: false}, 'la transazione del chiamante deve annullarsi');
        throw Object.assign(new Error('QUEUE_WRITE_ABORTED'), {code: 'QUEUE_WRITE_ABORTED'});
    }), /QUEUE_WRITE_ABORTED/);
    assert.equal(f.data('encryptedOperations').size, 0, 'la scrittura annullata non deve restare');
    assert.equal(f.record().holderId, null, 'il lease va rilasciato anche dopo la transazione fallita');
});

test('rinnovo e token anti-ABA: il takeover invalida il titolare precedente', async () => {
    const f = fixture();
    const coordinator = f.coordinator('page-a');
    const handle = await coordinator.acquire();
    assert.equal(handle.token, 1);
    const expiresAt = f.record().expiresAt;
    f.clock = 1050;
    assert.equal(await handle.renew(), true, 'il rinnovo estende il lease corrente');
    assert.ok(f.record().expiresAt > expiresAt);
    f.clock = 1200; // oltre la scadenza rinnovata: un altro titolare può subentrare
    const other = await f.coordinator('page-b').acquire();
    assert.equal(other.token, 2);
    assert.equal(await handle.renew(), false, 'un titolare decaduto non può rinnovare');
    assert.equal(await handle.release(), false);
    assert.equal(f.record().holderId, 'page-b');
    const stale = await guardedWrite(coordinator, handle, store => store.put(container('stale')));
    assert.deepEqual(stale, {reason: 'LEASE_CONTEXT_CLOSED', committed: false});
    assert.equal(f.data('encryptedOperations').size, 0);
    assert.equal(await other.renew(), true, 'il nuovo titolare resta operativo');
});

test('record del lease malformato: fail-closed senza riparazioni', async () => {
    const f = fixture({rows: {queueLeases: {[UID]: {id: UID, version: 1, holderId: 'page-b', token: 1, updatedAt: 900, expiresAt: 2000}}}});
    for (const patch of [{token: 0}, {version: 2}, {holderId: {}}, {expiresAt: Number.NaN}, {id: 'altro'}, {updatedAt: -1}]) {
        const bad = {...f.record(), ...patch};
        f.data('queueLeases').set(UID, bad);
        await assert.rejects(f.coordinator('page-a').acquire(), /LEASE_RECORD_INVALID/);
        assert.deepEqual(f.record(), bad, 'un record malformato non va riparato né sovrascritto');
    }
    f.clock = 999; // orologio tornato indietro: non può prolungare un possesso
    f.data('queueLeases').set(UID, {id: UID, version: 1, holderId: null, token: 1, updatedAt: 1000, expiresAt: 0});
    await assert.rejects(f.coordinator('page-a').acquire(), /LEASE_CLOCK_REVERSED/);
});

test('isolamento: nessun file del runtime nomina il coordinatore e il modulo non importa nulla', async () => {
    const root = path.resolve(import.meta.dirname, '..', '..');
    const source = await readFile(new URL('./offline-mutation-lease.mjs', import.meta.url), 'utf8');
    assert.equal(/^\s*import\s/m.test(source), false, 'il modulo isolato non deve importare nulla');
    assert.equal(/[^\w.]withOfflineQueueLease\s*\(/.test(source), false, 'il modulo non collega l\'interfaccia reale');
    const files = [];
    const walk = async directory => {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) await walk(target);
            else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
        }
    };
    await walk(path.join(root, 'Frontend', 'public'));
    assert.ok(files.length > 100, 'la scansione deve coprire le risorse del runtime');
    const offenders = [];
    for (const file of files) {
        const text = await readFile(file, 'utf8');
        if (text.includes('offline-mutation-lease') || text.includes('createOfflineMutationLeaseCoordinator')) {
            offenders.push(path.relative(root, file));
        }
    }
    assert.deepEqual(offenders, [], 'nessun modulo del runtime deve importare il coordinatore');
    const queue = await readFile(path.join(root, 'Frontend/public/assets/js/modules/data/offline-mutation-queue.js'), 'utf8');
    assert.match(queue, /OFFLINE_QUEUE_LOCKS_UNAVAILABLE/, 'il runtime senza Web Locks continua a rifiutare (nessun fallback abilitato)');
});
