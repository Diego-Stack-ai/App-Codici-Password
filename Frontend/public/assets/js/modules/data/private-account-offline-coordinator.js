import {createPrivateAccountPilotClient} from './private-account-offline-pilot.js';

let generation = 0;
let session = null;

const emit = detail => {
    globalThis.dispatchEvent?.(new CustomEvent('private-account-offline-state', {detail}));
};

export function getPrivateAccountOfflineState() {
    return session?.state || {state: 'idle'};
}

export async function checkPrivateAccountOfflineQueue() {
    if (!session?.ready) return {status: 'idle'};
    return session.ready.then(client => client?.flush() || {status: 'idle'});
}

export function stopPrivateAccountOfflineCoordinator() {
    generation += 1;
    if (!session) return;
    session.stop();
    session = null;
}

export function startPrivateAccountOfflineCoordinator({uid, vaultKeyMaterial, isActive = () => true, onAttention} = {}) {
    if (!uid || !vaultKeyMaterial) return Promise.resolve(null);
    if (session?.uid === uid) {
        if (typeof onAttention === 'function') session.onAttention = onAttention;
        return session.ready;
    }
    stopPrivateAccountOfflineCoordinator();
    const ownGeneration = ++generation;
    let client = null, stopped = false, notifiedOperationId = null;
    const active = () => !stopped && ownGeneration === generation && isActive();
    const run = () => active() && navigator.onLine ? checkPrivateAccountOfflineQueue().catch(() => null) : null;
    const visible = () => { if (document.visibilityState === 'visible') void run(); };
    const online = () => { void run(); };
    const stop = () => {
        if (stopped) return;
        stopped = true;
        window.removeEventListener('online', online);
        document.removeEventListener('visibilitychange', visible);
        client?.close();
    };
    session = {uid, state: {state: 'idle'}, ready: null, stop,
        onAttention: typeof onAttention === 'function' ? onAttention : () => {}};
    session.ready = createPrivateAccountPilotClient({
        uid, vaultKeyMaterial, isActive: active,
        onState: state => {
            if (!active() || !session || session.uid !== uid) return;
            session.state = state;
            emit(state);
            if (['conflict', 'reconciliation-required'].includes(state.state) && state.operation?.operationId !== notifiedOperationId) {
                notifiedOperationId = state.operation?.operationId || null;
                session.onAttention(state);
            }
        }
    }).then(created => {
        if (!active()) { created.close(); return null; }
        client = created;
        window.addEventListener('online', online);
        document.addEventListener('visibilitychange', visible);
        void client.flush().catch(() => null);
        return client;
    }).catch(error => {
        if (active()) emit({state: 'queue-unavailable', reason: error?.code || error?.message});
        return null;
    });
    return session.ready;
}
