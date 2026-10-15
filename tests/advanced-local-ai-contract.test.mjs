import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assessLocalAiCapabilities,
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

test('il manifest A2 è chiuso, relativo e verificabile', () => {
    const manifest = validateLocalAiPackageManifest({
        schemaVersion: 1,
        level: 'A2',
        packageId: 'granite-embedding-97m-multilingual-r2-onnx-q8',
        version: '0.0.1',
        runtime: 'transformers-js-onnx',
        model: { provider: 'ONNX Community / IBM Granite', modelId: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX', revision: 'TO_PIN', license: 'TO_VERIFY' },
        approxDownloadBytes: 1024,
        maxResidentBytes: 4096,
        locales: ['it-IT', 'en-US', 'zh-CN', 'hi-IN'],
        files: [{ path: 'model/model_quantized.onnx', bytes: 1024, sha256: 'a'.repeat(64) }]
    });
    assert.equal(manifest.level, 'A2');
    assert.throws(() => validateLocalAiPackageManifest({ ...manifest, files: [{ ...manifest.files[0], path: '../model.onnx' }] }), /FILE_PATH/);
});

test('la matrice mantiene A1 e limita A3 su iPhone', () => {
    const result = assessLocalAiCapabilities({
        wasm: true, webgpu: true, hardwareConcurrency: 6, deviceMemoryGiB: 6,
        storageAvailableBytes: 3 * 1024 * 1024 * 1024, mobile: true, ios: true
    });
    assert.equal(result.A1.status, 'available');
    assert.equal(result.A2.status, 'candidate');
    assert.equal(result.A3.status, 'lab-only');
    assert.ok(result.A3.reasons.includes('ios-physical-benchmark-required'));
});

test('il probe usa capacità e quota reali senza accedere alla Vault', async () => {
    const result = await probeLocalAiCapabilities({ navigatorObject: {
        storage: { estimate: async () => ({ quota: 2_000_000_000, usage: 100_000_000 }) },
        gpu: {}, hardwareConcurrency: 8, deviceMemory: 8,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0
    } });
    assert.equal(result.A1.status, 'available');
    assert.equal(result.A2.status, 'candidate');
    assert.equal(result.A3.status, 'candidate');
});

test('l’envelope ammette solo contesto minimo e rifiuta chiavi sensibili', () => {
    const envelope = createLocalAiEnvelope({
        level: 'A2', locale: 'it-IT',
        page: { pageId: 'impostazioni', purpose: 'Configura preferenze locali.' },
        question: 'Come cambio lingua?', turns: [],
        shortlist: [{ recordRef: 'account:opaque-1', kind: 'account', title: 'Account dimostrativo', subtitle: '' }]
    });
    assert.equal(envelope.shortlist.length, 1);
    assert.ok(Object.isFrozen(envelope));
    assert.throws(() => createLocalAiEnvelope({
        level: 'A2', locale: 'it-IT', page: { pageId: 'impostazioni', purpose: 'x' }, question: 'x',
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
