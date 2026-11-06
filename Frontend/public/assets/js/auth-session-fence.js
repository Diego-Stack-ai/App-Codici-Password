// Non-secret, origin-wide logout state. IndexedDB transactions serialize logout
// and explicit-login completion; notifications are only invalidation hints.
const DB_NAME = 'codex-auth-fence-v1';
const PENDING_PREFIX = 'codex_auth_logout_pending:';
const INITIAL = Object.freeze({revision: 0, nonce: 'initial', denied: false});
const same = (a, b) => a?.revision === b?.revision && a?.nonce === b?.nonce;
const failure = () => Object.assign(new Error('AUTH_SESSION_CHANGED'), {code: 'auth/session-changed'});

function browserTransaction(change) {
    return new Promise((resolve, reject) => {
        let db, transaction, settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            db?.close();
            if (error) reject(error); else resolve(value);
        };
        const timer = setTimeout(() => {
            try { transaction?.abort(); } catch { /* Already settled by the platform. */ }
            finish(failure());
        }, 5000);
        let opening;
        try { opening = indexedDB.open(DB_NAME, 1); }
        catch { finish(failure()); return; }
        opening.onupgradeneeded = () => opening.result.createObjectStore('state');
        opening.onerror = opening.onblocked = () => finish(failure());
        opening.onsuccess = () => {
            db = opening.result;
            if (settled) { db.close(); return; }
            try {
                transaction = db.transaction('state', 'readwrite');
                const store = transaction.objectStore('state');
                const request = store.get('current');
                let result;
                transaction.oncomplete = () => finish(null, result);
                transaction.onabort = transaction.onerror = () => finish(failure());
                request.onsuccess = () => {
                    try {
                        const old = request.result ?? INITIAL;
                        if (!Number.isSafeInteger(old.revision) || old.revision < 0 ||
                            typeof old.nonce !== 'string' || typeof old.denied !== 'boolean') throw failure();
                        result = change({...old});
                        store.put(result, 'current');
                    } catch { transaction.abort(); }
                };
            } catch { finish(failure()); }
        };
    });
}

export function createAuthSessionFence({transact = browserTransaction,
    nonce = () => crypto.randomUUID(), notify = () => {}, invalidate = () => {},
    pending = () => [], markPending = () => {}, clearPending = () => {}} = {}) {
    let current = null, explicitAttempt = 0;
    const adopt = (record, phase = 'committed') => {
        const changed = current && !same(current, record);
        current = record;
        if (changed || record.denied) invalidate(phase);
        return record;
    };
    const refresh = async () => {
        try {
            const state = adopt(await transact(state => state));
            if (pending().length) invalidate('committed');
            return state;
        }
        catch (error) { current = null; invalidate('committed'); throw error; }
    };
    return Object.freeze({
        async readPermit() {
            const state = await refresh();
            return state.denied || pending().length ? null : {...state};
        },
        async isCurrent(permit) {
            const state = await refresh();
            return Boolean(permit && !state.denied && !pending().length && same(state, permit));
        },
        isLocallyAllowed: () => {
            try { return Boolean(current && !current.denied && !pending().length); }
            catch { return false; }
        },
        async deny() {
            explicitAttempt++;
            current = null;
            invalidate('pending');
            // Unique tombstones survive even if the IndexedDB write fails.
            // A later login removes only those it observed, never a newer one.
            try { markPending(nonce()); } catch { /* Still write the authoritative deny if the hint store is full. */ }
            const state = await transact(old => ({revision: old.revision + 1, nonce: nonce(), denied: true}));
            // The sender must finish SDK signOut before its own redirect.
            adopt(state, 'pending');
            notify();
        },
        async beginExplicitLogin() {
            const attempt = ++explicitAttempt;
            const state = await refresh();
            if (attempt !== explicitAttempt) throw failure();
            return Object.freeze({...state, attempt, pending: pending()});
        },
        async completeExplicitLogin(permit, user) {
            if (!permit || permit.attempt !== explicitAttempt || !user?.uid || !user.emailVerified) throw failure();
            const state = await transact(old => {
                if (permit.attempt !== explicitAttempt || !same(old, permit) ||
                    pending().some(key => !permit.pending.includes(key))) throw failure();
                return {revision: old.revision + 1, nonce: nonce(), denied: false};
            });
            clearPending(permit.pending);
            adopt(state);
            notify();
        },
        refresh
    });
}

let channel;
export const authSessionFence = createAuthSessionFence({
    pending() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(PENDING_PREFIX)) keys.push(key);
        }
        return keys;
    },
    markPending(id) { localStorage.setItem(PENDING_PREFIX + id, '1'); },
    clearPending(keys) { for (const key of keys) localStorage.removeItem(key); },
    notify() {
        try { channel?.postMessage('changed'); } catch { /* Hint only. */ }
        try { localStorage.setItem('codex_auth_fence_notice', crypto.randomUUID()); } catch { /* Hint only. */ }
    },
    invalidate(phase) {
        if (typeof window === 'undefined') return;
        if (phase === 'pending') window.privateAuthGate?.block();
        else window.privateAuthGate?.reject();
        window.dispatchEvent(new Event('private-auth-blocked'));
    }
});
if (typeof window !== 'undefined') {
    window.authSessionFence = authSessionFence;
    const refresh = () => { authSessionFence.refresh().catch(() => {}); };
    if (typeof BroadcastChannel === 'function') {
        channel = new BroadcastChannel('codex-auth-fence-v1');
        channel.onmessage = refresh;
    }
    window.addEventListener('storage', event => {
        if (event.key === 'codex_auth_fence_notice' || event.key?.startsWith(PENDING_PREFIX)) refresh();
    });
    window.addEventListener('focus', refresh);
}
