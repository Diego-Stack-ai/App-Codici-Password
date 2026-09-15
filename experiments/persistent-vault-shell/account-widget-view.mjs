// Consultation-only shell composition: canonical Widget class names, capability reads,
// no legacy session manager or editor/writer imports.
export async function mountAccountWidgetView(root, context, {reader, allowSecretCopy = false, copyText = value => navigator.clipboard.writeText(value)}) {
    const host = document.createElement('section'); host.className = 'account-widgets-section';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const controls = new AbortController(), values = [], texts = [];
    let disposed = false, invalidated = false;
    const check = () => {
        if (disposed || invalidated || context.signal.aborted) throw new Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose);
        for (const node of [...values, ...texts]) node.textContent = '';
        values.length = 0; texts.length = 0; status.textContent = ''; host.remove();
    };
    const label = (tag, value) => { const node = document.createElement(tag); node.textContent = value; texts.push(node); return node; };
    const error = () => {
        invalidated = true;
        for (const node of values) node.textContent = '';
        // A rejected current read invalidates this whole mounted snapshot.
        controls.abort();
        status.textContent = 'Widget non disponibili. Riapri il dettaglio dopo lo sblocco o la connessione.';
    };
    try {
        check(); context.signal.addEventListener('abort', dispose, {once: true});
        host.append(status); root.append(host);
        const widgets = await reader.list(); check();
        let bankDeferred = false;
        for (const widget of widgets) {
            check();
            // Never flatten a bank-owned Widget into generic Account fields.
            if (widget.bankId) { bankDeferred = true; continue; }
            const card = document.createElement('article'); card.className = 'shared-account-card'; card.dataset.widgetId = widget.id;
            card.append(label('h3', widget.title || (widget.kind === 'shared-reference' ? 'Credenziale comune' : 'Widget')));
            for (const field of widget.fields) {
                const row = document.createElement('div'); row.className = 'shared-account-field';
                const value = document.createElement('span'); value.className = 'shared-account-value';
                value.dataset.widgetField = field.id; values.push(value);
                const masked = field.encrypted || field.preview === false;
                const initial = masked ? '••••••••' : await reader.read(widget.id, field.id, {expectedEncrypted: false});
                check(); value.textContent = initial; row.append(label('strong', field.label), value);
                if (masked) {
                    const reveal = document.createElement('button'); reveal.type = 'button';
                    let shown = false, pending = false;
                    const refreshLabel = () => { reveal.textContent = `${shown ? 'Nascondi' : 'Mostra'} ${field.label}`; reveal.setAttribute('aria-label', reveal.textContent); };
                    refreshLabel(); texts.push(reveal);
                    reveal.addEventListener('click', async () => {
                        if (pending) return;
                        try {
                            check(); pending = true; reveal.disabled = true;
                            if (shown) { value.textContent = '••••••••'; shown = false; }
                            else {
                                const decoded = await reader.read(widget.id, field.id, {expectedEncrypted: field.encrypted}); check();
                                value.textContent = decoded; shown = true;
                            }
                            refreshLabel();
                        } catch { if (!disposed && !context.signal.aborted) error(); }
                        finally { pending = false; if (!disposed) reveal.disabled = false; }
                    }, {signal: controls.signal});
                    row.append(reveal);
                }
                if ((!field.encrypted || allowSecretCopy) && field.copyable) {
                    const copy = label('button', `Copia ${field.label}`); copy.type = 'button';
                    copy.addEventListener('click', async () => {
                        try {
                            check(); const decoded = await reader.read(widget.id, field.id, {expectedEncrypted: field.encrypted, copy: true}); check();
                            await copyText(decoded); check();
                            status.textContent = 'Copiato.';
                        } catch { if (!disposed && !context.signal.aborted) error(); }
                    }, {signal: controls.signal});
                    row.append(copy);
                }
                card.append(row);
            }
            host.append(card);
        }
        if (bankDeferred) status.textContent = 'I campi collegati ai conti saranno disponibili nel modulo bancario della shell.';
        if (!widgets.length) host.hidden = true;
        check(); return dispose;
    } catch {
        if (disposed || context.signal.aborted) { dispose(); return dispose; }
        // Do not pass provider error messages, which can contain record values.
        error(); return dispose;
    }
}
