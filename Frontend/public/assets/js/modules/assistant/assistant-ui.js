function element(tag, className, text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

export function createAssistantUI({ onSearch, onClose }) {
    const backdrop = element('div', 'vault-assistant-backdrop');
    const panel = element('section', 'vault-assistant-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Assistente ricerca vault');

    const header = element('header', 'vault-assistant-header');
    const heading = element('div');
    heading.append(element('h2', '', 'Cerca in Codex'), element('p', '', 'Assistente locale, protetto e in sola lettura'));
    const close = element('button', 'vault-assistant-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Chiudi'); close.addEventListener('click', onClose);
    header.append(heading, close);

    const searchRow = element('div', 'vault-assistant-search-row');
    const input = element('input', 'vault-assistant-input');
    input.type = 'search'; input.autocomplete = 'off'; input.spellcheck = false;
    input.placeholder = 'Es. carta identità Diego, Poste Business…';
    input.setAttribute('aria-label', 'Cosa vuoi cercare?');
    const microphone = element('button', 'vault-assistant-microphone');
    microphone.type = 'button'; microphone.setAttribute('aria-label', 'Parla con Codex');
    microphone.append(element('span', 'material-symbols-outlined', 'mic'));
    searchRow.append(input, microphone);
    const status = element('p', 'vault-assistant-status', 'Scrivi almeno due caratteri.');
    const results = element('div', 'vault-assistant-results');

    const render = items => {
        results.replaceChildren();
        if (!items.length) { status.textContent = 'Non ho trovato risultati. Prova a dirmelo in un altro modo.'; return; }
        status.textContent = `${items.length} risultati. I dati segreti non vengono mostrati qui.`;
        for (const item of items) {
            const link = element('a', 'vault-assistant-result');
            link.href = item.href;
            const body = element('span');
            body.append(element('strong', '', item.title), element('small', '', item.subtitle || item.kind));
            link.append(body, element('span', 'vault-assistant-kind', item.kind));
            results.append(link);
        }
    };

    const speak = message => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'it-IT';
        window.speechSynthesis.speak(utterance);
    };

    const runSearch = (query, answerByVoice = false) => {
        const items = onSearch(query);
        render(items);
        if (answerByVoice) {
            speak(items.length
                ? `Ho trovato ${items.length} risultati. Il primo è ${items[0].title}.`
                : 'Non ho trovato risultati. Prova a dirmelo in un altro modo.');
        }
    };

    input.addEventListener('input', () => {
        const query = input.value.trim();
        if (query.length < 2) { results.replaceChildren(); status.textContent = 'Scrivi almeno due caratteri.'; return; }
        runSearch(query);
    });
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supportsLocalRecognition = SpeechRecognition
        && 'processLocally' in SpeechRecognition.prototype
        && typeof SpeechRecognition.available === 'function';
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'it-IT'; recognition.interimResults = false; recognition.maxAlternatives = 1;
        let installConfirmed = false;
        let remoteConsentPending = false;
        let usingLocalRecognition = false;
        let recognitionTimeout = null;
        const clearRecognitionTimeout = () => {
            if (recognitionTimeout) clearTimeout(recognitionTimeout);
            recognitionTimeout = null;
        };
        const beginRecognition = locally => {
            usingLocalRecognition = locally;
            if ('processLocally' in recognition) recognition.processLocally = locally;
            status.textContent = locally ? 'Ti ascolto sul dispositivo…' : 'Ti ascolto tramite il servizio vocale del browser…';
            microphone.classList.add('listening');
            recognition.start();
            clearRecognitionTimeout();
            recognitionTimeout = setTimeout(() => {
                recognition.abort();
                microphone.classList.remove('listening');
                status.textContent = 'Nessuna trascrizione ricevuta. Premi il microfono e riprova.';
            }, 8000);
        };
        const requestRemoteConsent = () => {
            remoteConsentPending = true;
            status.textContent = 'La voce locale non è disponibile. Se premi ancora, soltanto ciò che pronunci sarà elaborato dal servizio vocale del browser per questa sessione.';
        };
        microphone.addEventListener('click', async () => {
            microphone.disabled = true;
            try {
                if (remoteConsentPending) {
                    remoteConsentPending = false;
                    beginRecognition(false);
                    return;
                }
                if (!supportsLocalRecognition) {
                    requestRemoteConsent();
                    return;
                }
                const availability = await SpeechRecognition.available({ langs: ['it-IT'], processLocally: true });
                if (availability === 'available') {
                    beginRecognition(true);
                    return;
                }
                if (availability === 'downloadable' && !installConfirmed) {
                    installConfirmed = true;
                    microphone.querySelector('.material-symbols-outlined').textContent = 'download';
                    status.textContent = 'Manca la lingua italiana locale. Premi ancora il pulsante per scaricarla.';
                    return;
                }
                if ((availability === 'downloadable' || availability === 'downloading')
                    && typeof SpeechRecognition.install === 'function') {
                    status.textContent = 'Installazione della lingua italiana sul dispositivo…';
                    const installed = await SpeechRecognition.install({ langs: ['it-IT'], processLocally: true });
                    installConfirmed = false;
                    microphone.querySelector('.material-symbols-outlined').textContent = 'mic';
                    status.textContent = installed
                        ? 'Lingua italiana installata. Premi il microfono e parla.'
                        : 'Installazione non riuscita. Puoi continuare usando la tastiera.';
                    return;
                }
                requestRemoteConsent();
            } catch (error) {
                const permissionError = ['not-allowed', 'service-not-allowed'].includes(error?.error) || error?.name === 'NotAllowedError';
                status.textContent = permissionError
                    ? 'Il browser non ha autorizzato il microfono o il riconoscimento locale.'
                    : 'Riconoscimento vocale locale non disponibile. Puoi continuare usando la tastiera.';
            } finally {
                microphone.disabled = false;
            }
        });
        recognition.addEventListener('result', event => {
            clearRecognitionTimeout();
            const query = event.results[0][0].transcript.trim();
            input.value = query; runSearch(query, true);
        });
        recognition.addEventListener('error', event => {
            clearRecognitionTimeout();
            const messages = {
                'no-speech': 'Non ho sentito parole. Premi il microfono e riprova.',
                'audio-capture': 'Il microfono non è disponibile o è già utilizzato da un’altra app.',
                'not-allowed': 'Permesso microfono non concesso.',
                'service-not-allowed': 'Servizio vocale non autorizzato dal browser.',
                'language-not-supported': 'La lingua italiana locale non è ancora installata.'
            };
            status.textContent = messages[event.error]
                || `${usingLocalRecognition ? 'Riconoscimento locale' : 'Riconoscimento vocale'} non riuscito (${event.error || 'errore sconosciuto'}).`;
        });
        recognition.addEventListener('end', () => {
            clearRecognitionTimeout();
            microphone.classList.remove('listening');
        });
    } else {
        microphone.setAttribute('aria-disabled', 'true');
        microphone.title = 'Riconoscimento vocale non disponibile in questo browser';
        microphone.addEventListener('click', () => {
            status.textContent = 'Questo browser non offre il riconoscimento vocale. Puoi usare la dettatura della tastiera del telefono.';
        });
    }
    backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
    panel.append(header, searchRow, status, results); backdrop.append(panel); document.body.append(backdrop);
    queueMicrotask(() => input.focus());
    return { destroy: () => backdrop.remove() };
}
