import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpeechSynthesisController } from '../Frontend/public/assets/js/modules/assistant/speech-synthesis-controller.js';

class FakeUtterance {
    constructor(text) {
        this.text = text;
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    dispatch(type, detail = {}) {
        this.listeners.get(type)?.(detail);
    }
}

function fixture() {
    const calls = [];
    const timers = [];
    const italianVoice = { lang: 'it-IT', name: 'Italiano' };
    const synthesis = {
        cancel: () => calls.push('cancel'),
        resume: () => calls.push('resume'),
        getVoices: () => [{ lang: 'en-US', default: true }, italianVoice],
        speak: utterance => calls.push(['speak', utterance])
    };
    const statuses = [];
    const controller = createSpeechSynthesisController({
        synthesis,
        Utterance: FakeUtterance,
        setTimeoutFn: callback => { timers.push(callback); return timers.length; },
        clearTimeoutFn: () => {},
        onStatus: message => statuses.push(message)
    });
    return { calls, timers, italianVoice, statuses, controller };
}

test('sblocca la sintesi nel gesto utente con un primer quasi silenzioso', () => {
    const { calls, controller } = fixture();
    assert.equal(controller.prime(), true);
    assert.equal(calls[0], 'cancel');
    assert.equal(calls[1], 'resume');
    const primer = calls[2][1];
    assert.equal(calls[2][0], 'speak');
    assert.equal(primer.lang, 'it-IT');
    assert.equal(primer.volume, 0.01);
});

test('legge dopo il rilascio audio senza cancellare la frase appena accodata', () => {
    const { calls, timers, italianVoice, statuses, controller } = fixture();
    assert.equal(controller.speakAfterAudioRelease('Ho trovato tre account.'), true);
    assert.deepEqual(calls, []);
    assert.equal(timers.length, 1);
    timers[0]();
    assert.equal(calls[0], 'resume');
    assert.equal(calls[1][0], 'speak');
    const reply = calls[1][1];
    assert.equal(reply.text, 'Ho trovato tre account.');
    assert.equal(reply.voice, italianVoice);
    assert.equal(calls.includes('cancel'), false);
    reply.dispatch('start');
    reply.dispatch('end');
    assert.deepEqual(statuses, ['Sto leggendo la risposta…', 'Risposta letta sul dispositivo.']);
});

test('segnala un errore reale della voce e ignora le cancellazioni controllate', () => {
    const { calls, timers, statuses, controller } = fixture();
    controller.speakAfterAudioRelease('Risposta'); timers.shift()();
    calls[1][1].dispatch('error', { error: 'synthesis-failed' });
    assert.match(statuses[0], /non è disponibile/i);
});

test('degrada senza errori quando la sintesi non è disponibile', () => {
    const controller = createSpeechSynthesisController();
    assert.equal(controller.prime(), false);
    assert.equal(controller.speakAfterAudioRelease('Risposta'), false);
    controller.destroy();
});

test('alla chiusura cancella soltanto la sintesi residua', () => {
    const { calls, controller } = fixture();
    controller.destroy();
    assert.deepEqual(calls, ['cancel']);
});
