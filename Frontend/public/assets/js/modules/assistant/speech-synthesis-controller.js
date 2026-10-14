export function createSpeechSynthesisController({
    synthesis, Utterance, setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout,
    language = 'it-IT', releaseDelayMs = 350, onStatus = () => {}
} = {}) {
    let activeUtterance = null;
    let releaseTimer = null;
    const available = Boolean(synthesis && Utterance && synthesis.speak);
    const clearTimer = () => {
        if (releaseTimer !== null) clearTimeoutFn(releaseTimer);
        releaseTimer = null;
    };
    const hold = (utterance, report = false) => {
        activeUtterance = utterance;
        utterance.addEventListener?.('start', () => report && onStatus('Sto leggendo la risposta…'), { once: true });
        utterance.addEventListener?.('end', () => {
            if (activeUtterance === utterance) activeUtterance = null;
            if (report) onStatus('Risposta letta sul dispositivo.');
        }, { once: true });
        utterance.addEventListener?.('error', event => {
            if (activeUtterance === utterance) activeUtterance = null;
            if (report && !['interrupted', 'canceled'].includes(event?.error)) {
                onStatus('La lettura vocale non è disponibile. Puoi leggere la risposta sullo schermo.');
            }
        }, { once: true });
    };
    return {
        prime() {
            if (!available) return false;
            clearTimer(); synthesis.cancel?.(); synthesis.resume?.(); synthesis.getVoices?.();
            const primer = new Utterance('\u00A0');
            primer.lang = language; primer.volume = 0.01; primer.rate = 2;
            hold(primer); synthesis.speak(primer); return true;
        },
        speakAfterAudioRelease(message) {
            const text = String(message || '').trim();
            if (!available || !text) return false;
            clearTimer();
            releaseTimer = setTimeoutFn(() => {
                releaseTimer = null; synthesis.resume?.();
                const utterance = new Utterance(text); utterance.lang = language;
                const voices = synthesis.getVoices?.() || [];
                utterance.voice = voices.find(voice => voice.lang?.toLowerCase() === language.toLowerCase())
                    || voices.find(voice => voice.lang?.toLowerCase().startsWith('it'))
                    || voices.find(voice => voice.default) || null;
                hold(utterance, true); synthesis.speak(utterance);
            }, releaseDelayMs);
            return true;
        },
        destroy() { clearTimer(); activeUtterance = null; synthesis?.cancel?.(); }
    };
}
