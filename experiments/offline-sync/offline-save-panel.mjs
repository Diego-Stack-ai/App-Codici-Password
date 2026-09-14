// Candidate view boundary. No key, SDK, raw database or unscoped writer reaches the DOM.
export async function mountOfflineSavePanel(root, {signal, isActive = () => true, createClient, prepare, onSaved = () => {}, onDiscarded = () => {}, initialNote = ''}) {
    if (!signal || typeof createClient !== 'function' || typeof prepare !== 'function' || typeof onSaved !== 'function' || typeof onDiscarded !== 'function') throw new Error('SAVE_PANEL_CONFIG');
    const section = document.createElement('section');
    const label = document.createElement('label'); label.textContent = 'Nota';
    const input = document.createElement('textarea'); input.value = initialNote; input.autocomplete = 'off'; input.maxLength = 100000;
    label.append(input);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Salva nota';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Riprova sincronizzazione'; retry.hidden = true;
    section.append(label, status, save, retry);
    const discard = document.createElement('button'); discard.type = 'button'; discard.textContent = 'Mantieni i dati online'; discard.hidden = true;
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = 'Conferma: elimina questa modifica locale'; confirm.hidden = true;
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annulla'; cancel.hidden = true;
    section.append(discard, confirm, cancel);
    let disposed = false, busy = false, client, operation, accepted = false, submitted, confirmed = false, refresh, held;
    const active = () => !disposed && !signal.aborted && isActive();
    const dispose = () => {
        if (disposed) return;
        disposed = true; input.value = ''; operation = null; submitted = null; held = null; client?.close(); client = null;
        signal.removeEventListener('abort', dispose); save.onclick = retry.onclick = discard.onclick = confirm.onclick = cancel.onclick = null; section.remove();
    };
    const states = {idle: 'Nessuna modifica in attesa.', offline: 'Modifica conservata sul dispositivo. In attesa di connessione.',
        syncing: 'Sincronizzazione in corso…', saved: 'Nota salvata.', conflict: 'Account modificato altrove. La copia locale è conservata.',
        'reconciliation-required': 'Questo Account richiede la modifica completa. La copia locale è conservata.',
        'recoverable-error': 'Conferma non disponibile. Puoi riprovare senza creare una seconda operazione.'};
    const update = state => {
        if (!active() || confirmed) return;
        if (state === 'saved') return; // Queue-wide completion is not this note's receipt.
        status.textContent = states[state] || states['recoverable-error'];
        retry.hidden = !['offline', 'recoverable-error'].includes(state);
    };
    const controls = () => {
        if (!active()) return;
        save.disabled = !client || busy || accepted;
        input.readOnly = busy || accepted || Boolean(operation);
        retry.disabled = !client || busy;
        discard.disabled = confirm.disabled = cancel.disabled = !client || busy;
    };
    signal.addEventListener('abort', dispose, {once: true});
    if (!active()) { dispose(); return dispose; }
    root.append(section); save.disabled = true; input.readOnly = true; status.textContent = 'Preparazione…';
    try {
        const opened = await createClient({signal, isActive: active, onState: event => {
            if (!active() || confirmed) return;
            if (['conflict', 'reconciliation-required'].includes(event.state)) {
                if (!submitted || event.operation?.operationId !== submitted.operationId || event.operation?.recordId !== submitted.recordId) {
                    status.textContent = 'Un’altra modifica blocca la coda. Questa nota resta in attesa.';
                    retry.hidden = discard.hidden = confirm.hidden = cancel.hidden = true; held = null;
                    return;
                }
                held = structuredClone(event.operation); discard.hidden = false;
            }
            update(event.state);
        },
            onCommitted: event => {
                if (!active() || confirmed || !submitted || event.operationId !== submitted.operationId || event.recordId !== submitted.recordId) return;
                confirmed = accepted = true; operation = held = null; input.value = ''; retry.hidden = discard.hidden = confirm.hidden = cancel.hidden = true;
                status.textContent = states.saved; controls();
                refresh = Promise.resolve().then(() => {
                    if (active()) return onSaved({signal, isActive: active});
                }).catch(() => {
                    if (active()) status.textContent = 'Nota salvata. Riapri il dettaglio per aggiornare la visualizzazione.';
                });
                return refresh;
            }});
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
                submitted = {operationId: operation.operationId, recordId: operation.recordId};
                const result = await client.enqueue(operation);
                if (!active()) return;
                if (result?.acquired === false) { update('recoverable-error'); return; }
                accepted = true;
                // The encrypted command is now owned by the queue, not this editor.
                operation = null; input.value = '';
            } else await client.flush();
            await refresh;
        } catch { if (active()) update('recoverable-error'); }
        finally { busy = false; controls(); }
    };
    save.onclick = run; retry.onclick = run;
    discard.onclick = () => {
        if (!active() || busy || !held) return;
        status.textContent = 'Eliminare solo questa modifica in attesa? I dati online non saranno modificati.';
        discard.hidden = true; confirm.hidden = cancel.hidden = false;
    };
    cancel.onclick = () => {
        if (!active() || busy || !held) return;
        confirm.hidden = cancel.hidden = true; discard.hidden = false;
        status.textContent = 'La modifica locale è ancora conservata.';
    };
    confirm.onclick = async () => {
        if (!active() || busy || !held || confirm.hidden) return;
        busy = true; controls();
        try {
            const result = await client.discard(held);
            if (!active()) return;
            if (result?.acquired !== true) throw new Error('DISCARD_NOT_CONFIRMED');
            confirmed = accepted = true; held = operation = submitted = null; input.value = '';
            retry.hidden = discard.hidden = confirm.hidden = cancel.hidden = true;
            status.textContent = 'Modifica locale eliminata. I dati online sono invariati.';
            try { await onDiscarded({signal, isActive: active}); }
            catch { if (active()) status.textContent = 'Modifica locale eliminata. Riapri il dettaglio per aggiornare la visualizzazione.'; }
        } catch {
            if (active()) status.textContent = 'Eliminazione non confermata. La coda potrebbe essere cambiata: riapri il dettaglio prima di riprovare.';
        } finally { busy = false; controls(); }
    };
    return dispose;
}
