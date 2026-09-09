export const OFFLINE_MUTATION_WRITES_ENABLED = false;

export async function createOfflineMutationClientCore({
    uid,
    vaultKeyMaterial,
    enabled = OFFLINE_MUTATION_WRITES_ENABLED,
    createQueue,
    createSynchronizer,
    withLease,
    createChannel,
    send,
    onState = () => {},
    isOnline
}) {
    if (!enabled) throw new Error('OFFLINE_MUTATION_WRITES_DISABLED');
    if (!uid || !vaultKeyMaterial || !createQueue || !createSynchronizer || !withLease || !send) {
        throw new Error('OFFLINE_MUTATION_CLIENT_CONFIG_INVALID');
    }
    const queue = await createQueue({uid, vaultKeyMaterial});
    const synchronizer = createSynchronizer({uid, queue, send, withLease, onState, isOnline});
    const channel = createChannel?.(uid, () => synchronizer.flush()) ?? {notify() {}, close() {}};
    return {
        async enqueue(operation) {
            if (operation?.uid !== uid) throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
            await queue.enqueue(operation);
            channel.notify();
            return synchronizer.flush();
        },
        flush: () => synchronizer.flush(),
        async discard(operationId) {
            if (!operationId) throw new Error('OFFLINE_OPERATION_ID_REQUIRED');
            await queue.remove(operationId);
            channel.notify();
        },
        close() { channel.close(); queue.close?.(); }
    };
}
