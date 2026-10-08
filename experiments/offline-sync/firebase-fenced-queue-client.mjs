import {onAuthStateChanged} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {createFencedQueueClient} from './fenced-queue-client.mjs';

// Candidate only: caller supplies an existing schema-2 database and a Vault/view
// lifetime signal. SDK manages Auth/App Check tokens; no manual bearer storage.
export async function createFirebaseFencedQueueClient({auth, functions, uid, domain, signal,
    isActive = () => true, ...queueOptions}) {
    const names = {'private-account': 'applyPrivateAccountMutation', 'offline-sync': 'applyOfflineMutation'};
    if (!Object.hasOwn(names, domain) || typeof uid !== 'string' || !uid || !signal ||
        typeof signal.addEventListener !== 'function' || typeof isActive !== 'function' ||
        !auth?.app || functions?.app !== auth.app) throw new Error('FENCED_FIREBASE_CONFIG');
    const controller = new AbortController();
    let disposed = false, client, unsubscribe = () => {};
    const dispose = () => {
        if (disposed) return;
        disposed = true; controller.abort(); unsubscribe();
        signal.removeEventListener('abort', dispose); client?.close();
    };
    const active = () => {
        try { if (!disposed && (signal.aborted || auth.currentUser?.uid !== uid || !isActive())) dispose(); }
        catch { dispose(); }
        return !disposed;
    };
    const check = () => {
        if (!active()) throw Object.assign(new Error('FENCED_FIREBASE_SESSION_INACTIVE'), {code: 'FENCED_FIREBASE_SESSION_INACTIVE'});
    };
    try {
        check(); signal.addEventListener('abort', dispose, {once: true});
        unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) dispose(); });
        if (disposed) unsubscribe();
        check();
        const callable = httpsCallable(functions, names[domain]);
        client = await createFencedQueueClient({...queueOptions, uid, signal: controller.signal, isActive: active,
            async send(operation) {
                check();
                if (operation?.uid !== uid || (domain === 'private-account'
                    ? !operation.record || Object.hasOwn(operation, 'encryptedPayload')
                    : typeof operation.encryptedPayload !== 'string' || Object.hasOwn(operation, 'record'))) {
                    throw new Error('FENCED_FIREBASE_OPERATION_SCOPE');
                }
                // Capture before the SDK waits for tokens. The original queued
                // command cannot be changed by a caller while this send waits.
                const command = structuredClone(operation);
                check();
                const result = await callable(command);
                check();
                return result.data;
            }});
        if (!active()) { client.close(); check(); }
        return Object.freeze({...client, close: dispose});
    } catch (error) { dispose(); throw error; }
    finally { queueOptions.vaultKeyMaterial = null; }
}
