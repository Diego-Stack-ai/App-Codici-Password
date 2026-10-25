import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '../Frontend/public');
const executable = process.env.LOCAL_AI_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = value => new Promise(resolve => setTimeout(resolve, value));
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end(`<div id="assistant-package-settings"></div><script type="module">
                import { probeLocalAiCapabilities } from '/assets/js/modules/assistant/advanced-local-ai-contract.js';
                import { LOCAL_AI_PACKAGE_CATALOG } from '/assets/js/modules/assistant/local-ai-package-catalog.js';
                import { initAssistantPackageSettings } from '/assets/js/modules/assistant/assistant-package-settings.js';
                import { createGenerativeRuntime } from '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js';
                window.__probe = await probeLocalAiCapabilities();
                window.__catalog = { A1: LOCAL_AI_PACKAGE_CATALOG.A1.status, A2: LOCAL_AI_PACKAGE_CATALOG.A2.status };
                await initAssistantPackageSettings();
                window.__tiers = [...document.querySelectorAll('.assistant-package-tier')].map(button => ({
                    tier:button.dataset.tier,
                    disabled:button.disabled,
                    selected:button.getAttribute('aria-checked') === 'true',
                    recommended:button.classList.contains('recommended')
                }));
                window.__cacheNames = await caches.keys();
                window.__runtimeFactory = typeof createGenerativeRuntime;
                try {
                    const workerRuntime = new URL('/fixture-web-llm.js', location.href).href;
                    const worker = new Worker('/assets/js/modules/assistant/local-ai-generative-worker.js?runtime=' + encodeURIComponent(workerRuntime), { type:'module' });
                    window.__workerEcho = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error('worker-timeout')), 5000);
                        worker.addEventListener('message', event => { clearTimeout(timer); resolve(event.data); }, { once:true });
                        worker.addEventListener('error', event => { clearTimeout(timer); reject(new Error(event.message)); }, { once:true });
                        worker.postMessage({ ping:'ai2-worker' });
                    });
                    worker.terminate();
                } catch (error) { window.__workerEcho = { error:String(error?.message || error) }; }
                window.__ready = true;
            </script>`);
            return;
        }
        if (url.pathname === '/fixture-web-llm.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`export class WebWorkerMLCEngineHandler { onmessage(event) { self.postMessage({ echo:event.data?.ping }); } }`);
            return;
        }
        const file = path.resolve(root, '.' + url.pathname);
        assert.ok(file.startsWith(root + path.sep));
        response.setHeader('Content-Type', 'text/javascript');
        response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
await access(executable);
const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-local-ai-probe-'));
const browser = spawn(executable, ['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { windowsHide:true, stdio:'ignore' });
const exited = once(browser, 'exit');
let socket;
try {
    let port;
    for (let attempt=0; attempt<100; attempt++) { try { port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
    assert.ok(port, 'Chrome headless non avviato');
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(origin)}`, { method:'PUT' })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket,'open');
    let serial=0; const pending=new Map();
    socket.addEventListener('message', event => { const message=JSON.parse(event.data); if(!message.id)return; const task=pending.get(message.id); pending.delete(message.id); message.error?task.reject(new Error(message.error.message)):task.resolve(message.result); });
    const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    await command('Runtime.enable');
    let value;
    for(let attempt=0;attempt<100;attempt++){
        const result=await command('Runtime.evaluate',{expression:'window.__ready ? ({probe:window.__probe,catalog:window.__catalog,tiers:window.__tiers,caches:window.__cacheNames,runtimeFactory:window.__runtimeFactory,workerEcho:window.__workerEcho}) : null',returnByValue:true});
        value=result.result.value; if(value)break; await delay(100);
    }
    assert.equal(value.probe.A1.status,'candidate');
    assert.equal(value.probe.A2.status,'candidate');
    assert.deepEqual(value.catalog,{A1:'available',A2:'available'});
    assert.deepEqual(value.tiers.map(item => item.tier), ['light','medium','power']);
    assert.deepEqual(value.tiers.filter(item => !item.disabled).map(item => item.tier), value.probe.A2.allowedTiers);
    assert.equal(value.tiers.find(item => item.recommended)?.tier, value.probe.A2.recommendedTier);
    assert.equal(value.tiers.filter(item => item.selected).length, 1);
    assert.deepEqual(value.caches,[]);
    assert.equal(value.runtimeFactory,'function');
    assert.deepEqual(value.workerEcho,{ echo:'ai2-worker' });
    console.log('Local AI browser probe: OK');
} finally {
    socket?.close(); browser.kill(); await Promise.race([exited,delay(2000)]); server.close(); await rm(profile,{recursive:true,force:true});
}
