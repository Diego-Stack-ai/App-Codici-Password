import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyMicrophoneAccessError,
    classifySpeechRecognitionError,
    collectSpeechTranscripts,
    createSpeechTranscriptState,
    probeMicrophoneAccess,
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
    assert.match(voiceRecognitionErrorMessage('microphone-denied'), /impostazioni del browser/i);
    assert.match(voiceRecognitionErrorMessage('audio-capture'), /altra app/i);
    assert.match(voiceRecognitionErrorMessage('network'), /non è raggiungibile/i);
});

test('la verifica esplicita rispetta un permesso negato senza aprire il microfono', async () => {
    let opened = 0;
    const result = await probeMicrophoneAccess({
        permissions: { query: async descriptor => {
            assert.deepEqual(descriptor, { name: 'microphone' });
            return { state: 'denied' };
        } },
        mediaDevices: { getUserMedia: async () => { opened += 1; } }
    });
    assert.deepEqual(result, { ok: false, code: 'microphone-denied', permission: 'denied' });
    assert.equal(opened, 0);
});

test('getUserMedia è verificato con solo audio e ogni traccia viene rilasciata subito', async () => {
    let stopped = 0;
    const result = await probeMicrophoneAccess({
        permissions: { query: async () => { throw new TypeError('descriptor non supportato'); } },
        mediaDevices: { getUserMedia: async constraints => {
            assert.deepEqual(constraints, { audio: true });
            return { getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }] };
        } }
    });
    assert.deepEqual(result, { ok: true, permission: 'granted' });
    assert.equal(stopped, 2);
});

test('la verifica distingue microfono assente, occupato e browser incompatibile', async () => {
    const probe = name => probeMicrophoneAccess({
        permissions: null,
        mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error(name), { name }); } }
    });
    assert.equal((await probe('NotFoundError')).code, 'microphone-missing');
    assert.equal((await probe('NotReadableError')).code, 'microphone-busy');
    assert.equal((await probeMicrophoneAccess({ permissions: null, mediaDevices: null })).code, 'microphone-unsupported');
    assert.equal(classifyMicrophoneAccessError({ name: 'SecurityError' }), 'microphone-denied');
});

test('un blocco SpeechRecognition dopo getUserMedia non viene scambiato per permesso microfono', () => {
    assert.equal(
        classifySpeechRecognitionError({ name: 'NotAllowedError' }, { microphoneVerified: true, local: true }),
        'local-recognition-blocked'
    );
    assert.equal(
        classifySpeechRecognitionError({ error: 'service-not-allowed' }, { microphoneVerified: true, local: false }),
        'recognition-service-blocked'
    );
    assert.equal(
        classifySpeechRecognitionError({ error: 'language-not-supported' }, { microphoneVerified: true, local: true }),
        'local-language-unavailable'
    );
    assert.match(voiceRecognitionErrorMessage('local-recognition-blocked'), /microfono funziona/i);
});
