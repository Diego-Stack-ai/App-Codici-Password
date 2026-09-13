import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {createOfflineMutationSynchronizer} from '../../Frontend/public/assets/js/modules/data/offline-mutation-sync.js';

// Laboratory integration. Existing schema 2 supplied by caller; no DB migration,
// Firebase import, background wakeup or UI cutover. send must use server receipts.
export async function createFencedQueueClient({send, isOnline = () => navigator.onLine,
    isActive = () => true, signal, onState = () => {}, ...options}) {
    if (typeof send !== 'function' || typeof isActive !== 'function' || typeof isOnline !== 'function' ||
        typeof onState !== 'function') throw new Error('FENCED_CLIENT_CONFIG');
    let closed = false, running;
    const active = () => !closed && !signal?.aborted && isActive();
    const writer = await createFencedQueueWriter(options);
    const underLease = task => writer.run(task, {isActive: active, signal});
    const client = {
        flush() {
            if (!running) running = underLease(async api => {
                const synchronizer = createOfflineMutationSynchronizer({uid: options.uid,
                    queue: {list: () => api.list(), remove: operation => api.remove(operation),
                        markForReview: (operation, config) => api.markForReview(operation, config.reviewReason)},
                    send: async operation => {
                        await api.checkCurrent();
                        const result = await send(operation);
                        await api.checkCurrent();
                        return result;
                    },
                    withLease: (_uid, task) => task(), isOnline,
                    isActive: () => active() && !api.signal.aborted,
                    onState: state => { if (active() && !api.signal.aborted) onState(state); }
                });
                return synchronizer.flush();
            }).finally(() => { running = null; });
            return running;
        },
        async enqueue(operation) {
            const result = await underLease(api => api.enqueue(operation));
            if (!result.acquired) return result;
            return client.flush();
        },
        async replace(expected, replacement) {
            const result = await underLease(api => api.replace(expected, replacement));
            if (!result.acquired) return result;
            return client.flush();
        },
        discard(operation) { return underLease(api => api.remove(operation)); },
        close() { closed = true; }
    };
    return Object.freeze(client);
}
