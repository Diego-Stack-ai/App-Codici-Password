import {ACCOUNT_STANDARD_FIELDS} from './account-standard-contract.mjs';

const labels = {nomeAccount: 'Nome Account', username: 'Username', account: 'Account / codice', password: 'Password', url: 'URL'};
function clear(input) { input.value = ''; input.defaultValue = ''; }
export async function mountAccountStandardEditor(root, context, {load, save, onSaved, onCancel}) {
    const model = await load(), form = document.createElement('form'), inputs = {};
    form.dataset.accountStandardEditor = 'true';
    for (const field of ACCOUNT_STANDARD_FIELDS) {
        const label = document.createElement('label'), input = document.createElement('input');
        label.textContent = labels[field]; input.value = model.values[field]; input.defaultValue = model.values[field];
        input.dataset.field = field; input.type = field === 'password' ? 'password' : field === 'url' ? 'url' : 'text';
        input.setAttribute('autocomplete', field === 'password' ? 'current-password' : field === 'username' ? 'username' : 'off');
        input.readOnly = !model.canSave; label.append(input); form.append(label); inputs[field] = input;
    }
    const submit = document.createElement('button'), cancel = document.createElement('button'), status = document.createElement('p');
    submit.type = 'submit'; submit.textContent = 'Salva Account'; submit.disabled = !model.canSave;
    cancel.type = 'button'; cancel.textContent = 'Annulla'; form.append(submit, cancel, status); root.append(form);
    let closed = false;
    const dispose = () => {if (closed) return; closed = true; for (const input of Object.values(inputs)) clear(input); form.remove();};
    cancel.addEventListener('click', () => {dispose(); onCancel();});
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (closed || !model.canSave) return; submit.disabled = true;
        const changes = Object.fromEntries(ACCOUNT_STANDARD_FIELDS.filter(field => inputs[field].value !== model.values[field]).map(field => [field, inputs[field].value]));
        if (!Object.keys(changes).length) {status.textContent = 'Nessuna modifica.'; submit.disabled = false; return;}
        try {
            const result = await save(changes); if (closed) return;
            if (result?.status === 'saved' || result?.status === 'applied' || result?.status === 'confirmed') {dispose(); await onSaved();}
            else {status.textContent = 'Account modificato altrove o salvataggio non disponibile.'; submit.disabled = false;}
        } catch {
            if (!closed) {status.textContent = 'Account modificato altrove o salvataggio non disponibile.'; submit.disabled = false;}
        }
    });
    context.signal.addEventListener('abort', dispose, {once: true}); return dispose;
}
