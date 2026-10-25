import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assessLocalAiCapabilities,
    assessAdvancedRuntimeBenchmark,
    createEphemeralAssistantSession,
    createLocalAiEnvelope,
    validateLocalAiPackageManifest,
    validateTypedIntent,
    probeLocalAiCapabilities
} from '../Frontend/public/assets/js/modules/assistant/advanced-local-ai-contract.js';

const intent = (overrides = {}) => ({
    schemaVersion: 1,
    type: 'semantic_search',
    query: 'come trovo un account',
    pageId: null,
    resultOrdinal: null,
    confidence: 0.82,
    requiresConfirmation: false,
    ...overrides
});

test('il benchmark riproducibile applica budget diversi alle tre taglie', () => {
    assert.equal(assessAdvancedRuntimeBenchmark({ tier:'medium', firstTokenMs:9000, tokensPerSecond:5,
        peakMemoryMiB:1800, cancelMs:500 }).passed, true);
    const failed = assessAdvancedRuntimeBenchmark({ tier:'power', firstTokenMs:30000, tokensPerSecond:1,
        peakMemoryMiB:3500, cancelMs:2500 });
    assert.equal(failed.passed, false);
    assert.ok(failed.reasons.includes('generation-too-slow'));
});

test('il manifest AI.1 è chiuso, relativo e verificabile', () => {
    const manifest = validateLocalAiPackageManifest({
        schemaVersion: 1,
        level: 'A1',
        packageId: 'granite-embedding-97m-multilingual-r2-onnx-q8',
        version: '0.0.1',
        runtime: 'transformers-js-onnx',
        model: { provider: 'ONNX Community / IBM Granite', modelId: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX', revision: 'TO_PIN', license: 'TO_VERIFY' },
        approxDownloadBytes: 1024,
        maxResidentBytes: 4096,
        locales: ['it-IT', 'en-US', 'zh-CN', 'hi-IN'],
        files: [{ path: 'model/model_quantized.onnx', bytes: 1024, sha256: 'a'.repeat(64) }]
    });
    assert.equal(manifest.level, 'A1');
    assert.throws(() => validateLocalAiPackageManifest({ ...manifest, files: [{ ...manifest.files[0], path: '../model.onnx' }] }), /FILE_PATH/);
});

test('la matrice abilita AI.1 e limita AI.2 avanzata su iPhone', () => {
    const result = assessLocalAiCapabilities({
        wasm: true, webgpu: true, hardwareConcurrency: 6, deviceMemoryGiB: 6,
        storageAvailableBytes: 3 * 1024 * 1024 * 1024, mobile: true, ios: true
    });
    assert.equal(result.A1.status, 'candidate');
    assert.equal(result.A2.status, 'unavailable');
    assert.ok(result.A2.reasons.includes('desktop-required'));
    assert.deepEqual(result.A2.allowedTiers, []);
});

test('il probe usa capacità e quota reali senza accedere alla Vault', async () => {
    const result = await probeLocalAiCapabilities({ navigatorObject: {
        storage: { estimate: async () => ({ quota: 2_000_000_000, usage: 100_000_000 }) },
        gpu: { requestAdapter:async () => ({ limits:{} }) }, hardwareConcurrency: 8, deviceMemory: 8,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0
    } });
    assert.equal(result.A1.status, 'candidate');
    assert.equal(result.A2.status, 'candidate');
    assert.deepEqual(result.A2.allowedTiers, ['light']);
    assert.equal(result.A2.recommendedTier, 'light');
});

test('la taglia light usa il collaudo reale quando il browser non espone deviceMemory', () => {
    const result = assessLocalAiCapabilities({
        wasm:true, webgpu:true, hardwareConcurrency:8, deviceMemoryGiB:null,
        storageAvailableBytes:3*1024*1024*1024, mobile:false, ios:false
    });
    assert.equal(result.A2.status, 'candidate');
    assert.deepEqual(result.A2.allowedTiers, ['light']);
});

test('AI.2 resta una sola AI ma il controllo tecnico abilita taglie progressive', () => {
    const result = assessLocalAiCapabilities({
        wasm:true, webgpu:true, hardwareConcurrency:16, deviceMemoryGiB:16,
        storageAvailableBytes:10*1024*1024*1024, mobile:false, ios:false
    });
    assert.deepEqual(result.A2.allowedTiers, ['light','medium','power']);
    assert.equal(result.A2.recommendedTier, 'power');
});

test('l’envelope ammette solo contesto minimo e rifiuta chiavi sensibili', () => {
    const envelope = createLocalAiEnvelope({
        level: 'A1', locale: 'it-IT',
        page: { pageId: 'impostazioni', purpose: 'Configura preferenze locali.' },
        question: 'Come cambio lingua?', turns: [],
        shortlist: [{ recordRef: 'account:opaque-1', kind: 'account', title: 'Account dimostrativo', subtitle: '' }]
    });
    assert.equal(envelope.shortlist.length, 1);
    assert.ok(Object.isFrozen(envelope));
    assert.throws(() => createLocalAiEnvelope({
        level: 'A1', locale: 'it-IT', page: { pageId: 'impostazioni', purpose: 'x' }, question: 'x',
        shortlist: [{ recordRef: 'x', kind: 'x', title: 'x', subtitle: '', password: 'vietata' }]
    }), /ENVELOPE_RESULT/);
});

test('gli intenti sono tipizzati e non possono inventare azioni', () => {
    assert.equal(validateTypedIntent(intent()).type, 'semantic_search');
    assert.throws(() => validateTypedIntent(intent({ type: 'delete_account' })), /INTENT_TYPE/);
    assert.throws(() => validateTypedIntent(intent({ password: 'x' })), /INTENT_SHAPE/);
});

test('la memoria è limitata alla sessione e si azzera alla chiusura', () => {
    const session = createEphemeralAssistantSession({ maxTurns: 2 });
    session.append('prima', intent());
    session.append('seconda', intent({ type: 'clarify', query: null }));
    session.append('terza', intent({ type: 'select_result', query: null, resultOrdinal: 2, requiresConfirmation: true }));
    assert.deepEqual(session.snapshot().map(turn => turn.question), ['seconda', 'terza']);
    session.close();
    assert.throws(() => session.snapshot(), /SESSION_CLOSED/);
});
