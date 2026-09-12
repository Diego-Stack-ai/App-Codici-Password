// Experimental detail fields consume only the protected reader capability.
export async function mountDetailExtraFields(root, {account, signal, copyText, onError}) {
    if (signal.aborted) return () => {};
    const lifecycle = new AbortController();
    const wrapper = document.createElement('section');
    wrapper.className = 'detail-extra-fields';
    let disposed = false;
    const rows = [];
    const assertActive = () => {
        if (disposed || signal.aborted) throw new DOMException('View disposed', 'AbortError');
    };
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        signal.removeEventListener('abort', cleanup);
        lifecycle.abort();
        for (const row of rows) { row.value = ''; row.text.textContent = ''; }
        rows.length = 0;
        wrapper.remove();
    };
    signal.addEventListener('abort', cleanup, {once: true});
    root.append(wrapper);
    try {
        for (const [field, label] of [['note', 'Note'], ['url', 'Sito web']]) {
            assertActive();
            const present = account.has(field);
            assertActive();
            if (!present) continue;
            const value = await account.read(field);
            assertActive();
            if (typeof value !== 'string') throw new Error('INVALID_DETAIL_FIELD');
            const group = document.createElement('div');
            group.className = 'detail-extra-field';
            const heading = document.createElement('h3'); heading.textContent = label;
            // A pre element preserves notes' line breaks without HTML or inline styles.
            const text = document.createElement(field === 'note' ? 'pre' : 'p');
            text.textContent = value;
            const row = {text, value}; rows.push(row);
            const copy = document.createElement('button');
            copy.type = 'button'; copy.textContent = 'Copia';
            copy.setAttribute('aria-label', `Copia ${label.toLowerCase()}`);
            copy.addEventListener('click', async () => {
                try {
                    assertActive();
                    await copyText(row.value);
                    assertActive();
                } catch {
                    if (!disposed && !signal.aborted) onError?.(new Error('DETAIL_FIELD_COPY_FAILED'));
                }
            }, {signal: lifecycle.signal});
            group.append(heading, text, copy); wrapper.append(group);
        }
        return cleanup;
    } catch {
        const aborted = disposed || signal.aborted;
        cleanup();
        if (aborted) throw new DOMException('View disposed', 'AbortError');
        // Provider errors can contain record data: do not forward their messages.
        throw new Error('DETAIL_FIELDS_UNAVAILABLE');
    }
}
