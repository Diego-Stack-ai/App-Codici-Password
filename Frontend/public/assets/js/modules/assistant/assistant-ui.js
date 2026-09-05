function element(tag, className, text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

export function createAssistantUI({ onAsk, onClose, resolveCredential }) {
    const pageScrollY = window.scrollY;
    document.documentElement.classList.add('vault-assistant-open');
    document.body.classList.add('vault-assistant-open');
    document.body.style.top = `-${pageScrollY}px`;
    const backdrop = element('div', 'vault-assistant-backdrop');
    const panel = element('section', 'vault-assistant-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Agente Codex');
    const header = element('header', 'vault-assistant-header');
    const heading = element('div');
    heading.append(element('h2', '', 'Agente Codex'), element('p', '', 'Conversazione locale, protetta e in sola lettura'));
    const close = element('button', 'vault-assistant-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Chiudi'); close.addEventListener('click', onClose); header.append(heading, close);

    const conversation = element('div', 'vault-assistant-conversation'); conversation.setAttribute('aria-live', 'polite');
    const searchRow = element('form', 'vault-assistant-search-row');
    const input = element('input', 'vault-assistant-input');
    input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'Chiedimi cosa stai cercando…';
    input.setAttribute('aria-label', 'Parla con Agente Codex');
    const send = element('button', 'vault-assistant-send');
    send.type = 'submit'; send.setAttribute('aria-label', 'Invia richiesta'); send.append(element('span', 'material-symbols-outlined', 'arrow_upward'));
    const microphone = element('button', 'vault-assistant-microphone');
    microphone.type = 'button'; microphone.setAttribute('aria-label', 'Parla con Codex'); microphone.append(element('span', 'material-symbols-outlined', 'mic'));
    searchRow.append(input, send, microphone);
    const status = element('p', 'vault-assistant-status', 'I dati segreti non vengono mostrati nella conversazione.');

    const speak = message => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message); utterance.lang = 'it-IT'; window.speechSynthesis.speak(utterance);
    };
    const addBubble = (role, message) => {
        const bubble = element('div', `vault-assistant-bubble ${role}`, message);
        conversation.append(bubble); conversation.scrollTop = conversation.scrollHeight;
    };
    const addCredentialRow = async (container, label, value, { secret = false } = {}) => {
        if (!value) return;
        const row = element('div', 'vault-assistant-credential');
        const labelNode = element('span', 'vault-assistant-credential-label', `${label}:`);
        const valueNode = element('span', 'vault-assistant-credential-value', secret ? '••••••••' : '…');
        row.append(labelNode, valueNode);
        if (secret) {
            let revealed = false;
            let clearValue = null;
            const reveal = element('button', 'vault-assistant-credential-action');
            reveal.type = 'button'; reveal.title = 'Mostra password';
            reveal.append(element('span', 'material-symbols-outlined', 'visibility'));
            reveal.addEventListener('click', async event => {
                event.stopPropagation();
                clearValue ??= await resolveCredential(value);
                revealed = !revealed;
                valueNode.textContent = revealed ? (clearValue || '—') : '••••••••';
                reveal.title = revealed ? 'Nascondi password' : 'Mostra password';
                reveal.querySelector('.material-symbols-outlined').textContent = revealed ? 'visibility_off' : 'visibility';
            });
            const copy = element('button', 'vault-assistant-credential-action');
            copy.type = 'button'; copy.title = 'Copia password';
            copy.append(element('span', 'material-symbols-outlined', 'content_copy'));
            copy.addEventListener('click', async event => {
                event.stopPropagation();
                clearValue ??= await resolveCredential(value);
                if (clearValue) await navigator.clipboard.writeText(clearValue);
                copy.title = clearValue ? 'Password copiata' : 'Password non disponibile';
            });
            row.append(reveal, copy);
        } else {
            valueNode.textContent = await resolveCredential(value) || '—';
        }
        container.append(row);
    };
    const addResults = async items => {
        if (!items.length) return;
        const group = element('div', 'vault-assistant-results');
        for (const [index, item] of items.entries()) {
            const card = element('div', 'vault-assistant-result');
            card.tabIndex = 0; card.setAttribute('role', 'link');
            const navigate = () => { window.location.href = item.href; };
            card.addEventListener('click', navigate);
            card.addEventListener('keydown', event => { if (event.key === 'Enter') navigate(); });
            const body = element('div', 'vault-assistant-result-body');
            body.append(element('strong', '', `${index + 1}. ${item.title}`), element('small', '', item.subtitle || item.kind));
            if (item.credentials) {
                await addCredentialRow(body, 'Username', item.credentials.username);
                await addCredentialRow(body, 'Account', item.credentials.account);
                await addCredentialRow(body, 'Password', item.credentials.password, { secret: true });
            }
            card.append(body); group.append(card);
        }
        conversation.append(group); conversation.scrollTop = conversation.scrollHeight;
    };
    const ask = (query, answerByVoice = false) => {
        const value = query.trim(); if (!value) return;
        addBubble('user', value); input.value = '';
        const answer = onAsk(value); addBubble('assistant', answer.message); void addResults(answer.items || []);
        if (answerByVoice) speak(answer.message);
        if (answer.navigateTo) window.setTimeout(() => { window.location.href = answer.navigateTo; }, 450);
    };
    addBubble('assistant', 'Ciao. Dimmi cosa stai cercando: posso trovare documenti, account, aziende e scadenze.');
    searchRow.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supportsLocalRecognition = SpeechRecognition && 'processLocally' in SpeechRecognition.prototype && typeof SpeechRecognition.available === 'function';
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'it-IT'; recognition.interimResults = false; recognition.maxAlternatives = 1;
        let installConfirmed = false; let remoteConsentPending = false; let usingLocalRecognition = false; let recognitionTimeout = null;
        const clearRecognitionTimeout = () => { if (recognitionTimeout) clearTimeout(recognitionTimeout); recognitionTimeout = null; };
        const beginRecognition = locally => {
            usingLocalRecognition = locally;
            if ('processLocally' in recognition) recognition.processLocally = locally;
            status.textContent = locally ? 'Ti ascolto sul dispositivo…' : 'Ti ascolto tramite il servizio vocale del browser…';
            microphone.classList.add('listening'); recognition.start(); clearRecognitionTimeout();
            recognitionTimeout = setTimeout(() => {
                recognition.abort(); microphone.classList.remove('listening'); status.textContent = 'Nessuna trascrizione ricevuta. Premi il microfono e riprova.';
            }, 8000);
        };
        const requestRemoteConsent = () => {
            remoteConsentPending = true;
            status.textContent = 'La voce locale non è disponibile. Se premi ancora, soltanto ciò che pronunci sarà elaborato dal servizio vocale del browser per questa sessione.';
        };
        microphone.addEventListener('click', async () => {
            microphone.disabled = true;
            try {
                if (remoteConsentPending) { remoteConsentPending = false; beginRecognition(false); return; }
                if (!supportsLocalRecognition) { requestRemoteConsent(); return; }
                const availability = await SpeechRecognition.available({ langs: ['it-IT'], processLocally: true });
                if (availability === 'available') { beginRecognition(true); return; }
                if (availability === 'downloadable' && !installConfirmed) {
                    installConfirmed = true; microphone.querySelector('.material-symbols-outlined').textContent = 'download';
                    status.textContent = 'Manca la lingua italiana locale. Premi ancora per scaricarla.'; return;
                }
                if ((availability === 'downloadable' || availability === 'downloading') && typeof SpeechRecognition.install === 'function') {
                    status.textContent = 'Installazione della lingua italiana sul dispositivo…';
                    const installed = await SpeechRecognition.install({ langs: ['it-IT'], processLocally: true });
                    installConfirmed = false; microphone.querySelector('.material-symbols-outlined').textContent = 'mic';
                    status.textContent = installed ? 'Lingua installata. Premi il microfono e parla.' : 'Installazione non riuscita. Usa la tastiera.'; return;
                }
                requestRemoteConsent();
            } catch (error) {
                const denied = ['not-allowed', 'service-not-allowed'].includes(error?.error) || error?.name === 'NotAllowedError';
                status.textContent = denied ? 'Il browser non ha autorizzato il microfono.' : 'Riconoscimento vocale non disponibile. Usa la tastiera.';
            } finally { microphone.disabled = false; }
        });
        recognition.addEventListener('result', event => {
            clearRecognitionTimeout(); const query = event.results[0][0].transcript.trim(); ask(query, true);
        });
        recognition.addEventListener('error', event => {
            clearRecognitionTimeout();
            const messages = { 'no-speech': 'Non ho sentito parole. Riprova.', 'audio-capture': 'Il microfono non è disponibile.',
                'not-allowed': 'Permesso microfono non concesso.', 'service-not-allowed': 'Servizio vocale non autorizzato.',
                'language-not-supported': 'La lingua italiana locale non è installata.' };
            status.textContent = messages[event.error] || `${usingLocalRecognition ? 'Riconoscimento locale' : 'Riconoscimento vocale'} non riuscito.`;
        });
        recognition.addEventListener('end', () => { clearRecognitionTimeout(); microphone.classList.remove('listening'); });
    } else {
        microphone.setAttribute('aria-disabled', 'true'); microphone.title = 'Riconoscimento vocale non disponibile';
        microphone.addEventListener('click', () => { status.textContent = 'Usa la dettatura della tastiera del telefono.'; });
    }
    backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
    panel.append(header, conversation, searchRow, status); backdrop.append(panel); document.body.append(backdrop);
    queueMicrotask(() => input.focus());
    return { destroy: () => {
        window.speechSynthesis?.cancel();
        backdrop.remove();
        document.documentElement.classList.remove('vault-assistant-open');
        document.body.classList.remove('vault-assistant-open');
        document.body.style.removeProperty('top');
        window.scrollTo(0, pageScrollY);
    } };
}
