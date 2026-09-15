// Values remain only in this view. Exit/revocation clears both current and
// default input values, including nodes retained by an external reference.
export async function mountProfileTextEditor(root, context, {load, createController, onSaved, onCancel}) {
    const host = document.createElement('section'), fields = document.createElement('fieldset'), status = document.createElement('p');
    const save = document.createElement('button'), retry = document.createElement('button'), cancel = document.createElement('button');
    const controls = new AbortController(), rows = []; let disposed = false, controller, canSave = false;
    host.dataset.profileTextEditor = 'true'; status.setAttribute('role', 'status');
    save.type = retry.type = cancel.type = 'button'; save.textContent = 'Salva anagrafica'; retry.textContent = 'Riprova salvataggio'; cancel.textContent = 'Annulla'; retry.hidden = true;
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {
        if (disposed) return; disposed = true; controls.abort(); controller?.dispose(); context.signal.removeEventListener('abort', dispose);
        for (const row of rows) {row.input.value = ''; row.input.defaultValue = ''; row.original = ''; row.label.textContent = '';}
        rows.length = 0; status.textContent = ''; host.remove();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) {dispose(); return dispose;}
    try {
        const model = await load(); check();
        if (!Array.isArray(model?.fields) || !model.fields.length || model.fields.length > 10 || typeof model.canSave !== 'boolean') throw Error('PROFILE_EDITOR_INVALID');
        canSave = model.canSave; const seen = new Set();
        for (const field of model.fields) {
            if (typeof field.key !== 'string' || !/^[A-Za-z_]+$/.test(field.key) || seen.has(field.key) || typeof field.label !== 'string' ||
                typeof field.value !== 'string' || !Number.isInteger(field.maxLength) || field.maxLength > 20000 || field.maxLength < 1 || field.value.length > field.maxLength) throw Error('PROFILE_EDITOR_INVALID');
            seen.add(field.key);
            const label = document.createElement('label'), caption = document.createElement('span'); caption.textContent = field.label;
            const input = document.createElement(field.multiline ? 'textarea' : 'input');
            if (!field.multiline) input.type = 'text';
            input.value = field.value; input.maxLength = field.maxLength; input.readOnly = !canSave; input.dataset.profileField = field.key;
            input.setAttribute('autocomplete', 'off'); input.setAttribute('data-lpignore', 'true'); input.setAttribute('data-1p-ignore', 'true');
            label.append(caption, input); fields.append(label); rows.push({key: field.key, original: field.value, input, label: caption});
        }
        controller = createController({onState: ({status: state}) => {
            if (disposed || context.signal.aborted) return;
            try {check();} catch {dispose(); return;}
            fields.disabled = state !== 'idle'; save.disabled = !canSave || state !== 'idle'; retry.hidden = state !== 'unknown';
            status.textContent = ({preparing: 'Verifica e cifratura…', saving: 'Salvataggio in corso…', saved: 'Anagrafica salvata.',
                unknown: 'Conferma non ricevuta. Riprova lo stesso salvataggio.', invalid: 'Dati cambiati o salvataggio non disponibile. Riapri l’anagrafica.'})[state] || '';
        }});
        if (disposed) controller.dispose(); check();
        const act = async operation => {
            try {check(); const result = await operation(); check(); if (result?.status === 'saved') await onSaved();}
            catch {if (!disposed) status.textContent = 'Operazione non disponibile. Riapri l’anagrafica.';}
        };
        save.disabled = !canSave;
        if (!canSave) status.textContent = 'Anagrafica disponibile offline in sola consultazione.';
        save.addEventListener('click', () => {if (!canSave) return; void act(() => {
            const changes = Object.fromEntries(rows.filter(row => row.input.value !== row.original).map(row => [row.key, row.input.value]));
            if (!Object.keys(changes).length) {status.textContent = 'Nessuna modifica da salvare.'; return {status: 'idle'};}
            return controller.save(changes);
        });}, {signal: controls.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: controls.signal});
        cancel.addEventListener('click', () => {dispose(); onCancel();}, {signal: controls.signal});
        host.append(fields, save, retry, cancel, status); check(); root.append(host);
    } catch (error) {dispose(); throw error;}
    return dispose;
}
