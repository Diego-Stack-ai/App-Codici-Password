const VALID_STATES = new Set(['idle', 'offline', 'syncing', 'conflict', 'recoverable-error', 'saved']);

export function createOfflineMutationSynchronizer({
    uid,
    queue,
    send,
    withLease,
    isOnline = () => navigator.onLine,
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
                    const result = await send(operation);
                    if (result.status === 'conflict') {
                        emit('conflict', {operation, result, pending: operations.length - completed});
                        return {status: 'conflict', operation, result, completed};
                    }
                    if (result.status !== 'applied' && result.duplicate !== true) {
                        throw new Error('OFFLINE_SYNC_RESULT_INVALID');
                    }
                    await queue.remove(operation.operationId);
                    completed += 1;
                } catch (error) {
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
