import {createRouter} from './router.mjs';
import {createAdmissionCoordinator} from './admission-coordinator.mjs';

// Candidate bootstrap coordinator. Identity and Vault are supplied explicitly.
// Routes receive an owner-bound reader, never a key or the raw Vault object.
export function createProtectedSession({getUser, subscribeUser, createVault, routes, admission, getTicket, isTicketActive, onState = () => {}, onError = () => {}}) {
    for (const fn of [getTicket, isTicketActive, admission?.check, admission?.invalidate, admission?.dispose]) {
        if (typeof fn !== 'function') throw new TypeError('INVALID_ADMISSION_DEPENDENCY');
    }
    let disposed = false, observedUid = getUser()?.uid || null;
    let revision = 0, unlocking = 0, router, loggingOut = false;
    let unlockInFlight = false, coordinator;
    const report = state => onState({state, uid: observedUid});
    const vault = createVault({onLock(reason) {
        if (reason !== 'unlock-start') unlocking++;
        try {if (reason !== 'unlock-start') coordinator?.invalidate();}
        finally {try {router?.stop();}
            finally {if (!disposed) report(observedUid ? 'locked' : 'signed-out');}}
    }});
    coordinator = createAdmissionCoordinator({getUser, getTicket, isTicketActive, admission,
        onRefused: () => vault.lock('admission-refused')});
    function synchronize() {
        let uid;
        try {uid = getUser()?.uid || null;}
        catch (error) {
            // Losing the identity source must revoke existing capabilities too,
            // not merely reject the operation which happened to observe it.
            observedUid = null;
            revision++;
            vault.lock('auth-unavailable');
            throw error;
        }
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
            assertUnlocked() {
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                assertOwner(uid, epoch);
                if (!vault.isUnlocked()) throw new Error('VAULT_LOCKED');
            },
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
            },
            // Binary capability of the session: a route can seal and open the
            // document images of this owner only, and loses both on lock, logout or
            // UID change, because the Vault is re-checked before and after each use.
            async sealImage({bytes, aad}) {
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                assertOwner(uid, epoch);
                const sealed = await vault.sealImage(uid, {bytes, aad});
                assertOwner(uid, epoch);
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                return sealed;
            },
            async openImage({payload, envelope, aad}) {
                if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                assertOwner(uid, epoch);
                const plaintext = await vault.openImage(uid, {payload, envelope, aad});
                try {
                    assertOwner(uid, epoch);
                    if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
                } catch (error) { plaintext?.fill?.(0); throw error; }
                return plaintext;
            }
        });
    }]));
    router = createRouter({routes: ownedRoutes, onError(error) { vault.lock('view-error'); onError(error); }});
    let unsubscribe;
    try {
        unsubscribe = subscribeUser(() => { if (!disposed) synchronize(); });
        synchronize();
    } catch (error) {
        disposed = true;
        revision++;
        try {vault.lock('bootstrap-failed');}
        finally {try {coordinator.dispose();} finally {try {vault.dispose?.();} finally {unsubscribe?.();}}}
        throw error;
    }
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
        async navigate(route) {
            if (disposed) return;
            try {
                const uid = synchronize(), epoch = revision;
                if (!uid) return;
                const admissionAttempt = coordinator.begin('navigate');
                await coordinator.check(admissionAttempt);
                assertOwner(uid, epoch);
                coordinator.assertCurrent(admissionAttempt);
                if (disposed || revision !== epoch || observedUid !== uid) return;
                return await router.navigate(route);
            } catch (error) {
                if (!disposed) synchronize();
                if (error.message !== 'ATTEMPT_OBSOLETE') throw error;
            }
        },
        async unlock() {
            if (disposed) throw new Error('SESSION_DISPOSED');
            if (loggingOut) throw new Error('LOGOUT_PENDING');
            if (unlockInFlight) throw new Error('UNLOCK_PENDING');
            const uid = synchronize(), epoch = revision;
            if (!uid) throw new Error('AUTH_REQUIRED');
            const attempt = ++unlocking;
            // Lock invalidates the result immediately, but an underlying password
            // derivation may still be running. Do not overlap a second attempt.
            unlockInFlight = true;
            try {
                const admissionAttempt = coordinator.begin('unlock');
                await coordinator.check(admissionAttempt);
                assertOwner(uid, epoch);
                if (attempt !== unlocking) throw new Error('UNLOCK_CANCELLED');
                await vault.unlock(uid);
                assertOwner(uid, epoch);
                if (attempt !== unlocking) throw new Error('UNLOCK_CANCELLED');
                coordinator.assertCurrent(admissionAttempt);
                if (disposed || revision !== epoch || unlocking !== attempt) throw new Error('UNLOCK_CANCELLED');
                try {report('unlocked');}
                catch (error) {
                    // A failed UI notification must not leave this attempt's key live.
                    // Reentrant lock/disposal already invalidated its ownership.
                    if (!disposed && revision === epoch && unlocking === attempt && observedUid === uid) vault.lock('report-failed');
                    throw error;
                }
            } catch (error) {
                if (!disposed) synchronize();
                throw error;
            } finally { unlockInFlight = false; }
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
            finally {try {coordinator.dispose();} finally { try { vault.dispose?.(); } finally { unsubscribe(); } }}
        }
    });
}
