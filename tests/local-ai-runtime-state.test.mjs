import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clearLocalAiRuntimeState,
    readLocalAiRuntimeState,
    reportLocalAiRuntimeFailure,
    writeLocalAiRuntimeState
} from '../Frontend/public/assets/js/modules/assistant/local-ai-runtime-state.js';

const values = new Map();
globalThis.sessionStorage = {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key)
};

test('lo stato distingue pacchetto verificato, avvio e motore pronto', () => {
    clearLocalAiRuntimeState('A2', 'desktop32');
    writeLocalAiRuntimeState('A2', 'desktop32', { status:'verified', stage:'verification-save' });
    assert.equal(readLocalAiRuntimeState('A2', 'desktop32').status, 'verified');
    writeLocalAiRuntimeState('A2', 'desktop32', { status:'starting', stage:'runtime-initialization' });
    assert.equal(readLocalAiRuntimeState('A2', 'desktop32').status, 'starting');
    writeLocalAiRuntimeState('A2', 'desktop32', { status:'ready', stage:'ready' });
    assert.equal(readLocalAiRuntimeState('A2', 'desktop32').status, 'ready');
});

test('un errore conserva soltanto diagnostica sicura e impedisce il falso stato pronto', () => {
    const state = reportLocalAiRuntimeFailure('A2', 'desktop32', {
        code:'LOCAL_AI_GENERATION_TIMEOUT',
        stage:'generation',
        message:'contenuto che non deve essere conservato'
    }, 'generation');
    assert.equal(state.status, 'failed');
    assert.deepEqual(state.diagnostic, {
        code:'LOCAL_AI_GENERATION_TIMEOUT',
        stage:'generation',
        errorName:'Error'
    });
    assert.doesNotMatch(JSON.stringify(state), /contenuto che non deve/);
});
