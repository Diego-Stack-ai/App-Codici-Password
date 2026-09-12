// Each mounted view owns its listeners/async work via an AbortSignal and disposer.
export function createRouter({routes, onError = () => {}}) {
    let controller = null, dispose = null, generation = 0;
    function stop() {
        generation++;
        controller?.abort();
        controller = null;
        const previous = dispose;
        dispose = null;
        try { previous?.(); return true; }
        catch (error) { onError(error); return false; }
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
                    try { cleanup?.(); } catch (error) { onError(error); }
                }
                else dispose = cleanup;
            } catch (error) {
                if (epoch === generation) { stop(); onError(error); }
            }
        }
    });
}
