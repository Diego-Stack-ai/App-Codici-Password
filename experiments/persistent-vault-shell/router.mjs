// Each mounted view owns its listeners/async work via an AbortSignal and disposer.
export function createRouter({routes, onError = () => {}}) {
    let controller = null, dispose = null, generation = 0;
    function stop() {
        generation++;
        controller?.abort();
        controller = null;
        const previous = dispose;
        dispose = null;
        previous?.();
    }
    return Object.freeze({
        stop,
        async navigate(route) {
            if (!Object.hasOwn(routes, route)) route = 'overview';
            stop();
            const epoch = generation;
            const current = new AbortController();
            controller = current;
            try {
                const cleanup = await routes[route]({signal: current.signal, route});
                if (epoch !== generation) cleanup?.();
                else dispose = cleanup;
            } catch (error) {
                if (epoch === generation) { stop(); onError(error); }
            }
        }
    });
}
