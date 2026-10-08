// [M6-A-8b] Candidato di laboratorio: **coordinatore lease isolato** per lo store `queueLeases`
// nello **stesso** database della coda già a schema v2 (`codex-offline-queue-<uid>`).
//
// Perimetro rispettato: questo modulo **non** è importato da `withOfflineQueueLease`, dal client,
// dal sincronizzatore o dal pilota, e **non** abilita alcun fallback nel runtime: nessun file di
// `Frontend/public/**` lo nomina (verificato da una prova statica di isolamento). L'adozione nel
// runtime resta il passo successivo e separato.
//
// Cosa fa: apre il database della coda **senza imporre una versione** (né downgrade né upgrade
// automatico; un database assente resta assente), accetta **solo** lo schema v2 con la struttura
// attesa degli store e opera **esclusivamente** sullo store del lease — le transazioni che apre
// nominano solo `queueLeases`, quindi `encryptedOperations` non è mai toccato dal coordinatore.
// Offre acquisizione con token monotono (anti-ABA: il rilascio conserva il contatore), rilascio,
// rinnovo, timeout di acquisizione limitato e fencing con `guardTransaction` nella **stessa**
// transazione del chiamante.
//
// Rifiuti dichiarati (codice stabile, nessun esito ambiguo e nessuna «riuscita»):
//   LEASE_COORDINATOR_CONFIG     configurazione non valida
//   LEASE_DATABASE_MISSING       coda assente: la transazione di cambio versione viene annullata
//   LEASE_SCHEMA_V1              schema v1: manca lo store del lease (nessun upgrade automatico)
//   LEASE_SCHEMA_UNSUPPORTED     versione diversa da 1 e 2
//   LEASE_SCHEMA_MALFORMED       v2 con store attesi mancanti o struttura diversa da keyPath:'id'
//   LEASE_OPEN_FAILED/BLOCKED/TIMEOUT, LEASE_DATABASE_UNAVAILABLE
//   LEASE_SESSION_INACTIVE       sessione scaduta o annullata (mai una riuscita)
//   LEASE_BUSY                   lease occupato da un altro titolare (esito `acquired:false`)
//   LEASE_ACQUIRE_TIMEOUT        acquisizione oltre il limite: nessun task, lease tardivo rilasciato
//   LEASE_TRANSACTION_FAILED     transazione del lease fallita o annullata
//   LEASE_RECORD_INVALID         record del lease malformato (fail-closed, nessuna riparazione)
//   LEASE_TOKEN_EXHAUSTED        contatore dei token esaurito
//   LEASE_CLOCK_INVALID/REVERSED orologio non valido o tornato indietro
//   LEASE_LOST                   fencing: il lease non è più nostro (takeover)
//   LEASE_CONTEXT_CLOSED         contesto trattenuto dopo la fine del coordinamento
//   LEASE_GUARD_INVALID          transazione estranea, in sola lettura o callback non valida
//   LEASE_ASYNC_MUTATION_FORBIDDEN  callback asincrona dentro il fencing (non annullabile)
//   LEASE_TASK_INVALID, LEASE_RELEASE_FAILED
//
// Limiti dichiarati: il fencing protegge le scritture IndexedDB nella transazione del chiamante e
// non ritira un effetto esterno già avviato (una richiesta di rete parte comunque: servono le
// ricevute idempotenti del backend); il timeout copre **solo** l'acquisizione, non la durata del
// task; un lease scaduto è recuperabile da un altro titolare (il fencing lo intercetta nella
// transazione, non prima).
const LEASE_STORE = 'queueLeases';
const OPERATIONS_STORE = 'encryptedOperations';
const LEASE_RECORD_VERSION = 1;
const DATABASE_PREFIX = 'codex-offline-queue-';

const fail = (code, detail) => {
    const error = new Error(detail ? `${code} (${detail})` : code);
    error.code = code;
    return error;
};
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value);
const isThenable = value => !!value && typeof value.then === 'function';
const codeOf = error => error?.code || error?.name || error?.message || 'UNKNOWN';

export function createOfflineMutationLeaseCoordinator({uid, holderId, indexedDb = globalThis.indexedDB,
    databaseName, now = Date.now, ttlMs = 30_000, acquireTimeoutMs = 10_000, openTimeoutMs = 10_000} = {}) {
    if (!identifier(uid) || !identifier(holderId) || !indexedDb || typeof indexedDb.open !== 'function' ||
        typeof now !== 'function' || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 ||
        !Number.isSafeInteger(acquireTimeoutMs) || acquireTimeoutMs <= 0 ||
        !Number.isSafeInteger(openTimeoutMs) || openTimeoutMs <= 0 ||
        (databaseName !== undefined && !identifier(databaseName))) throw fail('LEASE_COORDINATOR_CONFIG');
    const name = databaseName ?? `${DATABASE_PREFIX}${uid}`;
    let database = null;
    let opening = null;

    function time() {
        const value = now();
        if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value + ttlMs)) {
            throw fail('LEASE_CLOCK_INVALID');
        }
        return value;
    }
    function checkSession(signal, isActive) {
        if (signal?.aborted || !isActive()) throw fail('LEASE_SESSION_INACTIVE');
    }
    // Stesso contratto del record del banco M6 (`id`/`version`/`holderId`/`token`/`updatedAt`/
    // `expiresAt`): un record malformato non viene riparato né sovrascritto, il coordinatore
    // fallisce chiuso.
    function validateRecord(record, at) {
        if (record === undefined) return;
        if (!record || record.id !== uid || record.version !== LEASE_RECORD_VERSION ||
            !Number.isSafeInteger(record.token) || record.token < 1 ||
            !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0 ||
            !Number.isSafeInteger(record.expiresAt) || record.expiresAt < 0 ||
            !(record.holderId === null
                ? record.expiresAt === 0
                : identifier(record.holderId) && record.expiresAt > record.updatedAt)) {
            throw fail('LEASE_RECORD_INVALID');
        }
        // Un orologio tornato indietro non può prolungare un possesso.
        if (at < record.updatedAt) throw fail('LEASE_CLOCK_REVERSED');
    }
    function owned(record, token, at) {
        return !!record && record.holderId === holderId && record.token === token && record.expiresAt > at;
    }
    function validateSchema(connection) {
        if (![1, 2].includes(connection.version)) throw fail('LEASE_SCHEMA_UNSUPPORTED', `versione ${connection.version}`);
        if (connection.version === 1) throw fail('LEASE_SCHEMA_V1');
        const expected = [OPERATIONS_STORE, LEASE_STORE];
        if (expected.some(storeName => !connection.objectStoreNames.contains(storeName))) {
            throw fail('LEASE_SCHEMA_MALFORMED', 'store attesi mancanti');
        }
        const transaction = connection.transaction(expected, 'readonly');
        for (const storeName of expected) {
            const store = transaction.objectStore(storeName);
            if (store.keyPath !== 'id' || store.autoIncrement) throw fail('LEASE_SCHEMA_MALFORMED', storeName);
        }
    }
    function connect({signal, isActive}) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (error, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', abort);
                if (error) reject(error); else resolve(result);
            };
            const abort = () => finish(fail('LEASE_SESSION_INACTIVE'));
            const timer = setTimeout(() => finish(fail('LEASE_OPEN_TIMEOUT')), openTimeoutMs);
            signal?.addEventListener('abort', abort, {once: true});
            let request;
            try { request = indexedDb.open(name); }
            catch (cause) { finish(fail('LEASE_OPEN_FAILED', codeOf(cause))); return; }
            request.onblocked = () => finish(fail('LEASE_DATABASE_BLOCKED'));
            request.onerror = () => finish(fail('LEASE_OPEN_FAILED', codeOf(request.error)));
            // Un database **assente** resta assente: la transazione di cambio versione è annullata e
            // il coordinatore rifiuta; non crea, non migra e non ripara nulla.
            request.onupgradeneeded = () => {
                try { request.transaction?.abort?.(); } catch { /* transazione già conclusa */ }
                finish(fail('LEASE_DATABASE_MISSING'));
            };
            request.onsuccess = () => {
                const connection = request.result;
                if (settled) { connection?.close?.(); return; }
                connection.onversionchange = () => {
                    try { connection.close(); } catch { /* connessione già chiusa */ }
                    if (database === connection) database = null;
                };
                try {
                    checkSession(signal, isActive);
                    validateSchema(connection);
                } catch (error) { connection.close(); finish(error); return; }
                database = connection;
                finish(null, {version: connection.version});
            };
        });
    }
    // Transazione **solo** sullo store del lease: `encryptedOperations` non entra mai in una
    // transazione aperta dal coordinatore.
    function leaseTransaction(mode, callback) {
        if (!database) return Promise.reject(fail('LEASE_DATABASE_UNAVAILABLE'));
        return new Promise((resolve, reject) => {
            let transaction;
            try { transaction = database.transaction(LEASE_STORE, mode); }
            catch (cause) { reject(fail('LEASE_TRANSACTION_FAILED', codeOf(cause))); return; }
            const store = transaction.objectStore(LEASE_STORE);
            let outcome, failure, settled = false;
            const settle = error => {
                if (settled) return;
                settled = true;
                if (error) reject(error); else resolve(outcome);
            };
            transaction.oncomplete = () => settle(failure);
            transaction.onabort = () => settle(failure || fail('LEASE_TRANSACTION_FAILED', 'annullata'));
            transaction.onerror = () => settle(failure || fail('LEASE_TRANSACTION_FAILED', 'errore'));
            const request = store.get(uid);
            request.onerror = () => { failure = fail('LEASE_TRANSACTION_FAILED', 'richiesta'); try { transaction.abort(); } catch { /* già conclusa */ } settle(failure); };
            request.onsuccess = () => {
                try {
                    const at = time();
                    validateRecord(request.result, at);
                    outcome = callback(request.result, at, store);
                } catch (cause) {
                    failure = cause;
                    try { transaction.abort(); } catch { /* già conclusa */ }
                    settle(cause);
                }
            };
        });
    }
    function createHandle(token, {signal, isActive}) {
        let live = true;
        const checkLive = () => {
            if (!live) throw fail('LEASE_CONTEXT_CLOSED');
            checkSession(signal, isActive);
        };
        return Object.freeze({
            token,
            holderId,
            // Il possesso è sempre verificato sul record persistito, non in memoria.
            isCurrent: async () => { try { checkLive(); } catch { return false; } return await leaseTransaction('readonly', (record, at) => owned(record, token, at)); },
            async checkCurrent() {
                checkLive();
                const current = await leaseTransaction('readonly', (record, at) => owned(record, token, at));
                if (!current) { live = false; throw fail('LEASE_LOST'); }
                return true;
            },
            async renew() {
                checkLive();
                const renewed = await leaseTransaction('readwrite', (record, at, store) => {
                    if (!owned(record, token, at)) return false;
                    store.put({...record, updatedAt: at, expiresAt: at + ttlMs});
                    return true;
                });
                if (!renewed) live = false;
                return renewed;
            },
            async release() {
                const released = await leaseTransaction('readwrite', (record, at, store) => {
                    if (!owned(record, token, at)) return false;
                    // Il token si conserva: cancellare il record o azzerarlo permetterebbe l'ABA.
                    store.put({...record, holderId: null, expiresAt: 0, updatedAt: at});
                    return true;
                });
                live = false;
                return released;
            },
            // `onValid` deve accodare **solo** scritture IndexedDB sincrone sulla transazione del
            // chiamante: un abort annulla quelle scritture, non un effetto esterno già avviato.
            guardTransaction(tx, onValid, onInvalid = () => {}) {
                if (!live) {
                    const error = fail('LEASE_CONTEXT_CLOSED');
                    try { tx?.abort?.(); } catch { /* già conclusa */ }
                    onInvalid(error);
                    return;
                }
                if (!tx || tx.db !== database || tx.mode !== 'readwrite' ||
                    typeof onValid !== 'function' || typeof onInvalid !== 'function') throw fail('LEASE_GUARD_INVALID');
                let store;
                try { store = tx.objectStore(LEASE_STORE); }
                catch (cause) { throw fail('LEASE_GUARD_INVALID', codeOf(cause)); }
                const request = store.get(uid);
                request.onerror = () => {
                    const error = fail('LEASE_TRANSACTION_FAILED', 'richiesta del lease');
                    try { tx.abort(); } catch { /* già conclusa */ }
                    onInvalid(error);
                };
                request.onsuccess = () => {
                    try {
                        const at = time();
                        validateRecord(request.result, at);
                        if (!owned(request.result, token, at)) throw fail('LEASE_LOST');
                        const result = onValid();
                        if (isThenable(result)) {
                            // Rifiuto osservato: non viene atteso né annullato.
                            Promise.resolve(result).catch(() => {});
                            throw fail('LEASE_ASYNC_MUTATION_FORBIDDEN');
                        }
                    } catch (error) {
                        if (error.code === 'LEASE_LOST') live = false;
                        try { tx.abort(); } catch { /* già conclusa */ }
                        onInvalid(error);
                    }
                };
            }
        });
    }
    async function open({signal, isActive = () => true} = {}) {
        if (typeof isActive !== 'function') throw fail('LEASE_COORDINATOR_CONFIG');
        checkSession(signal, isActive);
        if (database) return {version: database.version};
        if (!opening) opening = connect({signal, isActive}).finally(() => { opening = null; });
        return await opening;
    }
    async function acquire({signal, isActive = () => true} = {}) {
        await open({signal, isActive});
        checkSession(signal, isActive);
        let expired = false, timer;
        const deadline = new Promise((_resolve, reject) => {
            timer = setTimeout(() => { expired = true; reject(fail('LEASE_ACQUIRE_TIMEOUT')); }, acquireTimeoutMs);
        });
        const attempt = (async () => {
            const token = await leaseTransaction('readwrite', (record, at, store) => {
                if (record && record.holderId !== null && record.expiresAt > at) return null;
                const next = (record?.token || 0) + 1;
                if (!Number.isSafeInteger(next) || next < 1) throw fail('LEASE_TOKEN_EXHAUSTED');
                store.put({id: uid, version: LEASE_RECORD_VERSION, holderId, token: next,
                    updatedAt: at, expiresAt: at + ttlMs});
                return next;
            });
            if (token === null) return null;
            const handle = createHandle(token, {signal, isActive});
            if (expired) {
                // Lease arrivato **dopo** la scadenza: rilasciato senza mai eseguire il task.
                try { await handle.release(); } catch { /* rilascio best effort: l'esito resta il timeout */ }
                throw fail('LEASE_ACQUIRE_TIMEOUT');
            }
            return handle;
        })();
        attempt.catch(() => {}); // il ramo perdente della corsa non deve emergere come rifiuto non gestito
        try {
            const handle = await Promise.race([attempt, deadline]);
            if (handle && expired) {
                try { await handle.release(); } catch { /* rilascio best effort */ }
                throw fail('LEASE_ACQUIRE_TIMEOUT');
            }
            return handle;
        } finally { clearTimeout(timer); }
    }
    // Percorso protetto: apertura, acquisizione limitata, task sotto fencing, rilascio **sempre**
    // (anche dopo un errore). Restituisce `{acquired:true, value}` solo se il task è tornato senza
    // errore, il lease è ancora nostro e la sessione è ancora attiva: mai una riuscita ambigua.
    async function run(task, {signal, isActive = () => true} = {}) {
        if (typeof task !== 'function' || typeof isActive !== 'function') throw fail('LEASE_TASK_INVALID');
        await open({signal, isActive});
        checkSession(signal, isActive);
        const handle = await acquire({signal, isActive});
        if (!handle) {
            checkSession(signal, isActive);
            return {acquired: false, reason: 'LEASE_BUSY'};
        }
        let value, failure;
        try {
            await handle.checkCurrent();
            value = await task(handle);
            await handle.checkCurrent();
        } catch (cause) { failure = cause; }
        finally {
            try {
                const released = await handle.release();
                if (!released && !failure) failure = fail('LEASE_RELEASE_FAILED');
            } catch (cause) { if (!failure) failure = cause; }
        }
        if (failure) throw failure;
        checkSession(signal, isActive);
        return {acquired: true, value};
    }
    return Object.freeze({
        uid, holderId, databaseName: name,
        version: () => (database ? database.version : null),
        open,
        acquire,
        run,
        // Transazione sulla **stessa** connessione del coordinatore, per la scrittura fenced del
        // chiamante: `guardTransaction` rifiuta una connessione diversa.
        transaction(stores, mode = 'readonly') {
            if (!database) throw fail('LEASE_DATABASE_UNAVAILABLE');
            return database.transaction(stores, mode);
        },
        close() {
            if (!database) return;
            try { database.close(); } catch { /* connessione già chiusa */ }
            database = null;
        }
    });
}
