function buildSpeechTranscriptState(segments = []) {
    const frozenSegments = Object.freeze(segments.map(segment => segment
        ? Object.freeze({ text: segment.text, isFinal: segment.isFinal === true })
        : null));
    const final = frozenSegments.filter(segment => segment?.isFinal).map(segment => segment.text).join(' ').trim();
    const interim = frozenSegments.filter(segment => segment && !segment.isFinal).map(segment => segment.text).join(' ').trim();
    return Object.freeze({
        segments: frozenSegments,
        final,
        interim,
        visible: [final, interim].filter(Boolean).join(' ').trim()
    });
}

export function collectSpeechTranscripts(event) {
    const finalParts = [];
    const interimParts = [];
    const results = event?.results || [];
    const start = Number.isInteger(event?.resultIndex) ? event.resultIndex : 0;
    for (let index = start; index < results.length; index += 1) {
        const transcript = results[index]?.[0]?.transcript?.trim();
        if (!transcript) continue;
        (results[index].isFinal ? finalParts : interimParts).push(transcript);
    }
    return Object.freeze({ final: finalParts.join(' ').trim(), interim: interimParts.join(' ').trim() });
}

export function createSpeechTranscriptState() {
    return buildSpeechTranscriptState();
}

export function updateSpeechTranscriptState(current, event) {
    const results = event?.results || [];
    const segments = Array.from(current?.segments || []);
    const start = Number.isInteger(event?.resultIndex) ? event.resultIndex : 0;
    segments.length = results.length;
    for (let index = start; index < results.length; index += 1) {
        const text = results[index]?.[0]?.transcript?.trim();
        segments[index] = text ? { text, isFinal: results[index].isFinal === true } : null;
    }
    return buildSpeechTranscriptState(segments);
}

export function voiceRecognitionErrorMessage(code, { local = false } = {}) {
    const messages = {
        'no-speech': 'Non ho sentito parole. Premi il microfono e riprova.',
        'audio-capture': 'Il microfono non è disponibile o è già usato da un’altra app.',
        'not-allowed': 'Permesso microfono non concesso. Controlla i permessi del sito o della PWA.',
        'service-not-allowed': 'Il servizio vocale del browser non è autorizzato.',
        'language-not-supported': 'La lingua italiana locale non è installata.',
        network: 'Il servizio vocale del browser non è raggiungibile. Puoi usare la tastiera.',
        aborted: 'Ascolto interrotto.'
    };
    return messages[code] || `${local ? 'Riconoscimento locale' : 'Riconoscimento vocale'} non riuscito.`;
}
