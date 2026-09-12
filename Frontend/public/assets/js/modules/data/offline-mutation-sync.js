const VALID_STATES = new Set(['idle', 'offline', 'syncing', 'conflict', 'recoverable-error', 'reconciliation-required', 'saved']);

export function createOfflineMutationSynchronizer({
    uid,
    queue,
    send,
    withLease,
    isOnline = () => navigator.onLine,
    isActive = () => true,
    onState = () => {}
}) {
    if (!uid || !queue || typeof send !== 'function' || typeof withLease !== 'function') {
        throw new Error('OFFLINE_SYNCHRONIZER_CONFIG_INVALID');
    }
    let running = null;

    function emit(state, detail = {}) {
        if (!VALID_STATES.has(state)) throw new Error('OFFLINE_SYNC_STATE_INVALID');
        onState({state, ...detail});
    }

    async function run() {
        if (!isActive()) return {status: 'recoverable-error'};
        if (!isOnline()) {
            const pending = (await queue.list()).length;
            emit('offline', {pending});
            return {status: 'offline', pending};
        }
        return withLease(uid, async () => {
            const operations = await queue.list();
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
                    await queue.remove(operation.operationId);
                    completed += 1;
                } catch (error) {
                    if (isActive() && ['failed-precondition', 'functions/failed-precondition'].includes(error?.code) && error?.details?.reason === 'LEGACY_MUTATION_RESULT_UNVERIFIED') {
                        let heldOperation;
                        try { heldOperation = await queue.markForReview(operation, {isActive}); }
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
