import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_AI_ADVANCED_TIERS, LOCAL_AI_PACKAGE_CATALOG, LOCAL_AI_RUNTIME_PROVENANCE, getLocalAiPackageCandidate } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';
import { createLocalAiRuntimeLoader, readLocalAiRuntimeDiagnostic } from '../Frontend/public/assets/js/modules/assistant/local-ai-runtime-loader.js';
import { readFileSync } from 'node:fs';

test('catalogo fissato: somme, revisioni e runtime hanno provenienza immutabile', () => {
    for (const level of ['A1','A2']) {
        const entry = LOCAL_AI_PACKAGE_CATALOG[level];
        assert.equal(entry.status, 'available');
        assert.match(entry.baseUrl, /^\/assets\/local-ai(?:-packages)?\//);
        if (level === 'A1') assert.match(entry.runtimeUrl, /^\/assets\/local-ai\/.+\/runtime\/factory\.js$/);
        else assert.equal(entry.runtimeUrl, '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js');
        assert.equal(entry.manifest.files.reduce((sum, item) => sum + item.bytes, 0), entry.manifest.approxDownloadBytes);
        assert.match(entry.manifest.model.revision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].gitRevision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].npmIntegrity, /^sha512-/);
    }
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A1.manifest.approxDownloadBytes, 145871600);
    assert.ok(LOCAL_AI_PACKAGE_CATALOG.A2.manifest.approxDownloadBytes > 1_500_000_000);
    assert.ok(LOCAL_AI_PACKAGE_CATALOG.A2.manifest.approxDownloadBytes < 2_500_000_000);
    assert.deepEqual(Object.keys(LOCAL_AI_ADVANCED_TIERS), ['desktop32']);
    assert.equal(LOCAL_AI_ADVANCED_TIERS.desktop32.status, 'available');
    assert.match(LOCAL_AI_ADVANCED_TIERS.desktop32.baseUrl, /^\/assets\/local-ai-packages\/a2\//);
    assert.equal(LOCAL_AI_ADVANCED_TIERS.desktop32.artifactPlan.license, 'Apache-2.0');
    assert.match(LOCAL_AI_ADVANCED_TIERS.desktop32.artifactPlan.revision, /^[a-f0-9]{40}$/);
    assert.equal(getLocalAiPackageCandidate('A2', { tier:'desktop32' }).status, 'available');
});

test('il loader usa il runtime Hosting del pacchetto AI.2 desktop32 materializzato', async () => {
    let imported = '';
    const loader = createLocalAiRuntimeLoader({
        packageManager:{ status:async () => ({ installed:true, active:{ cacheName:'desktop32' } }), markVerified(){} },
        importModule:async url => { imported = url; return { createGenerativeRuntime:async () => ({
            complete:async () => ({ choices:[{ message:{ content:'{"ok":true}' } }] }), dispose:async () => {}
        }) }; }, origin:'https://app.example'
    });
    await loader.load('A2', { tier:'desktop32', assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['desktop32'] } } });
    assert.equal(imported, 'https://app.example/assets/js/modules/assistant/local-ai-generative-runtime-factory.js');
});

test('il runtime WebLLM conserva i pacchetti Hosting e riscrive solo Hugging Face', () => {
    const source = readFileSync(new URL('../Frontend/public/assets/local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/runtime/web-llm.js', import.meta.url), 'utf8');
    const cleanModelUrl = source.match(/function cleanModelUrl\(modelUrl\) \{[\s\S]*?\n\}/)?.[0] || '';
    assert.match(cleanModelUrl, /resolved\.hostname === "huggingface\.co"/);
    assert.match(cleanModelUrl, /resolved\.pathname \+= "resolve\/main\/"/);
    assert.doesNotMatch(cleanModelUrl, /modelUrl \+= "resolve\/main\/"/);
    const factory = readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/local-ai-generative-runtime-factory.js', import.meta.url), 'utf8');
    assert.match(factory, /'qwen2\.5-3b-instruct-q4f16-1-mlc'/);
    assert.match(factory, /context_window_size:spec\.contextWindowSize/);
    assert.match(factory, /new URL\('runtime\/web-llm\.js\?codex-runtime=3', packageBaseUrl\)\.href/);
    assert.match(factory, /await import\(runtimeUrl\)/);
    assert.match(factory, /CreateWebWorkerMLCEngine/);
    assert.match(factory, /local-ai-generative-worker\.js\?runtime=/);
    assert.match(factory, /deleteModelAllInfoInCache/);
    assert.match(factory, /\^SyntaxError\\s\*:/);
    assert.match(factory, /await deleteModelAllInfoInCache\(spec\.modelId, appConfig\)/);
    assert.match(factory, /response_format:options\.responseFormat/);
    const worker = readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/local-ai-generative-worker.js', import.meta.url), 'utf8');
    assert.match(worker, /new URL\(runtimeUrl\)\.origin !== self\.location\.origin/);
    assert.match(worker, /handlerPromise = import\(runtimeUrl\)/);
    assert.match(worker, /\(await handlerPromise\)\.onmessage\(message\)/);
});

test('il runtime usa il manifest tensoriale realmente incluso nei pacchetti MLC', () => {
    const source = readFileSync(new URL('../Frontend/public/assets/local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/runtime/web-llm.js', import.meta.url), 'utf8');
    assert.match(source, /TENSOR_CACHE_MANIFEST_FILENAME = "ndarray-cache\.json"/);
    assert.doesNotMatch(source, /TENSOR_CACHE_MANIFEST_FILENAME = "tensor-cache\.json"/);
    assert.doesNotMatch(source, /new URL\("tensor-cache\.json"/);
    assert.match(source, /new URL\(TENSOR_CACHE_MANIFEST_FILENAME, tensorCacheUrl\)/);
});

test('il loader espone fasi e codice sicuro quando l’inizializzazione AI.2 fallisce', async () => {
    const stages = [];
    const loader = createLocalAiRuntimeLoader({
        packageManager:{ status:async () => ({ installed:true, active:{ cacheName:'desktop32' } }), markVerified(){} },
        importModule:async () => ({ createGenerativeRuntime:async () => { throw new DOMException('dettaglio non esposto', 'OperationError'); } }),
        origin:'https://app.example'
    });
    let failure;
    try {
        await loader.load('A2', {
            tier:'desktop32',
            assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['desktop32'] } },
            onStage:stage => stages.push(stage)
        });
    } catch (error) { failure = error; }
    assert.deepEqual(stages, ['preflight','package-check','capability-check','runtime-import','runtime-initialization']);
    assert.equal(failure.code, 'LOCAL_AI_GPU_OPERATION_FAILED');
    assert.equal(failure.stage, 'runtime-initialization');
    assert.equal(failure.causeName, 'OperationError');
    assert.doesNotMatch(failure.message, /dettaglio non esposto/);
});

test('il loader chiude il runtime e classifica un errore dello smoke test', async () => {
    let disposed = 0;
    const loader = createLocalAiRuntimeLoader({
        packageManager:{ status:async () => ({ installed:true, active:{} }), markVerified(){} },
        importModule:async () => ({ createGenerativeRuntime:async () => ({
            complete:async () => { throw new Error('contenuto interno'); },
            dispose:async () => { disposed++; }
        }) }),
        origin:'https://app.example'
    });
    await assert.rejects(
        loader.load('A2', { tier:'desktop32', assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['desktop32'] } } }),
        error => error.code === 'LOCAL_AI_SMOKE_TEST_FAILED' && error.stage === 'smoke-test'
    );
    assert.equal(disposed, 1);
});

test('la diagnostica scarta messaggi arbitrari e conserva solo codice e fase ammessi', () => {
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ message:'dato sensibile', name:'OperationError' }, 'runtime-import'),
        { code:'LOCAL_AI_GPU_OPERATION_FAILED', stage:'runtime-import', errorName:'OperationError' }
    );
});

test('la diagnostica classifica gli errori noti senza esporne il testo', () => {
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ name:'DeviceLostError', message:'contenuto non pubblicabile' }, 'runtime-initialization'),
        { code:'LOCAL_AI_GPU_DEVICE_LOST', stage:'runtime-initialization', errorName:'DeviceLostError' }
    );
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ name:'CompileError', message:'dettaglio WebAssembly riservato' }, 'runtime-initialization'),
        { code:'LOCAL_AI_WASM_COMPILE_FAILED', stage:'runtime-initialization', errorName:'CompileError' }
    );
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ name:'Error', message:'Failed to fetch a model file at a private URL' }, 'runtime-initialization'),
        { code:'LOCAL_AI_MODEL_FETCH_FAILED', stage:'runtime-initialization', errorName:'Error' }
    );
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ name:'SyntaxError', message:'Unexpected token in JSON' }, 'runtime-initialization'),
        { code:'LOCAL_AI_ARTIFACT_PARSE_FAILED', stage:'runtime-initialization', errorName:'SyntaxError' }
    );
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic("TypeError: Failed to execute 'add' on 'Cache': Request failed", 'runtime-initialization'),
        { code:'LOCAL_AI_MODEL_MANIFEST_UNAVAILABLE', stage:'runtime-initialization', errorName:'TypeError' }
    );
});

test('le impostazioni espongono un solo pacchetto AI.2 con conferma dei 32 GB', () => {
    const source = readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/assistant-package-settings.js', import.meta.url), 'utf8');
    assert.match(source, /getLocalAiPackageCandidate\(level, \{ tier:selectedTier \}\)/);
    assert.match(source, /readDesktop32RamConfirmation/);
    assert.match(source, /writeDesktop32RamConfirmation\(ramConfirmed\)/);
    assert.match(source, /usableTiers\.includes\('desktop32'\)/);
    assert.doesNotMatch(source, /setAttribute\('role', 'radiogroup'\)/);
    assert.match(source, /sessionStorage\.setItem\(diagnosticKey/);
    assert.match(source, /readLocalAiRuntimeDiagnostic/);
    assert.match(source, /\[Local AI verification failed\]/);
    assert.match(source, /errors\[level\]\.errorName/);
});

test('il pannello dei pacchetti segue lo stato dell’interruttore Agente AI', () => {
    const settings = readFileSync(new URL('../Frontend/public/assets/js/modules/settings/impostazioni.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../Frontend/public/impostazioni.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../Frontend/public/assets/css/impostazioni.css', import.meta.url), 'utf8');
    assert.match(html, /id="assistant-package-settings"[\s\S]*?aria-hidden="true" hidden/);
    assert.match(settings, /toggle\.checked = data\?\.settings_ai_assistant === true;\s*syncAssistantPackageSettingsVisibility\(toggle\.checked\)/);
    assert.match(settings, /const enabled = toggle\.checked;\s*syncAssistantPackageSettingsVisibility\(enabled\)/);
    assert.match(settings, /toggle\.checked = !enabled;\s*syncAssistantPackageSettingsVisibility\(toggle\.checked\)/);
    assert.match(settings, /packageSettings\.hidden = !enabled/);
    assert.match(settings, /setAttribute\('aria-hidden', String\(!enabled\)\)/);
    assert.match(css, /\.assistant-package-settings\[hidden\]\s*\{\s*display:none;/);
});

test('il loader non importa runtime quando il pacchetto non è installato', async () => {
    let imports = 0;
    const loader = createLocalAiRuntimeLoader({
        packageManager: { status: async () => ({ installed:false }), markVerified() {} },
        importModule: async () => { imports++; return {}; }, origin:'https://app.example'
    });
    await assert.rejects(loader.load('A1', { assessment:{} }), /LOCAL_AI_PACKAGE_NOT_INSTALLED/);
    assert.equal(imports, 0);
});

test('il loader usa soltanto factory e URL same-origin del catalogo disponibile', async () => {
    let imported = '';
    const runtime = { marker:true };
    const loader = createLocalAiRuntimeLoader({
        packageManager: { status: async () => ({ installed:true, active:{ cacheName:'verified' } }), markVerified() {} },
        importModule: async url => { imported = url; return { createSemanticRuntime: args => ({
            runtime, args, embed:async () => Array(8).fill(0.1), dispose:async () => {}
        }) }; },
        origin:'https://app.example'
    });
    const assessment = { A1:{ status:'candidate', reasons:[] }, A2:{ status:'unavailable', reasons:['webgpu-unavailable'] } };
    const loaded = await loader.load('A1', { assessment });
    assert.match(imported, /^https:\/\/app\.example\/assets\/local-ai\/a2\//);
    assert.equal(loaded.runtime, runtime);
    assert.match(loaded.args.packageBaseUrl, /^https:\/\/app\.example\/assets\/local-ai\/a2\//);
});
