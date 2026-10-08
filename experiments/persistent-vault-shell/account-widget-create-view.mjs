// Generic widget creation; structured banking and shared links use separate flows.
export function mountAccountWidgetCreate(root, context, {source, onSaved = () => {}}) {
  const host = document.createElement('section'), controls = new AbortController(), inputs = [], rows = [];
  let closed = false, busy = false, plan;
  const make = (tag, text) => {const node = document.createElement(tag); node.textContent = text; return node;};
  const input = (parent, text, type = 'text') => {
    const label = make('label', text), node = document.createElement('input');
    node.type = type; node.autocomplete = 'off'; inputs.push(node); label.append(node); parent.append(label); return node;
  };
  const title = input(host, 'Titolo widget'), fields = make('div', '');
  const add = make('button', 'Aggiungi campo'), save = make('button', 'Crea widget'), cancel = make('button', 'Annulla');
  const status = make('p', ''); status.setAttribute('role', 'status');
  for (const button of [add, save, cancel]) button.type = 'button';
  const wipe = () => {for (const node of inputs) {node.value = ''; node.checked = false;}};
  const dispose = () => {
    if (closed) return; closed = true; controls.abort(); wipe(); plan = null; rows.length = 0;
    host.remove(); source.dispose(); context.signal.removeEventListener('abort', dispose);
  };
  const addField = () => {
    if (closed || busy || plan || rows.length >= 30) return;
    const row = make('div', ''), label = input(row, 'Nome campo'), value = input(row, 'Valore', 'password');
    const secret = input(row, 'Campo riservato (cifrato)', 'checkbox'); secret.checked = true;
    // Keep the draft masked even if the user explicitly opts for a public field.
    rows.push({id: crypto.randomUUID(), label, value, secret}); fields.append(row);
    add.disabled = rows.length >= 30;
  };
  try {context.assertUnlocked(); if (context.signal.aborted) throw Error('VIEW_DISPOSED');}
  catch (error) {dispose(); throw error;}
  host.append(fields, add, save, cancel, status); root.append(host); addField();
  context.signal.addEventListener('abort', dispose, {once: true});
  add.addEventListener('click', addField, {signal: controls.signal});
  cancel.addEventListener('click', dispose, {signal: controls.signal});
  save.addEventListener('click', async () => {
    if (closed || busy) return; busy = true; save.disabled = true; add.disabled = true;
    try {
      context.assertUnlocked();
      if (!plan) {
        plan = await source.prepareCreate({title: title.value, fields: rows.map(row => ({id: row.id,
          label: row.label.value, value: row.value.value, type: row.secret.checked ? 'sensitive' : 'text'}))});
        if (closed) return;
        wipe(); for (const node of inputs) node.disabled = true;
      }
      await source.send(plan); if (closed) return;
      dispose(); await onSaved();
    } catch {
      if (!closed) status.textContent = plan ? 'Esito non confermato. Riprova la stessa richiesta o chiudi e verifica.' : 'Creazione non disponibile. Controlla titolo, nomi dei campi e connessione.';
    } finally {busy = false; if (!closed) {save.disabled = false; add.disabled = Boolean(plan) || rows.length >= 30;}}
  }, {signal: controls.signal});
  return dispose;
}
