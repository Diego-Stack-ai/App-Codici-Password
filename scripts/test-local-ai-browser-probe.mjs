import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, mkdtemp, rm, access, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '../Frontend/public');
const executable = process.env.LOCAL_AI_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const realModelProbe = process.env.LOCAL_AI_REAL_MODEL_PROBE === '1';
const windowedProbe = process.env.LOCAL_AI_WINDOWED_PROBE === '1';
const externalBrowserProbe = process.env.LOCAL_AI_EXTERNAL_BROWSER === '1';
const delay = value => new Promise(resolve => setTimeout(resolve, value));
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end(`<main style="font:16px/1.5 system-ui;padding:24px;max-width:900px"><h1>Collaudo AI.2</h1><pre id="probe-status" style="white-space:pre-wrap">Avvio…</pre><div id="assistant-package-settings"></div></main><script>
                window.__pageErrors = [];
                window.__setProbeStage = (stage, detail = '') => {
                    window.__stage = stage;
                    document.querySelector('#probe-status').textContent = 'Fase: ' + stage + (detail ? '\\n' + detail : '');
                };
                addEventListener('error', event => window.__pageErrors.push(String(event.error?.stack || event.message || 'page-error')));
                addEventListener('unhandledrejection', event => window.__pageErrors.push(String(event.reason?.stack || event.reason || 'unhandled-rejection')));
            </script><script type="module">
                import { assessAdvancedRuntimeBenchmark, createLocalAiEnvelope, probeLocalAiCapabilities } from '/assets/js/modules/assistant/advanced-local-ai-contract.js';
                import { LOCAL_AI_PACKAGE_CATALOG } from '/assets/js/modules/assistant/local-ai-package-catalog.js';
                import { initAssistantPackageSettings } from '/assets/js/modules/assistant/assistant-package-settings.js';
                import { createGenerativeRuntime } from '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js';
                import { createA2IntentRequest, parseA2IntentContent, stabilizeA2Intent } from '/assets/js/modules/assistant/local-ai-assistant-service.js';
                window.__setProbeStage('capability-probe');
                localStorage.setItem('codex.local-ai.desktop32-ram-confirmed.v1', 'true');
                window.__probe = await probeLocalAiCapabilities();
                window.__setProbeStage('settings');
                window.__catalog = { A1: LOCAL_AI_PACKAGE_CATALOG.A1.status, A2: LOCAL_AI_PACKAGE_CATALOG.A2.status };
                await initAssistantPackageSettings();
                window.__setProbeStage('worker');
                window.__desktop32 = {
                    confirmationChecked:Boolean(document.querySelector('.assistant-package-ram-confirmation input')?.checked),
                    installDisabled:Boolean([...document.querySelectorAll('.assistant-package-actions button')]
                        .find(button => button.textContent.trim() === 'Installa')?.disabled)
                };
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
                if (${JSON.stringify(realModelProbe)}) {
                    let runtime;
                    try {
                        const candidate = LOCAL_AI_PACKAGE_CATALOG.A2;
                        window.__setProbeStage('model-initialization', 'Caricamento del pacchetto locale…');
                        const initializationStarted = performance.now();
                        runtime = await createGenerativeRuntime({
                            manifest:candidate.manifest,
                            packageBaseUrl:new URL(candidate.baseUrl, location.href).href,
                            onProgress:report => {
                                window.__realModelProgress = report;
                                window.__setProbeStage('model-initialization', JSON.stringify(report));
                            }
                        });
                        window.__setProbeStage('first-token');
                        const firstTokenStarted = performance.now();
                        const stream = await runtime.complete([
                            { role:'system', content:'Rispondi soltanto con OK.' },
                            { role:'user', content:'Verifica reattività.' }
                        ], { maxTokens:8, temperature:0, stream:true });
                        let firstTokenMs = null;
                        let streamedText = '';
                        for await (const chunk of stream) {
                            const text = String(chunk?.choices?.[0]?.delta?.content || '');
                            if (text && firstTokenMs === null) firstTokenMs = performance.now() - firstTokenStarted;
                            streamedText += text;
                        }
                        if (firstTokenMs === null) throw new Error('LOCAL_AI_EMPTY_STREAM');
                        const initializationMs = performance.now() - initializationStarted;
                        const completionStarted = performance.now();
                        const result = await runtime.complete([
                            { role:'system', content:'Rispondi soltanto con {"ok":true}.' },
                            { role:'user', content:'Verifica locale.' }
                        ], { maxTokens:16, temperature:0 });
                        const completionMs = performance.now() - completionStarted;
                        const completionTokens = Number(result?.usage?.completion_tokens) || 0;
                        const tokensPerSecond = completionTokens > 0 && completionMs > 0
                            ? completionTokens / (completionMs / 1000) : null;
                        const content = String(result?.choices?.[0]?.message?.content || '');
                        const parsed = JSON.parse(content);
                        window.__setProbeStage('intent-quality');
                        const guide = {
                            pageId:'impostazioni',
                            purpose:'Configura preferenze, sicurezza, notifiche, backup e assistente locale.',
                            steps:[{ body:'Scegli tema e lingua.' }, { body:'Gestisci sicurezza e notifiche.' }]
                        };
                        const question = 'Spiegami questa pagina e dimmi a cosa serve.';
                        const envelope = createLocalAiEnvelope({
                            level:'A2', locale:'it-IT', page:{ pageId:guide.pageId, purpose:guide.purpose },
                            question, turns:[], shortlist:[]
                        });
                        const intentRequest = createA2IntentRequest({ question, envelope, guide });
                        const intentResult = await runtime.complete(intentRequest.messages, intentRequest.options);
                        const rawIntent = parseA2IntentContent(intentResult?.choices?.[0]?.message?.content);
                        const stableIntent = stabilizeA2Intent({ intent:rawIntent, question, guide });
                        const qualityCases = [];
                        for (const testCase of [
                            { question:'Trova le scadnze dell assicuraizone e dimmi quante sono.', type:'semantic_search' },
                            { question:'Ciao', type:'clarify' },
                            { question:'Apri il secondo', type:'select_result', ordinal:2 },
                            { question:'A cosa serve questa pagina? Rispondi in una sola frase.', type:'explain_page', oneLine:true }
                        ]) {
                            const caseIntent = stabilizeA2Intent({ intent:{}, question:testCase.question, guide });
                            qualityCases.push({
                                question:testCase.question,
                                expected:testCase,
                                intent:caseIntent,
                                passed:caseIntent.type === testCase.type
                                    && (!testCase.ordinal || caseIntent.resultOrdinal === testCase.ordinal)
                                    && (!testCase.oneLine || (!caseIntent.query.includes('\\n') && !caseIntent.query.includes('•')))
                            });
                        }
                        window.__setProbeStage('interruption');
                        const cancelStream = await runtime.complete([
                            { role:'user', content:'Conta lentamente da uno a cento, un numero per riga.' }
                        ], { maxTokens:128, temperature:0, stream:true });
                        const cancelStarted = performance.now();
                        let cancelRequestedAt = null;
                        const cancelTimer = setTimeout(async () => {
                            cancelRequestedAt = performance.now();
                            await runtime.interrupt();
                        }, 100);
                        try { for await (const _chunk of cancelStream) { /* consuma fino all'interruzione */ } }
                        catch { /* L'interruzione puo chiudere lo stream con un errore controllato. */ }
                        clearTimeout(cancelTimer);
                        const cancelMs = performance.now() - (cancelRequestedAt || cancelStarted);
                        const benchmark = assessAdvancedRuntimeBenchmark({
                            tier:'desktop32',
                            firstTokenMs,
                            tokensPerSecond:tokensPerSecond || 0,
                            peakMemoryMiB:candidate.manifest.maxResidentBytes / 1024 / 1024,
                            cancelMs
                        });
                        window.__realModelProbe = {
                            ok:parsed?.ok === true && Object.keys(parsed).length === 1
                                && stableIntent.type === 'explain_page'
                                && stableIntent.query.includes('Configura preferenze')
                                && qualityCases.every(testCase => testCase.passed)
                                && /^\s*OK[.!]?\s*$/i.test(streamedText)
                                && benchmark.passed,
                            progress:window.__realModelProgress || null,
                            smoke:parsed,
                            metrics:{ initializationMs, firstTokenMs, completionMs, completionTokens, tokensPerSecond, cancelMs },
                            streamedText,
                            benchmark,
                            rawIntent,
                            stableIntent,
                            qualityCases
                        };
                    } catch (error) {
                        window.__realModelProbe = {
                            ok:false,
                            type:typeof error,
                            name:String(error?.name || ''),
                            message:String(error?.message || error),
                            stack:String(error?.stack || '')
                        };
                    } finally {
                        await runtime?.dispose?.();
                        await Promise.all((await caches.keys()).map(name => caches.delete(name)));
                    }
                }
                window.__ready = true;
                window.__stage = 'ready';
                document.querySelector('#probe-status').textContent = JSON.stringify({
                    stage:window.__stage,
                    probe:window.__probe,
                    realModelProbe:window.__realModelProbe,
                    pageErrors:window.__pageErrors
                }, null, 2);
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
        const info = await stat(file);
        assert.ok(info.isFile());
        const extension = path.extname(file).toLowerCase();
        const contentTypes = {
            '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json',
            '.wasm':'application/wasm', '.bin':'application/octet-stream', '.txt':'text/plain'
        };
        response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
        response.setHeader('Content-Length', String(info.size));
        if (request.method === 'HEAD') { response.end(); return; }
        createReadStream(file).pipe(response);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (externalBrowserProbe) {
    console.log(`Local AI external browser probe: ${origin}`);
    await new Promise(resolve => {
        process.once('SIGINT', resolve);
        process.once('SIGTERM', resolve);
    });
    server.close();
    process.exit(0);
}
await access(executable);
const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-local-ai-probe-'));
const browserModeArgs = windowedProbe
    ? ['--window-position=-32000,-32000','--window-size=800,600']
    : ['--headless=new'];
const browser = spawn(executable, [...browserModeArgs,'--enable-unsafe-webgpu','--no-first-run','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { windowsHide:!windowedProbe, stdio:'ignore' });
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
    const attempts = realModelProbe ? 2400 : 300;
    for(let attempt=0;attempt<attempts;attempt++){
        const result=await command('Runtime.evaluate',{expression:'window.__ready ? ({probe:window.__probe,catalog:window.__catalog,desktop32:window.__desktop32,caches:window.__cacheNames,runtimeFactory:window.__runtimeFactory,workerEcho:window.__workerEcho,realModelProbe:window.__realModelProbe,pageErrors:window.__pageErrors}) : (window.__pageErrors?.length ? ({pageErrors:window.__pageErrors}) : null)',returnByValue:true});
        value=result.result.value; if(value)break; await delay(100);
    }
    if (!value) {
        const diagnostic = await command('Runtime.evaluate', {
            expression:'({ stage:window.__stage || null, probe:window.__probe || null, pageErrors:window.__pageErrors || [] })',
            returnByValue:true
        });
        console.error('Local AI browser probe timeout:', JSON.stringify(diagnostic.result.value));
    }
    assert.ok(value, 'Il probe browser non ha prodotto un risultato entro il limite');
    assert.deepEqual(value.pageErrors, []);
    assert.equal(value.probe.A1.status,'candidate');
    assert.deepEqual(value.catalog,{A1:'available',A2:'available'});
    if (value.probe.A2.status === 'candidate') {
        assert.deepEqual(value.probe.A2.allowedTiers, ['desktop32']);
        assert.deepEqual(value.desktop32, { confirmationChecked:true, installDisabled:false });
    } else {
        assert.equal(value.probe.A2.status, 'unavailable');
        assert.ok(value.probe.A2.reasons.includes('webgpu-unavailable'));
        assert.deepEqual(value.desktop32, { confirmationChecked:true, installDisabled:true });
    }
    assert.deepEqual(value.caches,[]);
    assert.equal(value.runtimeFactory,'function');
    assert.deepEqual(value.workerEcho,{ echo:'ai2-worker' });
    if (realModelProbe) {
        console.log('Local AI real model probe:', JSON.stringify(value.realModelProbe));
        assert.equal(value.realModelProbe?.ok, true, value.realModelProbe?.message || 'inizializzazione reale fallita');
        assert.ok(value.realModelProbe?.metrics?.initializationMs > 0);
        assert.ok(value.realModelProbe?.metrics?.firstTokenMs > 0);
        assert.ok(value.realModelProbe?.metrics?.completionMs > 0);
        assert.equal(value.realModelProbe?.benchmark?.passed, true);
    }
    console.log('Local AI browser probe: OK');
} finally {
    socket?.close(); browser.kill(); await Promise.race([exited,delay(2000)]); server.close(); await rm(profile,{recursive:true,force:true});
}
