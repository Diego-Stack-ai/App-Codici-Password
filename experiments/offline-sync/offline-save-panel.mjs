// Candidate view boundary. No key, SDK, raw database or unscoped writer reaches the DOM.
export async function mountOfflineSavePanel(root, {signal, isActive = () => true, createClient, prepare, readConflict, onSaved = () => {}, onDiscarded = () => {}, initialNote = ''}) {
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
    const compare = document.createElement('button'); compare.type = 'button'; compare.textContent = 'Confronta le note'; compare.hidden = true;
    const comparison = document.createElement('section'); comparison.hidden = true;
    const localTitle = document.createElement('h3'); localTitle.textContent = 'Nota locale in attesa';
    const localText = document.createElement('pre');
    const onlineTitle = document.createElement('h3'); onlineTitle.textContent = 'Nota online al momento del confronto';
    const onlineText = document.createElement('pre');
    comparison.append(localTitle, localText, onlineTitle, onlineText); section.append(compare, comparison);
    const clearComparison = () => { localText.textContent = onlineText.textContent = ''; comparison.hidden = true; };
    let disposed = false, busy = false, client, operation, accepted = false, submitted, confirmed = false, refresh, held;
    const active = () => !disposed && !signal.aborted && isActive();
    const dispose = () => {
        if (disposed) return;
        disposed = true; input.value = ''; operation = null; submitted = null; held = null; client?.close(); client = null;
        clearComparison(); compare.onclick = null;
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
        compare.disabled = !client || busy;
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
                    retry.hidden = discard.hidden = confirm.hidden = cancel.hidden = compare.hidden = true; held = null; clearComparison();
                    return;
                }
                held = structuredClone(event.operation); discard.hidden = false;
                confirm.hidden = cancel.hidden = true;
                compare.hidden = typeof readConflict !== 'function'; clearComparison();
            }
            update(event.state);
        },
            onCommitted: event => {
                if (!active() || confirmed || !submitted || event.operationId !== submitted.operationId || event.recordId !== submitted.recordId) return;
                confirmed = accepted = true; operation = held = null; input.value = ''; retry.hidden = discard.hidden = confirm.hidden = cancel.hidden = true;
                compare.hidden = true; clearComparison();
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
    compare.onclick = async () => {
        if (!active() || busy || !held || typeof readConflict !== 'function') return;
        busy = true; controls(); clearComparison();
        try {
            const snapshot = held;
            const result = await readConflict(structuredClone(snapshot), {signal, isActive: active});
            if (!active() || held !== snapshot) return;
            if (typeof result?.localNote !== 'string' || typeof result?.onlineNote !== 'string' ||
                result.localNote.length > 100000 || result.onlineNote.length > 100000) throw new Error('REVIEW_INVALID');
            localText.textContent = result.localNote; onlineText.textContent = result.onlineNote; comparison.hidden = false;
        } catch { if (active()) status.textContent = 'Confronto non disponibile. La modifica locale è conservata.'; }
        finally { busy = false; controls(); }
    };
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
            compare.hidden = true; clearComparison();
            status.textContent = 'Modifica locale eliminata. I dati online sono invariati.';
            try { await onDiscarded({signal, isActive: active}); }
            catch { if (active()) status.textContent = 'Modifica locale eliminata. Riapri il dettaglio per aggiornare la visualizzazione.'; }
        } catch {
            if (active()) status.textContent = 'Eliminazione non confermata. La coda potrebbe essere cambiata: riapri il dettaglio prima di riprovare.';
        } finally { busy = false; controls(); }
    };
    return dispose;
}
