import {createOfflineMutationQueue, deriveOfflineQueueKey, openOfflineOperation, readOfflineQueueContainers,
    sealOfflineOperation, withOfflineQueueLease} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';
import {inspectQueueSchema, upgradeQueueSchemaToV2} from './queue-upgrade-v2.mjs';

// M6-A-4 — laboratorio: convivenza e upgrade con **due schede reali** nello stesso profilo e
// stessa origine (due tab, non pagina + Worker). La scheda **vecchia** esegue il comportamento
// della build v1 attuale e mantiene una coda v1 con operazioni sigillate pendenti; la scheda
// **candidata** chiede l'upgrade additivo a v2. Non monta nulla dell'app: `Frontend/public/**`,
// PWA, Rules, Functions e dati reali restano invariati.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const CHANNEL = 'codex-m6-a4-two-tabs';
const PEER = globalThis.location?.hash === '#peer';
const nativeLocks = globalThis.navigator?.locks;
const setLocks = value => Object.defineProperty(navigator, 'locks', {value, configurable: true});
const queueName = uid => `codex-offline-queue-${uid}`;
const newUid = label => `two-tabs-${label}-${crypto.randomUUID()}`;
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const codeOf = error => error?.code || (error?.name && error.name !== 'Error' ? error.name : error?.message);
const assert = (value, code) => { if (!value) throw new Error(code); };
const same = (value, expected, code) => assert(JSON.stringify(value) === JSON.stringify(expected), code);
const sameOutcome = (actual, expected, code) => assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${code}:${JSON.stringify(actual)}`);
const rejection = async task => { try { await task(); return null; } catch (error) { return codeOf(error); } };
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const containerIds = async uid => (await readOfflineQueueContainers({uid})).containers.map(row => row.operationId).sort();
const sealFor = async (uid, operationId, value) => sealOfflineOperation(
    {uid, operationId, recordId: `record-${operationId}`, value}, await deriveOfflineQueueKey(KEY, uid));
// Scrittura grezza di un contenitore sigillato: è il "processo" di laboratorio dentro la sezione
// critica del protocollo in prova (nessun percorso di accodamento dell'app è montato qui).
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
const decrypted = async uid => {
    const key = await deriveOfflineQueueKey(KEY, uid);
    const operations = [];
    for (const container of (await readOfflineQueueContainers({uid})).containers) {
        operations.push(await openOfflineOperation(container, key, uid));
    }
    return operations;
};
// Coda v1 reale creata dalla build v1 attuale, con due operazioni pendenti di cui una in
// riconciliazione. Restituisce solo la descrizione attesa: i contenitori restano nel database.
const createV1Queue = async uid => {
    const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
    await queue.enqueue({uid, operationId: 'device:1', recordId: 'record-1', value: 'fixture-1'});
    await queue.enqueue({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'});
    await queue.markForReview({uid, operationId: 'device:2', recordId: 'record-2', value: 'fixture-2'},
        {reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
    return queue;
};

// ─────────────────────────── ruolo SCHEDA VECCHIA (peer) ───────────────────────────
if (PEER) {
    const channel = new BroadcastChannel(CHANNEL);
    let heldQueue = null, heldRaw = null, gate = null, heldRun = null;
    const handlePeer = async (op, args, id) => {
        switch (op) {
            case 'create': {
                heldQueue = await createV1Queue(args.uid);
                if (args.mode === 'retained') {
                    // Copia vecchia che **non collabora**: connessione v1 grezza trattenuta, senza
                    // alcuna reazione a `versionchange`; l'handle della build v1 viene chiuso.
                    heldRaw = await requestValue(indexedDB.open(queueName(args.uid), 1));
                    heldQueue.close(); heldQueue = null;
                }
                return {mode: args.mode};
            }
            case 'probe-closed': {
                // Osservazione **comportamentale** sulla connessione della build v1: se la reazione
                // a `versionchange` l'ha chiusa, qualunque transazione successiva fallisce.
                try {
                    if (heldRaw) heldRaw.transaction('encryptedOperations');
                    else await heldQueue.list();
                    return {error: null};
                } catch (error) { return {error: error.name}; }
            }
            case 'close-held': {
                heldRaw?.close(); heldRaw = null; heldQueue?.close(); heldQueue = null;
                return {closed: true};
            }
            case 'old-open': {
                // Build v1 attuale su una coda già v2.
                try { const queue = await createOfflineMutationQueue({uid: args.uid, vaultKeyMaterial: KEY}); queue.close(); return {error: null}; }
                catch (error) { return {error: error.name || codeOf(error)}; }
            }
            case 'old-list': {
                // La copia vecchia continua a leggere la **sua** coda v1 mentre l'upgrade è bloccato.
                if (heldRaw) {
                    const rows = await requestValue(heldRaw.transaction('encryptedOperations', 'readonly')
                        .objectStore('encryptedOperations').getAll());
                    return rows.map(row => row.operationId).sort();
                }
                return (await heldQueue.list()).map(operation => operation.operationId).sort();
            }
            case 'v1-attempt': {
                try {
                    const outcome = await withOfflineQueueLease(args.uid, async () => {
                        await writeSealed(args.uid, await sealFor(args.uid, args.operationId, 'peer'));
                        return args.operationId;
                    });
                    return outcome;
                } catch (error) { return {error: codeOf(error)}; }
            }
            case 'v1-hold': {
                // Risposta **immediata**: l'ingresso nella sezione critica arriva come evento
                // separato, così la scheda candidata può tentare mentre il lock è tenuto.
                heldRun = withOfflineQueueLease(args.uid, async () => {
                    channel.postMessage({id, held: true});
                    await new Promise(resolve => { gate = resolve; });
                    await writeSealed(args.uid, await sealFor(args.uid, args.operationId, 'peer'));
                    return args.operationId;
                });
                heldRun.catch(() => {});
                return {holding: true};
            }
            case 'release': {
                gate?.(); gate = null;
                await heldRun?.catch(() => {});
                heldRun = null;
                return {released: true};
            }
            case 'hybrid-attempt': {
                const database = await requestValue(indexedDB.open(queueName(args.uid)));
                try {
                    const coordinator = createHybridQueueCoordinator({database, uid: args.uid, holderId: 'peer-tab',
                        locks: args.bridge ? navigator.locks : null});
                    return await coordinator.run(async context => {
                        const container = await sealFor(args.uid, args.operationId, 'peer');
                        await new Promise((resolve, reject) => {
                            const tx = database.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                            tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('PEER_WRITE_ABORTED'));
                            context.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); }, error => reject(error));
                        });
                        return args.operationId;
                    });
                } catch (error) { return {error: codeOf(error)}; } finally { database.close(); }
            }
            case 'strip-locks': {
                setLocks(undefined);
                return {webLocks: typeof navigator.locks};
            }
            default: throw new Error(`PEER_OP_UNKNOWN:${op}`);
        }
    };
    channel.onmessage = async ({data}) => {
        if (!data?.op) return;
        try { channel.postMessage({id: data.id, ok: true, result: await handlePeer(data.op, data.args, data.id)}); }
        catch (error) { channel.postMessage({id: data.id, ok: false, error: codeOf(error), name: error?.name,
            detail: error?.message, where: (error?.stack || '').split('`n')[1]?.trim()}); }
    };
    await new Promise(resolve => {
        if (document.readyState === 'complete') resolve(); else addEventListener('load', resolve, {once: true});
    });
    channel.postMessage({type: 'peer-ready'});
} else {
    // ─────────────────────────── ruolo SCHEDA CANDIDATA (main) ───────────────────────────
    const passed = [];
    let reported = false, stage = 'start';
    const report = async payload => {
        if (reported) return;
        reported = true;
        await fetch('/result', {method: 'POST', body: JSON.stringify(payload)});
    };
    setTimeout(() => report({ok: false, passed, code: 'BENCH_STALL', stage}), 30000);
    const channel = new BroadcastChannel(CHANNEL);
    const pending = new Map(), heldWaiters = new Map();
    let peerReady = null;
    const ready = new Promise(resolve => { peerReady = resolve; });
    channel.onmessage = ({data}) => {
        if (data?.type === 'peer-ready') { peerReady(); return; }
        if (data?.held && heldWaiters.has(data.id)) { heldWaiters.get(data.id)(); heldWaiters.delete(data.id); return; }
        const settle = pending.get(data?.id);
        if (settle) { pending.delete(data.id); settle(data); }
    };
    const peer = (op, args = {}) => new Promise(resolve => {
        const id = crypto.randomUUID();
        pending.set(id, resolve);
        channel.postMessage({id, op, args});
    });
    // peerHold: attende che la scheda vecchia sia **entrata** nella sezione critica (evento
    // separato dalla risposta) e restituisce il rilascio esplicito.
    const peerHold = async (op, args = {}) => {
        const id = crypto.randomUUID();
        const held = new Promise(resolve => heldWaiters.set(id, resolve));
        const reply = new Promise(resolve => pending.set(id, resolve));
        channel.postMessage({id, op, args});
        await Promise.race([held, sleep(5000).then(() => { throw new Error(`PEER_${op.toUpperCase()}_NOT_HELD`); })]);
        return {release: async () => {
            const message = await peer('release', {});
            assert(message?.ok === true, `PEER_RELEASE_FAILED:${message?.error || 'NO_REPLY'}`);
            await reply;
        }};
    };
    const peerResult = async (op, args) => {
        const message = await peer(op, args);
        assert(message?.ok === true, `PEER_${op.toUpperCase()}_FAILED:${message?.error || 'NO_REPLY'}:${message?.detail || ''}:${message?.where || ''}`);
        return message.result;
    };
    const coordinatorRunOn = (database, uid, holderId, bridge) => createHybridQueueCoordinator(
        {database, uid, holderId, locks: bridge ? navigator.locks : null});
    const coordinatorRun = async (uid, {bridge, operationId, holderId = 'main-tab'}) => {
        const database = await requestValue(indexedDB.open(queueName(uid)));
        try {
            return await coordinatorRunOn(database, uid, holderId, bridge).run(async context => {
                const container = await sealFor(uid, operationId, 'main');
                await new Promise((resolve, reject) => {
                    const tx = database.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('MAIN_WRITE_ABORTED'));
                    context.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); }, error => reject(error));
                });
                return operationId;
            });
        } finally { database.close(); }
    };
    const startMainHold = async (uid, operationId, {bridge}) => {
        const database = await requestValue(indexedDB.open(queueName(uid)));
        let enter, release;
        const entered = new Promise(resolve => { enter = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        const result = coordinatorRunOn(database, uid, 'main-tab', bridge).run(async context => {
            enter(true);
            await gate;
            const container = await sealFor(uid, operationId, 'main');
            await new Promise((resolve, reject) => {
                const tx = database.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('MAIN_HOLD_WRITE_ABORTED'));
                context.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); }, error => reject(error));
            });
            return operationId;
        });
        return {entered, result, release: () => release(), close: () => database.close()};
    };
    // Coda v1 con una operazione pendente, portata a v2 dal candidato: **nessun retry**.
    const upgradedQueue = async label => {
        const uid = newUid(label);
        const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY});
        await queue.enqueue({uid, operationId: 'seed', recordId: 'record-seed', value: 'seed'});
        queue.close();
        try { same((await upgradeQueueSchemaToV2({uid})).version, 2, `PREPARE_${label}_VERSION`); }
        catch (error) { throw new Error(`PREPARE_${label}_INTERNAL_BLOCK:${codeOf(error)}`); }
        return uid;
    };

    try {
        assert(typeof nativeLocks?.request === 'function', 'MAIN_WEB_LOCKS_MISSING');
        // Seconda **scheda reale** nello stesso profilo e nella stessa origine: `#peer` la fa
        // riconoscere come scheda vecchia. Il runner disattiva il blocco dei popup in questa modalità.
        const peerTab = window.open('/#peer', '_blank');
        assert(peerTab, 'PEER_TAB_BLOCKED');
        await Promise.race([ready, sleep(5000).then(() => { throw new Error('PEER_TAB_MISSING'); })]);

        // ── (a) La scheda vecchia reagisce a `versionchange` chiudendosi: upgrade riuscito ──
        const uidA = newUid('cooperative');
        stage = 'a:peer-create';
        await peerResult('create', {uid: uidA, mode: 'cooperative'});
        const beforeA = await inspectQueueSchema({uid: uidA});
        same([beforeA.version, beforeA.rows.length], [1, 2], 'A_BEFORE');
        stage = 'a:upgrade';
        same((await upgradeQueueSchemaToV2({uid: uidA})).version, 2, 'A_UPGRADE_VERSION');
        const afterA = await inspectQueueSchema({uid: uidA});
        same([afterA.version, afterA.stores], [2, ['encryptedOperations', 'queueLeases']], 'A_AFTER_SCHEMA');
        same(canonical(afterA.rows), canonical(beforeA.rows), 'A_ROWS_CHANGED');
        stage = 'a:probe-closed';
        same((await peerResult('probe-closed', {})).error, 'InvalidStateError', 'A_OLD_CONNECTION_NOT_CLOSED');
        const afterReadA = await readOfflineQueueContainers({uid: uidA});
        same([afterReadA.version, afterReadA.containers.map(row => row.operationId).sort()],
            [2, ['device:1', 'device:2']], 'A_READER');
        const operationsA = await decrypted(uidA);
        same(operationsA.find(operation => operation.operationId === 'device:2')._queueState, 'reconciliation-required', 'A_REVIEW_LOST');
        passed.push('(a) due schede reali, connessione vecchia cooperativa: al cambio versione la connessione della scheda vecchia si chiude da sola (`InvalidStateError` sulla sua transazione successiva), l’upgrade a v2 riesce e le due operazioni sigillate restano identiche e leggibili dal lettore, compreso lo stato di riconciliazione');

        // ── (b) Connessione vecchia **trattenuta**: blocco deliberato, poi recupero ─────────
        const uidB = newUid('retained');
        stage = 'b:peer-create';
        await peerResult('create', {uid: uidB, mode: 'retained'});
        stage = 'b:inspect';
        const beforeB = await inspectQueueSchema({uid: uidB});
        stage = 'b:blocked-upgrade';
        same(await rejection(() => upgradeQueueSchemaToV2({uid: uidB})), 'QUEUE_UPGRADE_BLOCKED', 'B_NOT_BLOCKED');
        // La richiesta di cambio versione resta **in sospeso**: finché la copia vecchia non
        // rilascia, un'apertura senza versione da questa scheda non fallisce, **attende**. Il
        // lettore ha un limite di tempo, quindi si osserva un timeout — non una coda corrotta.
        stage = 'b:reader-while-blocked';
        same(await rejection(() => readOfflineQueueContainers({uid: uidB, timeoutMs: 1500})), 'QUEUE_READER_TIMEOUT', 'B_READER_WHILE_BLOCKED');
        // Nessuna perdita: la copia vecchia continua a leggere la sua coda v1.
        stage = 'b:old-copy-reads';
        sameOutcome(await peerResult('old-list', {}), ['device:1', 'device:2'], 'B_OLD_COPY_LOST_QUEUE');
        stage = 'b:close-held';
        await peerResult('close-held', {});
        // Dopo il rilascio la richiesta in sospeso viene annullata dalla guardia approvata in R1.
        stage = 'b:after-release';
        const blockedB = await inspectQueueSchema({uid: uidB});
        same([blockedB.version, blockedB.stores], [1, ['encryptedOperations']], 'B_BLOCKED_CHANGED_SCHEMA');
        same(canonical(blockedB.rows), canonical(beforeB.rows), 'B_BLOCKED_ROWS_CHANGED');
        same(await containerIds(uidB), ['device:1', 'device:2'], 'B_BLOCKED_LOST_OR_DUPLICATED');
        same((await readOfflineQueueContainers({uid: uidB})).version, 1, 'B_BLOCKED_READER');
        stage = 'b:recovery';
        same((await upgradeQueueSchemaToV2({uid: uidB})).version, 2, 'B_RECOVERY_VERSION');
        const afterB = await inspectQueueSchema({uid: uidB});
        same(canonical(afterB.rows), canonical(beforeB.rows), 'B_RECOVERY_ROWS_CHANGED');
        same(await containerIds(uidB), ['device:1', 'device:2'], 'B_RECOVERY_DUPLICATED');
        passed.push('(b) connessione vecchia deliberatamente trattenuta: l’upgrade viene riportato come `QUEUE_UPGRADE_BLOCKED` (blocco **deliberato**) e la richiesta resta in sospeso, quindi la scheda candidata **non riesce nemmeno a leggere** la coda mentre la copia vecchia tiene la connessione (`QUEUE_READER_TIMEOUT` dal limite del lettore, nessun blocco infinito); la copia vecchia continua invece a leggere le sue due operazioni — nessuna perdita, nessuna duplicazione, nessuna scrittura; dopo il rilascio la coda resta a versione 1 con le stesse operazioni e un nuovo upgrade riesce');

        // ── (c) La vecchia build sullo schema v2 fallisce in modo dichiarato ───────────────
        stage = 'c:old-open';
        const oldOnV2 = await peerResult('old-open', {uid: uidA});
        same(oldOnV2.error, 'VersionError', 'C_NOT_DECLARED');
        const afterC = await inspectQueueSchema({uid: uidA});
        same(canonical(afterC.rows), canonical(beforeA.rows), 'C_ROWS_CHANGED');
        same(await containerIds(uidA), ['device:1', 'device:2'], 'C_OPERATIONS_LOST');
        const operationsC = await decrypted(uidA);
        same([operationsC.find(operation => operation.operationId === 'device:2')._queueState,
            operationsC.find(operation => operation.operationId === 'device:2')._reviewReason],
        ['reconciliation-required', 'LEGACY_MUTATION_RESULT_UNVERIFIED'], 'C_MARKED_SAVED');
        passed.push('(c) la build vecchia che apre una coda già v2 fallisce con `VersionError` dichiarato: le due operazioni restano al loro posto e quella in riconciliazione conserva `_queueState` e `_reviewReason` — nessuna operazione risulta segnata come salvata');

        // ── D. Ponte Web Locks fra le due schede (novità rispetto al Worker) ───────────────
        stage = 'd1';
        const uidD = await upgradedQueue('bridge');
        const holdD1 = await peerHold('v1-hold', {uid: uidD, operationId: 'peer-d1'});
        sameOutcome(await coordinatorRun(uidD, {bridge: true, operationId: 'main-d1'}), {acquired: false}, 'D1_NOT_EXCLUDED');
        same(await containerIds(uidD), ['seed'], 'D1_CANDIDATE_WROTE');
        await holdD1.release();
        stage = 'd2';
        const uidD2 = await upgradedQueue('bridge-hold');
        const holding = await startMainHold(uidD2, 'main-d2', {bridge: true});
        await holding.entered;
        sameOutcome(await peerResult('v1-attempt', {uid: uidD2, operationId: 'peer-d2'}), {acquired: false}, 'D2_NOT_EXCLUDED');
        holding.release(); await holding.result; holding.close();
        same(await containerIds(uidD2), ['main-d2', 'seed'], 'D2_OLD_TAB_WROTE');
        passed.push('D1/D2 ponte Web Locks fra **due schede**: con la scheda vecchia che tiene il lock di piattaforma il candidato non esegue ({acquired:false}) e non scrive; con il candidato che tiene lock e lease la scheda vecchia non esegue e non scrive');

        stage = 'd3';
        const uidD3 = await upgradedQueue('bridge-hole');
        const holdD3 = await peerHold('v1-hold', {uid: uidD3, operationId: 'peer-d3'});
        sameOutcome(await coordinatorRun(uidD3, {bridge: false, operationId: 'main-d3'}),
            {acquired: true, value: 'main-d3'}, 'D3_NOT_ADMITTED');
        await holdD3.release();
        // Entrambe le schede scrivono: la candidata **fuori** dal lock di piattaforma, la vecchia
        // dentro la sua sezione critica — è la sovrapposizione dei due protocolli.
        same(await containerIds(uidD3), ['main-d3', 'peer-d3', 'seed'], 'D3_WRITES_MISSING');
        passed.push('D3 controllo discriminante fra due schede: **senza ponte** (solo lease) il candidato esegue mentre la scheda vecchia tiene il lock di piattaforma — il solo lease non garantisce la convivenza, come già visto con il Worker');

        // ── E. Assenza reale di Web Locks nelle due schede ────────────────────────────────
        stage = 'e';
        const uidE = await upgradedQueue('absent');
        setLocks(undefined);
        same(typeof navigator.locks, 'undefined', 'E_MAIN_LOCKS_NOT_REMOVED');
        same((await peerResult('strip-locks', {})).webLocks, 'undefined', 'E_PEER_LOCKS_NOT_REMOVED');
        same(await rejection(() => withOfflineQueueLease(uidE, async () => 'no')), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE', 'E_MAIN_V1');
        sameOutcome(await peerResult('v1-attempt', {uid: uidE, operationId: 'peer-e'}), {error: 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE'}, 'E_PEER_V1');
        same(await containerIds(uidE), ['seed'], 'E_V1_WROTE');
        const leaseHolding = await startMainHold(uidE, 'main-e', {bridge: false});
        await leaseHolding.entered;
        sameOutcome(await peerResult('hybrid-attempt', {uid: uidE, bridge: false, operationId: 'peer-e2'}),
            {acquired: false}, 'E_LEASE_NOT_EXCLUSIVE');
        leaseHolding.release(); await leaseHolding.result; leaseHolding.close();
        same(await containerIds(uidE), ['main-e', 'seed'], 'E_WRITES_MISSING');
        setLocks(nativeLocks);
        passed.push('E assenza **reale** di Web Locks in entrambe le schede (API rimossa nei due realm): la scheda vecchia rifiuta in entrambe con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` senza scrivere, mentre il candidato usa solo il lease — esegue ed esclude l’altro candidato');

        await report({ok: true, passed, browser: navigator.userAgent, peerWebLocks: typeof navigator.locks});
    } catch (error) {
        setLocks(nativeLocks);
        await report({ok: false, passed, code: codeOf(error), stage});
    }
}
