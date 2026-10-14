import assert from 'node:assert/strict';
import test from 'node:test';
import {
    collectSpeechTranscripts,
    createSpeechTranscriptState,
    updateSpeechTranscriptState,
    voiceRecognitionErrorMessage
} from '../Frontend/public/assets/js/modules/assistant/voice-recognition-model.js';

test('separa trascrizione finale e parziale', () => {
    const result = collectSpeechTranscripts({
        resultIndex: 0,
        results: [
            Object.assign([{ transcript: 'cerca Fineco' }], { isFinal: true }),
            Object.assign([{ transcript: ' azienda' }], { isFinal: false })
        ]
    });
    assert.deepEqual(result, { final: 'cerca Fineco', interim: 'azienda' });
});

test('ignora risultati vocali vuoti o malformati', () => {
    assert.deepEqual(collectSpeechTranscripts({ results: [Object.assign([{}], { isFinal: true })] }), { final: '', interim: '' });
    assert.deepEqual(collectSpeechTranscripts(null), { final: '', interim: '' });
});

test('conserva i segmenti finali fra eventi incrementali senza duplicarli', () => {
    let state = createSpeechTranscriptState();
    state = updateSpeechTranscriptState(state, {
        resultIndex: 0,
        results: [
            Object.assign([{ transcript: 'cerca Fineco' }], { isFinal: true }),
            Object.assign([{ transcript: ' azienda' }], { isFinal: false })
        ]
    });
    assert.equal(state.final, 'cerca Fineco');
    assert.equal(state.interim, 'azienda');
    assert.equal(state.visible, 'cerca Fineco azienda');

    state = updateSpeechTranscriptState(state, {
        resultIndex: 1,
        results: [
            Object.assign([{ transcript: 'cerca Fineco' }], { isFinal: true }),
            Object.assign([{ transcript: ' aziendale' }], { isFinal: true })
        ]
    });
    assert.equal(state.final, 'cerca Fineco aziendale');
    assert.equal(state.interim, '');
    assert.equal(state.visible, 'cerca Fineco aziendale');
});

test('gli errori spiegano permesso, microfono occupato e rete', () => {
    assert.match(voiceRecognitionErrorMessage('not-allowed'), /permessi del sito o della PWA/i);
    assert.match(voiceRecognitionErrorMessage('audio-capture'), /altra app/i);
    assert.match(voiceRecognitionErrorMessage('network'), /non è raggiungibile/i);
});
