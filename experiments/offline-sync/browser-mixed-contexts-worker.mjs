import {deriveOfflineQueueKey, sealOfflineOperation, withOfflineQueueLease} from './queue.js';
import {createHybridQueueCoordinator} from './hybrid-queue-coordinator.mjs';

// M6-A-3 — laboratorio: il **secondo contesto** della matrice mista. È un agente separato con
// proprio event loop, stessa origine, stesso profilo e stesse API (`indexedDB`, Web Locks) della
// scheda. Non conosce né monta nulla dell'app: riceve un ruolo (`v1` o `hybrid`) e restituisce
// l'esito. Con `stripLocks` rimuove **davvero** `navigator.locks` nel proprio realm.
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
// Error generici portano il codice nel messaggio; i DOMException nel nome.
const codeOf = error => error.code || (error.name && error.name !== 'Error' ? error.name : error.message);
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});

// Cancello deterministico: con `gated` il Worker resta nella sezione critica finché la scheda non
// manda `{release: true}` — la matrice non dipende così da tempi arbitrari.
let releaseGate = null;
onmessage = async ({data}) => {
    if (data?.release) { releaseGate?.(); releaseGate = null; return; }
    const reply = payload => postMessage({...payload, id: data.id});
    let database;
    try {
        if (data.stripLocks) Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
        database = await requestValue(indexedDB.open(`codex-offline-queue-${data.uid}`));
        // Diagnostica di laboratorio: la riga del lease vista dopo il tentativo.
        const readLease = async () => {
            try {
                return await requestValue(database.transaction('queueLeases', 'readonly').objectStore('queueLeases').get(data.uid)) ?? null;
            } catch { return null; }
        };
        const seal = async () => sealOfflineOperation({uid: data.uid, operationId: data.operationId,
            recordId: `record-${data.operationId}`, value: 'worker'}, await deriveOfflineQueueKey(KEY, data.uid));
        // Il "processo" di laboratorio: annuncia l'ingresso nella sezione critica, poi sigilla e
        // scrive il contenitore. Nel ramo ibrido la scrittura passa da `guardTransaction`.
        const task = async context => {
            reply({entered: true});
            if (data.gated) await new Promise(resolve => { releaseGate = resolve; });
            else if (data.holdMs) await new Promise(resolve => setTimeout(resolve, data.holdMs));
            const container = await seal();
            if (context?.guardTransaction) {
                await new Promise((resolve, reject) => {
                    const tx = database.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                    tx.oncomplete = resolve;
                    tx.onabort = tx.onerror = () => reject(tx.error || new Error('WORKER_WRITE_ABORTED'));
                    context.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); },
                        error => reject(error));
                });
            } else {
                await new Promise((resolve, reject) => {
                    const tx = database.transaction('encryptedOperations', 'readwrite');
                    tx.oncomplete = resolve;
                    tx.onabort = tx.onerror = () => reject(tx.error || new Error('WORKER_WRITE_ABORTED'));
                    tx.objectStore('encryptedOperations').put(container);
                });
            }
            return data.operationId;
        };
        let outcome;
        if (data.role === 'v1') {
            // Build v1 attuale: nessun argomento `locks`, quindi risolve `globalThis.navigator?.locks`.
            try { outcome = await withOfflineQueueLease(data.uid, task); }
            catch (error) { outcome = {error: codeOf(error)}; }
        } else {
            // `null` disattiva davvero il ponte: `undefined` riattiverebbe il default
            // (`globalThis.navigator?.locks`) per semantica dei parametri di default.
            const coordinator = createHybridQueueCoordinator({database, uid: data.uid, holderId: data.holderId,
                locks: data.bridge ? navigator.locks : null, ttlMs: data.ttlMs ?? 30000,
                ...(data.acquireTimeoutMs ? {acquireTimeoutMs: data.acquireTimeoutMs} : {})});
            try { outcome = await coordinator.run(task); }
            catch (error) { outcome = {error: codeOf(error)}; }
        }
        reply({ok: true, outcome, webLocks: typeof navigator.locks, lease: await readLease()});
    } catch (error) {
        reply({ok: false, code: codeOf(error), webLocks: typeof navigator.locks});
    } finally { database?.close(); }
};
