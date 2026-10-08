import {createOfflineMutationQueue, createOfflineQueueReader, deriveOfflineQueueKey, sealOfflineOperation,
    withOfflineQueueLease} from './offline-mutation-queue.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';
import {createOfflineMutationClientCore} from './offline-mutation-client-core.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';

// [M6-A-8e] Secondo contesto della matrice **copie miste** (casi 6, 6-bis, 6-ter del piano M6): un
// Worker dedicato che interpreta i tre ruoli richiesti con i **moduli runtime correnti**.
//  - `old`: la copia **precedente** — apre la coda con la **versione 1** (quindi fallisce con
//    `VersionError` davanti a uno schema v2), esclude con il solo Web Lock di piattaforma
//    (`withOfflineQueueLease`) e legge solo lo schema 1;
//  - `new`: la copia **corrente** con l'opt-in del lease (`resolveOfflineQueueLease`) e le
//    mutazioni fenced nella stessa transazione;
//  - `rollback`: build **v2-compatibile** con fallback **spento** — legge gli schemi 1 e 2 con il
//    lettore compatibile del runtime e non scrive quando il lock/lease richiesto non c'è.
// Nessun adattatore runtime nuovo: il Worker usa i moduli di `Frontend/public/**` così come sono.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const codeOf = error => error?.code || (error?.name && error.name !== 'Error' ? error.name : error?.message || 'WORKER_ERROR');
const fail = code => Object.assign(new Error(code), {code});

export function createMixedCurrentWorker({uid, post, indexedDb = globalThis.indexedDB} = {}) {
    if (typeof post !== 'function' || !indexedDb || !uid) throw new Error('MIXED_CURRENT_WORKER_CONFIG');
    let releaseGate = null;
    const name = `codex-offline-queue-${uid}`;
    const openVersioned = version => new Promise((resolve, reject) => {
        const request = version === undefined ? indexedDb.open(name) : indexedDb.open(name, version);
        request.onupgradeneeded = () => { try { request.transaction.abort(); } catch { /* già conclusa */ } reject(fail('UNEXPECTED_UPGRADE')); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || fail('OPEN_FAILED'));
    });
    const readIds = async () => {
        try {
            const reader = await createOfflineQueueReader({uid, vaultKeyMaterial: KEY});
            const result = await reader.read();
            return result.available ? result.operations.map(operation => operation.operationId).sort() : `unavailable:${result.reason}`;
        } catch (error) { return `unavailable:${codeOf(error)}`; }
    };
    // Scrittura della copia **vecchia**: connessione aperta alla versione 1 (come la build
    // precedente) e inserimento di un contenitore sigillato dentro la sezione critica.
    const oldWrite = async operationId => {
        const container = await sealOfflineOperation({uid, operationId, recordId: `record-${operationId}`, value: 'old'},
            await deriveOfflineQueueKey(KEY, uid));
        const database = await openVersioned(1);
        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction('encryptedOperations', 'readwrite');
                transaction.oncomplete = resolve;
                transaction.onabort = transaction.onerror = () => reject(transaction.error || fail('OLD_WRITE_ABORTED'));
                transaction.objectStore('encryptedOperations').put(container);
            });
        } finally { database.close(); }
        return operationId;
    };
    const newMutation = async ({action, operationId, replacementOperationId, lease, isActive = () => true}) => {
        const queue = await createOfflineMutationQueue({uid, vaultKeyMaterial: KEY, isActive});
        try {
            if (action === 'enqueue') {
                await queue.enqueue({uid, operationId, recordId: `record-${operationId}`, value: 'new'}, {isActive, lease});
                return {action, status: 'enqueued'};
            }
            const reader = await createOfflineQueueReader({uid, vaultKeyMaterial: KEY});
            const result = await reader.read();
            const expected = result.operations?.find(operation => operation.operationId === operationId);
            if (!expected) throw fail('OPERATION_MISSING');
            if (action === 'replace') {
                await queue.replace(expected, {...expected, operationId: replacementOperationId, value: 'new'}, {isActive, lease});
                return {action, status: 'replaced'};
            }
            if (action === 'markForReview') {
                await queue.markForReview(expected, {isActive, lease});
                return {action, status: 'marked'};
            }
            await queue.remove(expected, {isActive, lease});
            return {action, status: 'removed'};
        } finally { queue.close(); }
    };
    const boundary = ({holderId, now, ttlMs, acquireTimeoutMs}) =>
        resolveOfflineQueueLease({uid, leaseFallback: true, holderId, indexedDb, now, ttlMs, acquireTimeoutMs});

    async function handle(data) {
        const reply = payload => post({...payload, id: data?.id});
        if (data?.release) { const gate = releaseGate; releaseGate = null; gate?.(); return; }
        // La rimozione di Web Locks avviene **prima** di costruire qualsiasi confine, nello stesso
        // modo del realm del Worker approvato in M6-A-8d.
        if (data.stripLocks) Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
        const now = () => data.now ?? 0;
        try {
            if (data.op === 'ping') { reply({ok: true, webLocks: typeof globalThis.navigator?.locks}); return; }
            if (data.op === 'old-open') {
                const database = await openVersioned(1);
                const version = database.version;
                database.close();
                reply({ok: true, version});
                return;
            }
            if (data.op === 'old-read-v1') {
                // Lettore della build **precedente**: apre senza imporre una versione e **rifiuta**
                // in modo dichiarato uno schema diverso dal v1 (mai una coda vuota).
                const database = await openVersioned(undefined);
                try {
                    if (database.version !== 1) throw fail('QUEUE_UNAVAILABLE_SCHEMA');
                    const containers = await new Promise((resolve, reject) => {
                        const request = database.transaction('encryptedOperations', 'readonly').objectStore('encryptedOperations').getAll();
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error || fail('OLD_READ_FAILED'));
                    });
                    reply({ok: true, version: database.version, ids: containers.map(row => row.operationId).sort()});
                } finally { database.close(); }
                return;
            }
            if (data.op === 'old-write') {
                // La copia vecchia esclude con il **solo** Web Lock di piattaforma e apre a versione 1:
                // su uno schema v2 fallisce prima di qualunque scrittura.
                const outcome = await withOfflineQueueLease(uid, () => oldWrite(data.operationId));
                reply({ok: true, outcome, ids: await readIds()});
                return;
            }
            if (data.op === 'old-hold') {
                const outcome = await withOfflineQueueLease(uid, async () => {
                    reply({event: 'held', protocol: 'old'});
                    await new Promise(resolve => { releaseGate = resolve; });
                    if (data.write) await oldWrite(data.operationId);
                    return 'old';
                });
                reply({ok: true, outcome, ids: await readIds()});
                return;
            }
            if (data.op === 'new-probe' || data.op === 'new-mutate' || data.op === 'new-hold') {
                const withLease = boundary({holderId: data.holderId, now, ttlMs: data.ttlMs, acquireTimeoutMs: data.acquireTimeoutMs});
                const before = await readIds();
                try {
                    const outcome = await withLease(uid, async lease => {
                        if (data.op === 'new-hold') {
                            reply({event: 'held', protocol: 'new', token: lease?.token ?? null});
                            await new Promise(resolve => { releaseGate = resolve; });
                        }
                        if (data.op === 'new-probe') return {token: lease?.token ?? null};
                        return {token: lease?.token ?? null,
                            mutation: await newMutation({action: data.action, operationId: data.operationId,
                                replacementOperationId: data.replacementOperationId, lease})};
                    });
                    reply({ok: true, outcome, before, after: await readIds()});
                } finally { withLease.close?.(); }
                return;
            }
            if (data.op === 'rollback-read') {
                const reader = await createOfflineQueueReader({uid, vaultKeyMaterial: KEY});
                const result = await reader.read();
                reply({ok: true, available: result.available, version: result.version,
                    ids: result.available ? result.operations.map(operation => operation.operationId).sort() : null,
                    reason: result.reason ?? null});
                return;
            }
            if (data.op === 'rollback-sync' || data.op === 'rollback-mutate') {
                // Build di rollback: lettore compatibile v1/v2 e **nessun** fallback (solo il lock di
                // piattaforma). Con l'API assente ogni scrittura è rifiutata e il trasporto non parte.
                const sent = [];
                const client = await createOfflineMutationClientCore({
                    uid, vaultKeyMaterial: KEY, enabled: true,
                    createQueue: options => createOfflineMutationQueue({...options, indexedDb}),
                    createQueueReader: options => createOfflineQueueReader({...options, indexedDb}),
                    createSynchronizer: createOfflineMutationSynchronizer,
                    withLease: withOfflineQueueLease,
                    createChannel: () => ({notify() {}, close() {}}),
                    send: async operation => { sent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; },
                    isOnline: () => true, onState: () => {}
                });
                try {
                    const before = await readIds();
                    if (data.op === 'rollback-mutate') {
                        await client.discard(data.operationId);
                        reply({ok: true, before, after: await readIds(), sent});
                    } else {
                        const outcome = await client.flush();
                        reply({ok: true, outcome, before, after: await readIds(), sent});
                    }
                } catch (error) {
                    // Il rifiuto del rollback riporta comunque gli invii effettuati (nessuno) e lo
                    // stato della coda, così il banco può pretendere l'assenza di scritture.
                    reply({ok: false, code: codeOf(error), before: await readIds(), sent});
                } finally { client.close(); }
                return;
            }
            reply({ok: false, code: 'WORKER_OP_UNKNOWN'});
        } catch (error) {
            reply({ok: false, code: codeOf(error)});
        }
    }
    return {handle};
}

// Nel browser: un'istanza per UID, collegata a `postMessage`. La rimozione di Web Locks (quando
// richiesta dal job) avviene nel realm del Worker prima di costruire il confine.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof self.addEventListener === 'function') {
    const workers = new Map();
    self.addEventListener('message', event => {
        const uid = event.data?.uid;
        if (!uid) return;
        if (!workers.has(uid)) workers.set(uid, createMixedCurrentWorker({uid, post: message => self.postMessage(message)}));
        workers.get(uid).handle(event.data);
    });
}
