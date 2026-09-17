// A2 editor, shared by the private and the company address slices: the two
// schemas stay apart in the contracts, the sources and the services, while the
// interaction — rows, an optional fixed seat that is never removable, guards,
// double confirmation, local discard, offline consultation and revocation — is the
// same in both tabs. Every retained control is cleared and detached on exit.
const BLOCKED = Object.freeze({
    ADDRESS_ID_MISSING: 'Riga senza ID persistito: è visibile ma non modificabile. L’assegnazione dell’ID richiede una migrazione separata.',
    ADDRESS_ID_DERIVED: 'Identità ricavata dalla posizione e non persistita: la riga è visibile ma non modificabile.',
    COMPANY_ADDRESS_ID_MISSING: 'Sede senza ID persistito: è visibile ma non modificabile. L’assegnazione dell’ID richiede una migrazione separata.',
    COMPANY_ADDRESS_ID_DERIVED: 'Identità della sede ricavata dalla posizione e non persistita: la riga è visibile ma non modificabile.',
    PROFILE_ADDRESS_UTILITIES_PRESENT: 'Contiene utenze: l’eliminazione è vietata. Gestisci prima le utenze mostrate sotto questo indirizzo.',
    PROFILE_ADDRESS_LINKED: 'Collegato a un Account: scollega prima dal percorso dei collegamenti.',
    PROFILE_ADDRESS_QR_SELECTED: 'Incluso nella tessera digitale: escludilo prima dalla tessera.',
    COMPANY_ADDRESS_QR_SELECTED: 'Sede inclusa nella tessera digitale: escludila prima dalla tessera.',
    PROFILE_ADDRESSES_QR_UNVERIFIABLE: 'Selezione della tessera digitale non verificabile: l’eliminazione è disabilitata finché la configurazione salvata non è leggibile e coerente.',
    COMPANY_ADDRESSES_QR_UNVERIFIABLE: 'Selezione della tessera digitale non verificabile: l’eliminazione è disabilitata finché la configurazione salvata non è leggibile e coerente.'
});
export async function mountAddressesEditor(root, context, {load, createController, createId, onSaved, onCancel, mountUtilities, labels = {}}) {
    const text = {save: 'Salva indirizzi', saved: 'Indirizzi salvati.', delete: 'Elimina', confirm: 'Conferma eliminazione',
        removed: 'Riga rimossa: salva per confermare.', refresh: 'Indirizzi salvati, ma la vista non si è aggiornata. Riapri la linguetta.',
        invalid: 'Dati cambiati o salvataggio non disponibile. Riapri la linguetta.',
        unavailable: 'Operazione non disponibile. Riapri la linguetta.', empty: 'Nessuna modifica da salvare.',
        incomplete: 'Compila almeno un campo della nuova riga.',
        offline: 'Indirizzi disponibili offline in sola consultazione.', ...labels};
    const host = document.createElement('section'), rowsHost = document.createElement('div');
    const seatHost = document.createElement('div'), actions = document.createElement('div');
    const status = document.createElement('p'), controls = new AbortController(), rows = [], retained = [];
    host.dataset.addressesEditor = 'true'; status.dataset.addressStatus = 'true'; status.setAttribute('role', 'status');
    retained.push(status, host);
    let disposed = false, controller, canSave = false, templates = null, seat = null;
    const button = (action, label, parent = actions) => {
        const node = document.createElement('button');
        node.type = 'button'; node.dataset.addressAction = action; node.textContent = label;
        retained.push(node); parent.append(node);
        return node;
    };
    const save = button('save', text.save), retry = button('retry', 'Riprova salvataggio'), cancel = button('cancel', 'Annulla');
    retry.hidden = true;
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {
        if (disposed) return;
        disposed = true; controls.abort(); controller?.dispose(); context.signal.removeEventListener('abort', dispose);
        for (const node of retained) {
            if (typeof node.value === 'string') {node.value = ''; node.defaultValue = '';}
            if (node !== host) node.textContent = '';
        }
        retained.length = 0; rows.length = 0; seat = null; host.remove();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) {dispose(); return dispose;}
    const fieldInput = (field, editable) => {
        const caption = document.createElement('span'), input = document.createElement('input');
        caption.textContent = field.label;
        if (field.type === 'boolean') {
            input.type = 'checkbox'; input.checked = field.value === true; input.defaultChecked = input.checked;
        } else {
            input.type = field.secret ? 'password' : 'text';
            input.value = field.value ?? ''; input.defaultValue = input.value; input.maxLength = field.maxLength;
        }
        input.readOnly = !canSave || !editable;
        input.disabled = !canSave || !editable;
        input.dataset.addressField = field.key;
        input.setAttribute('autocomplete', 'off'); input.setAttribute('data-lpignore', 'true'); input.setAttribute('data-1p-ignore', 'true');
        const wrapper = document.createElement('label'); wrapper.append(caption, input);
        retained.push(input, caption, wrapper);
        return {input, caption, wrapper, key: field.key, original: field.type === 'boolean' ? field.value === true : input.value};
    };
    const group = (fields, editable, editableAll = true) => {
        const set = document.createElement('fieldset'), entries = [];
        for (const field of fields) {
            const entry = fieldInput(field, editableAll && editable);
            set.append(entry.wrapper); entries.push(entry);
        }
        return {set, entries};
    };
    // The row reason is the one the service would use: it is shown, never hidden.
    const rowReason = row => !row.editable ? BLOCKED[row.blocked] || 'Riga non modificabile.'
        : row.deleteRefusal ? BLOCKED[row.deleteRefusal] || text.unavailable : null;
    // A row that was never saved leaves the draft only: no delete operation, no
    // backend request, and no typed value is left behind.
    const discard = row => {
        for (const entry of row.entries) {
            entry.input.value = ''; entry.input.defaultValue = ''; entry.input.checked = false; entry.caption.textContent = '';
        }
        row.message.textContent = ''; row.remove.textContent = '';
        row.set.remove();
        const index = rows.indexOf(row);
        if (index !== -1) rows.splice(index, 1);
        for (const node of [row.set, row.message, row.remove, ...row.entries.map(entry => entry.input)]) {
            const at = retained.indexOf(node);
            if (at !== -1) retained.splice(at, 1);
        }
    };
    const addRow = ({id, label, fields, created = false, editable = true, blocked: blockedCode = null, deleteRefusal = null}) => {
        const row = {id, label, created, editable, blocked: blockedCode, deleteRefusal, removed: false, entries: []};
        const {set, entries} = group(fields, editable, editable);
        row.entries = entries;
        set.dataset.addressRow = 'true'; set.dataset.addressId = typeof id === 'string' ? id : '';
        if (created) set.dataset.addressNew = 'true';
        const legend = document.createElement('legend');
        legend.dataset.addressLabel = 'true'; legend.textContent = typeof label === 'string' ? label : '';
        set.prepend(legend);
        const message = document.createElement('p'), remove = document.createElement('button');
        message.dataset.addressMessage = 'true'; remove.type = 'button'; remove.dataset.addressAction = 'delete';
        remove.textContent = text.delete;
        row.set = set; row.message = message; row.remove = remove;
        const reason = rowReason(row);
        if (reason) message.textContent = reason;
        // A fixed seat or a row without a persisted identity is never removable.
        remove.disabled = !canSave || !editable || Boolean(reason);
        remove.addEventListener('click', () => {
            try {
                check();
                if (remove.disabled) return;
                if (row.created) {discard(row); return;}
                if (remove.dataset.addressConfirm !== 'true') {
                    remove.dataset.addressConfirm = 'true'; remove.textContent = text.confirm;
                    return;
                }
                row.removed = true; set.hidden = true; message.textContent = text.removed;
            } catch {if (!disposed) status.textContent = text.unavailable;}
        }, {signal: controls.signal});
        set.append(message, remove); retained.push(set, legend, message, remove, ...entries.map(entry => entry.input));
        rowsHost.append(set); rows.push(row);
        if (!created && editable && typeof mountUtilities === 'function') {
            const utilities = document.createElement('div'); utilities.dataset.addressUtilities = id; set.append(utilities); retained.push(utilities);
            const mounted = mountUtilities(utilities, id);
            Promise.resolve(mounted).then(cleanup => {if (typeof cleanup === 'function') controls.signal.addEventListener('abort', cleanup, {once: true});})
                .catch(() => {if (!disposed) message.textContent = text.unavailable;});
        }
        return row;
    };
    const valueOf = entry => entry.input.type === 'checkbox' ? entry.input.checked : entry.input.value;
    const changed = entries => {
        const result = {};
        for (const entry of entries) {
            const value = valueOf(entry);
            if (value === entry.original) continue;
            if (typeof value === 'string' && value === '' && entry.original === '') continue;
            result[entry.key] = value;
        }
        return result;
    };
    const filled = entries => {
        const result = {};
        for (const entry of entries) {
            const value = valueOf(entry);
            if (typeof value === 'string' && value === '') continue;
            result[entry.key] = value;
        }
        return result;
    };
    // The draft shape is shared by both domains: the private source simply ignores
    // the seat section, which only the company source understands.
    const draft = () => {
        const creates = [], updates = [], deletes = [];
        for (const row of rows) {
            if (row.removed) {if (!row.created) deletes.push({id: row.id}); continue;}
            const fields = row.created ? filled(row.entries) : changed(row.entries);
            if (!Object.keys(fields).length) continue;
            if (row.created) creates.push({id: row.id, fields});
            else updates.push({id: row.id, fields});
        }
        const seatFields = seat ? changed(seat.entries) : {};
        return {seat: Object.keys(seatFields).length ? {fields: seatFields} : undefined, creates, updates, deletes};
    };
    try {
        const model = await load(); check();
        if (!addressesModel(model)) throw Error('ADDRESSES_EDITOR_INVALID');
        canSave = model.canSave; templates = model.templates;
        // The fixed seat is consulted and edited field by field; it can never be
        // removed, because the company schema has no other legal seat.
        if (model.seat) {
            const {set, entries} = group(model.seat.fields, true, true);
            seat = {entries};
            set.dataset.addressSeat = 'true';
            const legend = document.createElement('legend');
            legend.dataset.addressLabel = 'true'; legend.textContent = model.seat.label ?? 'Sede legale';
            set.prepend(legend);
            retained.push(set, legend, ...entries.map(entry => entry.input));
            seatHost.append(set);
        }
        for (const row of model.rows) addRow({...row, created: false});
        const add = button('add', model.addLabel ?? 'Aggiungi indirizzo');
        add.disabled = !canSave;
        add.addEventListener('click', () => {
            try {
                check();
                if (!canSave) return;
                addRow({id: createId(), label: model.newLabel ?? 'Nuovo indirizzo', fields: templates, created: true, editable: true});
            } catch {if (!disposed) status.textContent = text.unavailable;}
        }, {signal: controls.signal});
        controller = createController({onState: ({status: state}) => {
            if (disposed || context.signal.aborted) return;
            try {check();} catch {dispose(); return;}
            save.disabled = !canSave || state !== 'idle'; retry.hidden = state !== 'unknown';
            status.textContent = ({preparing: 'Verifica…', saving: 'Salvataggio in corso…', saved: text.saved,
                unknown: 'Conferma non ricevuta. Riprova lo stesso salvataggio.', invalid: text.invalid})[state] || '';
        }});
        if (disposed) controller.dispose(); check();
        const act = async operation => {
            try {
                check();
                const result = await operation();
                check();
                if (result?.status === 'saved') {
                    try {await onSaved();}
                    catch {if (!disposed) status.textContent = text.refresh;}
                }
            } catch {if (!disposed) status.textContent = text.unavailable;}
        };
        save.disabled = !canSave;
        if (!canSave) status.textContent = text.offline;
        save.addEventListener('click', () => {void act(() => {
            const staged = draft();
            if (!staged.seat && !staged.creates.length && !staged.updates.length && !staged.deletes.length) {
                status.textContent = text.empty; return {status: 'idle'};
            }
            if (staged.creates.some(create => !Object.values(create.fields).some(value => typeof value === 'string' && value !== ''))) {
                status.textContent = text.incomplete; return {status: 'idle'};
            }
            return controller.save(staged);
        });}, {signal: controls.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: controls.signal});
        cancel.addEventListener('click', () => {dispose(); onCancel();}, {signal: controls.signal});
        host.append(seatHost, rowsHost, actions, status); check(); root.append(host);
    } catch (error) {dispose(); throw error;}
    return dispose;
}
function addressesModel(model) {
    if (!model || !Array.isArray(model.rows) || typeof model.canSave !== 'boolean' || !model.templates) return false;
    const fields = list => Array.isArray(list) && list.every(field => typeof field.key === 'string' && typeof field.label === 'string' &&
        (field.type === 'boolean' ? typeof field.value === 'boolean'
            : typeof field.value === 'string' && Number.isInteger(field.maxLength) && field.maxLength >= 1 && field.value.length <= field.maxLength));
    for (const row of model.rows) {
        if (row.id !== null && typeof row.id !== 'string') return false;
        if (!fields(row.fields)) return false;
    }
    return fields(model.templates) && (!model.seat || fields(model.seat.fields));
}
