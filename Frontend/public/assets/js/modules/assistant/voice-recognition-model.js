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

const normalizeErrorName = error => String(error?.name || error?.error || '').trim();

export function classifyMicrophoneAccessError(error) {
    const name = normalizeErrorName(error);
    if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) return 'microphone-denied';
    if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) return 'microphone-missing';
    if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) return 'microphone-busy';
    if (name === 'TypeError') return 'microphone-unsupported';
    return 'audio-capture';
}

export async function probeMicrophoneAccess({ permissions, mediaDevices } = {}) {
    let permission = 'unknown';
    if (permissions?.query) {
        try {
            const result = await permissions.query({ name: 'microphone' });
            if (['granted', 'prompt', 'denied'].includes(result?.state)) permission = result.state;
        } catch { /* API non supportata: getUserMedia resta la verifica autorevole. */ }
    }

    if (permission === 'denied') {
        return Object.freeze({ ok: false, code: 'microphone-denied', permission });
    }
    if (!mediaDevices?.getUserMedia) {
        return Object.freeze({ ok: false, code: 'microphone-unsupported', permission });
    }

    let stream = null;
    try {
        stream = await mediaDevices.getUserMedia({ audio: true });
        return Object.freeze({ ok: true, permission: 'granted' });
    } catch (error) {
        return Object.freeze({ ok: false, code: classifyMicrophoneAccessError(error), permission });
    } finally {
        try {
            for (const track of stream?.getTracks?.() || []) {
                try { track.stop(); } catch { /* traccia già terminata */ }
            }
        } catch { /* stream non più disponibile */ }
    }
}

export function classifySpeechRecognitionError(error, { microphoneVerified = false, local = false } = {}) {
    const code = normalizeErrorName(error);
    if (code === 'service-not-allowed') return local ? 'local-recognition-blocked' : 'recognition-service-blocked';
    if (code === 'language-not-supported') return local ? 'local-language-unavailable' : code;
    if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError', 'not-allowed'].includes(code)) {
        if (!microphoneVerified) return 'microphone-denied';
        return local ? 'local-recognition-blocked' : 'recognition-service-blocked';
    }
    return code;
}

export function voiceRecognitionErrorMessage(code) {
    const messages = {
        'no-speech': 'Non ho sentito parole. Premi il microfono e riprova.',
        'audio-capture': 'Il microfono non è disponibile o è già usato da un’altra app.',
        'microphone-denied': 'Il microfono è bloccato per questo sito o per la PWA. Consenti il microfono nelle impostazioni del browser e riprova.',
        'microphone-missing': 'Nessun microfono disponibile sul dispositivo.',
        'microphone-busy': 'Il microfono è già usato da un’altra app o non può essere avviato.',
        'microphone-unsupported': 'Questo browser non consente alla PWA di accedere al microfono. Puoi usare la tastiera.',
        'recognition-service-blocked': 'Il microfono funziona, ma il servizio vocale del browser è bloccato. Puoi usare la tastiera.',
        'local-recognition-blocked': 'Il microfono funziona, ma il riconoscimento locale è bloccato. Premi ancora per usare il servizio vocale del browser.',
        'local-language-unavailable': 'Il pacchetto italiano per il riconoscimento locale non è disponibile. Premi ancora per usare il servizio vocale del browser.',
        'language-not-supported': 'La lingua italiana non è supportata dal servizio vocale del browser.',
        network: 'Il servizio vocale del browser non è raggiungibile. Puoi usare la tastiera.',
        aborted: 'Ascolto interrotto.'
    };
    return messages[code] || 'Riconoscimento vocale non riuscito.';
}
