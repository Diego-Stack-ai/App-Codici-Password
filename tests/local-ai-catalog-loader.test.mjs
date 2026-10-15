import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_AI_PACKAGE_CATALOG, LOCAL_AI_RUNTIME_PROVENANCE } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';
import { createLocalAiRuntimeLoader } from '../Frontend/public/assets/js/modules/assistant/local-ai-runtime-loader.js';

test('catalogo fissato: somme, revisioni e runtime hanno provenienza immutabile', () => {
    for (const level of ['A2','A3']) {
        const entry = LOCAL_AI_PACKAGE_CATALOG[level];
        assert.equal(entry.status, 'blocked');
        assert.equal(entry.manifest.files.reduce((sum, item) => sum + item.bytes, 0), entry.manifest.approxDownloadBytes);
        assert.match(entry.manifest.model.revision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].gitRevision, /^[a-f0-9]{40}$/);
        assert.match(LOCAL_AI_RUNTIME_PROVENANCE[level].npmIntegrity, /^sha512-/);
    }
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A2.manifest.approxDownloadBytes, 123314242);
    assert.equal(LOCAL_AI_PACKAGE_CATALOG.A3.manifest.approxDownloadBytes, 295598663);
});

test('il loader non importa runtime quando catalogo o pacchetto non supera i gate', async () => {
    let imports = 0;
    const loader = createLocalAiRuntimeLoader({
        packageManager: { status: async () => ({ installed:false }) },
        importModule: async () => { imports++; return {}; }, origin:'https://app.example'
    });
    await assert.rejects(loader.load('A2', { capabilities:{} }), /LOCAL_AI_BLOCKED/);
    assert.equal(imports, 0);
});
