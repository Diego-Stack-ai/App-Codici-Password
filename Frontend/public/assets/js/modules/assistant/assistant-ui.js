import { SwipeList } from '../../swipe-list-v6.js';
import {
    classifySpeechRecognitionError,
    createSpeechTranscriptState,
    probeMicrophoneAccess,
    updateSpeechTranscriptState,
    voiceRecognitionErrorMessage
} from './voice-recognition-model.js';

function element(tag, className, text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (/\bmaterial-(?:symbols|icons)(?:-[\w-]+)?\b/i.test(className)) {
        node.classList.add('notranslate');
        node.setAttribute('translate', 'no');
    }
    if (text) node.textContent = text;
    return node;
}

const SPEECH_LOCALES = Object.freeze({
    it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
    zh: 'zh-CN', hi: 'hi-IN', pt: 'pt-PT'
});

export function speechLocaleForLanguage(language) {
    return SPEECH_LOCALES[language] || SPEECH_LOCALES.it;
}

export function createAssistantUI({ onAsk, onExplain = null, onClose, onArchive, resolveCredential, offlineNotice = '', language = 'it' }) {
    const speechLocale = speechLocaleForLanguage(language);
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
    const headerActions = element('div', 'vault-assistant-header-actions');
    const help = element('button', 'vault-assistant-help', '?');
    help.type = 'button'; help.setAttribute('aria-label', 'Istruzioni Agente Codex'); help.setAttribute('aria-expanded', 'false');
    const close = element('button', 'vault-assistant-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Chiudi'); close.addEventListener('click', onClose);
    headerActions.append(help, close); header.append(heading, headerActions);

    const modes = element('div', 'vault-assistant-modes');
    modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Modalità Agente Codex');
    const searchMode = element('button', 'vault-assistant-mode active', 'Cerca');
    const askMode = element('button', 'vault-assistant-mode', 'Chiedi');
    searchMode.type = 'button'; askMode.type = 'button';
    searchMode.setAttribute('aria-pressed', 'true'); askMode.setAttribute('aria-pressed', 'false');
    modes.append(searchMode, askMode);
    const instructions = element('section', 'vault-assistant-instructions');
    instructions.hidden = true;
    instructions.append(
        element('strong', '', 'Come usare Agente Codex'),
        element('p', '', 'In Cerca puoi cercare il nome completo o parziale di un Account, poi dire “apri il secondo”, “apri il due” oppure indicare il nome esatto.'),
        element('p', '', onExplain
            ? 'In Chiedi il pacchetto locale spiega questa pagina senza inviare dati a servizi esterni.'
            : 'Per usare Chiedi installa e verifica AI.1 Locale oppure AI.2 Avanzata per PC nelle Impostazioni.')
    );
    const modeNotice = element('p', 'vault-assistant-mode-notice', onExplain
        ? 'Chiedi usa il pacchetto AI locale installato e non invia contenuti a servizi esterni.'
        : 'Installa e verifica AI.1 Locale oppure AI.2 Avanzata per PC nelle Impostazioni. Cerca resta sempre disponibile.');
    modeNotice.hidden = true;

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
    const swipeLists = new Set();
    if (offlineNotice) status.textContent = offlineNotice;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let speechSynthesis; let uiDestroyed = false; let activeMode = 'search';
    microphone.disabled = true;
    import('./speech-synthesis-controller.js').then(module => {
        speechSynthesis = module.createSpeechSynthesisController({
            synthesis: window.speechSynthesis,
            Utterance: window.SpeechSynthesisUtterance,
            language: speechLocale
        });
        if (uiDestroyed) speechSynthesis.destroy(); else microphone.disabled = !SpeechRecognition;
    }).catch(() => { if (!uiDestroyed) microphone.disabled = !SpeechRecognition; });
    const setMode = mode => {
        activeMode = mode;
        const searching = mode === 'search';
        searchMode.classList.toggle('active', searching); askMode.classList.toggle('active', !searching);
        searchMode.setAttribute('aria-pressed', String(searching)); askMode.setAttribute('aria-pressed', String(!searching));
        const usable = searching || Boolean(onExplain);
        input.disabled = !usable; send.disabled = !usable; microphone.disabled = !usable || !SpeechRecognition;
        modeNotice.hidden = searching;
        input.placeholder = searching ? 'Cosa vuoi cercare?' : (onExplain ? 'Cosa vuoi sapere su questa pagina?' : 'AI locale avanzata non disponibile');
        if (searching) input.focus();
    };
    searchMode.addEventListener('click', () => setMode('search'));
    askMode.addEventListener('click', () => setMode('ask'));
    help.addEventListener('click', () => {
        instructions.hidden = !instructions.hidden;
        help.setAttribute('aria-expanded', String(!instructions.hidden));
    });
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
            const card = element('div', 'vault-assistant-result swipe-row');
            card.assistantItem = item;
            card.tabIndex = 0; card.setAttribute('role', 'link');
            const navigate = () => { window.location.href = item.href; };
            card.addEventListener('click', navigate);
            card.addEventListener('keydown', event => { if (event.target === card && event.key === 'Enter') navigate(); });
            const archiveBackground = element('div', 'swipe-action-bg swipe-bg-left bg-archive');
            archiveBackground.append(element('span', 'material-symbols-outlined', 'archive'));
            const deleteBackground = element('div', 'swipe-action-bg swipe-bg-right bg-delete');
            deleteBackground.append(element('span', 'material-symbols-outlined', 'delete'));
            const content = element('div', 'swipe-content vault-assistant-result-content');
            const body = element('div', 'vault-assistant-result-body');
            const heading = element('div', 'vault-assistant-result-heading');
            const icon = item.iconSource ? element('img', 'vault-assistant-result-icon') : element('span', 'vault-assistant-result-icon material-symbols-outlined', 'shield_lock');
            if (item.iconSource) { icon.src = item.iconSource; icon.alt = ''; icon.addEventListener('error', () => icon.remove(), {once: true}); }
            heading.append(icon, element('strong', '', `${index + 1}. ${item.title}`));
            body.append(heading, element('small', '', item.subtitle || item.kind));
            if (item.credentials) {
                await addCredentialRow(body, 'Username', item.credentials.username);
                await addCredentialRow(body, 'Account', item.credentials.account);
                await addCredentialRow(body, 'Password', item.credentials.password, { secret: true });
            }
            content.append(body); card.append(archiveBackground, deleteBackground, content); group.append(card);
        }
        conversation.append(group); conversation.scrollTop = conversation.scrollHeight;
        if (items.some(item => item.archiveAction) && onArchive) {
            const selector = `.vault-assistant-result.swipe-row`;
            const run = async (card, requireConfirmation) => {
                const item = card.assistantItem;
                if (!item?.archiveAction) return;
                const completed = await onArchive(item, { requireConfirmation });
                if (!completed) window.setTimeout(() => { void addResults([item]); }, 500);
            };
            const swipeList = new SwipeList(selector, {
                threshold: 0.15,
                onSwipeLeft: card => { void run(card, true); },
                onSwipeRight: card => { void run(card, false); }
            });
            swipeLists.forEach(instance => instance.destroy());
            swipeLists.clear(); swipeLists.add(swipeList);
        }
    };
    let lastShortlist = [];
    const ask = query => {
        const value = query.trim(); if (!value) return;
        addBubble('user', value); input.value = '';
        if (!onExplain || activeMode === 'search') {
            const answer = onAsk(value); if (answer.items?.length) lastShortlist = answer.items;
            addBubble('assistant', answer.message); void addResults(answer.items || []);
            if (answer.navigateTo) window.setTimeout(() => { window.location.href = answer.navigateTo; }, 450);
            return answer;
        }
        const vaultAnswer = onAsk(value);
        if (vaultAnswer?.items?.length || vaultAnswer?.navigateTo) {
            if (vaultAnswer.items?.length) lastShortlist = vaultAnswer.items;
            addBubble('assistant', vaultAnswer.message); void addResults(vaultAnswer.items || []);
            if (vaultAnswer.navigateTo) window.setTimeout(() => { window.location.href = vaultAnswer.navigateTo; }, 450);
            return Promise.resolve(vaultAnswer);
        }
        status.textContent = 'Elaborazione locale…';
        return onExplain(value, { shortlist:lastShortlist }).then(message => {
            addBubble('assistant', message); return { message, items:[] };
        }).catch(() => {
            const fallback = onAsk(value);
            const message = fallback?.items?.length
                ? fallback.message
                : 'Il pacchetto locale non è pronto su questo dispositivo. Puoi continuare con Cerca.';
            if (fallback?.items?.length) lastShortlist = fallback.items;
            addBubble('assistant', message); void addResults(fallback?.items || []);
            return { message, items:fallback?.items || [] };
        }).finally(() => { status.textContent = 'I dati segreti non vengono mostrati nella conversazione.'; });
    };
    searchRow.addEventListener('submit', event => { event.preventDefault(); void ask(input.value); });

    let activeRecognition = null;
    const supportsLocalRecognition = SpeechRecognition && 'processLocally' in SpeechRecognition.prototype && typeof SpeechRecognition.available === 'function';
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition(); activeRecognition = recognition;
        recognition.lang = speechLocale; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 3;
        let installConfirmed = false; let remoteConsentPending = false; let usingLocalRecognition = false;
        let recognitionTimeout = null; let recognitionActive = false; let recognitionStarting = false; let submittedFinal = false;
        let pendingSpokenAnswer = null;
        let transcriptState = createSpeechTranscriptState();
        const microphoneIcon = microphone.querySelector('.material-symbols-outlined');
        const clearRecognitionTimeout = () => { if (recognitionTimeout) clearTimeout(recognitionTimeout); recognitionTimeout = null; };
        const setListening = active => {
            microphone.classList.toggle('listening', active);
            microphone.setAttribute('aria-pressed', String(active));
            microphone.setAttribute('aria-label', active ? 'Termina ascolto' : 'Parla con Codex');
            microphone.title = active ? 'Termina ascolto' : 'Avvia riconoscimento vocale';
            if (microphoneIcon) microphoneIcon.textContent = active ? 'stop_circle' : 'mic';
        };
        const beginRecognition = locally => {
            usingLocalRecognition = locally; recognitionStarting = true; submittedFinal = false;
            transcriptState = createSpeechTranscriptState();
            if ('processLocally' in recognition) recognition.processLocally = locally;
            status.textContent = locally ? 'Avvio ascolto sul dispositivo…' : 'Avvio il servizio vocale del browser…';
            setListening(true);
            try {
                recognition.start();
            } catch (error) {
                recognitionStarting = false; setListening(false);
                const code = classifySpeechRecognitionError(error, { microphoneVerified: true, local: locally });
                if (locally && ['local-recognition-blocked', 'local-language-unavailable'].includes(code)) {
                    requestRemoteConsent(voiceRecognitionErrorMessage(code, { local: true }));
                    return;
                }
                status.textContent = voiceRecognitionErrorMessage(code, { local: locally });
                return;
            }
            clearRecognitionTimeout();
            recognitionTimeout = setTimeout(() => {
                if (recognitionActive || recognitionStarting) recognition.stop();
                status.textContent = input.value.trim()
                    ? 'Tempo di ascolto terminato. Controlla il testo e invialo.'
                    : 'Nessuna trascrizione ricevuta. Premi il microfono e riprova.';
            }, 12000);
        };
        const requestRemoteConsent = reason => {
            remoteConsentPending = true;
            const prefix = reason || 'La voce locale non è disponibile.';
            status.textContent = `${prefix} Se premi ancora, soltanto ciò che pronunci sarà elaborato dal servizio vocale del browser per questa sessione.`;
        };
        microphone.addEventListener('click', async () => {
            if (recognitionActive || recognitionStarting) {
                status.textContent = 'Termino l’ascolto…'; recognition.stop(); return;
            }
            speechSynthesis?.prime();
            microphone.disabled = true;
            try {
                const microphoneAccess = await probeMicrophoneAccess({
                    permissions: navigator.permissions,
                    mediaDevices: navigator.mediaDevices
                });
                if (!microphoneAccess.ok) {
                    status.textContent = voiceRecognitionErrorMessage(microphoneAccess.code);
                    return;
                }
                if (remoteConsentPending) { remoteConsentPending = false; beginRecognition(false); return; }
                // Su browser privi del motore locale (incluso WebKit), il consenso
                // a getUserMedia appartiene gia allo stesso gesto dell'utente:
                // dopo la concessione si avvia subito il servizio vocale disponibile.
                if (!supportsLocalRecognition) { beginRecognition(false); return; }
                const availability = await SpeechRecognition.available({ langs: [speechLocale], processLocally: true });
                if (availability === 'available') { beginRecognition(true); return; }
                if (availability === 'downloadable' && !installConfirmed) {
                    installConfirmed = true; if (microphoneIcon) microphoneIcon.textContent = 'download';
                    status.textContent = 'Manca il pacchetto vocale locale per la lingua scelta. Premi ancora per scaricarlo.'; return;
                }
                if ((availability === 'downloadable' || availability === 'downloading') && typeof SpeechRecognition.install === 'function') {
                    status.textContent = 'Installazione del pacchetto vocale sul dispositivo…';
                    const installed = await SpeechRecognition.install({ langs: [speechLocale], processLocally: true });
                    installConfirmed = false; if (microphoneIcon) microphoneIcon.textContent = 'mic';
                    status.textContent = installed ? 'Lingua installata. Premi il microfono e parla.' : 'Installazione non riuscita. Usa la tastiera.'; return;
                }
                requestRemoteConsent(voiceRecognitionErrorMessage('local-language-unavailable', { local: true }));
            } catch (error) {
                const code = classifySpeechRecognitionError(error, { microphoneVerified: true, local: true });
                if (['local-recognition-blocked', 'local-language-unavailable'].includes(code)) {
                    requestRemoteConsent(voiceRecognitionErrorMessage(code, { local: true }));
                } else {
                    status.textContent = voiceRecognitionErrorMessage(code, { local: true });
                }
                recognitionStarting = false; setListening(false);
            } finally { microphone.disabled = false; }
        });
        recognition.addEventListener('start', () => {
            recognitionStarting = false; recognitionActive = true;
            status.textContent = usingLocalRecognition
                ? 'Ti ascolto sul dispositivo. Premi stop quando hai finito.'
                : 'Ti ascolto tramite il browser. Premi stop quando hai finito.';
        });
        recognition.addEventListener('result', event => {
            transcriptState = updateSpeechTranscriptState(transcriptState, event);
            if (transcriptState.visible) input.value = transcriptState.visible;
            status.textContent = transcriptState.interim
                ? `Ho sentito: “${transcriptState.visible}”`
                : (transcriptState.final ? 'Trascrizione completata.' : 'Ti ascolto…');
            if (transcriptState.final && !transcriptState.interim && !submittedFinal) {
                submittedFinal = true; clearRecognitionTimeout();
                pendingSpokenAnswer = Promise.resolve(ask(transcriptState.final))
                    .then(answer => answer?.message || '')
                    .catch(() => '');
                try { recognition.stop(); } catch {}
            }
        });
        recognition.addEventListener('error', event => {
            clearRecognitionTimeout(); recognitionStarting = false; recognitionActive = false;
            pendingSpokenAnswer = null;
            const code = classifySpeechRecognitionError(event, { microphoneVerified: true, local: usingLocalRecognition });
            if (usingLocalRecognition && ['local-recognition-blocked', 'local-language-unavailable'].includes(code)) {
                requestRemoteConsent(voiceRecognitionErrorMessage(code, { local: true }));
            } else {
                status.textContent = voiceRecognitionErrorMessage(code, { local: usingLocalRecognition });
            }
            setListening(false);
        });
        recognition.addEventListener('end', async () => {
            clearRecognitionTimeout(); recognitionStarting = false; recognitionActive = false; setListening(false);
            if (pendingSpokenAnswer) {
                const message = await pendingSpokenAnswer; pendingSpokenAnswer = null;
                speechSynthesis?.speakAfterAudioRelease(message);
            }
            if (!remoteConsentPending && !submittedFinal && input.value.trim()) status.textContent = 'Ascolto terminato. Controlla il testo e premi invia.';
        });
    } else {
        microphone.setAttribute('aria-disabled', 'true'); microphone.title = 'Riconoscimento vocale non disponibile';
        microphone.addEventListener('click', () => { status.textContent = 'Usa la dettatura della tastiera del telefono.'; });
    }
    backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
    panel.append(header, modes, instructions, modeNotice, conversation, searchRow, status); backdrop.append(panel); document.body.append(backdrop);
    queueMicrotask(() => input.focus());
    return { destroy: () => {
        swipeLists.forEach(instance => instance.destroy()); swipeLists.clear();
        try { activeRecognition?.abort(); } catch {}
        activeRecognition = null;
        uiDestroyed = true;
        speechSynthesis?.destroy();
        backdrop.remove();
        document.documentElement.classList.remove('vault-assistant-open');
        document.body.classList.remove('vault-assistant-open');
        document.body.style.removeProperty('top');
        window.scrollTo(0, pageScrollY);
    } };
}
