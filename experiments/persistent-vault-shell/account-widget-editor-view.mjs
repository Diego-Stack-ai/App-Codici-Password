export async function mountAccountWidgetEditor(root, context, {source, widgetId, notice, onSaved = () => {}}) {
  const host = document.createElement('section'), fields = [], events = new AbortController();
  let closed = false, busy = false, plan = null, model, deleteArmed = false, deleting = false;
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Salva widget';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Chiudi editor';
  const unlink = typeof source.prepareUnlink === 'function';
  const remove = document.createElement('button'); remove.type = 'button';
  remove.textContent = unlink ? 'Scollega da questo Account' : 'Elimina widget';
  const dispose = () => {
    if (closed) return; closed = true; events.abort();
    for (const input of fields) {input.value = ''; input.checked = false;}
    model = null; plan = null; status.textContent = ''; host.remove(); source.dispose();
    context.signal.removeEventListener('abort', dispose);
  };
  context.signal.addEventListener('abort', dispose, {once: true});
  const input = (label, value, secret = false) => {
    const row = document.createElement('label'); row.textContent = label;
    const node = document.createElement('input'); node.type = secret ? 'password' : 'text'; node.value = String(value ?? '');
    node.autocomplete = 'off'; fields.push(node); row.append(node); host.append(row); return node;
  };
  try {
    context.assertUnlocked(); model = await source.load(widgetId);
    if (closed || context.signal.aborted) {dispose(); return dispose;}
    if (notice) {const warning = document.createElement('p'); warning.textContent = notice; host.append(warning);}
    const title = input('Titolo', model.title);
    const values = model.fields.map(field => {
      const node = input(field.label, field.value, field.encrypted);
      if (!field.encrypted && typeof field.value === 'boolean') {node.type = 'checkbox'; node.checked = field.value;}
      else if (!field.encrypted && typeof field.value === 'number') node.type = 'number';
      return node;
    });
    host.append(save, cancel, status); root.append(host);
    if (unlink || typeof source.prepareDelete === 'function') host.append(remove);
    remove.addEventListener('click', async () => {
      if (busy || closed || (plan && !deleting)) return;
      if (!deleteArmed) {
        deleteArmed = true; remove.textContent = unlink ? 'Conferma scollegamento' : 'Conferma eliminazione widget';
        status.textContent = unlink ? 'Verrà rimosso solo il collegamento da questo Account. La credenziale comune e gli altri collegamenti resteranno. Premi di nuovo per confermare.' : 'Verrà eliminato questo widget, non l’Account. Premi di nuovo per confermare.';
        return;
      }
      busy = true; remove.disabled = true; save.disabled = true;
      try {
        context.assertUnlocked();
        if (!plan) {
          plan = unlink ? await source.prepareUnlink() : await source.prepareDelete(); deleting = true;
          if (closed) return;
          for (const node of fields) {node.value = ''; node.checked = false; node.disabled = true;}
          model = null;
        }
        await source.send(plan); if (closed) return;
        dispose(); await onSaved();
      } catch {
        if (!closed) status.textContent = unlink
          ? (plan ? 'Scollegamento non confermato. Riprova la stessa richiesta oppure chiudi e verifica il collegamento.' : 'Scollegamento non disponibile. Chiudi e riapri il widget.')
          : (plan ? 'Eliminazione non confermata. Riprova la stessa richiesta oppure chiudi e verifica il widget.' : 'Eliminazione non disponibile. Chiudi e riapri il widget.');
      } finally {busy = false; if (!closed) {remove.disabled = false; save.disabled = deleting;}}
    }, {signal: events.signal});
    cancel.addEventListener('click', dispose, {signal: events.signal});
    save.addEventListener('click', async () => {
      if (busy || closed || deleting) return; busy = true; save.disabled = true; remove.disabled = true;
      try {
        context.assertUnlocked();
        if (!plan) {
          if (model.fields.some((field, i) => typeof field.value === 'number' &&
            (values[i].value.trim() === '' || !Number.isFinite(Number(values[i].value))))) {
            status.textContent = 'Inserisci un numero valido nei campi numerici.';
            return;
          }
          plan = await source.prepare({...model, title: title.value, fields: model.fields.map((field, i) => ({...field,
            value: typeof field.value === 'boolean' ? values[i].checked : typeof field.value === 'number' ? Number(values[i].value) : values[i].value}))});
          if (closed) return;
          for (const node of fields) {node.value = ''; node.checked = false; node.disabled = true;}
          model = null;
        }
        await source.send(plan); if (closed) return;
        dispose(); await onSaved();
      } catch {
        if (!closed) status.textContent = plan ? 'Esito non confermato. Riprova la stessa richiesta oppure chiudi e verifica il widget.' : 'Modifica non disponibile. Chiudi e riapri il widget.';
      } finally {busy = false; if (!closed) {save.disabled = false; remove.disabled = Boolean(plan);}}
    }, {signal: events.signal});
    return dispose;
  } catch (error) {dispose(); throw error;}
}
