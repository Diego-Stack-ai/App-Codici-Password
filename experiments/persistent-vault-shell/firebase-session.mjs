import {onAuthStateChanged, signOut} from 'firebase/auth';
import {doc, getDoc} from 'firebase/firestore';
import {createLegacyAdapter} from './legacy-adapter.mjs';
import {createProtectedSession} from './protected-session.mjs';
import {bindBrowserSession, clearLegacyUnlock} from './browser-session-boundary.mjs';

// Candidate integration, not imported by the published application or preview.
// The caller supplies initialized SDK instances and an abortable password UI.
export function createFirebaseSession({auth, db, cryptoApi, requestPassword, routes, createQueueClient, admission, getTicket, isTicketActive, presentation, onState, onError, browserTarget = globalThis}) {
    if (typeof presentation?.invalidate !== 'function' || typeof presentation?.dispose !== 'function') throw new TypeError('INVALID_PRESENTATION');
    // Fail before creating a session if legacy storage cannot be cleared.
    clearLegacyUnlock(globalThis.sessionStorage);
    const getUser = () => auth.currentUser;
    const listeners = new Set();
    let closed = false, unsubscribeAuth, detach, session;
    let observedUid, initialized = false, authEpoch = 0, draining = false, pending;
    const subscribeUser = listener => {
        if (closed) throw new Error('SESSION_DISPOSED');
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    function dispose() {
        if (closed) return;
        closed = true; authEpoch++; pending = undefined; listeners.clear();
        try {detach?.();}
        finally {try {session?.dispose();}
            finally {try {unsubscribeAuth?.();} finally {presentation.dispose();}}}
    }
    function onAuthEvent(user) {
        if (closed) return;
        pending = {user, epoch: ++authEpoch};
        if (draining) return;
        draining = true;
        try {
            while (pending && !closed) {
                const event = pending; pending = undefined;
                let failed = false, failure;
                const attempt = fn => {try {return fn();} catch (error) {if (!failed) {failed = true; failure = error;}}};
                const uid = attempt(() => event.user?.uid ?? null);
                const currentUid = attempt(() => getUser()?.uid ?? null);
                const start = !initialized || uid !== observedUid;
                if (failed || uid !== currentUid || start) {
                    attempt(() => presentation.invalidate());
                    attempt(() => session.lock());
                }
                if (!failed && uid === currentUid && !closed && event.epoch === authEpoch) {
                    initialized = true; observedUid = uid;
                    for (const listener of [...listeners]) {
                        if (closed || event.epoch !== authEpoch) break;
                        if (listeners.has(listener)) attempt(() => listener(event.user));
                    }
                    if (!failed && !closed && event.epoch === authEpoch && start && uid) {
                        const latest = attempt(() => getUser()?.uid ?? null);
                        if (!failed && latest === uid && !closed && event.epoch === authEpoch) {
                            attempt(() => presentation.beginIdentity?.());
                        }
                    }
                }
                if (failed) {
                    // A broken observer is terminal, including falsy thrown values.
                    attempt(dispose);
                    if (typeof onError === 'function') onError(failure);
                    else throw failure;
                }
            }
        } finally {draining = false;}
    }
    const assertActive = (signal, uid) => {
        if (signal.aborted || auth.currentUser?.uid !== uid) throw new Error('VIEW_DISPOSED');
    };
    const segment = value => {
        if (typeof value !== 'string' || !value || value.includes('/') || value === '.' || value === '..') throw new Error('INVALID_RECORD_ID');
        return value;
    };
    const boundRoutes = Object.fromEntries(Object.entries(routes).map(([name, mount]) => [name, context => mount({
        ...context,
        async readAccount({id, companyId, field}) {
            if (!['username', 'account', 'password', 'nomeAccount'].includes(field)) throw new Error('FIELD_NOT_ALLOWED');
            const uid = context.user?.uid;
            assertActive(context.signal, uid);
            if (!uid || !context.unlocked) throw new Error('VAULT_LOCKED');
            const path = ['users', uid];
            if (companyId !== undefined) path.push('aziende', segment(companyId));
            path.push('accounts', segment(id));
            const snapshot = await getDoc(doc(db, ...path));
            assertActive(context.signal, uid);
            if (!snapshot.exists()) throw new Error('RECORD_NOT_FOUND');
            const record = snapshot.data();
            if (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid) throw new Error('OWNER_MISMATCH');
            // No automatic plaintext fallback or legacy migration.
            return context.read({ownerId: uid, ciphertext: record[field]});
        }
    })]));
    try {session = createProtectedSession({getUser, subscribeUser, routes: boundRoutes, onState, onError, admission, getTicket, isTicketActive,
        createVault: callbacks => {
            const adapter = createLegacyAdapter({getUser, subscribeUser, cryptoApi, requestPassword, ...callbacks,
                openQueueWithKey: typeof createQueueClient === 'function'
                    ? (vaultKeyMaterial, scope) => createQueueClient({...scope, vaultKeyMaterial}) : undefined,
                async loadSecurity(uid, {signal}) {
                    assertActive(signal, uid);
                    const snapshot = await getDoc(doc(db, 'users', uid, 'settings', 'security'));
                    assertActive(signal, uid);
                    return snapshot.exists() ? snapshot.data() : null;
                }
            });
            return {unlock: () => adapter.unlock(), read: (uid, record) => adapter.read(record),
                encrypt: (uid, value) => adapter.encrypt(value),
                sealImage: (uid, options) => adapter.sealImage(options),
                openImage: (uid, options) => adapter.openImage(options),
                openQueue: (uid, options) => adapter.openQueue(options),
                lock: adapter.lock, isUnlocked: adapter.isUnlocked, touch: adapter.touch, dispose: adapter.dispose};
        }
    });
        detach = bindBrowserSession(session, browserTarget);
        // Establish the initial epoch only after both internal listeners exist.
        onAuthEvent(getUser());
        if (closed) throw new Error('AUTH_OBSERVER_INITIALIZATION_FAILED');
        const off = onAuthStateChanged(auth, onAuthEvent, error => {
            try {dispose();} finally {if (typeof onError === 'function') onError(error);}
        });
        if (closed) off(); else unsubscribeAuth = off;
    } catch (error) {try {dispose();} finally {throw error;}}
    return Object.freeze({...session, logout: () => session.logout(async () => {
        presentation.invalidate();
        try {await signOut(auth);} finally {presentation.invalidate();}
    }),
        dispose});
}
