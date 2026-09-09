import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {functions} from '../../firebase-config.js?v=1.2.66';
import {createOfflineMutationQueue, createOfflineQueueChannel, withOfflineQueueLease} from './offline-mutation-queue.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';
import {createOfflineMutationClientCore, OFFLINE_MUTATION_WRITES_ENABLED} from './offline-mutation-client-core.js';

export {OFFLINE_MUTATION_WRITES_ENABLED};

export function createOfflineMutationClient(options) {
    const callable = httpsCallable(functions, 'applyOfflineMutation');
    return createOfflineMutationClientCore({
        ...options,
        createQueue: createOfflineMutationQueue,
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: withOfflineQueueLease,
        createChannel: createOfflineQueueChannel,
        send: operation => callable(operation).then(result => result.data)
    });
}
