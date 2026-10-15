import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_AI_PACKAGE_CATALOG, LOCAL_AI_RUNTIME_PROVENANCE } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';
import { createLocalAiRuntimeLoader } from '../Frontend/public/assets/js/modules/assistant/local-ai-runtime-loader.js';

test('catalogo fissato: somme, revisioni e runtime hanno provenienza immutabile', () => {
    for (const level of ['A2','A3']) {
        const entry = LOCAL_AI_PACKAGE_CATALOG[level];
        assert.equal(entry.status, 'available');
        assert.match(entry.baseUrl, /^\/assets\/local-ai\//);
        assert.match(entry.runtimeUrl, /^\/assets\/local-ai\/.+\/runtime\/factory\.js$/);
        assert.equal(entry.manifest.files.reduce((sum, item) => sum + item.bytes, 0), entry.manifest.approxDownloadBytes);
        assert.match(entry.manifest.model.revision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].gitRevision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].npmIntegrity, /^sha512-/);
    }
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A2.manifest.approxDownloadBytes, 145871600);
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A3.manifest.approxDownloadBytes, 301982152);
});

test('il loader non importa runtime quando il pacchetto non è installato', async () => {
    let imports = 0;
    const loader = createLocalAiRuntimeLoader({
        packageManager: { status: async () => ({ installed:false }) },
        importModule: async () => { imports++; return {}; }, origin:'https://app.example'
    });
    await assert.rejects(loader.load('A2', { capabilities:{} }), /LOCAL_AI_PACKAGE_NOT_INSTALLED/);
    assert.equal(imports, 0);
});

test('il loader usa soltanto factory e URL same-origin del catalogo disponibile', async () => {
    let imported = '';
    const runtime = { marker:true };
    const loader = createLocalAiRuntimeLoader({
        packageManager: { status: async () => ({ installed:true, active:{ cacheName:'verified' } }) },
        importModule: async url => { imported = url; return { createSemanticRuntime: args => ({ runtime, args }) }; },
        origin:'https://app.example'
    });
    const capabilities = { wasm:true, webgpu:false, hardwareConcurrency:4, deviceMemoryGiB:4,
        storageAvailableBytes:2_000_000_000, mobile:false, ios:false };
    const loaded = await loader.load('A2', { capabilities });
    assert.match(imported, /^https:\/\/app\.example\/assets\/local-ai\/a2\//);
    assert.equal(loaded.runtime, runtime);
    assert.match(loaded.args.packageBaseUrl, /^https:\/\/app\.example\/assets\/local-ai\/a2\//);
});
