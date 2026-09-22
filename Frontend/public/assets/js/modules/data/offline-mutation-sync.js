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

    // Lettura unica per entrambi i rami: `available: false` non è mai una coda vuota.
    async function read() {
        if (readQueue) {
            const result = await readQueue();
            if (result?.available === false) return {available: false, reason: result.reason || 'QUEUE_READER_UNAVAILABLE'};
            return {available: true, operations: result?.operations ?? []};
        }
        return {available: true, operations: await queue.list()};
    }

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
        if (!isOnline()) {
            emit('offline', {pending: read0.operations.length});
            return {status: 'offline', pending: read0.operations.length};
        }
        return withLease(uid, async () => {
            const read1 = await read();
            if (!read1.available) {
                emit('queue-unavailable', {reason: read1.reason, pending: null});
                return {status: 'queue-unavailable', reason: read1.reason};
            }
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
                    const result = await send(operation);
                    if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
                    if (result.status === 'conflict') {
                        emit('conflict', {operation, result, pending: operations.length - completed});
                        return {status: 'conflict', operation, result, completed};
                    }
                    if (result.status !== 'applied') {
                        throw new Error('OFFLINE_SYNC_RESULT_INVALID');
                    }
                    await queue.remove(operation, {isActive});
                    if (!isActive()) throw new Error('OFFLINE_SESSION_CHANGED');
                    completed += 1;
                } catch (error) {
                    if (isActive() && ['failed-precondition', 'functions/failed-precondition'].includes(error?.code) && ['LEGACY_MUTATION_RESULT_UNVERIFIED', 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'].includes(error?.details?.reason)) {
                        let heldOperation;
                        try { heldOperation = await queue.markForReview(operation, {isActive, reviewReason: error.details.reason}); }
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
