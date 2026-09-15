// Test runner only. DevTools affects this disposable browser target, never the
// host connection. The control channel remains available while HTTP is offline.
export async function attachEntryNetworkControl(child, {restartPhase, forced = false, onReport} = {}) {
    if (restartPhase !== undefined && !['prepare', 'resume'].includes(restartPhase)) throw new Error('INVALID_RESTART_PHASE');
    const endpoint = await new Promise((resolve, reject) => {
        let output = '';
        const finish = (error, value) => { clearTimeout(timer); child.stderr.off('data', read); child.off('error', fail); child.off('exit', exited); error ? reject(error) : resolve(value); };
        const fail = error => finish(error);
        const exited = code => finish(new Error(`DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:${code}`));
        const read = chunk => { output = (output + chunk).slice(-16384); const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) finish(null, match[1]); };
        const timer = setTimeout(() => finish(new Error('DEVTOOLS_ENDPOINT_TIMEOUT')), 10000);
        child.stderr.on('data', read); child.on('error', fail); child.on('exit', exited);
    });
    const address = new URL(endpoint);
    if (address.hostname !== '127.0.0.1') throw new Error('DEVTOOLS_NONLOCAL');
    const host = address.host;
    let target;
    for (let i = 0; i < 100 && !target; i++) {
        target = (await (await fetch(`http://${host}/json/list`)).json()).find(item => item.type === 'page' && item.url === (restartPhase ? 'about:blank' : 'http://127.0.0.1:4188/'));
        if (!target) await new Promise(done => setTimeout(done, 50));
    }
    if (!target) throw new Error('DEVTOOLS_TARGET_MISSING');
    const socket = new WebSocket(target.webSocketDebuggerUrl), pending = new Map(), exceptions = []; let serial = 0;
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true}); });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++serial; pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));
    });
    socket.addEventListener('close', () => { for (const entry of pending.values()) entry.reject(new Error('DEVTOOLS_CLOSED')); pending.clear(); });
    socket.addEventListener('message', async event => {
        const message = JSON.parse(event.data);
        if (message.id) {
            const entry = pending.get(message.id); pending.delete(message.id);
            if (message.error) entry?.reject(new Error(message.error.message)); else entry?.resolve(message.result);
        } else if (message.method === 'Runtime.bindingCalled' && message.params.name === '__entryResult' && forced) {
            if (message.params.payload.length > 10000) return;
            try { onReport?.(JSON.parse(message.params.payload)); } catch { /* Ignore malformed laboratory reports. */ }
        } else if (message.method === 'Runtime.exceptionThrown') {
            exceptions.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
        } else if (message.method === 'Runtime.bindingCalled' && message.params.name === '__entryNetworkControl') {
            const request = JSON.parse(message.params.payload);
            if (!Number.isSafeInteger(request.id) || typeof request.offline !== 'boolean') return;
            try {
                await send('Network.emulateNetworkConditions', {offline: request.offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
                await send('Runtime.evaluate', {expression: `window.__entryNetworkDone(${request.id}, true)`});
            } catch {
                await send('Runtime.evaluate', {expression: `window.__entryNetworkDone(${request.id}, false)`}).catch(() => {});
            }
        }
    });
    await send('Network.enable'); await send('Runtime.enable');
    await send('Runtime.addBinding', {name: '__entryNetworkControl'});
    if (forced) await send('Runtime.addBinding', {name: '__entryResult'});
    if (restartPhase) {
        await send('Page.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__entryRestartPhase = ${JSON.stringify(restartPhase)}; window.__entryForced = ${JSON.stringify(forced)};`});
        if (restartPhase === 'resume') await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
        await send('Page.navigate', {url: 'http://127.0.0.1:4188/'});
    }
    const close = () => socket.close();
    close.quitBrowser = () => send('Browser.close');
    close.inspect = async () => ({state: (await send('Runtime.evaluate', {expression: `JSON.stringify({ready:document.readyState, online:navigator.onLine, controlled:Boolean(navigator.serviceWorker?.controller), status:document.getElementById('status')?.textContent, message:document.getElementById('message')?.textContent, phase:sessionStorage.getItem('synthetic-cold-phase'), failure:window.__coldFailure})`, returnByValue: true})).result?.value, exceptions});
    return close;
}
