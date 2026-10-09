import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {auth, functions} from '../../firebase-config.js?v=1.2.140';
import {createOfflineMutationQueue, createOfflineQueueChannel, createOfflineQueueReader, withOfflineQueueLease} from './offline-mutation-queue.js';
import {createOfflineMutationSynchronizer} from './offline-mutation-sync.js';
import {createOfflineMutationClientCore, OFFLINE_MUTATION_WRITES_ENABLED} from './offline-mutation-client-core.js';

export {OFFLINE_MUTATION_WRITES_ENABLED};

export function createOfflineMutationClient(options) {
    const callable = httpsCallable(functions, options?.callableName || 'applyOfflineMutation');
    return createOfflineMutationClientCore({
        ...options,
        isActive: () => auth.currentUser?.uid === options.uid && (!options.isActive || options.isActive()),
        createQueue: createOfflineMutationQueue,
        createQueueReader: createOfflineQueueReader,
        createSynchronizer: createOfflineMutationSynchronizer,
        // [M6-A-8c] Il confine `withLease` resta **quello di sempre** (`withOfflineQueueLease`) per
        // ogni chiamante. Solo un'iniezione **esplicita** lo sostituisce: oggi lo fa il pilota
        // account privato e soltanto sotto il suo opt-in (`?m6lease=1` più assenza reale di Web
        // Locks). Nessun percorso dell'app cambia comportamento per il solo fatto che questo file
        // conosca il lease.
        withLease: options?.withLease ?? withOfflineQueueLease,
        createChannel: createOfflineQueueChannel,
        send: operation => callable(operation).then(result => result.data)
    });
}
