import {PRIVATE_QR_SCALARS} from './qr-selection-contract.mjs';
import {COMPANY_QR_SCALARS} from './company-qr-selection-contract.mjs';

// Dependency-injected editor. Mount only after a trusted writer is available;
// the module itself never imports Firebase or creates an alternate write path.
export async function mountQrSelectionEditor(root, context, {load, createController, domain = 'private'}) {
    if (!['private', 'company'].includes(domain)) throw Error('INVALID_DOMAIN');
    const scalarKeys = domain === 'company' ? COMPANY_QR_SCALARS : PRIVATE_QR_SCALARS;
    const collectionKeys = domain === 'company' ? [] : ['phones', 'emails', 'addresses'];
    let disposed = false, controller;
    const abort = new AbortController(), host = document.createElement('section'), fields = document.createElement('fieldset');
    const status = document.createElement('p'), save = document.createElement('button'), retry = document.createElement('button');
    const rows = [];
    status.setAttribute('role', 'status'); save.type = retry.type = 'button';
    save.textContent = 'Salva selezione'; retry.textContent = 'Riprova salvataggio'; retry.hidden = true;
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {
        if (disposed) return; disposed = true; abort.abort(); controller?.dispose();
        context.signal.removeEventListener('abort', dispose);
        for (const row of rows) {row.input.checked = false; row.input.value = ''; row.label.textContent = '';}
        rows.length = 0; status.textContent = ''; host.remove();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) {dispose(); return dispose;}
    try {
        const snapshot = await load(); check();
        if (!snapshot || !Array.isArray(snapshot.choices) || snapshot.choices.length > 3005) throw Error('INVALID_CHOICES');
        const seen = new Set();
        for (const choice of snapshot.choices) {
            const scalar = scalarKeys.includes(choice.key), compound = `${choice.key}:${choice.id ?? ''}`;
            if ((!scalar && !collectionKeys.includes(choice.key)) || (scalar && choice.id != null) ||
                (!scalar && (typeof choice.id !== 'string' || !choice.id)) || seen.has(compound) || typeof choice.label !== 'string' || choice.label.length > 100000) throw Error('INVALID_CHOICES');
            seen.add(compound);
            const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
            input.type = 'checkbox'; input.checked = scalar ? snapshot.selection[choice.key] === true : snapshot.selection[choice.key].includes(choice.id);
            text.textContent = choice.label; label.append(input, text); fields.append(label);
            rows.push({key: choice.key, id: choice.id, input, label: text});
        }
        if (scalarKeys.some(key => !seen.has(`${key}:`)) || collectionKeys.some(key =>
            !Array.isArray(snapshot.selection[key]) || snapshot.selection[key].some(id => !seen.has(`${key}:${id}`)))) throw Error('INCOMPLETE_CHOICES');
        const onState = ({status: state}) => {
            if (disposed || context.signal.aborted) return;
            try {check();} catch {dispose(); return;}
            fields.disabled = save.disabled = state !== 'idle'; retry.hidden = state !== 'unknown';
            status.textContent = ({preparing: 'Verifica selezione…', saving: 'Salvataggio in corso…', saved: 'Selezione salvata.',
                unknown: 'Conferma non ricevuta. Riprova lo stesso salvataggio.', invalid: 'Selezione non valida o dati cambiati. Riapri la tessera.'})[state] || '';
        };
        controller = createController({onState}); if (disposed) controller.dispose(); check();
        const act = async action => {try {check(); await action();} catch {if (!disposed) status.textContent = 'Operazione non disponibile. Riapri la tessera.';}};
        save.addEventListener('click', () => {void act(() => {
            const selection = Object.fromEntries(scalarKeys.map(key => [key, false]));
            for (const key of collectionKeys) selection[key] = [];
            for (const row of rows) if (row.input.checked) {
                if (scalarKeys.includes(row.key)) selection[row.key] = true; else selection[row.key].push(row.id);
            }
            return controller.save(selection);
        });}, {signal: abort.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: abort.signal});
        host.append(fields, save, retry, status); check(); root.append(host);
    } catch (error) {dispose(); throw error;}
    return dispose;
}
