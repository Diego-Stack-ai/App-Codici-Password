import {createOfflineMutationQueue, createOfflineQueueReader, deriveOfflineQueueKey, sealOfflineOperation} from './offline-mutation-queue.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';
import {createOfflineMutationClientCore} from './offline-mutation-client-core.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';

// [M6-A-8c] Banco browser (IndexedDB **reale**, dati sintetici, profilo usa e getta) del confine
// `withLease` del pilota account privato collegato al lease approvato in M6-A-8b: coda v2 **reale**
// con `encryptedOperations` e `queueLeases` nello stesso database, client e sincronizzatore reali,
// risolutore reale. Verifica la regola di adozione (Web Locks prioritario, opt-in spento = rifiuto
// invariato, opt-in acceso + API assente = lease), i rifiuti su coda assente/v1/malformato, la
// contesa fra due contesti, il rilascio dopo errore e l'assenza di qualsiasi falsa riuscita.
// Nessun Service Worker, nessuna PWA, nessun dato reale, nessun invio di rete.
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
const waitFor = async (predicate, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('LEASE_BENCH_WAIT');
};
const nameOf = uid => `codex-offline-queue-${uid}`;
const readLease = uid => requestValue(indexedDB.open(nameOf(uid))).then(database => {
    if (!database.objectStoreNames.contains('queueLeases')) { database.close(); return null; }
    return requestValue(database.transaction('queueLeases', 'readonly').objectStore('queueLeases').get(uid))
        .then(value => { database.close(); return value ?? null; });
});

let reported = false;
const report = async payload => {
    if (reported) return;
    reported = true;
    await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
};
setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL'}), 30000);

// Il confine del pilota: client e sincronizzatore **reali**, con il risolutore reale come `withLease`.
const buildClient = async ({uid, holderId, sent, states, send, leaseFallback = true, ...leaseOptions}) => createOfflineMutationClientCore({
    uid, vaultKeyMaterial: KEY, enabled: true,
    createQueue: options => createOfflineMutationQueue(options),
    createQueueReader: options => createOfflineQueueReader(options),
    createSynchronizer: createOfflineMutationSynchronizer,
    withLease: resolveOfflineQueueLease({uid, leaseFallback, holderId, ...leaseOptions}),
    createChannel: () => ({notify() {}, close() {}}),
    send, isOnline: () => true, onState: state => states.push(state)
});
const seed = async (uid, operationIds, {version = 2} = {}) => {
    if (version === 1) {
        const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
        for (const operationId of operationIds) {
            await queue.enqueue({uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`});
        }
        queue.close();
        return;
    }
    const key = await deriveOfflineQueueKey(KEY, uid);
    // I contenitori si sigillano **prima** della transazione: nessun `await` dentro una transazione
    // IndexedDB reale (si chiuderebbe da sola).
    const containers = [];
    for (const operationId of operationIds) {
        containers.push(await sealOfflineOperation({uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`}, key));
    }
    const database = await requestValue(indexedDB.open(nameOf(uid), 2));
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(['encryptedOperations', 'queueLeases'], 'readwrite');
            transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(transaction.error);
            for (const container of containers) transaction.objectStore('encryptedOperations').put(container);
        });
    } finally { database.close(); }
};

try {
    // ── Layout v2 reale ───────────────────────────────────────────────────────────────────
    const uid = `pilot-lease-${crypto.randomUUID()}`;
    const v1 = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await v1.enqueue({uid, operationId: 'device:seed', recordId: 'record-seed', value: 'fixture-seed'});
    v1.close();
    same((await upgradeQueueSchemaToV2({uid})).version, 2, 'PILOT_LEASE_UPGRADE');
    const layout = await inspectQueueSchema({uid});
    same([layout.version, layout.stores, layout.rows.length], [2, ['encryptedOperations', 'queueLeases'], 1], 'PILOT_LEASE_LAYOUT');
    // Stato iniziale della coda riportato a due operazioni sigillate reali.
    await seed(uid, ['device:1', 'device:2']);
    const seeded = await inspectQueueSchema({uid});
    same([seeded.version, seeded.rows.length], [2, 3], 'PILOT_LEASE_SEED');

    // ── 1. Web Locks presente: percorso di piattaforma, nessun record di lease ───────────
    assert(typeof navigator.locks?.request === 'function', 'PILOT_LEASE_WEB_LOCKS_EXPECTED');
    const platformSent = [], platformStates = [];
    const platformClient = await buildClient({uid, holderId: 'page-platform', sent: platformSent, states: platformStates,
        send: async operation => { platformSent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; }});
    const platformOutcome = await platformClient.flush();
    same(platformOutcome?.value?.status, 'saved', 'PILOT_LEASE_PLATFORM_FLUSH');
    same(platformSent.sort(), ['device:1', 'device:2', 'device:seed'], 'PILOT_LEASE_PLATFORM_SENT');
    same(await readLease(uid), null, 'PILOT_LEASE_PLATFORM_CREATED_LEASE');
    platformClient.close();
    passed.push('Web Locks **presente**: il confine resta quello di piattaforma e la sincronizzazione reale completa (due operazioni inviate e confermate) senza che venga creato alcun record in `queueLeases` — il lease IndexedDB non è nemmeno usato');

    // ── 2. Web Locks assente e opt-in spento: rifiuto invariato ─────────────────────────
    Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
    assert(typeof navigator.locks === 'undefined', 'PILOT_LEASE_LOCKS_NOT_REMOVED');
    await seed(uid, ['device:3']);
    const offSent = [];
    const offClient = await buildClient({uid, holderId: 'page-off', sent: offSent, states: [], leaseFallback: false,
        send: async operation => ({status: 'applied', operationId: operation.operationId})});
    same(await rejection(() => offClient.flush()), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', 'PILOT_LEASE_OFF');
    same(offSent, [], 'PILOT_LEASE_OFF_SENT');
    same(await readLease(uid), null, 'PILOT_LEASE_OFF_LEASE');
    offClient.close();
    passed.push('Web Locks **assente** e opt-in **spento**: il confine rifiuta con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, non invia nulla e non crea alcun lease (comportamento invariato del runtime)');

    // ── 3. Web Locks assente e opt-in acceso su v2: il lease regge il percorso reale ────
    const leasedSent = [], leasedStates = [];
    const leasedClient = await buildClient({uid, holderId: 'page-lease', sent: leasedSent, states: leasedStates,
        send: async operation => { leasedSent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; }});
    const leasedOutcome = await leasedClient.flush();
    same(leasedOutcome?.value?.status, 'saved', 'PILOT_LEASE_LEASED_FLUSH');
    same(leasedSent, ['device:3'], 'PILOT_LEASE_LEASED_SENT');
    const releasedLease = await readLease(uid);
    same([releasedLease.holderId, releasedLease.expiresAt, releasedLease.token], [null, 0, 1], 'PILOT_LEASE_RELEASED');
    same((await inspectQueueSchema({uid})).rows.length, 0, 'PILOT_LEASE_QUEUE_EMPTY');
    passed.push('Web Locks assente + opt-in acceso su layout v2 reale: la sincronizzazione si svolge sotto lease IndexedDB nello stesso database della coda e lo rilascia (`holderId:null`, `expiresAt:0`, token conservato); lo store `encryptedOperations` è scritto solo dalle conferme reali');

    // ── 4. Contesa fra due contesti reali ───────────────────────────────────────────────
    await seed(uid, ['device:4', 'device:5']);
    let release, entered = false;
    const gate = new Promise(resolve => { release = resolve; });
    const holderSent = [], otherSent = [];
    const holderClient = await buildClient({uid, holderId: 'page-holder', sent: holderSent, states: [],
        send: async operation => { entered = true; await gate; holderSent.push(operation.operationId); return {status: 'applied'}; }});
    const otherClient = await buildClient({uid, holderId: 'page-other', sent: otherSent, states: [],
        send: async operation => { otherSent.push(operation.operationId); return {status: 'applied'}; }});
    const holderRun = holderClient.flush();
    await waitFor(() => entered);
    same((await readLease(uid)).holderId, 'page-holder', 'PILOT_LEASE_HOLDER');
    same(await otherClient.flush(), {acquired: false, reason: 'LEASE_BUSY'}, 'PILOT_LEASE_BUSY');
    same(otherSent, [], 'PILOT_LEASE_BUSY_SENT');
    release();
    same((await holderRun)?.value?.status, 'saved', 'PILOT_LEASE_HOLDER_FLUSH');
    same(holderSent.sort(), ['device:4', 'device:5'], 'PILOT_LEASE_HOLDER_SENT');
    same((await readLease(uid)).holderId, null, 'PILOT_LEASE_HOLDER_RELEASED');
    passed.push('contesa fra due contesti reali sullo stesso database: mentre il primo tiene il lease il secondo riceve `{acquired:false}` senza inviare né scrivere; dopo il rilascio il primo completa e il lease torna libero');

    // ── 5. Rilascio dopo errore del trasporto ───────────────────────────────────────────
    await seed(uid, ['device:6']);
    const failingClient = await buildClient({uid, holderId: 'page-failing', sent: [], states: [],
        send: async () => { throw Object.assign(new Error('SYNTHETIC_TRANSPORT_FAILURE'), {code: 'SYNTHETIC_TRANSPORT_FAILURE'}); }});
    const failingOutcome = await failingClient.flush();
    same(failingOutcome?.value?.status, 'recoverable-error', 'PILOT_LEASE_ERROR_STATUS');
    same((await readLease(uid)).holderId, null, 'PILOT_LEASE_ERROR_RELEASE');
    same((await inspectQueueSchema({uid})).rows.length, 1, 'PILOT_LEASE_ERROR_QUEUE');
    const recoveredSent = [];
    const recoveredClient = await buildClient({uid, holderId: 'page-recovered', sent: recoveredSent, states: [],
        send: async operation => { recoveredSent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; }});
    same((await recoveredClient.flush())?.value?.status, 'saved', 'PILOT_LEASE_RECOVERED');
    same(recoveredSent, ['device:6'], 'PILOT_LEASE_RECOVERED_SENT');
    same((await readLease(uid)).holderId, null, 'PILOT_LEASE_RECOVERED_RELEASE');
    passed.push('errore del trasporto: il sincronizzatore reale riporta `recoverable-error`, il lease viene rilasciato, l’operazione resta in coda e un contesto successivo la invia e la conferma — nessuna riuscita ambigua');

    // ── 6. R1: fencing atomico — un titolare scaduto non conferma e non rimuove ──────────
    await seed(uid, ['device:7']);
    let clock = Date.now();
    const staleSent = [];
    const staleClient = await buildClient({uid, holderId: 'page-stale', sent: staleSent, states: [], ttlMs: 50,
        now: () => clock,
        send: async operation => { staleSent.push(operation.operationId); clock += 1000; return {status: 'applied', operationId: operation.operationId}; }});
    same(await rejection(() => staleClient.flush()), 'LEASE_LOST', 'PILOT_LEASE_R1_STALE');
    same(staleSent, ['device:7'], 'PILOT_LEASE_R1_SENT');
    same((await inspectQueueSchema({uid})).rows.length, 1, 'PILOT_LEASE_R1_REMOVED');
    const takeoverSent = [];
    // Lo stesso orologio del titolare scaduto: il record è oltre il TTL, quindi il subentro è lecito.
    const takeoverClient = await buildClient({uid, holderId: 'page-takeover', sent: takeoverSent, states: [],
        now: () => clock,
        send: async operation => { takeoverSent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; }});
    same((await takeoverClient.flush())?.value?.status, 'saved', 'PILOT_LEASE_R1_TAKEOVER');
    same(takeoverSent, ['device:7'], 'PILOT_LEASE_R1_TAKEOVER_SENT');
    same((await inspectQueueSchema({uid})).rows.length, 0, 'PILOT_LEASE_R1_TAKEOVER_REMOVED');
    staleClient.close();
    takeoverClient.close();
    passed.push('R1 fencing atomico su IndexedDB reale: con il titolare scaduto oltre il TTL la conferma è rifiutata con `LEASE_LOST`, l’operazione **non** viene rimossa e il vecchio titolare non dichiara alcuna riuscita; il nuovo titolare subentra e completa invio e conferma');

    // ── 7. Coda v1 reale e coda assente: fail-closed, nessun upgrade ─────────────────────
    const v1Uid = `pilot-lease-v1-${crypto.randomUUID()}`;
    const v1Queue = await createOfflineMutationQueue({uid: v1Uid, vaultKeyMaterial: KEY});
    await v1Queue.enqueue({uid: v1Uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture'});
    v1Queue.close();
    const v1Before = await inspectQueueSchema({uid: v1Uid});
    const v1Sent = [];
    const v1Client = await buildClient({uid: v1Uid, holderId: 'page-v1', sent: v1Sent, states: [],
        send: async operation => { v1Sent.push(operation.operationId); return {status: 'applied'}; }});
    same(await rejection(() => v1Client.flush()), 'LEASE_SCHEMA_V1', 'PILOT_LEASE_V1');
    same(v1Sent, [], 'PILOT_LEASE_V1_SENT');
    const v1After = await inspectQueueSchema({uid: v1Uid});
    same([v1After.version, v1After.stores, v1After.rows.length], [1, ['encryptedOperations'], 1], 'PILOT_LEASE_V1_CHANGED');
    same(JSON.stringify(v1After.rows), JSON.stringify(v1Before.rows), 'PILOT_LEASE_V1_ROWS');
    v1Client.close();
    const absentUid = `pilot-lease-absent-${crypto.randomUUID()}`;
    // Sonda diretta del risolutore: il percorso del client **creerebbe** la coda assente (lo
    // scrittore v1 la fa nascere), quindi il rifiuto si prova dove il contratto lo prevede.
    const absentResolver = resolveOfflineQueueLease({uid: absentUid, leaseFallback: true, holderId: 'page-absent'});
    let absentRan = false;
    same(await rejection(() => absentResolver(absentUid, async () => { absentRan = true; })), 'LEASE_DATABASE_MISSING', 'PILOT_LEASE_ABSENT');
    assert(!absentRan, 'PILOT_LEASE_ABSENT_RAN');
    assert(!(await indexedDB.databases()).map(entry => entry.name).includes(nameOf(absentUid)), 'PILOT_LEASE_ABSENT_CREATED');
    same((await inspectQueueSchema({uid})).version, 2, 'PILOT_LEASE_MAIN_VERSION');
    passed.push('coda **v1 reale** e coda **assente**: il confine del pilota fallisce chiuso con `LEASE_SCHEMA_V1` e `LEASE_DATABASE_MISSING`, non invia nulla, non crea database e **non** esegue l’upgrade (la coda resta v1 con le stesse righe: l’upgrade M6-A-7 resta separato e non automatico)');

    holderClient.close();
    otherClient.close();
    failingClient.close();
    recoveredClient.close();
    leasedClient.close();
    await report({ok: true, passed, browser: navigator.userAgent, webLocks: 'rimossa dopo il primo scenario'});
} catch (error) {
    await report({ok: false, passed, code: codeOf(error), detail: detailOf(error)});
}
