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
    isOnline,
    isActive = () => true
}) {
    if (!enabled) throw new Error('OFFLINE_MUTATION_WRITES_DISABLED');
    if (!uid || !vaultKeyMaterial || !createQueue || !createSynchronizer || !withLease || !send) {
        throw new Error('OFFLINE_MUTATION_CLIENT_CONFIG_INVALID');
    }
    let closed = false;
    const active = () => !closed && isActive();
    const assertActive = () => { if (!active()) throw new Error('OFFLINE_SESSION_CHANGED'); };
    assertActive();
    const queue = await createQueue({uid, vaultKeyMaterial});
    if (!active()) { queue.close?.(); throw new Error('OFFLINE_SESSION_CHANGED'); }
    const synchronizer = createSynchronizer({uid, queue, send, withLease, onState, isOnline, isActive: active});
    const channel = createChannel?.(uid, () => synchronizer.flush()) ?? {notify() {}, close() {}};
    return {
        async enqueue(operation) {
            assertActive();
            if (operation?.uid !== uid) throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
            await queue.enqueue(operation);
            channel.notify();
            return synchronizer.flush();
        },
        async replace(expectedOperation, replacement) {
            assertActive();
            if (expectedOperation?.uid !== uid || replacement?.uid !== uid) throw new Error('OFFLINE_OPERATION_SCOPE_INVALID');
            const result = await withLease(uid, async () => {
                assertActive();
                await queue.replace(expectedOperation, replacement, {isActive: active});
                return {status: 'replaced'};
            });
            if (result?.acquired === false) return {status: 'recoverable-error'};
            assertActive();
            channel.notify();
            return synchronizer.flush();
        },
        flush: () => synchronizer.flush(),
        async discard(operationId) {
            assertActive();
            if (!operationId) throw new Error('OFFLINE_OPERATION_ID_REQUIRED');
            const result = await withLease(uid, async () => {
                assertActive();
                await queue.remove(operationId);
            });
            if (result?.acquired === false) throw new Error('OFFLINE_QUEUE_BUSY');
            channel.notify();
        },
        close() { closed = true; channel.close(); queue.close?.(); }
    };
}
