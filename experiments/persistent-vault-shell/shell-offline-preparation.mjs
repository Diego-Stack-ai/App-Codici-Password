// Coordinates the canonical ciphertext prefetch without tying it to a route.
// In-flight SDK reads cannot be cancelled; stale results never update this UI.
export function createShellOfflinePreparation({getUser, prepare, onState, events = globalThis, isOnline = () => globalThis.navigator?.onLine !== false}) {
    let generation = 0, disposed = false, pending;
    const current = (ticket, uid) => !disposed && ticket === generation && getUser()?.uid === uid;
    function clear() { generation++; pending = undefined; if (!disposed) onState('idle'); }
    function refresh() {
        const uid = getUser()?.uid;
        if (disposed || !uid) return Promise.resolve(null);
        if (!isOnline()) { onState('offline'); return Promise.resolve(null); }
        if (pending?.uid === uid) return pending.promise;
        const ticket = ++generation;
        onState('preparing');
        const promise = Promise.resolve().then(() => {
            if (!current(ticket, uid)) return null;
            return prepare({uid}, 'home');
        }).then(result => {
            if (!current(ticket, uid)) return null;
            onState(result?.complete ? 'ready' : 'incomplete');
            return result;
        }).catch(() => { if (current(ticket, uid)) onState('incomplete'); return null; })
            .finally(() => { if (current(ticket, uid)) pending = undefined; });
        pending = {uid, promise}; return promise;
    }
    const online = () => { void refresh(); };
    const offline = () => { generation++; pending = undefined; if (!disposed && getUser()?.uid) onState('offline'); };
    events.addEventListener('online', online);
    events.addEventListener('offline', offline);
    return Object.freeze({refresh, clear, dispose() { if (disposed) return; clear(); disposed = true; events.removeEventListener('online', online); events.removeEventListener('offline', offline); }});
}
