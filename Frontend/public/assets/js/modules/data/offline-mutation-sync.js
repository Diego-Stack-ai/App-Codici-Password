const VALID_STATES = new Set(['idle', 'offline', 'syncing', 'conflict', 'recoverable-error', 'reconciliation-required', 'saved', 'queue-unavailable']);

export function createOfflineMutationSynchronizer({
    uid,
    queue,
    send,
    withLease,
    // [M6-A-6] Il percorso di lettura è iniettabile: quando è fornito, la coda viene letta con il
    // lettore compatibile v1/v2 e un esito non leggibile diventa uno **stato esplicito di
    // indisponibilità** invece di una coda vuota o di un salvataggio riuscito.
    readQueue = null,
    isOnline = () => navigator.onLine,
    isActive = () => true,
    onState = () => {}
}) {
    if (!uid || (typeof send !== 'function' && !readQueue) || typeof withLease !== 'function') {
        throw new Error('OFFLINE_SYNCHRONIZER_CONFIG_INVALID');
    }
    if (!queue && !readQueue) throw new Error('OFFLINE_SYNCHRONIZER_CONFIG_INVALID');
    if (queue && typeof queue.list !== 'function') throw new Error('OFFLINE_SYNCHRONIZER_CONFIG_INVALID');
    let running = null;

    function emit(state, detail = {}) {
        if (!VALID_STATES.has(state)) throw new Error('OFFLINE_SYNC_STATE_INVALID');
        onState({state, ...detail});
    }

    // Lettura unica per entrambi i rami: solo `{available: true}` con un **elenco valido** è una
    // lettura riuscita. Qualunque altra risposta — mancante, malformata, o un errore — fallisce
    // chiusa come indisponibilità: **mai** una coda vuota.
    async function read() {
        try {
            if (readQueue) {
                const result = await readQueue();
                if (result?.available !== true || !Array.isArray(result.operations)) {
                    return {available: false, reason: result?.reason || 'QUEUE_READER_UNAVAILABLE'};
                }
                return {available: true, operations: result.operations};
            }
            return {available: true, operations: await queue.list()};
        } catch (error) {
            return {available: false, reason: error?.code || error?.message || 'QUEUE_READER_UNAVAILABLE'};
        }
    }

    // Lo scrittore può diventare non operabile **dopo** l'apertura (upgrade concorrente che chiude
    // la connessione): in quel caso non si invia nulla, perché non si potrebbe rimuovere
    // l'operazione inviata e la coda non sarebbe più governabile.
    const writerUnavailable = () => !!queue && typeof queue.isOperable === 'function' && queue.isOperable() === false;
    const writerUnavailableResult = pending => {
        emit('queue-unavailable', {reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE', pending});
        return {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'};
    };

    async function run() {
        if (!isActive()) return {status: 'recoverable-error'};
        const read0 = await read();
        if (!read0.available) {
            emit('queue-unavailable', {reason: read0.reason, pending: null});
            return {status: 'queue-unavailable', reason: read0.reason};
        }
        if (!queue) {
            // Coda leggibile ma non operabile (scrittore non disponibile): nessun invio, nessuna
            // conferma e nessun «salvato», perché non si potrebbe rimuovere l'operazione inviata.
            emit('queue-unavailable', {reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE', pending: read0.operations.length});
            return {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'};
        }
        if (writerUnavailable()) return writerUnavailableResult(read0.operations.length);
        if (!isOnline()) {
            emit('offline', {pending: read0.operations.length});
            return {status: 'offline', pending: read0.operations.length};
        }
        // [M6-A-8c R1] Il contesto del lease (quando il confine è quello del fallback) viene passato
        // alle mutazioni della coda: la conferma e la marcatura per revisione verificano il token
        // nella **stessa** transazione, quindi un titolare scaduto o subentrato non rimuove e non
        // riscrive nulla. Sul percorso Web Locks il contesto è `undefined` e il comportamento resta
        // quello di sempre.
        return withLease(uid, async lease => {
            const read1 = await read();
            if (!read1.available) {
                emit('queue-unavailable', {reason: read1.reason, pending: null});
                return {status: 'queue-unavailable', reason: read1.reason};
            }
            if (writerUnavailable()) return writerUnavailableResult(read1.operations.length);
            const operations = read1.operations;
            emit('syncing', {pending: operations.length});
            let completed = 0;
            for (const operation of operations) {
                try {
                    if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
                    if (operation._queueState === 'reconciliation-required') {
                        emit('reconciliation-required', {operation, pending: operations.length - completed});
                        return {status: 'reconciliation-required', operation, completed};
                    }
                    // Guardia immediatamente prima dell'effetto: se lo scrittore è stato chiuso da
                    // un upgrade concorrente non si invia nulla.
                    if (writerUnavailable()) return writerUnavailableResult(operations.length - completed);
                    const result = await send(operation);
                    if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
                    if (result.status === 'conflict') {
                        emit('conflict', {operation, result, pending: operations.length - completed});
                        return {status: 'conflict', operation, result, completed};
                    }
                    if (result.status !== 'applied') {
                        throw new Error('OFFLINE_SYNC_RESULT_INVALID');
                    }
                    await queue.remove(operation, {isActive, lease: lease ?? null});
                    if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
                    completed += 1;
                } catch (error) {
                    if (isActive() && ['failed-precondition', 'functions/failed-precondition'].includes(error?.code) && ['LEGACY_MUTATION_RESULT_UNVERIFIED', 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'].includes(error?.details?.reason)) {
                        let heldOperation;
                        try { heldOperation = await queue.markForReview(operation, {isActive, lease: lease ?? null, reviewReason: error.details.reason}); }
                        catch (storageError) {
                            emit('recoverable-error', {operationId: operation.operationId, pending: operations.length - completed});
                            return {status: 'recoverable-error', error: storageError, completed};
                        }
                        emit('reconciliation-required', {operation: heldOperation, pending: operations.length - completed});
                        return {status: 'reconciliation-required', operation: heldOperation, completed};
                    }
                    emit('recoverable-error', {operationId: operation.operationId, pending: operations.length - completed});
                    return {status: 'recoverable-error', error, completed};
                }
            }
            emit(operations.length ? 'saved' : 'idle', {pending: 0, completed});
            return {status: 'saved', completed};
        });
    }

    return {
        flush() {
            if (!running) running = run().finally(() => { running = null; });
            return running;
        }
    };
}
