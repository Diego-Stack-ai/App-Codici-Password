import {createRouter} from './router.mjs';

// Candidate bootstrap coordinator. Identity and Vault are supplied explicitly.
// Routes receive an owner-bound reader, never a key or the raw Vault object.
export function createProtectedSession({getUser, subscribeUser, createVault, routes, onState = () => {}, onError = () => {}}) {
    let disposed = false, observedUid = getUser()?.uid || null;
    let revision = 0, unlocking = 0, router, loggingOut = false;
    const report = state => onState({state, uid: observedUid});
    const vault = createVault({onLock(reason) {
        if (reason !== 'unlock-start') unlocking++;
        router?.stop();
        if (!disposed) report(observedUid ? 'locked' : 'signed-out');
    }});
    function synchronize() {
        const uid = getUser()?.uid || null;
        if (uid !== observedUid) {
            observedUid = uid;
            revision++;
            vault.lock('auth-change');
        }
        return uid;
    }
    function assertOwner(uid, epoch) {
        if (disposed || synchronize() !== uid || revision !== epoch || !uid) throw new Error('AUTH_CHANGED');
    }
    const ownedRoutes = Object.fromEntries(Object.entries(routes).map(([name, mount]) => [name, context => {
        const uid = synchronize(), epoch = revision;
        const unlocked = Boolean(uid && vault.isUnlocked());
        if (context.signal.aborted) return;
        return mount({...context, user: uid ? Object.freeze({uid}) : null, unlocked,
            async read(record) {
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                assertOwner(uid, epoch);
                const value = await vault.read(uid, record);
                assertOwner(uid, epoch);
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                return value;
            },
            async encrypt(value) {
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                assertOwner(uid, epoch);
                const ciphertext = await vault.encrypt(uid, value);
                assertOwner(uid, epoch);
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                return ciphertext;
            }
        });
    }]));
    router = createRouter({routes: ownedRoutes, onError(error) { vault.lock('view-error'); onError(error); }});
    const unsubscribe = subscribeUser(() => { if (!disposed) synchronize(); });
    synchronize();
    return Object.freeze({
        // Bootstrap-only capability: intentionally absent from route contexts.
        async openMutationQueue(options) {
            for (const name of ['onState', 'onCommitted']) {
                if (options?.[name] !== undefined && typeof options[name] !== 'function') throw new Error('QUEUE_OBSERVER_INVALID');
            }
            const uid = synchronize(), epoch = revision;
            assertOwner(uid, epoch);
            if (!vault.isUnlocked()) throw new Error('VAULT_LOCKED');
            if (typeof vault.openQueue !== 'function') throw new Error('QUEUE_UNAVAILABLE');
            const guardObserver = observer => event => {
                try { assertOwner(uid, epoch); if (options?.signal?.aborted || !vault.isUnlocked()) return; } catch { return; }
                return observer?.(event);
            };
            const queue = await vault.openQueue(uid, {...options,
                onState: guardObserver(options?.onState), onCommitted: guardObserver(options?.onCommitted)});
            const check = () => {
                assertOwner(uid, epoch);
                if (options?.signal?.aborted || !vault.isUnlocked()) throw new Error('VIEW_DISPOSED');
            };
            try {
                check();
                return Object.freeze({close: () => queue.close(), ...Object.fromEntries(
                    ['enqueue', 'flush', 'pendingForRecord', 'discard', 'replace'].map(name => [name, async (...args) => {
                        check(); const result = await queue[name](...args); check(); return result;
                    }]))});
            }
            catch (error) { queue.close(); throw error; }
        },
        navigate(route) {
            if (disposed) return Promise.resolve();
            synchronize();
            return router.navigate(route);
        },
        async unlock() {
            if (disposed) throw new Error('SESSION_DISPOSED');
            if (loggingOut) throw new Error('LOGOUT_PENDING');
            const uid = synchronize(), epoch = revision;
            if (!uid) throw new Error('AUTH_REQUIRED');
            const attempt = ++unlocking;
            await vault.unlock(uid);
            assertOwner(uid, epoch);
            if (attempt !== unlocking) throw new Error('UNLOCK_CANCELLED');
            report('unlocked');
        },
        lock(reason = 'manual') { if (!disposed) vault.lock(reason); },
        async logout(signOut) {
            if (disposed) return;
            if (loggingOut) throw new Error('LOGOUT_PENDING');
            loggingOut = true;
            // Invalidate first, even when the identity provider rejects sign-out.
            try { vault.lock('logout'); await signOut(); if (!disposed) synchronize(); }
            finally { loggingOut = false; }
        },
        touch() { if (!disposed) { synchronize(); vault.touch(); } },
        check() { return !disposed && Boolean(synchronize()) && vault.isUnlocked(); },
        dispose() {
            if (disposed) return;
            disposed = true;
            revision++;
            try { vault.lock('dispose'); }
            finally { try { vault.dispose?.(); } finally { unsubscribe(); } }
        }
    });
}
