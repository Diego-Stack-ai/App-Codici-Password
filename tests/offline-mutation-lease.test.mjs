import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// [M6-A-8c] Prove sul **modulo runtime reale** `offline-mutation-lease.js` e sul confine `withLease`
// del client/sincronizzatore del pilota, con dati sintetici. I moduli di `Frontend/public/**` sono
// ESM ma il pacchetto radice è `commonjs`: si caricano da `data:` URL (convenzione delle suite di
// questo progetto), riscrivendo il **solo** specificatore dell'import relativo.
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const readModule = file => readFile(new URL(`../Frontend/public/assets/js/modules/data/${file}`, import.meta.url), 'utf8');
const queueUrl = dataUrl(await readModule('offline-mutation-queue.js'));
const queue = await import(queueUrl);
const lease = await import(dataUrl((await readModule('offline-mutation-lease.js'))
    .replace("from './offline-mutation-queue.js'", `from '${queueUrl}'`)));
const {createOfflineMutationClientCore} = await import(dataUrl(await readModule('offline-mutation-client-core.js')));
const {createOfflineMutationSynchronizer} = await import(dataUrl(await readModule('offline-mutation-sync.js')));

const UID = 'owner-a';
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const NAME = `codex-offline-queue-${UID}`;

// Fixture IndexedDB in memoria con **store separati**, bozza e commit alla conclusione, richieste
// differite, cursore, guasto iniettabile e blocco deliberato. Riproduce il contratto osservato dal
// motore ed è sufficiente ai moduli reali (coda, lettore compatibile, coordinatore del lease).
function databaseFixture({version = 2, stores = ['encryptedOperations', 'queueLeases'], structure = {}, missing = false, stall = false} = {}) {
    const calls = {opens: [], created: [], upgradeAborts: 0, writes: [], transactions: []};
    const data = new Map(stores.map(name => [name, new Map()]));
    let tail = Promise.resolve(), failStore = null, stalled = stall;
    const deferred = [];
    const database = {
        version,
        objectStoreNames: Object.assign([...stores], {contains: name => stores.includes(name)}),
        onversionchange: null,
        close() { database.closed = true; },
        createObjectStore(name) { calls.created.push(name); return {createIndex() {}}; },
        transaction(requested, mode) {
            const wanted = Array.isArray(requested) ? requested : [requested];
            if (wanted.some(name => !stores.includes(name))) throw new Error('NotFoundError');
            calls.transactions.push({stores: [...wanted], mode});
            const requests = [];
            const tx = {db: database, mode, aborted: false, error: null,
                oncomplete: null, onabort: null, onerror: null,
                abort() { tx.aborted = true; },
                objectStore(name) {
                    if (!wanted.includes(name)) throw new Error('NotFoundError');
                    const definition = structure[name] ?? {};
                    const enqueue = (action, key, value) => { const request = {}; requests.push({name, action, key, value, request}); return request; };
                    return {keyPath: definition.keyPath ?? 'id', autoIncrement: definition.autoIncrement ?? false,
                        get: key => enqueue('get', key), put: value => enqueue('put', value?.id, value),
                        add: value => enqueue('add', value?.id, value), delete: key => enqueue('delete', key),
                        count: () => enqueue('count'), openCursor: () => enqueue('cursor'),
                        index: () => ({getAll: () => enqueue('all')})};
                }};
            const run = () => {
                if (stalled) { deferred.push(run); return; }
                if (tx.aborted) { tx.onabort?.(); return; }
                const drafts = new Map(wanted.map(name => [name, new Map(data.get(name))]));
                while (requests.length && !tx.aborted) {
                    const {name, action, key, value, request} = requests.shift();
                    const draft = drafts.get(name);
                    try {
                        if (failStore === name) { failStore = null; throw Object.assign(new Error('LEASE_TRANSACTION_FAILED'), {code: 'LEASE_TRANSACTION_FAILED'}); }
                        if (action === 'get') request.result = structuredClone(draft.get(key));
                        else if (action === 'all') request.result = [...draft.values()].map(row => structuredClone(row)).sort((left, right) => (left.queuedAt ?? 0) - (right.queuedAt ?? 0));
                        else if (action === 'count') request.result = draft.size;
                        else if (action === 'delete') draft.delete(key);
                        else if (action === 'cursor') {
                            const rows = [...draft.values()].map(row => structuredClone(row));
                            const cursor = {value: undefined};
                            let index = 0;
                            const step = () => {
                                if (index < rows.length) { cursor.value = rows[index++]; request.result = cursor; request.onsuccess?.(); }
                                else { request.result = null; request.onsuccess?.(); }
                            };
                            cursor.continue = step;
                            step();
                        } else if (action === 'add' && draft.has(key)) throw new Error('INDEXED_DB_WRITE_FAILED');
                        else { draft.set(key, structuredClone(value)); calls.writes.push(`${name}:${action}`); }
                        if (action !== 'cursor') request.onsuccess?.();
                    } catch (error) { tx.error = error; tx.aborted = true; request.error = error; request.onerror?.(); }
                }
                if (!tx.aborted && mode === 'readwrite') for (const [name, draft] of drafts) data.set(name, draft);
                if (tx.aborted) tx.onabort?.(); else tx.oncomplete?.();
            };
            tail = tail.then(() => new Promise(resolve => setImmediate(() => { run(); resolve(); })));
            return tx;
        }
    };
    const indexedDb = {open(requested) {
        calls.opens.push(requested);
        const request = {transaction: {abort() { calls.upgradeAborts += 1; }}};
        if (missing) { setImmediate(() => { request.onupgradeneeded?.(); request.onerror?.(); }); return request; }
        setImmediate(() => { request.result = database; request.onsuccess?.(); });
        return request;
    }};
    return {
        calls, indexedDb, version,
        store: name => data.get(name) ?? new Map(),
        record: () => (data.get('queueLeases')?.has(UID) ? structuredClone(data.get('queueLeases').get(UID)) : undefined),
        takeover(holderId, token) { data.get('queueLeases').set(UID, {...data.get('queueLeases').get(UID), holderId, token}); },
        set failStore(name) { failStore = name; },
        releaseStall() { stalled = false; for (const run of deferred.splice(0)) setImmediate(run); }
    };
}

const fakeLocks = () => {
    let occupied = false;
    const names = [];
    return {names, busy: false, request: async (name, _options, callback) => {
        names.push(name);
        if (occupied) return callback(null);
        occupied = true;
        try { return await callback({name}); } finally { occupied = false; }
    }};
};
const waitFor = async (predicate, timeoutMs = 3000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, 2));
    }
    throw new Error('WAIT_TIMEOUT');
};
const writesOn = (calls, name) => calls.writes.filter(write => write.startsWith(`${name}:`));
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };

// ── 1. Regola di adozione: Web Locks prioritario, opt-in spento = rifiuto invariato ─────────────
test('Web Locks disponibile: percorso di piattaforma, il lease IndexedDB non viene nemmeno aperto', async () => {
    const f = databaseFixture();
    const locks = fakeLocks();
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks, indexedDb: f.indexedDb});
    assert.deepEqual(await withLease(UID, async () => 'platform'), {acquired: true, value: 'platform'});
    assert.deepEqual(locks.names, [NAME], 'il lock di piattaforma usa il nome della coda dello UID');
    // Esclusione del percorso di piattaforma: mentre è occupato il secondo ingresso rifiuta.
    let release, entered = false;
    const gate = new Promise(resolve => { release = resolve; });
    const first = withLease(UID, async () => { entered = true; await gate; return 'first'; });
    await waitFor(() => entered);
    assert.deepEqual(await withLease(UID, async () => 'second'), {acquired: false});
    release();
    assert.deepEqual(await first, {acquired: true, value: 'first'});
    // Discriminante: nessuna apertura del database del lease e nessun record creato.
    assert.deepEqual(f.calls.opens, [], 'con Web Locks il lease IndexedDB non deve essere aperto');
    assert.deepEqual(f.calls.writes, []);
    assert.equal(f.record(), undefined);
});

test('Web Locks assente e opt-in spento: rifiuto invariato del runtime, nessun task eseguito', async () => {
    const f = databaseFixture();
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: false, locks: null, indexedDb: f.indexedDb});
    let ran = false;
    assert.equal(await rejection(() => withLease(UID, async () => { ran = true; })), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE');
    assert.equal(ran, false);
    assert.deepEqual(f.calls.opens, [], 'senza opt-in non si deve aprire nulla');
    assert.deepEqual(f.calls.writes, []);
    // Default esplicito: anche senza argomenti la regola resta spenta.
    const defaulted = lease.resolveOfflineQueueLease({uid: UID, locks: null, indexedDb: f.indexedDb});
    assert.equal(await rejection(() => defaulted(UID, async () => { ran = true; })), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE');
    assert.equal(ran, false);
});

test('Web Locks assente e opt-in acceso su coda v2: usa il lease dello stesso database', async () => {
    const f = databaseFixture();
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a', ttlMs: 100, now: () => 1000});
    assert.deepEqual(await withLease(UID, async () => 'leased'), {acquired: true, value: 'leased'});
    assert.deepEqual(f.calls.opens, [NAME], 'apre il database della coda dello UID');
    const record = f.record();
    assert.equal(record.holderId, null, 'il lease è rilasciato alla fine');
    assert.equal(record.token, 1);
    assert.deepEqual(f.calls.created, [], 'nessuno store creato');
    assert.deepEqual(writesOn(f.calls, 'encryptedOperations'), [], 'il coordinatore non scrive la coda');
    assert.deepEqual(writesOn(f.calls, 'queueLeases').sort(), ['queueLeases:put', 'queueLeases:put']);
});

test('coda assente, schema v1 e schema malformato falliscono chiuso senza task e senza scritture', async () => {
    const cases = [
        {name: 'coda assente', options: {missing: true}, code: 'LEASE_DATABASE_MISSING'},
        {name: 'schema v1', options: {version: 1, stores: ['encryptedOperations']}, code: 'LEASE_SCHEMA_V1'},
        {name: 'schema v3', options: {version: 3, stores: ['encryptedOperations', 'queueLeases']}, code: 'LEASE_SCHEMA_UNSUPPORTED'},
        {name: 'v2 senza store del lease', options: {version: 2, stores: ['encryptedOperations']}, code: 'LEASE_SCHEMA_MALFORMED'},
        {name: 'v2 con struttura errata', options: {version: 2, structure: {queueLeases: {keyPath: 'chiave'}}}, code: 'LEASE_SCHEMA_MALFORMED'}
    ];
    for (const {name, options, code} of cases) {
        const f = databaseFixture(options);
        const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb});
        let ran = false;
        assert.equal(await rejection(() => withLease(UID, async () => { ran = true; })), code, name);
        assert.equal(ran, false, `${name}: nessun task eseguito`);
        assert.deepEqual(f.calls.created, [], `${name}: nessuno store creato`);
        assert.deepEqual(f.calls.writes, [], `${name}: nessuna scrittura`);
        assert.equal(f.record(), undefined, `${name}: nessun lease creato`);
        if (options.missing) assert.equal(f.calls.upgradeAborts, 1, 'la transazione di cambio versione è annullata: il database non nasce');
    }
});

// ── 2. Esclusione, timeout, errore del task, sessione scaduta: mai una falsa riuscita ───────────
test('lease occupato: il secondo contesto rifiuta {acquired:false} senza eseguire né scrivere', async () => {
    const f = databaseFixture();
    const holder = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a'});
    const other = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-b'});
    let release, entered = false, otherRan = false;
    const gate = new Promise(resolve => { release = resolve; });
    const first = holder(UID, async () => { entered = true; await gate; return 'holder'; });
    await waitFor(() => entered);
    assert.equal(f.record().holderId, 'page-a');
    assert.deepEqual(await other(UID, async () => { otherRan = true; }), {acquired: false, reason: 'LEASE_BUSY'});
    assert.equal(otherRan, false);
    assert.deepEqual(writesOn(f.calls, 'encryptedOperations'), []);
    // Il gate va rilasciato **prima** di attendere il titolare (diagnosi M6-A-8b).
    release();
    assert.deepEqual(await first, {acquired: true, value: 'holder'});
    assert.equal(f.record().holderId, null);
    assert.deepEqual(await other(UID, async () => 'after'), {acquired: true, value: 'after'});
    assert.equal(f.record().token, 2, 'il token avanza: nessuna finestra ABA');
});

test('timeout di acquisizione: nessun task e lease tardivo rilasciato senza effetti', async () => {
    const f = databaseFixture({stall: true});
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a', acquireTimeoutMs: 20});
    let ran = false;
    assert.equal(await rejection(() => withLease(UID, async () => { ran = true; })), 'LEASE_ACQUIRE_TIMEOUT');
    assert.equal(ran, false);
    assert.equal(f.record(), undefined);
    f.releaseStall();
    await waitFor(() => f.record()?.holderId === null);
    assert.equal(f.record().token, 1, 'il lease tardivo è stato rilasciato, non trattenuto');
    assert.equal(ran, false);
    assert.deepEqual(writesOn(f.calls, 'encryptedOperations'), []);
});

test('errore del task: il lease viene rilasciato e nessuna riuscita ambigua', async () => {
    const f = databaseFixture();
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a'});
    const failure = Object.assign(new Error('SYNTHETIC_TASK_FAILURE'), {code: 'SYNTHETIC_TASK_FAILURE'});
    assert.equal(await rejection(() => withLease(UID, async () => { throw failure; })), 'SYNTHETIC_TASK_FAILURE');
    assert.equal(f.record().holderId, null, 'il lease va rilasciato anche dopo un errore');
    assert.equal(f.record().expiresAt, 0);
    const other = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-b'});
    assert.deepEqual(await other(UID, async () => 'after-error'), {acquired: true, value: 'after-error'});
    assert.equal(f.record().token, 2);
});

test('sessione scaduta: nessun task, nessun lease; e la caduta durante il task non è una riuscita', async () => {
    const f = databaseFixture();
    let ran = false;
    const dead = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, isActive: () => false});
    assert.equal(await rejection(() => dead(UID, async () => { ran = true; })), 'LEASE_SESSION_INACTIVE');
    assert.equal(ran, false);
    assert.deepEqual(f.calls.opens, [], 'sessione non attiva: nessuna apertura');
    assert.equal(f.record(), undefined);
    let active = true;
    const live = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, isActive: () => active});
    assert.equal(await rejection(() => live(UID, async () => { active = false; return 'mai riferito'; })), 'LEASE_SESSION_INACTIVE');
    assert.equal(f.record().holderId, null, 'il lease è rilasciato anche quando la sessione cade');
});

test('ambito diverso dallo UID del coordinatore: rifiuto esplicito, nessun lease', async () => {
    const f = databaseFixture();
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb});
    assert.equal(await rejection(() => withLease('other-uid', async () => 'no')), 'OFFLINE_LEASE_SCOPE_MISMATCH');
    assert.deepEqual(f.calls.opens, []);
    assert.equal(f.record(), undefined);
});

test('senza IndexedDB la creazione del confine non fallisce: rifiuto esplicito all’uso e Web Locks intatto', async () => {
    const withLease = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: null});
    assert.equal(typeof withLease, 'function', 'il risolutore si costruisce comunque');
    assert.equal(await rejection(() => withLease(UID, async () => 'no')), 'LEASE_COORDINATOR_CONFIG', 'rifiuto esplicito solo all’uso');
    // Priorità Web Locks: il percorso di piattaforma non dipende dall'IndexedDB.
    const locks = fakeLocks();
    const platform = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks, indexedDb: null});
    assert.deepEqual(await platform(UID, async () => 'platform'), {acquired: true, value: 'platform'});
});

test('il collegamento è solo nel pilota: coda, client, sincronizzatore e upgrade non nominano il lease', async () => {
    for (const file of ['offline-mutation-queue.js', 'offline-mutation-client.js', 'offline-mutation-client-core.js',
        'offline-mutation-sync.js', 'offline-mutation-upgrade.js']) {
        assert.equal((await readModule(file)).includes('offline-mutation-lease'), false, `${file} non deve collegare il lease`);
    }
    const pilot = await readModule('private-account-offline-pilot.js');
    assert.equal(pilot.includes("from './offline-mutation-lease.js'"), true, 'il pilota è l’unico punto di collegamento');
    const client = await readModule('offline-mutation-client.js');
    assert.equal(client.includes('options?.withLease ?? withOfflineQueueLease'), true, 'il default del client resta `withOfflineQueueLease`');
    const queue = await readModule('offline-mutation-queue.js');
    assert.equal(queue.includes('OFFLINE_QUEUE_LOCKS_UNAVAILABLE'), true, 'il rifiuto senza Web Locks resta nel runtime');
});

// ── 3. Client e sincronizzatore del pilota sul percorso reale v2 ────────────────────────────────
const buildClient = async ({f, holderId, sent, states, send, uid = UID, ...leaseOptions}) => {
    const client = await createOfflineMutationClientCore({
        uid, vaultKeyMaterial: KEY, enabled: true,
        createQueue: options => queue.createOfflineMutationQueue({...options, indexedDb: f.indexedDb}),
        createQueueReader: options => queue.createOfflineQueueReader({...options, indexedDb: f.indexedDb}),
        createSynchronizer: createOfflineMutationSynchronizer,
        // Esattamente il confine che il pilota inietta con l'opt-in attivo e Web Locks assente.
        withLease: lease.resolveOfflineQueueLease({uid, leaseFallback: true, locks: null, holderId, indexedDb: f.indexedDb, ...leaseOptions}),
        createChannel: () => ({notify() {}, close() {}}),
        send, isOnline: () => true, onState: state => states.push(state)
    });
    return client;
};
const seedOperation = async (f, operationId) => {
    const instance = await queue.createOfflineMutationQueue({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
    await instance.enqueue({uid: UID, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`});
    instance.close();
};

test('client e sincronizzatore reali: la sincronizzazione si svolge sotto lease e lo rilascia', async () => {
    const f = databaseFixture();
    await seedOperation(f, 'device:1');
    const sent = [], states = [];
    const client = await buildClient({f, holderId: 'page-a', sent, states,
        send: async operation => { sent.push(operation.operationId); return {status: 'applied'}; }});
    // L'involucro `{acquired, value}` è il contratto **preesistente** del confine `withLease`
    // (i chiamanti del pilota fanno `result?.value || result`): il percorso lease non lo cambia.
    assert.deepEqual(await client.flush(), {acquired: true, value: {status: 'saved', completed: 1}});
    assert.deepEqual(sent, ['device:1']);
    assert.equal(f.store('encryptedOperations').size, 0, 'la conferma rimuove l’operazione');
    assert.equal(f.record().holderId, null, 'il lease è rilasciato alla fine della sincronizzazione');
    assert.equal(f.record().token, 1);
    client.close();
});

test('client e sincronizzatore reali: contesa fra due contesti e rilascio dopo errore', async () => {
    const f = databaseFixture();
    await seedOperation(f, 'device:1');
    const statesA = [], statesB = [], sentA = [], sentB = [];
    let release, entered = false;
    const gate = new Promise(resolve => { release = resolve; });
    const clientA = await buildClient({f, holderId: 'page-a', states: statesA, sent: sentA,
        send: async operation => { entered = true; await gate; sentA.push(operation.operationId); return {status: 'applied'}; }});
    const clientB = await buildClient({f, holderId: 'page-b', states: statesB, sent: sentB,
        send: async operation => { sentB.push(operation.operationId); return {status: 'applied'}; }});
    const first = clientA.flush();
    await waitFor(() => entered);
    assert.equal(f.record().holderId, 'page-a');
    assert.deepEqual(await clientB.flush(), {acquired: false, reason: 'LEASE_BUSY'}, 'il secondo contesto non dichiara nulla');
    assert.deepEqual(sentB, [], 'il secondo contesto non invia');
    assert.equal(f.store('encryptedOperations').size, 1, 'l’operazione resta in coda');
    release();
    assert.deepEqual(await first, {acquired: true, value: {status: 'saved', completed: 1}});
    assert.deepEqual(sentA, ['device:1']);
    assert.equal(f.record().holderId, null);
    // Rilascio dopo errore del trasporto: nessuna riuscita, coda conservata, lease libero.
    await seedOperation(f, 'device:2');
    const failing = await buildClient({f, holderId: 'page-c', states: [], sent: [],
        send: async () => { throw Object.assign(new Error('SYNTHETIC_TRANSPORT_FAILURE'), {code: 'SYNTHETIC_TRANSPORT_FAILURE'}); }});
    const outcome = await failing.flush();
    assert.equal(outcome.acquired, true, 'il lease è stato acquisito: l’errore è del trasporto');
    assert.equal(outcome.value.status, 'recoverable-error');
    assert.equal(f.record().holderId, null, 'il lease è rilasciato anche dopo l’errore del trasporto');
    assert.equal(f.store('encryptedOperations').size, 1, 'la coda resta conservata');
    const recovered = await buildClient({f, holderId: 'page-d', states: [], sent: [],
        send: async operation => ({status: 'applied', operationId: operation.operationId})});
    assert.deepEqual(await recovered.flush(), {acquired: true, value: {status: 'saved', completed: 1}});
    assert.equal(f.store('encryptedOperations').size, 0);
    clientA.close(); clientB.close(); failing.close(); recovered.close();
});

test('client e sincronizzatore reali su coda v1: fail-closed dichiarato, nessun invio, nessun upgrade', async () => {
    const f = databaseFixture({version: 1, stores: ['encryptedOperations']});
    await seedOperation(f, 'device:1');
    const sent = [], states = [];
    const client = await buildClient({f, holderId: 'page-a', sent, states,
        send: async operation => { sent.push(operation.operationId); return {status: 'applied'}; }});
    assert.equal(await rejection(() => client.flush()), 'LEASE_SCHEMA_V1');
    assert.deepEqual(sent, [], 'nessun invio su schema non supportato dal lease');
    assert.equal(f.store('encryptedOperations').size, 1, 'la coda resta intatta');
    assert.equal(f.version, 1, 'nessun upgrade automatico');
    assert.deepEqual(f.calls.created, [], 'nessuno store creato');
    assert.deepEqual(writesOn(f.calls, 'queueLeases'), [], 'nessuna scrittura sul lease');
    client.close();
});

// ── 4. M6-A-8c R1: fencing atomico delle scritture reali della coda ─────────────────────────────
const fencedTransactions = f => f.calls.transactions.filter(tx => tx.mode === 'readwrite'
    && tx.stores.includes('queueLeases') && tx.stores.includes('encryptedOperations'));

test('R1 fencing atomico: un titolare scaduto non accoda, non sostituisce, non marca e non rimuove', async () => {
    let clock = 1000;
    const f = databaseFixture();
    const instance = await queue.createOfflineMutationQueue({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
    // L'operazione attesa è quella accodata: il confronto dei contenitori usa la stessa forma che
    // `list()` restituirebbe dopo la decifratura.
    const pending = {uid: UID, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'};
    await instance.enqueue(pending);
    const container = structuredClone(f.store('encryptedOperations').get(`${UID}:device:1`));
    const stale = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null,
        indexedDb: f.indexedDb, holderId: 'page-a', ttlMs: 100, now: () => clock});
    const cases = [
        ['enqueue', context => instance.enqueue({uid: UID, operationId: 'device:9', recordId: 'record-9', value: 'x'}, {lease: context})],
        ['replace', context => instance.replace(pending, {...pending, operationId: 'device:2', value: 'sostituito'}, {lease: context})],
        ['markForReview', context => instance.markForReview(pending, {lease: context})],
        ['remove', context => instance.remove(pending, {lease: context})]
    ];
    let base = 1000;
    for (const [name, run] of cases) {
        clock = base;
        // Il titolare è scaduto **prima** della scrittura reale: la stessa transazione che scriverebbe
        // verifica il token e annulla tutto.
        assert.equal(await rejection(() => stale(UID, async context => { clock = base + 200; return await run(context); })),
            'LEASE_LOST', name);
        assert.equal(f.store('encryptedOperations').size, 1, `${name}: zero scritture/rimozioni`);
        assert.deepEqual(f.store('encryptedOperations').get(`${UID}:device:1`), container, `${name}: contenitore invariato`);
        assert.ok(fencedTransactions(f).length >= 1, `${name}: transazione fenced sul lease`);
        base += 1000;
    }
    // Il **nuovo** titolare prosegue e completa la rimozione.
    clock = base + 200;
    const current = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null,
        indexedDb: f.indexedDb, holderId: 'page-b', ttlMs: 100, now: () => clock});
    await current(UID, async context => { await instance.remove(pending, {lease: context}); });
    assert.equal(f.store('encryptedOperations').size, 0, 'il nuovo titolare completa la rimozione');
    instance.close();
});

test('R1 ritardo/sospensione oltre TTL durante la sincronizzazione: nessuna conferma, nessuna rimozione, nessuna riuscita', async () => {
    let clock = 1000;
    const f = databaseFixture();
    await seedOperation(f, 'device:1');
    const sent = [];
    const stale = await buildClient({f, holderId: 'page-a', sent, states: [], ttlMs: 100, now: () => clock,
        send: async operation => { sent.push(operation.operationId); clock = 1200; return {status: 'applied'}; }});
    assert.equal(await rejection(() => stale.flush()), 'LEASE_LOST', 'il vecchio titolare non dichiara una riuscita');
    assert.deepEqual(sent, ['device:1'], 'l’invio era già partito: il fencing non ritira la rete');
    assert.equal(f.store('encryptedOperations').size, 1, 'nessuna rimozione: la conferma è stata rifiutata');
    assert.equal(f.record().holderId, 'page-a', 'il record scaduto non viene riscritto dal vecchio titolare');
    // Il nuovo titolare subentra e completa la conferma.
    const currentSent = [];
    const current = await buildClient({f, holderId: 'page-b', sent: currentSent, states: [], ttlMs: 100, now: () => clock,
        send: async operation => { currentSent.push(operation.operationId); return {status: 'applied'}; }});
    assert.deepEqual(await current.flush(), {acquired: true, value: {status: 'saved', completed: 1}});
    assert.deepEqual(currentSent, ['device:1']);
    assert.equal(f.store('encryptedOperations').size, 0, 'il nuovo titolare conferma e rimuove');
    stale.close(); current.close();
});

test('R1 lease occupato: l’accodamento resta conservato senza token e nessuna sincronizzazione è dichiarata', async () => {
    const f = databaseFixture();
    const holder = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a'});
    let release, entered = false;
    const gate = new Promise(resolve => { release = resolve; });
    const holding = holder(UID, async () => { entered = true; await gate; return 'holder'; });
    await waitFor(() => entered);
    const other = await buildClient({f, holderId: 'page-b', sent: [], states: [],
        send: async operation => ({status: 'applied', operationId: operation.operationId})});
    const outcome = await other.enqueue({uid: UID, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    assert.equal(f.store('encryptedOperations').size, 1, 'la modifica dell’utente è conservata');
    assert.equal(outcome?.acquired === true, false, 'nessuna riuscita dichiarata con il confine occupato');
    release();
    assert.deepEqual(await holding, {acquired: true, value: 'holder'});
    other.close();
});

test('R1 percorso Web Locks: nessuna transazione sul lease e comportamento invariato', async () => {    const f = databaseFixture();
    const locks = fakeLocks();
    const sent = [];
    const client = await createOfflineMutationClientCore({
        uid: UID, vaultKeyMaterial: KEY, enabled: true,
        createQueue: options => queue.createOfflineMutationQueue({...options, indexedDb: f.indexedDb}),
        createQueueReader: options => queue.createOfflineQueueReader({...options, indexedDb: f.indexedDb}),
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks, indexedDb: f.indexedDb}),
        createChannel: () => ({notify() {}, close() {}}),
        send: async operation => { sent.push(operation.operationId); return {status: 'applied'}; },
        isOnline: () => true, onState: () => {}
    });
    await client.enqueue({uid: UID, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    assert.deepEqual(sent, ['device:1'], 'il percorso di piattaforma sincronizza come prima');
    assert.equal(f.store('encryptedOperations').size, 0);
    assert.deepEqual(locks.names, [NAME, NAME], 'accodamento e sincronizzazione passano dal lock di piattaforma');
    assert.deepEqual(fencedTransactions(f), [], 'nessuna transazione fenced: il percorso Web Locks non usa il lease');
    assert.equal(f.record(), undefined, 'nessun record di lease creato');
    client.close();
});

test('R1 un confine che riferisce LEASE_LOST non lascia scrivere senza token', async () => {
    let enqueued = 0;
    const dependencies = error => ({uid: UID, vaultKeyMaterial: KEY, enabled: true,
        createQueue: async () => ({isOperable: () => true, enqueue: async () => { enqueued += 1; },
            list: async () => [], close() {}}),
        createSynchronizer: () => ({flush: async () => ({status: 'saved'})}),
        withLease: async () => { throw error; }, send: async () => {}});
    // Token **preso e perso**: nessuna scrittura, esito dichiarato.
    const lost = await createOfflineMutationClientCore(dependencies(Object.assign(new Error('LEASE_LOST'), {code: 'LEASE_LOST'})));
    assert.equal(await rejection(() => lost.enqueue({uid: UID, operationId: 'device:1', recordId: 'record-1', value: 'x'})), 'LEASE_LOST');
    assert.equal(enqueued, 0, 'nessuna scrittura senza token dopo una perdita');
    // Token **mai preso** (API di piattaforma assente): l’accodamento resta conservato come prima.
    const off = await createOfflineMutationClientCore(dependencies(Object.assign(new Error('OFFLINE_QUEUE_LOCKS_UNAVAILABLE'), {code: 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE'})));
    assert.deepEqual(await off.enqueue({uid: UID, operationId: 'device:2', recordId: 'record-2', value: 'x'}), {status: 'saved'});
    assert.equal(enqueued, 1, 'la conservazione della modifica non cambia quando nessun token esiste');
    lost.close(); off.close();
});

// ── M6-A-8d: la chiusura del confine non abbandona un'acquisizione in corso ─────────────────────
test('chiusura durante un’acquisizione bloccata: il lease tardivo è rilasciato prima della chiusura', async () => {
    const f = databaseFixture({stall: true});
    const coordinator = lease.createOfflineMutationLeaseCoordinator({uid: UID, holderId: 'page-a',
        indexedDb: f.indexedDb, now: () => 1000, ttlMs: 30000, acquireTimeoutMs: 20});
    let ran = false;
    assert.equal(await rejection(() => coordinator.run(async () => { ran = true; })), 'LEASE_ACQUIRE_TIMEOUT');
    assert.equal(ran, false);
    const closing = coordinator.close(); // chiusura richiesta **mentre** l'acquisizione è in corso
    f.releaseStall();
    await closing;
    assert.equal(f.record().holderId, null, 'il lease tardivo è rilasciato prima della chiusura');
    assert.equal(f.record().expiresAt, 0);
    assert.deepEqual(writesOn(f.calls, 'encryptedOperations'), [], 'nessuna scrittura nella coda');
    // Controprova: senza acquisizione in corso la chiusura è immediata e non tocca nulla.
    const settled = databaseFixture();
    const idle = lease.createOfflineMutationLeaseCoordinator({uid: UID, holderId: 'page-b', indexedDb: settled.indexedDb});
    await idle.open();
    await idle.close();
    assert.equal(settled.record(), undefined, 'nessun lease creato da una chiusura a vuoto');
});
