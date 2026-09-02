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
    const supportsLocalRecognition = SpeechRecognition && 'processLocally' in SpeechRecognition.prototype;
    if (supportsLocalRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'it-IT'; recognition.interimResults = false; recognition.maxAlternatives = 1;
        recognition.processLocally = true;
        microphone.addEventListener('click', () => {
            status.textContent = 'Ti ascolto…'; microphone.classList.add('listening');
            try { recognition.start(); } catch { /* una sessione è già attiva */ }
        });
        recognition.addEventListener('result', event => {
            const query = event.results[0][0].transcript.trim();
            input.value = query; runSearch(query, true);
        });
        recognition.addEventListener('error', () => { status.textContent = 'Non sono riuscito ad ascoltare. Puoi riprovare o scrivere.'; });
        recognition.addEventListener('end', () => microphone.classList.remove('listening'));
    } else {
        microphone.disabled = true;
        microphone.title = 'Riconoscimento vocale locale non disponibile in questo browser';
        microphone.addEventListener('click', () => {
            status.textContent = 'Questo browser non offre ancora il riconoscimento vocale completamente locale.';
        });
    }
    backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
    panel.append(header, searchRow, status, results); backdrop.append(panel); document.body.append(backdrop);
    queueMicrotask(() => input.focus());
    return { destroy: () => backdrop.remove() };
}

export function createAssistantButton(onClick) {
    const button = element('button', 'vault-assistant-fab', 'Cerca nella Vault');
    button.type = 'button'; button.addEventListener('click', onClick); document.body.append(button);
    return { destroy: () => button.remove() };
}
