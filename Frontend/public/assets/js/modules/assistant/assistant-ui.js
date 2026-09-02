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
    heading.append(element('h2', '', 'Cerca nella tua Vault'), element('p', '', 'Ricerca locale, in sola lettura'));
    const close = element('button', 'vault-assistant-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Chiudi'); close.addEventListener('click', onClose);
    header.append(heading, close);

    const input = element('input', 'vault-assistant-input');
    input.type = 'search'; input.autocomplete = 'off'; input.spellcheck = false;
    input.placeholder = 'Es. carta identità Diego, Poste Business…';
    input.setAttribute('aria-label', 'Cosa vuoi cercare?');
    const status = element('p', 'vault-assistant-status', 'Scrivi almeno due caratteri.');
    const results = element('div', 'vault-assistant-results');

    const render = items => {
        results.replaceChildren();
        if (!items.length) { status.textContent = 'Nessun risultato trovato.'; return; }
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

    input.addEventListener('input', () => {
        const query = input.value.trim();
        if (query.length < 2) { results.replaceChildren(); status.textContent = 'Scrivi almeno due caratteri.'; return; }
        render(onSearch(query));
    });
    backdrop.addEventListener('click', event => { if (event.target === backdrop) onClose(); });
    panel.append(header, input, status, results); backdrop.append(panel); document.body.append(backdrop);
    queueMicrotask(() => input.focus());
    return { destroy: () => backdrop.remove() };
}

export function createAssistantButton(onClick) {
    const button = element('button', 'vault-assistant-fab', 'Cerca nella Vault');
    button.type = 'button'; button.addEventListener('click', onClick); document.body.append(button);
    return { destroy: () => button.remove() };
}
