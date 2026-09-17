// Test runner only. DevTools affects this disposable browser target, never the
// host connection. The control channel remains available while HTTP is offline.
// Waiting for the endpoint is exported on its own, and it settles exactly once:
// the listeners are detached the moment the endpoint arrives, so a browser that
// closes normally afterwards is never reported as an early exit.
// The stderr of a browser is kept for diagnosis, with the disposable profile
// token removed: an endpoint that never arrives must say which browser it was.
export const sanitizeBrowserOutput = value => String(value ?? '')
    .replaceAll(/codex-entry-browser-[A-Za-z0-9]+/g, 'codex-entry-browser-<profile>')
    .replaceAll(/\\+/g, '/').slice(-600);
export function awaitDevToolsEndpoint(child, {timeoutMs = 10000, describe} = {}) {
    return new Promise((resolve, reject) => {
        let output = '', settled = false;
        const context = () => {
            let detail = {};
            try {detail = describe?.() ?? {};} catch {detail = {describe: 'unavailable'};}
            return JSON.stringify({...detail, stderr: sanitizeBrowserOutput(output)});
        };
        const detach = () => {clearTimeout(timer); child.stderr?.off?.('data', read); child.off('error', fail); child.off('exit', exited);};
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            detach();
            error ? reject(error) : resolve(value);
        };
        const fail = error => finish(error);
        const exited = code => finish(new Error(`DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:${code} ${context()}`));
        const read = chunk => {
            output = (output + chunk).slice(-16384);
            const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) finish(null, match[1]);
        };
        const timer = setTimeout(() => finish(new Error(`DEVTOOLS_ENDPOINT_TIMEOUT ${context()}`)), timeoutMs);
        child.stderr?.on?.('data', read);
        child.on('error', fail);
        child.on('exit', exited);
    });
}
// Every browser of the matrix must produce one identified result: a missing one,
// an unnamed one, an unexpected device profile or the same (browser, profile) pair
// counted twice is a failure, never a silent reduction of the matrix.
export function assertEveryBrowserReported({browsers, results}) {
    const keyOf = entry => `${typeof entry === 'string' ? entry : entry.name}::${(typeof entry === 'string' ? null : entry.profile)?.name ?? 'single'}`;
    const expected = browsers.map(keyOf);
    if (!Array.isArray(results) || results.length !== expected.length) {
        throw new Error(`ENTRY_BROWSER_RESULTS_MISSING:${results?.length ?? 0}/${expected.length}`);
    }
    const actual = results.map(entry => `${entry?.browser}::${entry?.profile ?? 'single'}`);
    if (actual.some(value => !expected.includes(value))) {
        throw new Error(`ENTRY_BROWSER_RESULT_UNIDENTIFIED:${JSON.stringify(actual)}`);
    }
    if (new Set(actual).size !== actual.length) {
        throw new Error(`ENTRY_BROWSER_RESULT_DUPLICATED:${JSON.stringify(actual)}`);
    }
    return results;
}
export async function attachEntryNetworkControl(child, {restartPhase, forced = false, onReport, describe, deviceProfile = null} = {}) {
    if (restartPhase !== undefined && !['prepare', 'resume'].includes(restartPhase)) throw new Error('INVALID_RESTART_PHASE');
    if (deviceProfile && (!Number.isSafeInteger(deviceProfile.width) || !Number.isSafeInteger(deviceProfile.height) ||
        typeof deviceProfile.name !== 'string' || !deviceProfile.name)) throw new Error('INVALID_DEVICE_PROFILE');
    const endpoint = await awaitDevToolsEndpoint(child, {describe});
    const address = new URL(endpoint);
    if (address.hostname !== '127.0.0.1') throw new Error('DEVTOOLS_NONLOCAL');
    const host = address.host;
    let target;
    for (let i = 0; i < 100 && !target; i++) {
        target = (await (await fetch(`http://${host}/json/list`)).json()).find(item => item.type === 'page' &&
            item.url === (restartPhase || deviceProfile ? 'about:blank' : 'http://127.0.0.1:4188/'));
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
    // A device profile is applied through DevTools before the page loads, so the
    // first paint already has the emulated viewport: the dimensions, the device
    // scale factor and the touch capability are reported with the result.
    if (deviceProfile) {
        await send('Page.enable');
        await send('Emulation.setDeviceMetricsOverride', {width: deviceProfile.width, height: deviceProfile.height,
            deviceScaleFactor: deviceProfile.deviceScaleFactor ?? 1, mobile: deviceProfile.mobile !== false});
        if (deviceProfile.mobile !== false) await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
        await send('Page.addScriptToEvaluateOnNewDocument',
            {source: `window.__entryDeviceProfile = ${JSON.stringify(deviceProfile.name)};`});
    }
    if (restartPhase) {
        await send('Page.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__entryRestartPhase = ${JSON.stringify(restartPhase)}; window.__entryForced = ${JSON.stringify(forced)};`});
        if (restartPhase === 'resume') await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
        await send('Page.navigate', {url: 'http://127.0.0.1:4188/'});
    } else if (deviceProfile) await send('Page.navigate', {url: 'http://127.0.0.1:4188/'});
    const close = () => socket.close();
    close.deviceProfile = deviceProfile ? {...deviceProfile} : null;
    close.quitBrowser = () => send('Browser.close');
    close.inspect = async () => ({state: (await send('Runtime.evaluate', {expression: `JSON.stringify({ready:document.readyState, online:navigator.onLine, controlled:Boolean(navigator.serviceWorker?.controller), status:document.getElementById('status')?.textContent, message:document.getElementById('message')?.textContent, phase:sessionStorage.getItem('synthetic-cold-phase'), failure:window.__coldFailure})`, returnByValue: true})).result?.value, exceptions});
    return close;
}
