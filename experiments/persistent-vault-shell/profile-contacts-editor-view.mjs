// Row values live only in this view. Every exit path clears the retained controls
// and detaches the nodes, including nodes still held by an external reference.
const BLOCKED = Object.freeze({
    CONTACT_ID_MISSING: 'Riga senza ID persistito: è visibile ma non modificabile. L’assegnazione dell’ID richiede una migrazione separata.'
});
export async function mountProfileContactsEditor(root, context, {load, createController, createId, onSaved, onCancel, labels = {}}) {
    const text = {save: 'Salva contatti', saved: 'Contatti salvati.', delete: 'Elimina', confirm: 'Conferma eliminazione',
        removed: 'Riga rimossa: salva per confermare.', refresh: 'Contatti salvati, ma la vista non si è aggiornata. Riapri i contatti.',
        invalid: 'Dati cambiati o salvataggio non disponibile. Riapri i contatti.',
        unavailable: 'Operazione non disponibile. Riapri i contatti.',
        offline: 'Contatti disponibili offline in sola consultazione.',
        empty: 'Nessuna modifica da salvare.', incomplete: 'Compila almeno un campo della nuova riga.',
        linked: 'Collegato a un Account: scollega prima dal percorso dei collegamenti.',
        qr: 'Incluso nella selezione QR: escludilo prima dalla tessera digitale.',
        qrUnverified: 'Selezione QR non verificabile: l’eliminazione è disabilitata finché la configurazione salvata non è leggibile e coerente.', ...labels};
    const host = document.createElement('section'), rowsHost = document.createElement('div'), actions = document.createElement('div');
    const status = document.createElement('p'), controls = new AbortController(), rows = [], retained = [];
    host.dataset.profileContactsEditor = 'true'; status.dataset.contactStatus = 'true'; status.setAttribute('role', 'status');
    retained.push(status, host);
    let disposed = false, controller, canSave = false, templates = null;
    const button = (action, label) => {
        const node = document.createElement('button');
        node.type = 'button'; node.dataset.contactAction = action; node.textContent = label;
        retained.push(node); actions.append(node);
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
        retained.length = 0; rows.length = 0; host.remove();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) {dispose(); return dispose;}
    // A row without a persisted ID is shown, never repaired here and never
    // targeted. An unverifiable QR protection blocks deletion for every row.
    const blockReason = row => !row.editable && !row.created ? BLOCKED[row.blocked] || 'Riga non modificabile.'
        : row.qr === 'unverified' ? text.qrUnverified
            : row.linked ? text.linked : row.qr === true ? text.qr : null;
    const addRow = ({collection, id, fields, created = false, editable = true, linked = false, qr = null, blocked: blockedCode = null}) => {
        const row = {collection, id, created, editable, linked, qr, blocked: blockedCode, removed: false, entries: []};
        const set = document.createElement('fieldset');
        set.dataset.contactRow = 'true'; set.dataset.contactCollection = collection;
        set.dataset.contactId = typeof id === 'string' ? id : '';
        if (created) set.dataset.contactNew = 'true';
        retained.push(set);
        for (const field of fields) {
            const label = document.createElement('label'), caption = document.createElement('span');
            caption.textContent = field.label;
            const input = document.createElement(field.multiline ? 'textarea' : 'input');
            if (!field.multiline) input.type = field.secret ? 'password' : 'text';
            input.value = field.value ?? ''; input.defaultValue = input.value; input.maxLength = field.maxLength;
            input.readOnly = !canSave || !editable;
            input.dataset.contactField = field.key; input.dataset.contactCollection = collection;
            input.setAttribute('autocomplete', 'off'); input.setAttribute('data-lpignore', 'true'); input.setAttribute('data-1p-ignore', 'true');
            label.append(caption, input); set.append(label);
            retained.push(input, caption, label);
            row.entries.push({key: field.key, input, original: input.value});
        }
        const message = document.createElement('p'), remove = document.createElement('button');
        message.dataset.contactMessage = 'true'; remove.type = 'button'; remove.dataset.contactAction = 'delete';
        remove.textContent = text.delete; retained.push(message, remove);
        const blocked = blockReason(row);
        if (blocked) message.textContent = blocked;
        remove.disabled = !canSave || Boolean(blocked);
        remove.addEventListener('click', () => {
            try {
                check();
                if (remove.disabled) return;
                if (remove.dataset.contactConfirm !== 'true') {
                    remove.dataset.contactConfirm = 'true'; remove.textContent = text.confirm;
                    return;
                }
                row.removed = true; set.hidden = true; message.textContent = text.removed;
            } catch {if (!disposed) status.textContent = text.unavailable;}
        }, {signal: controls.signal});
        set.append(message, remove); rowsHost.append(set); rows.push(row);
        return row;
    };
    const values = (row, onlyChanged) => {
        const result = {};
        for (const entry of row.entries) {
            if (onlyChanged && entry.input.value === entry.original) continue;
            if (!onlyChanged && entry.input.value === '') continue;
            result[entry.key] = entry.input.value;
        }
        return result;
    };
    const draft = () => {
        const creates = [], updates = [], deletes = [];
        for (const row of rows) {
            if (row.removed) {deletes.push({collection: row.collection, id: row.id}); continue;}
            if (row.created) {creates.push({collection: row.collection, id: row.id, fields: values(row, false)}); continue;}
            const fields = values(row, true);
            if (Object.keys(fields).length) updates.push({collection: row.collection, id: row.id, fields});
        }
        return {creates, updates, deletes};
    };
    try {
        const model = await load(); check();
        if (!contactModel(model)) throw Error('PROFILE_EDITOR_INVALID');
        canSave = model.canSave; templates = model.templates;
        for (const row of model.rows) addRow({...row, created: false, editable: row.editable});
        for (const [collection, label] of [['contactEmails', 'Aggiungi email'], ['contactPhones', 'Aggiungi telefono']]) {
            const node = document.createElement('button');
            node.type = 'button'; node.dataset.contactAdd = collection; node.textContent = label; node.disabled = !canSave;
            retained.push(node);
            node.addEventListener('click', () => {
                try {
                    check();
                    if (!canSave) return;
                    addRow({collection, id: createId(collection), fields: templates[collection], created: true, editable: true});
                } catch {if (!disposed) status.textContent = text.unavailable;}
            }, {signal: controls.signal});
            actions.append(node);
        }
        controller = createController({onState: ({status: state}) => {
            if (disposed || context.signal.aborted) return;
            try {check();} catch {dispose(); return;}
            save.disabled = !canSave || state !== 'idle'; retry.hidden = state !== 'unknown';
            status.textContent = ({preparing: 'Verifica e cifratura…', saving: 'Salvataggio in corso…', saved: text.saved,
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
            if (!staged.creates.length && !staged.updates.length && !staged.deletes.length) {status.textContent = text.empty; return {status: 'idle'};}
            if (staged.creates.some(create => !Object.keys(create.fields).length)) {status.textContent = text.incomplete; return {status: 'idle'};}
            return controller.save(staged);
        });}, {signal: controls.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: controls.signal});
        cancel.addEventListener('click', () => {dispose(); onCancel();}, {signal: controls.signal});
        host.append(rowsHost, actions, status); check(); root.append(host);
    } catch (error) {dispose(); throw error;}
    return dispose;
}
function contactModel(model) {
    if (!model || !Array.isArray(model.rows) || typeof model.canSave !== 'boolean' || !model.templates) return false;
    for (const row of model.rows) {
        if (typeof row.collection !== 'string' || (row.id !== null && typeof row.id !== 'string') || !Array.isArray(row.fields)) return false;
        for (const field of row.fields) if (typeof field.key !== 'string' || typeof field.value !== 'string' ||
            !Number.isInteger(field.maxLength) || field.maxLength < 1 || field.value.length > field.maxLength) return false;
    }
    return ['contactEmails', 'contactPhones'].every(key => Array.isArray(model.templates[key]));
}
