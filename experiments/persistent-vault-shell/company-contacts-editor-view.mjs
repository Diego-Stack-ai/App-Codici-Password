// Company contacts editor. Same interaction as the private contacts editor A1 —
// fixed slots, repeatable rows, double confirmation, local discard of an unsaved
// row — but the company schema is never converted into the private one: a fixed
// slot is emptied (its object and every field it carries survive), a telephone
// slot stays a top-level string, and only a repeatable `emails.extra` row with a
// stable persisted id can be deleted. Every exit path clears the retained
// controls and detaches the nodes, including nodes still held externally.
const BLOCKED = Object.freeze({
    COMPANY_CONTACT_ID_MISSING: 'Riga senza ID persistito: è visibile ma non modificabile. L’assegnazione dell’ID richiede una migrazione separata.',
    COMPANY_CONTACT_ID_DERIVED: 'L’identità di questa riga è stata ricavata dalla posizione e non è persistita: la riga è visibile ma non modificabile.',
    COMPANY_CONTACTS_LINKED: 'Collegato a un Account: scollega prima dal percorso dei collegamenti.',
    COMPANY_CONTACTS_QR_SELECTED: 'Incluso nella tessera digitale: escludilo prima dalla tessera.',
    COMPANY_CONTACTS_QR_UNVERIFIABLE: 'Selezione della tessera digitale non verificabile: svuotamento ed eliminazione sono disabilitati finché la configurazione salvata non è leggibile e coerente.',
    COMPANY_CONTACTS_LEGACY_FALLBACK: 'Il valore mostrato proviene dal campo legacy aziendaEmail: la sua rimozione richiede una migrazione separata.'
});
export async function mountCompanyContactsEditor(root, context, {load, createController, createId, onSaved, onCancel, labels = {}}) {
    const text = {save: 'Salva contatti', saved: 'Contatti aziendali salvati.', delete: 'Elimina',
        confirm: 'Conferma eliminazione', removed: 'Riga rimossa: salva per confermare.',
        refresh: 'Contatti salvati, ma la vista non si è aggiornata. Riapri i contatti.',
        invalid: 'Dati cambiati o salvataggio non disponibile. Riapri i contatti.',
        unavailable: 'Operazione non disponibile. Riapri i contatti.',
        offline: 'Contatti aziendali disponibili offline in sola consultazione.',
        empty: 'Nessuna modifica da salvare.', incomplete: 'Compila almeno un campo della nuova riga.',
        linked: BLOCKED.COMPANY_CONTACTS_LINKED, qr: BLOCKED.COMPANY_CONTACTS_QR_SELECTED,
        qrUnverified: BLOCKED.COMPANY_CONTACTS_QR_UNVERIFIABLE, ...labels};
    const host = document.createElement('section'), rowsHost = document.createElement('div'), actions = document.createElement('div');
    const status = document.createElement('p'), controls = new AbortController(), rows = [], retained = [];
    host.dataset.companyContactsEditor = 'true'; status.dataset.companyStatus = 'true'; status.setAttribute('role', 'status');
    retained.push(status, host);
    let disposed = false, controller, canSave = false, templates = null;
    const button = (action, label) => {
        const node = document.createElement('button');
        node.type = 'button'; node.dataset.companyAction = action; node.textContent = label;
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
    // A row that cannot be addressed is shown with its reason and never targeted.
    // A fixed slot is never removable: its only removal is the emptying, and that
    // is what the card/link protections block.
    const blockReason = row => !row.editable ? BLOCKED[row.blocked] || 'Riga non modificabile.'
        : row.kind === 'email-extra' ? (row.deleteRefusal ? BLOCKED[row.deleteRefusal] || text.qrUnverified : null)
            : (row.emptyRefusal ? BLOCKED[row.emptyRefusal] || text.qrUnverified : null);
    // A row that was never saved leaves the draft only: it produces no delete
    // operation, no backend request, and no typed value is left behind.
    const discard = row => {
        for (const entry of row.entries) {
            entry.input.value = ''; entry.input.defaultValue = ''; entry.input.checked = false;
            entry.caption.textContent = '';
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
    const addRow = ({kind, id, label, fields, created = false, editable = true, removable = false, blocked: blockedCode = null,
        deleteRefusal = null, emptyRefusal = null, link = null}) => {
        const row = {kind, id, label, created, editable, removable, blocked: blockedCode, deleteRefusal, emptyRefusal, link,
            removed: false, entries: []};
        const set = document.createElement('fieldset');
        set.dataset.companyRow = 'true'; set.dataset.companyKind = kind;
        set.dataset.companyId = typeof id === 'string' ? id : '';
        if (created) set.dataset.companyNew = 'true';
        retained.push(set);
        for (const field of fields) {
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
            input.dataset.companyField = field.key; input.dataset.companyKind = kind;
            input.setAttribute('autocomplete', 'off'); input.setAttribute('data-lpignore', 'true'); input.setAttribute('data-1p-ignore', 'true');
            const wrapper = document.createElement('label'); wrapper.append(caption, input); set.append(wrapper);
            retained.push(input, caption, wrapper);
            row.entries.push({key: field.key, input, caption, original: field.type === 'boolean' ? field.value === true : input.value});
        }
        const message = document.createElement('p'), remove = document.createElement('button');
        message.dataset.companyMessage = 'true'; remove.type = 'button'; remove.dataset.companyAction = 'delete';
        remove.textContent = text.delete; retained.push(message, remove);
        row.set = set; row.message = message; row.remove = remove;
        const blocked = blockReason(row);
        if (blocked) message.textContent = blocked;
        // Only a repeatable row with a stable id can be deleted; a fixed slot is
        // emptied through its own field, and an unsaved row is discarded locally.
        remove.disabled = !canSave || !editable || Boolean(blocked) || (!created && kind !== 'email-extra');
        remove.addEventListener('click', () => {
            try {
                check();
                if (remove.disabled) return;
                if (row.created) {discard(row); return;}
                if (remove.dataset.companyConfirm !== 'true') {
                    remove.dataset.companyConfirm = 'true'; remove.textContent = text.confirm;
                    return;
                }
                row.removed = true; set.hidden = true; message.textContent = text.removed;
            } catch {if (!disposed) status.textContent = text.unavailable;}
        }, {signal: controls.signal});
        set.append(message, remove); rowsHost.append(set); rows.push(row);
        return row;
    };
    const valueOf = entry => entry.input.type === 'checkbox' ? entry.input.checked : entry.input.value;
    const changedFields = row => {
        const result = {};
        for (const entry of row.entries) {
            const value = valueOf(entry);
            if (value === entry.original) continue;
            if (typeof value === 'string' && value === '' && entry.original === '') continue;
            result[entry.key] = value;
        }
        return result;
    };
    const filledFields = row => {
        const result = {};
        for (const entry of row.entries) {
            const value = valueOf(entry);
            if (typeof value === 'string' && value === '') continue;
            result[entry.key] = value;
        }
        return result;
    };
    // The company draft never invents an identity and never converts a row: a
    // fixed slot carries its own field names, a telephone slot a string value.
    const draft = () => {
        const slots = [], creates = [], updates = [], deletes = [];
        for (const row of rows) {
            if (row.removed) {if (!row.created) deletes.push({id: row.id}); continue;}
            if (row.kind === 'phone-slot') {
                const value = changedFields(row).number;
                if (value === undefined) continue;
                slots.push({kind: 'phone-slot', id: row.id, value});
                continue;
            }
            const fields = row.created ? filledFields(row) : changedFields(row);
            if (!Object.keys(fields).length) continue;
            if (row.created) creates.push({id: row.id, fields});
            else if (row.kind === 'email-extra') updates.push({id: row.id, fields});
            else slots.push({kind: 'email-slot', id: row.id, fields});
        }
        return {slots, creates, updates, deletes};
    };
    // Emptying is the sanctioned removal of a fixed slot, so a blocked emptying
    // is refused here with the same reason the service would use.
    const emptied = row => row.kind === 'phone-slot' ? changedFields(row).number === ''
        : changedFields(row).email === '';
    const blockedEmptying = () => rows.some(row => !row.removed && row.kind !== 'email-extra' && !row.created && row.emptyRefusal && emptied(row));
    try {
        const model = await load(); check();
        if (!companyModel(model)) throw Error('COMPANY_EDITOR_INVALID');
        canSave = model.canSave; templates = model.templates;
        for (const row of model.rows) addRow({...row, created: false, editable: row.editable});
        const add = document.createElement('button');
        add.type = 'button'; add.dataset.companyAction = 'add'; add.textContent = 'Aggiungi email';
        add.disabled = !canSave; retained.push(add);
        add.addEventListener('click', () => {
            try {
                check();
                if (!canSave) return;
                addRow({kind: 'email-extra', id: createId(), label: 'Email aggiuntiva', fields: templates.emailExtra,
                    created: true, editable: true, removable: true});
            } catch {if (!disposed) status.textContent = text.unavailable;}
        }, {signal: controls.signal});
        actions.append(add);
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
            if (!staged.slots.length && !staged.creates.length && !staged.updates.length && !staged.deletes.length) {
                status.textContent = text.empty; return {status: 'idle'};
            }
            // A new row needs at least one typed value: its default card flag is
            // not a contact by itself.
            if (staged.creates.some(create => !Object.values(create.fields).some(value => typeof value === 'string' && value !== ''))) {
                status.textContent = text.incomplete; return {status: 'idle'};
            }
            if (blockedEmptying()) {
                const row = rows.find(item => !item.removed && item.kind !== 'email-extra' && !item.created && item.emptyRefusal && emptied(item));
                status.textContent = BLOCKED[row.emptyRefusal] || text.unavailable;
                return {status: 'idle'};
            }
            return controller.save(staged);
        });}, {signal: controls.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: controls.signal});
        cancel.addEventListener('click', () => {dispose(); onCancel();}, {signal: controls.signal});
        host.append(rowsHost, actions, status); check(); root.append(host);
    } catch (error) {dispose(); throw error;}
    return dispose;
}
function companyModel(model) {
    if (!model || !Array.isArray(model.rows) || typeof model.canSave !== 'boolean' || !model.templates) return false;
    for (const row of model.rows) {
        if (typeof row.kind !== 'string' || (row.id !== null && typeof row.id !== 'string') || !Array.isArray(row.fields)) return false;
        for (const field of row.fields) {
            if (typeof field.key !== 'string' || typeof field.label !== 'string') return false;
            if (field.type === 'boolean') {if (typeof field.value !== 'boolean') return false; continue;}
            if (typeof field.value !== 'string' || !Number.isInteger(field.maxLength) || field.maxLength < 1 ||
                field.value.length > field.maxLength) return false;
        }
    }
    return Array.isArray(model.templates.emailExtra);
}
