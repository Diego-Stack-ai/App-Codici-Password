import {createIndexedDbQueueLease} from './indexeddb-queue-lease.mjs';

// Candidate only. Both paths acquire the SAME IndexedDB lease. Web Locks is an
// additional scheduling aid, never an alternative authority. No DB upgrade,
// auto-renewal, runtime import or compatibility with older PWA code is provided.
// Only guardTransaction fences writes; checkCurrent cannot guarantee exclusive
// network effects across suspension. Exact duplicate sends need server receipts.
// When the Web Locks API is absent (or malformed) the IndexedDB lease alone still
// provides mutual exclusion. Without the platform lock nothing can cancel a
// blocked/suspended transaction, so acquisition is bounded by acquireTimeoutMs:
// the deadline only covers acquisition, and a lease granted after it is released
// without ever running the task (fail-closed instead of waiting forever).
const failure = code => Object.assign(new Error(code), {code});

export function createHybridQueueCoordinator({locks = globalThis.navigator?.locks, acquireTimeoutMs = 10_000, ...leaseOptions} = {}) {
    if (locks != null && typeof locks.request !== 'function') throw failure('HYBRID_LOCKS_INVALID');
    if (!Number.isSafeInteger(acquireTimeoutMs) || acquireTimeoutMs <= 0) throw failure('HYBRID_TIMEOUT_INVALID');
    const leaseClient = createIndexedDbQueueLease(leaseOptions);
    return Object.freeze({
        async run(task, {signal, isActive = () => true} = {}) {
            if (typeof task !== 'function' || typeof isActive !== 'function') throw failure('HYBRID_TASK_INVALID');
            const checkSession = () => {
                if (signal?.aborted || !isActive()) throw failure('HYBRID_SESSION_INACTIVE');
            };
            checkSession();
            let expired = false, timer;
            const deadline = new Promise((_resolve, reject) => {
                timer = setTimeout(() => { expired = true; reject(failure('HYBRID_ACQUIRE_TIMEOUT')); }, acquireTimeoutMs);
            });
            const timeout = () => failure('HYBRID_ACQUIRE_TIMEOUT');
            const execute = async () => {
                checkSession();
                if (expired) throw timeout();
                const lease = await leaseClient.acquire();
                // A late completion cannot revive ownership: release and refuse.
                if (expired) {
                    if (lease) { try { await lease.release(); } catch {} }
                    throw timeout();
                }
                if (!lease) { checkSession(); return {acquired: false}; }
                // Acquisition is over: the task may legitimately outlive the deadline.
                clearTimeout(timer);
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
            const acquire = () => {
                if (!locks) return execute();
                // Occupied/rejected Web Locks must never fall through to fallback.
                return locks.request(`codex-offline-queue-${leaseOptions.uid}`, {mode: 'exclusive', ifAvailable: true}, lock => {
                    checkSession();
                    return lock ? execute() : {acquired: false};
                });
            };
            try { return await Promise.race([acquire(), deadline]); }
            finally { clearTimeout(timer); }
        }
    });
}
