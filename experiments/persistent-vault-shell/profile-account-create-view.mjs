import {createProfileAccountCreateSource} from './prepare-profile-account-create.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

export async function mountProfileAccountCreate(root, context, options) {
    const source = createProfileAccountCreateSource({context, ...options});
    const host = document.createElement('section'), title = document.createElement('h3'), origin = document.createElement('p');
    const scope = document.createElement('select'), name = document.createElement('input'), username = document.createElement('input');
    const password = document.createElement('input'), transfer = document.createElement('input'), transferLabel = document.createElement('label');
    const save = document.createElement('button'), cancel = document.createElement('button'), retry = document.createElement('button'), status = document.createElement('p');
    const controls = new AbortController(); let disposed = false, model;
    host.dataset.profileAccountCreate = 'true';
    title.textContent = 'Crea un nuovo Account'; origin.textContent = `Origine: ${options.source.type}`;
    name.placeholder = 'Nome Account'; username.placeholder = 'Username'; password.placeholder = 'Password'; password.type = 'password';
    transfer.type = 'checkbox'; const transferText = document.createElement('span'); transferText.textContent = 'Trasferisci la password legacy in modo sicuro'; transferLabel.append(transfer, transferText);
    save.type = cancel.type = retry.type = 'button'; save.textContent = 'Crea e collega'; cancel.textContent = 'Annulla'; retry.textContent = 'Riprova'; retry.hidden = true;
    status.setAttribute('role', 'status');
    const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; scope.append(node); };
    option('private', 'Personale'); for (const row of options.companies || []) option(`company:${row.companyId}`, row.companyName);
    const dispose = () => { if (disposed) return; disposed = true; controls.abort(); source.dispose(); for (const node of [name, username, password]) node.value = ''; host.remove(); };
    const check = () => { if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked(); };
    context.signal.addEventListener('abort', dispose, {once: true});
    model = await source.load(); check(); username.value = model.suggestedUsername; transferLabel.hidden = !model.canTransferLegacy;
    const controller = createQrSelectionSaveController({context, getUser: options.getUser, submit: options.submitCreate,
        prepare: async (_, operationId) => source.prepare({scope: scope.value === 'private' ? {domain: 'private'} : {domain: 'company', companyId: scope.value.slice(8)},
            name: name.value, username: username.value, password: password.value, transferLegacyPassword: transfer.checked, operationId}),
        createRequest: prepared => prepared,
        onState: ({status: state}) => { if (disposed) return; save.disabled = state !== 'idle'; retry.hidden = state !== 'unknown';
            status.textContent = ({preparing: 'Verifica e cifratura…', saving: 'Creazione e collegamento…', saved: 'Account creato e collegato.',
                unknown: 'Conferma non ricevuta. Riprova senza creare duplicati.', invalid: 'Dati cambiati. Riapri il profilo.'})[state] || ''; }});
    host.append(title, origin, scope, name, username, password, transferLabel, save, retry, cancel, status); root.append(host);
    cancel.addEventListener('click', () => { dispose(); options.onCancel(); }, {signal: controls.signal});
    const act = async retrying => { try { check(); const result = retrying ? await controller.retry() : await controller.save(null); check(); if (result?.status === 'saved') { dispose(); await options.onSaved(); } } catch { if (!disposed) status.textContent = 'Creazione non disponibile; la password legacy è stata conservata.'; } };
    save.addEventListener('click', () => { void act(false); }, {signal: controls.signal}); retry.addEventListener('click', () => { void act(true); }, {signal: controls.signal});
    return dispose;
}
