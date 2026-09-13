import {createIndexedDbQueueLease} from './indexeddb-queue-lease.mjs';

// Candidate only. Both paths acquire the SAME IndexedDB lease. Web Locks is an
// additional scheduling aid, never an alternative authority. No DB upgrade,
// auto-renewal, runtime import or compatibility with older PWA code is provided.
// Only guardTransaction fences writes; checkCurrent cannot guarantee exclusive
// network effects across suspension. Exact duplicate sends need server receipts.
const failure = code => Object.assign(new Error(code), {code});

export function createHybridQueueCoordinator({locks = globalThis.navigator?.locks, ...leaseOptions} = {}) {
    if (locks != null && typeof locks.request !== 'function') throw failure('HYBRID_LOCKS_INVALID');
    const leaseClient = createIndexedDbQueueLease(leaseOptions);
    return Object.freeze({
        async run(task, {signal, isActive = () => true} = {}) {
            if (typeof task !== 'function' || typeof isActive !== 'function') throw failure('HYBRID_TASK_INVALID');
            const checkSession = () => {
                if (signal?.aborted || !isActive()) throw failure('HYBRID_SESSION_INACTIVE');
            };
            checkSession();
            const execute = async () => {
                checkSession();
                const lease = await leaseClient.acquire();
                if (!lease) { checkSession(); return {acquired: false}; }
                let live = true, value, error, failed = false;
                const controller = new AbortController();
                const invalidate = () => { live = false; controller.abort(); };
                signal?.addEventListener('abort', invalidate, {once: true});
                const check = () => {
                    try { checkSession(); } catch (cause) { invalidate(); throw cause; }
                    if (!live) throw failure('HYBRID_CONTEXT_CLOSED');
                };
                const checkCurrent = async () => {
                    check();
                    const current = await lease.isCurrent();
                    check();
                    if (!current) { invalidate(); throw failure('LEASE_LOST'); }
                };
                const context = Object.freeze({token: lease.token, signal: controller.signal, checkCurrent,
                    async renew() {
                        check();
                        const renewed = await lease.renew();
                        check();
                        if (!renewed) { invalidate(); throw failure('LEASE_LOST'); }
                    },
                    guardTransaction(tx, onValid, onInvalid = () => {}) {
                        try { check(); }
                        catch (cause) { tx.abort(); onInvalid(cause); return; }
                        lease.guardTransaction(tx, () => { check(); return onValid(); }, cause => {
                            if (cause.code === 'LEASE_LOST') invalidate();
                            onInvalid(cause);
                        });
                    }
                });
                try {
                    await checkCurrent();
                    value = await task(context);
                    await checkCurrent();
                } catch (cause) { error = cause; failed = true; }
                finally {
                    invalidate();
                    signal?.removeEventListener('abort', invalidate);
                    try { await lease.release(); } catch (cause) {
                        if (!failed) { error = cause; failed = true; }
                    }
                }
                if (failed) throw error;
                checkSession();
                return {acquired: true, value};
            };
            if (!locks) return execute();
            // Occupied/rejected Web Locks must never fall through to fallback.
            return locks.request(`codex-offline-queue-${leaseOptions.uid}`, {mode: 'exclusive', ifAvailable: true}, lock => {
                checkSession();
                return lock ? execute() : {acquired: false};
            });
        }
    });
}
