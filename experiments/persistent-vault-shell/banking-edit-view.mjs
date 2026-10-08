import {BANK_EDIT_SECRETS} from './banking-edit-contract.mjs';
const labels = {iban: 'IBAN', passwordDispositiva: 'Password dispositiva', numeroVerde: 'Numero verde', referenteNome: 'Referente banca',
  referenteTelefono: 'Telefono banca', referenteCellulare: 'Cellulare banca', cardType: 'Tipo carta', type: 'Tipo', titolare: 'Intestatario',
  cardNumber: 'Numero carta', expiry: 'Scadenza MM/AA', pin: 'PIN', ccv: 'CCV'};
export async function mountBankingEditor(root, context, {source, onSaved = () => {}}) {
  const host = document.createElement('section'), events = new AbortController(), inputs = new Map();
  let closed = false, busy = false, plan, original;
  const make = (tag, text) => {const node = document.createElement(tag); node.textContent = text; return node;};
  const wipe = () => {for (const input of inputs.values()) input.value = ''; original = null;};
  const dispose = () => {if (closed) return; closed = true; events.abort(); wipe(); plan = null; source.dispose();
    host.remove(); context.signal.removeEventListener('abort', dispose);};
  context.signal.addEventListener('abort', dispose, {once: true});
  try {
    context.assertUnlocked(); if (context.signal.aborted) throw Error('VIEW_DISPOSED');
    const loaded = await source.load(); if (closed) return dispose;
    original = loaded;
    host.append(make('h3', 'Modifica dati bancari esistenti'));
    for (const [field, value] of Object.entries(original)) {
      const label = make('label', labels[field] || field), input = document.createElement('input');
      input.type = BANK_EDIT_SECRETS.includes(field) ? 'password' : 'text'; input.autocomplete = 'off'; input.value = value;
      inputs.set(field, input); label.append(input); host.append(label);
    }
    const save = make('button', 'Salva dati bancari'), cancel = make('button', 'Annulla'), status = make('p', '');
    save.type = cancel.type = 'button'; status.setAttribute('role', 'status'); host.append(save, cancel, status); root.append(host);
    cancel.addEventListener('click', dispose, {signal: events.signal});
    save.addEventListener('click', async () => {
      if (closed || busy) return; busy = true; save.disabled = true;
      try {
        if (!plan) {
          const changes = Object.fromEntries([...inputs].filter(([field, input]) => input.value !== original[field]).map(([field, input]) => [field, input.value]));
          if (!Object.keys(changes).length) {status.textContent = 'Nessuna modifica.'; return;}
          plan = await source.prepare(changes); if (closed) return;
          wipe(); for (const input of inputs.values()) input.disabled = true;
        }
        const result = await source.send(plan); if (closed) return;
        if (result?.status !== 'confirmed') throw Error('BANK_EDIT_UNCONFIRMED');
        dispose(); await onSaved();
      } catch {if (!closed) status.textContent = plan ? 'Esito non confermato. Riprova la stessa richiesta.' : 'Modifica non preparata: verifica i dati o riapri il conto.';}
      finally {busy = false; if (!closed) save.disabled = false;}
    }, {signal: events.signal});
    return dispose;
  } catch (error) {dispose(); throw error;}
}
