import {createFencedQueueWriter} from './fenced-queue-writer.mjs';
import {createOfflineMutationSynchronizer} from '../../Frontend/public/assets/js/modules/data/offline-mutation-sync.js';

// Laboratory integration. Existing schema 2 supplied by caller; no DB migration,
// Firebase import, background wakeup or UI cutover. send must use server receipts.
export async function createFencedQueueClient({send, isOnline = () => navigator.onLine,
    isActive = () => true, signal, onState = () => {}, renewEveryMs = 0, ...options}) {
    if (typeof send !== 'function' || typeof isActive !== 'function' || typeof isOnline !== 'function' ||
        typeof onState !== 'function') throw new Error('FENCED_CLIENT_CONFIG');
    if (!Number.isSafeInteger(renewEveryMs) || renewEveryMs < 0 || renewEveryMs >= (options.ttlMs ?? 30000)) throw new Error('FENCED_CLIENT_RENEWAL_CONFIG');
    let closed = false, running;
    const renewalStops = new Set();
    const active = () => !closed && !signal?.aborted && isActive();
    const writer = await createFencedQueueWriter(options);
    const underLease = task => writer.run(task, {isActive: active, signal});
    const client = {
        flush() {
            if (!running) running = underLease(async api => {
                let renewalFailure, renewing = false;
                const stop = () => {
                    clearInterval(timer); renewalStops.delete(stop);
                    api.signal.removeEventListener('abort', stop); signal?.removeEventListener('abort', stop);
                };
                const timer = renewEveryMs ? setInterval(async () => {
                    if (!active() || api.signal.aborted) { stop(); return; }
                    if (renewing) return;
                    renewing = true;
                    try { await api.renew(); }
                    catch (error) { renewalFailure = error; stop(); }
                    finally { renewing = false; }
                }, renewEveryMs) : undefined;
                renewalStops.add(stop); api.signal.addEventListener('abort', stop, {once: true}); signal?.addEventListener('abort', stop, {once: true});
                const check = async () => {
                    if (renewalFailure) throw renewalFailure;
                    await api.checkCurrent();
                    if (renewalFailure) throw renewalFailure;
                };
                const synchronizer = createOfflineMutationSynchronizer({uid: options.uid,
                    queue: {list: () => api.list(), remove: operation => api.remove(operation),
                        markForReview: (operation, config) => api.markForReview(operation, config.reviewReason)},
                    send: async operation => {
                        await check();
                        const result = await send(operation);
                        await check();
                        return result;
                    },
                    withLease: (_uid, task) => task(), isOnline,
                    isActive: () => active() && !api.signal.aborted && !renewalFailure,
                    onState: state => { if (active() && !api.signal.aborted && !renewalFailure) onState(state); }
                });
                try { const result = await synchronizer.flush(); if (renewalFailure) throw renewalFailure; return result; }
                finally { stop(); }
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
        close() { closed = true; for (const stop of [...renewalStops]) stop(); }
    };
    return Object.freeze(client);
}
