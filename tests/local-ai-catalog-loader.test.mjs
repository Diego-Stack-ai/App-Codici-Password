import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_AI_ADVANCED_TIERS, LOCAL_AI_PACKAGE_CATALOG, LOCAL_AI_RUNTIME_PROVENANCE, getLocalAiPackageCandidate } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';
import { createLocalAiRuntimeLoader, readLocalAiRuntimeDiagnostic } from '../Frontend/public/assets/js/modules/assistant/local-ai-runtime-loader.js';
import { readFileSync } from 'node:fs';

test('catalogo fissato: somme, revisioni e runtime hanno provenienza immutabile', () => {
    for (const level of ['A1','A2']) {
        const entry = LOCAL_AI_PACKAGE_CATALOG[level];
        assert.equal(entry.status, 'available');
        assert.match(entry.baseUrl, /^\/assets\/local-ai\//);
        if (level === 'A1') assert.match(entry.runtimeUrl, /^\/assets\/local-ai\/.+\/runtime\/factory\.js$/);
        else assert.equal(entry.runtimeUrl, '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js');
        assert.equal(entry.manifest.files.reduce((sum, item) => sum + item.bytes, 0), entry.manifest.approxDownloadBytes);
        assert.match(entry.manifest.model.revision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].gitRevision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].npmIntegrity, /^sha512-/);
    }
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A1.manifest.approxDownloadBytes, 145871600);
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A2.manifest.approxDownloadBytes, 301981873);
    assert.equal(LOCAL_AI_ADVANCED_TIERS.light.status, 'available');
    assert.equal(LOCAL_AI_ADVANCED_TIERS.medium.status, 'available');
    assert.equal(LOCAL_AI_ADVANCED_TIERS.power.status, 'available');
    assert.match(LOCAL_AI_ADVANCED_TIERS.medium.baseUrl, /^\/assets\/local-ai-packages\/a2\//);
    assert.match(LOCAL_AI_ADVANCED_TIERS.power.baseUrl, /^\/assets\/local-ai-packages\/a2\//);
    assert.equal(LOCAL_AI_ADVANCED_TIERS.medium.artifactPlan.license, 'Apache-2.0');
    assert.equal(LOCAL_AI_ADVANCED_TIERS.power.artifactPlan.license, 'Apache-2.0');
    assert.match(LOCAL_AI_ADVANCED_TIERS.medium.artifactPlan.revision, /^[a-f0-9]{40}$/);
    assert.match(LOCAL_AI_ADVANCED_TIERS.power.artifactPlan.revision, /^[a-f0-9]{40}$/);
    assert.equal(getLocalAiPackageCandidate('A2', { tier:'medium' }).status, 'available');
});

test('il loader usa il runtime Hosting della taglia AI.2 medium materializzata', async () => {
    let imported = '';
    const loader = createLocalAiRuntimeLoader({
        packageManager:{ status:async () => ({ installed:true, active:{ cacheName:'medium' } }), markVerified(){} },
        importModule:async url => { imported = url; return { createGenerativeRuntime:async () => ({
            complete:async () => ({ choices:[{ message:{ content:'{"ok":true}' } }] }), dispose:async () => {}
        }) }; }, origin:'https://app.example'
    });
    await loader.load('A2', { tier:'medium', assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['light','medium'] } } });
    assert.equal(imported, 'https://app.example/assets/js/modules/assistant/local-ai-generative-runtime-factory.js');
});

test('il runtime WebLLM conserva i pacchetti Hosting e riscrive solo Hugging Face', () => {
    const source = readFileSync(new URL('../Frontend/public/assets/local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/runtime/web-llm.js', import.meta.url), 'utf8');
    const cleanModelUrl = source.match(/function cleanModelUrl\(modelUrl\) \{[\s\S]*?\n\}/)?.[0] || '';
    assert.match(cleanModelUrl, /resolved\.hostname === "huggingface\.co"/);
    assert.match(cleanModelUrl, /resolved\.pathname \+= "resolve\/main\/"/);
    assert.doesNotMatch(cleanModelUrl, /modelUrl \+= "resolve\/main\/"/);
    const factory = readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/local-ai-generative-runtime-factory.js', import.meta.url), 'utf8');
    assert.match(factory, /'qwen2\.5-0\.5b-instruct-q4f16-1-mlc'/);
    assert.match(factory, /'qwen2\.5-1\.5b-instruct-q4f16-1-mlc'/);
    assert.match(factory, /'smollm2-1\.7b-instruct-q4f16-1-mlc'/);
    assert.doesNotMatch(factory, /response_format/);
});

test('il loader espone fasi e codice sicuro quando l’inizializzazione AI.2 fallisce', async () => {
    const stages = [];
    const loader = createLocalAiRuntimeLoader({
        packageManager:{ status:async () => ({ installed:true, active:{ cacheName:'light' } }), markVerified(){} },
        importModule:async () => ({ createGenerativeRuntime:async () => { throw new DOMException('dettaglio non esposto', 'OperationError'); } }),
        origin:'https://app.example'
    });
    let failure;
    try {
        await loader.load('A2', {
            tier:'light',
            assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['light'] } },
            onStage:stage => stages.push(stage)
        });
    } catch (error) { failure = error; }
    assert.deepEqual(stages, ['preflight','package-check','capability-check','runtime-import','runtime-initialization']);
    assert.equal(failure.code, 'LOCAL_AI_RUNTIME_INITIALIZATION_FAILED');
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
        loader.load('A2', { tier:'light', assessment:{ A2:{ status:'candidate', reasons:[], allowedTiers:['light'] } } }),
        error => error.code === 'LOCAL_AI_SMOKE_TEST_FAILED' && error.stage === 'smoke-test'
    );
    assert.equal(disposed, 1);
});

test('la diagnostica scarta messaggi arbitrari e conserva solo codice e fase ammessi', () => {
    assert.deepEqual(
        readLocalAiRuntimeDiagnostic({ message:'dato sensibile', name:'OperationError' }, 'runtime-import'),
        { code:'LOCAL_AI_RUNTIME_IMPORT_FAILED', stage:'runtime-import', errorName:'OperationError' }
    );
});

test('le impostazioni espongono la scelta operativa delle tre taglie AI.2', () => {
    const source = readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/assistant-package-settings.js', import.meta.url), 'utf8');
    assert.match(source, /getLocalAiPackageCandidate\(level, \{ tier:selectedTier \}\)/);
    assert.match(source, /setAttribute\('role', 'radiogroup'\)/);
    assert.match(source, /writeSelectedAdvancedTier\(tier\)/);
    assert.match(source, /tierButton\.classList\.toggle\('recommended'/);
    assert.match(source, /sessionStorage\.setItem\(diagnosticKey/);
    assert.match(source, /readLocalAiRuntimeDiagnostic/);
    assert.match(source, /\[Local AI verification failed\]/);
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
