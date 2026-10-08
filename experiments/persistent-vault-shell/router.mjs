// Each mounted view owns its listeners/async work via an AbortSignal and disposer.
export function createRouter({routes, onError = () => {}}) {
    let controller = null, dispose = null, generation = 0;
    let stopping = false, pendingCleanup = false;
    function stop() {
        generation++;
        if (stopping) return false;
        stopping = true;
        const previousController = controller;
        controller = null;
        const previous = dispose;
        dispose = null;
        try {
            // Detach ownership and close the gate before synchronous abort listeners run.
            previousController?.abort();
            const result = previous?.();
            const then = result != null ? result.then : undefined;
            if (typeof then === 'function') {
                pendingCleanup = true;
                // Capture then once: hostile/accessor thenables must not be read twice.
                new Promise((resolve, reject) => {then.call(result, resolve, reject);}).then(
                    () => {pendingCleanup = false;},
                    error => {
                        try { onError(error); }
                        catch { /* Cleanup was reported; observer throws must not leak a rejection. */ }
                        finally { pendingCleanup = false; }
                    }
                );
            }
            return !pendingCleanup;
        }
        catch (error) { onError(error); return false; }
        finally { stopping = false; }
    }
    return Object.freeze({
        stop,
        async navigate(route) {
            if (!Object.hasOwn(routes, route)) route = 'overview';
            if (!stop()) return;
            const epoch = generation;
            const current = new AbortController();
            controller = current;
            try {
                const cleanup = await routes[route]({signal: current.signal, route});
                if (epoch !== generation) {
                    // A stale mount still owns resources requiring cleanup.
                    // Await its disposer and preserve the fatal error boundary.
                    try { await cleanup?.(); } catch (error) { onError(error); }
                }
                else dispose = cleanup;
            } catch (error) {
                if (epoch === generation) { stop(); onError(error); }
            }
        }
    });
}
