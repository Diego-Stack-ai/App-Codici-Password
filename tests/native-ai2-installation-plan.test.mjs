import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIVE_AI2_INSTALLATION_PLAN, nativeAi2InstallSummary } from '../Frontend/public/assets/js/modules/assistant/native-ai2-installation-plan.js';

test('il piano nativo usa un modello permissivo e non pubblica artefatti non ancora firmati', () => {
    const plan = NATIVE_AI2_INSTALLATION_PLAN;
    assert.equal(plan.supportedPlatform, 'windows-x64');
    assert.equal(plan.minimum.ramGiB, 32);
    assert.equal(plan.host.runtime, 'llama.cpp');
    assert.equal(plan.host.endpoint, 'http://127.0.0.1:32145');
    assert.equal(plan.model.modelId, 'Qwen/Qwen3-4B-GGUF');
    assert.equal(plan.model.license, 'Apache-2.0');
    assert.equal(plan.host.installerReady, false);
    assert.equal(plan.model.releaseReady, false);
    assert.equal(nativeAi2InstallSummary(plan).ready, false);
});

test('il popup informa su requisiti, elaborazione locale, fallback e rimozione', () => {
    const summary = nativeAi2InstallSummary();
    assert.match(summary.body, /soltanto su questo PC/);
    assert.match(summary.body, /Ricerca continuerà a funzionare/);
    assert.match(summary.body, /rimossa in qualsiasi momento/);
    assert.match(summary.requirements, /32 GB di RAM/);
});
