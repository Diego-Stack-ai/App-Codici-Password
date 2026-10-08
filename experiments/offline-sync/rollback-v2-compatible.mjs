// M6-A-5 — laboratorio: build di **rollback** con fallback disattivato e lettore compatibile v1/v2.
//
// Rappresenta il ritorno a una build che **non** attiva il fallback (nessun lease acquisito in
// autonomia, nessuna scrittura senza il lease richiesto, nessun invio) ma **sa leggere** una coda
// già aggiornata allo schema 2, così le operazioni sigillate pendenti restano visibili. Non è
// collegata al runtime: nessun file di `Frontend/public/**` la importa. Espone anche il modello
// del **lettore precedente** (solo schema 1), che su una coda v2 deve fallire in modo dichiarato.
const fail = code => Object.assign(new Error(code), {code});
const requestValue = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
const queueName = uid => `codex-offline-queue-${uid}`;

// Modello del lettore della build **precedente**: conosce solo lo schema 1. Su una coda già
// aggiornata a v2 **fallisce** con un codice dichiarato: non restituisce mai un elenco vuoto.
export async function readWithPreviousV1Reader({uid, indexedDb = globalThis.indexedDB} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb) throw fail('ROLLBACK_CONFIG');
    const database = await requestValue(indexedDb.open(queueName(uid)));
    try {
        if (database.version !== 1) throw fail('QUEUE_UNAVAILABLE_SCHEMA');
        const rows = await requestValue(database.transaction('encryptedOperations', 'readonly')
            .objectStore('encryptedOperations').getAll());
        return {version: database.version, containers: rows};
    } finally { database.close(); }
}

export function createRollbackQueueBuild({uid, indexedDb = globalThis.indexedDB, reader, keys, transport = null, database = null} = {}) {
    if (typeof uid !== 'string' || !uid || !indexedDb || typeof reader !== 'function' ||
        typeof keys?.derive !== 'function' || typeof keys?.seal !== 'function') throw fail('ROLLBACK_CONFIG');
    const name = queueName(uid);

    // Lettura tramite il lettore iniettato. Se il lettore non è disponibile per lo schema della
    // coda, il risultato è uno **stato dichiarato di indisponibilità**: mai una coda vuota, mai
    // un salvataggio riuscito (`operations: null`, non `[]`).
    const read = async () => {
        try {
            const {version, containers} = await reader({uid, indexedDb});
            return {available: true, version, operations: containers, reason: null};
        } catch (error) {
            return {available: false, version: null, operations: null, reason: error?.code || error?.message};
        }
    };

    // Nessuna scrittura senza il **lease richiesto**: la build di rollback non ha un percorso di
    // fallback, quindi senza lease rifiuta invece di accodare. Nessuna cancellazione è esposta.
    const enqueue = async (operation, {lease = null} = {}) => {
        if (!lease || typeof lease.guardTransaction !== 'function' || typeof lease.checkCurrent !== 'function') {
            throw fail('QUEUE_WRITE_REQUIRES_LEASE');
        }
        const container = await keys.seal(operation, await keys.derive());
        // La scrittura deve avvenire sulla **stessa** connessione del lease: `guardTransaction`
        // rifiuta una connessione diversa (`LEASE_GUARD_INVALID`).
        const connection = database ?? await requestValue(indexedDb.open(name));
        try {
            await new Promise((resolve, reject) => {
                const tx = connection.transaction(['queueLeases', 'encryptedOperations'], 'readwrite');
                tx.oncomplete = resolve;
                tx.onabort = tx.onerror = () => reject(tx.error || fail('QUEUE_WRITE_ABORTED'));
                lease.guardTransaction(tx, () => { tx.objectStore('encryptedOperations').put(container); }, error => reject(error));
            });
        } finally { if (!database) connection.close(); }
        return container.operationId;
    };

    // Nessun invio in questa build: il percorso di sincronizzazione è disattivato e il trasporto
    // non viene mai chiamato.
    const synchronise = async () => ({sent: 0, reason: 'ROLLBACK_FALLBACK_DISABLED'});

    return Object.freeze({read, enqueue, synchronise, readWithPreviousV1Reader: () => readWithPreviousV1Reader({uid, indexedDb})});
}
