import {createOfflineMutationQueue, createOfflineQueueReader} from './offline-mutation-queue.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';
import {createOfflineMutationClientCore} from './offline-mutation-client-core.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';

// [M6-A-8d] Secondo contesto **reale** del pilota lease: un Worker dedicato che usa gli stessi moduli
// runtime approvati sotto `Frontend/public/**` (coda, lettore compatibile, sincronizzatore,
// client-core e risolutore del lease) — **nessun adattatore runtime nuovo** e nessun candidato di
// `experiments/` come implementazione. Il Worker rimuove davvero `navigator.locks` nel proprio realm
// e non riceve alcuna opzione `locks`: il risolutore legge l'API a ogni chiamata, quindi il ramo
// usato è quello del lease IndexedDB. Il file espone una **factory** perché la stessa logica sia
// pilotabile dalle prove Node con una IndexedDB in memoria; nel browser l'istanza è collegata a
// `self.postMessage`.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const codeOf = error => error?.code || (error?.name && error.name !== 'Error' ? error.name : error?.message || 'WORKER_ERROR');

export function createPilotLeaseWorker({post, indexedDb = globalThis.indexedDB} = {}) {
    if (typeof post !== 'function' || !indexedDb) throw new Error('PILOT_LEASE_WORKER_CONFIG');
    let releaseGate = null;
    const queueFor = options => createOfflineMutationQueue({...options, indexedDb});
    const readerFor = options => createOfflineQueueReader({...options, indexedDb});
    const boundaryFor = ({uid, holderId, now, ttlMs = 30000, acquireTimeoutMs = 10000, isActive}) =>
        resolveOfflineQueueLease({uid, leaseFallback: true, holderId, indexedDb, now, ttlMs, acquireTimeoutMs, isActive});
    const readQueue = async uid => (await readerFor({uid, vaultKeyMaterial: KEY})).read();
    const operationIds = async uid => {
        try {
            const result = await readQueue(uid);
            return result.available ? result.operations.map(operation => operation.operationId).sort() : `unavailable:${result.reason}`;
        } catch (error) { return `unavailable:${codeOf(error)}:${error?.message ?? ''}`; }
    };
    const expectedOperation = async (uid, operationId) => {
        const result = await readQueue(uid);
        if (!result.available) throw Object.assign(new Error(result.reason || 'QUEUE_UNAVAILABLE'), {code: result.reason || 'QUEUE_UNAVAILABLE'});
        const expected = result.operations.find(operation => operation.operationId === operationId);
        if (!expected) throw Object.assign(new Error('WORKER_OPERATION_MISSING'), {code: 'WORKER_OPERATION_MISSING'});
        return expected;
    };
    const transport = behaviour => (behaviour === 'fail'
        ? async () => { throw Object.assign(new Error('SYNTHETIC_TRANSPORT_FAILURE'), {code: 'SYNTHETIC_TRANSPORT_FAILURE'}); }
        : async operation => ({status: 'applied', operationId: operation.operationId}));
    const buildClient = ({uid, holderId, now, ttlMs, acquireTimeoutMs, behaviour}) => createOfflineMutationClientCore({
        uid, vaultKeyMaterial: KEY, enabled: true,
        createQueue: queueFor, createQueueReader: readerFor, createSynchronizer: createOfflineMutationSynchronizer,
        withLease: boundaryFor({uid, holderId, now, ttlMs, acquireTimeoutMs}),
        createChannel: () => ({notify() {}, close() {}}),
        send: transport(behaviour), isOnline: () => true, onState: () => {}
    });
    // Mutazione della coda **sotto il token**: la stessa transazione verifica il lease e scrive.
    async function performMutation({uid, action, operationId, replacementOperationId, lease, isActive = () => true}) {
        const queue = await queueFor({uid, vaultKeyMaterial: KEY, isActive});
        try {
            if (action === 'enqueue') {
                await queue.enqueue({uid, operationId, recordId: `record-${operationId}`, value: 'worker'}, {isActive, lease});
                return {action, status: 'enqueued'};
            }
            const expected = await expectedOperation(uid, operationId);
            if (action === 'replace') {
                await queue.replace(expected, {...expected, operationId: replacementOperationId, value: 'replaced'}, {isActive, lease});
                return {action, status: 'replaced'};
            }
            if (action === 'markForReview') {
                await queue.markForReview(expected, {isActive, lease});
                return {action, status: 'marked'};
            }
            if (action === 'remove') {
                await queue.remove(expected, {isActive, lease});
                return {action, status: 'removed'};
            }
            throw Object.assign(new Error('WORKER_ACTION_INVALID'), {code: 'WORKER_ACTION_INVALID'});
        } finally { queue.close(); }
    }

    async function handle(data) {
        const id = data?.id;
        const reply = payload => post({...payload, id});
        if (data?.release) { const gate = releaseGate; releaseGate = null; gate?.(); return; }
        let clock = data?.now ?? 0;
        const now = () => clock;
        const {uid, holderId} = data ?? {};
        const boundaryOptions = {uid, holderId, now, ttlMs: data?.ttlMs, acquireTimeoutMs: data?.acquireTimeoutMs};
        try {
            if (data?.op === 'ping') { reply({ok: true, webLocks: typeof globalThis.navigator?.locks}); return; }
            // Per il caso bloccato la fotografia **prima** non si legge: il lettore compatibile apre
            // una transazione che comprende lo store del lease e resterebbe in coda dietro il blocco
            // deliberato, spostando l'acquisizione oltre la scadenza.
            const before = data.op === 'blocked' ? null : await operationIds(uid);
            if (data.op === 'mutate') {
                // Le quattro mutazioni della coda, tutte sotto lo **stesso** confine: la verifica del
                // token e la scrittura stanno nella stessa transazione.
                const withLease = boundaryFor(boundaryOptions);
                try {
                    const outcome = await withLease(uid, lease => performMutation({...data, lease}));
                    reply({ok: true, outcome, before, after: await operationIds(uid)});
                } finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'client-enqueue') {
                // Superficie del **pilota**: `client.enqueue` accoda e poi sincronizza (conferma sotto
                // token), quindi la coda risulta vuota a operazione confermata.
                const client = await buildClient({...boundaryOptions, behaviour: data.send});
                try {
                    const outcome = await client.enqueue({uid, operationId: data.operationId,
                        recordId: `record-${data.operationId}`, value: 'worker'});
                    reply({ok: true, outcome, before, after: await operationIds(uid)});
                } finally { client.close(); }
                return;
            }
            if (data.op === 'hold') {
                const withLease = boundaryFor(boundaryOptions);
                let ran = false;
                try {
                    const outcome = await withLease(uid, async lease => {
                        reply({event: 'held', token: lease?.token ?? null});
                        await new Promise(resolve => { releaseGate = resolve; });
                        if (data.advanceTo !== undefined) clock = data.advanceTo;
                        ran = true;
                        if (!data.action) return {token: lease?.token ?? null};
                        return {token: lease?.token ?? null, mutation: await performMutation({...data, lease})};
                    });
                    reply({ok: true, outcome, ran, before, after: await operationIds(uid)});
                } catch (error) { reply({ok: false, code: codeOf(error), ran, before, after: await operationIds(uid)}); }
                finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'blocked' || data.op === 'probe') {
                const withLease = boundaryFor(data.op === 'blocked'
                    ? {...boundaryOptions, acquireTimeoutMs: data.acquireTimeoutMs ?? 60} : boundaryOptions);
                let ran = false;
                try {
                    const outcome = await withLease(uid, async lease => { ran = true; return {token: lease?.token ?? null}; });
                    reply({ok: true, outcome, ran, before, after: data.op === 'blocked' ? null : await operationIds(uid)});
                } catch (error) { reply({ok: false, code: codeOf(error), ran, before, after: data.op === 'blocked' ? null : await operationIds(uid)}); }
                finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'failing') {
                const withLease = boundaryFor(boundaryOptions);
                let ran = false;
                try {
                    await withLease(uid, async () => { ran = true; throw Object.assign(new Error('SYNTHETIC_TASK_FAILURE'), {code: 'SYNTHETIC_TASK_FAILURE'}); });
                    reply({ok: true, before, after: await operationIds(uid)});
                } catch (error) { reply({ok: false, code: codeOf(error), ran, before, after: await operationIds(uid)}); }
                finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'session') {
                // `during: true` = sessione attiva che cade **dentro** il task; altrimenti la sessione
                // è già scaduta prima del confine.
                let active = data.during === true;
                let ran = false;
                const withLease = boundaryFor({...boundaryOptions, isActive: () => active});
                try {
                    const outcome = await withLease(uid, async () => { ran = true; if (data.during === true) active = false; return 'ran'; });
                    reply({ok: true, outcome, ran, before, after: await operationIds(uid)});
                } catch (error) { reply({ok: false, code: codeOf(error), ran, before, after: await operationIds(uid)}); }
                finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'flush') {
                const client = await buildClient({...boundaryOptions, behaviour: data.send});
                try {
                    const outcome = await client.flush();
                    reply({ok: true, outcome, before, after: await operationIds(uid)});
                } finally { client.close(); }
                return;
            }
            reply({ok: false, code: 'WORKER_OP_UNKNOWN'});
        } catch (error) {
            reply({ok: false, code: codeOf(error), detail: String(error?.stack || '').slice(0, 240)});
        }
    }
    return {handle};
}

// Nel browser il Worker rimuove **davvero** Web Locks nel proprio realm *prima* di costruire
// qualsiasi confine, e collega la factory a `postMessage`. Con `navigator.locks` assente il
// risolutore usa il lease IndexedDB (l'API è letta a ogni chiamata).
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.addEventListener === 'function') {
    Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
    const worker = createPilotLeaseWorker({post: message => self.postMessage(message)});
    if (typeof navigator.locks !== 'undefined') throw new Error('PILOT_LEASE_WORKER_LOCKS_PRESENT');
    self.addEventListener('message', event => { worker.handle(event.data); });
}
