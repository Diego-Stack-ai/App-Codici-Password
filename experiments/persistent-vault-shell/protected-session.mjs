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
