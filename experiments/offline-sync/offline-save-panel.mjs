// Candidate view boundary. No key, SDK, raw database or unscoped writer reaches the DOM.
export async function mountOfflineSavePanel(root, {signal, isActive = () => true, createClient, prepare, initialNote = ''}) {
    if (!signal || typeof createClient !== 'function' || typeof prepare !== 'function') throw new Error('SAVE_PANEL_CONFIG');
    const section = document.createElement('section');
    const label = document.createElement('label'); label.textContent = 'Nota';
    const input = document.createElement('textarea'); input.value = initialNote; input.autocomplete = 'off'; input.maxLength = 100000;
    label.append(input);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Salva nota';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Riprova sincronizzazione'; retry.hidden = true;
    section.append(label, status, save, retry);
    let disposed = false, busy = false, client, operation, accepted = false;
    const active = () => !disposed && !signal.aborted && isActive();
    const dispose = () => {
        if (disposed) return;
        disposed = true; input.value = ''; operation = null; client?.close(); client = null;
        signal.removeEventListener('abort', dispose); save.onclick = retry.onclick = null; section.remove();
    };
    const states = {idle: 'Nessuna modifica in attesa.', offline: 'Modifica conservata sul dispositivo. In attesa di connessione.',
        syncing: 'Sincronizzazione in corso…', saved: 'Nota salvata.', conflict: 'Account modificato altrove. La copia locale è conservata.',
        'reconciliation-required': 'Questo Account richiede la modifica completa. La copia locale è conservata.',
        'recoverable-error': 'Conferma non disponibile. Puoi riprovare senza creare una seconda operazione.'};
    const update = state => {
        if (!active()) return;
        status.textContent = states[state] || states['recoverable-error'];
        if (state === 'saved') { accepted = true; input.value = ''; operation = null; }
        retry.hidden = !['offline', 'recoverable-error'].includes(state);
    };
    const controls = () => {
        if (!active()) return;
        save.disabled = !client || busy || accepted;
        input.readOnly = busy || accepted || Boolean(operation);
        retry.disabled = !client || busy;
    };
    signal.addEventListener('abort', dispose, {once: true});
    if (!active()) { dispose(); return dispose; }
    root.append(section); save.disabled = true; input.readOnly = true; status.textContent = 'Preparazione…';
    try {
        const opened = await createClient({signal, isActive: active, onState: event => update(event.state)});
        if (!active()) { opened.close(); dispose(); return dispose; }
        client = opened; status.textContent = 'Modifica la nota e salva.'; controls();
    } catch { if (active()) status.textContent = 'Editor non disponibile. Riapri la pagina.'; return dispose; }
    const run = async () => {
        if (!active() || busy) return;
        busy = true; controls();
        try {
            if (!accepted) {
                if (!operation) operation = await prepare(input.value, {signal, isActive: active});
                if (!active()) { operation = null; return; }
                const result = await client.enqueue(operation);
                if (!active()) return;
                if (result?.acquired === false) { update('recoverable-error'); return; }
                accepted = true;
                // The encrypted command is now owned by the queue, not this editor.
                operation = null; input.value = '';
            } else await client.flush();
        } catch { if (active()) update('recoverable-error'); }
        finally { busy = false; controls(); }
    };
    save.onclick = run; retry.onclick = run;
    return dispose;
}
