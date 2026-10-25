const runtimeUrl = new URL(self.location.href).searchParams.get('runtime');
if (!runtimeUrl || new URL(runtimeUrl).origin !== self.location.origin) {
    throw new Error('LOCAL_AI_RUNTIME_URL_SCOPE');
}

// Il listener viene registrato prima di attendere l'import: Chrome puo infatti
// consegnare il primo messaggio del proxy durante una top-level await. Ogni
// messaggio resta accodato sulla medesima Promise e mantiene il proprio ordine.
const handlerPromise = import(runtimeUrl)
    .then(({ WebWorkerMLCEngineHandler }) => new WebWorkerMLCEngineHandler());
self.onmessage = async message => (await handlerPromise).onmessage(message);
