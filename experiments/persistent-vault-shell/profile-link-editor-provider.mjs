import {createProfileLinkEditorSource} from './profile-link-editor-source.mjs';
import {validateProfileLinkRequest} from './profile-link-contract.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {mountProfileAccountPicker} from './profile-account-picker-view.mjs';

export async function mountProfileLinkEditor(root, context, options) {
    if (!['change', 'unlink'].includes(options.mode) || typeof options.submit !== 'function' ||
        typeof options.assertNoPendingAccount !== 'function') throw Error('PROFILE_LINK_CONFIG');
    const source = createProfileLinkEditorSource({context, ...options});
    const uid = context.user?.uid, controls = new AbortController();
    const host = document.createElement('section'), heading = document.createElement('h3'), summary = document.createElement('p');
    const pickerHost = document.createElement('div'), status = document.createElement('p');
    const save = document.createElement('button'), choose = document.createElement('button'), retry = document.createElement('button'), cancel = document.createElement('button');
    let disposed = false, pickerCleanup, controller, selected, model;
    host.dataset.profileLinkEditor = 'true'; status.setAttribute('role', 'status');
    save.type = choose.type = retry.type = cancel.type = 'button';
    heading.textContent = options.mode === 'unlink' ? 'Scollega Account' : 'Scegli Account';
    save.textContent = options.mode === 'unlink' ? 'Conferma scollegamento' : 'Salva collegamento';
    choose.textContent = 'Scegli altro Account'; retry.textContent = 'Riprova collegamento'; cancel.textContent = 'Annulla collegamento';
    choose.hidden = retry.hidden = true; save.disabled = true;
    const dispose = () => {
        if (disposed) return; disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose);
        pickerCleanup?.(); controller?.dispose(); source.dispose(); selected = model = null; summary.textContent = status.textContent = ''; host.remove();
    };
    const check = () => {
        if (disposed || context.signal.aborted || options.getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const report = () => {try {check(); status.textContent = 'Collegamento non disponibile o dati cambiati. Riapri il profilo.';} catch {dispose();}};
    const act = async operation => {
        try {check(); const result = await operation(); check(); if (result?.status === 'saved') {dispose(); await options.onSaved();}}
        catch {report();}
    };
    const openPicker = async () => {
        check(); selected = undefined; summary.textContent = ''; choose.hidden = true; save.disabled = true; pickerCleanup?.();
        const mounted = await (options.mountPicker || mountProfileAccountPicker)(pickerHost, context, {
            load: options.readAccounts, filterAccounts: options.models.filterProfileAccounts,
            onSelect: (account, labels) => {
                try {
                    check(); selected = account; summary.textContent = `${labels.name} — ${labels.companyName || 'Personale'}`;
                    choose.hidden = false;
                    const unchanged = JSON.stringify(selected) === JSON.stringify(model.account);
                    save.disabled = unchanged || !model.canSave; status.textContent = unchanged ? 'Questo Account è già collegato al dato.' : '';
                } catch {dispose();}
            }, onCancel: () => {dispose(); options.onCancel();}});
        if (disposed || context.signal.aborted) mounted?.(); else pickerCleanup = mounted;
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    try {
        check(); model = await source.load(); check();
        if (options.mode === 'unlink' && !model.account) throw Error('PROFILE_LINK_UNCHANGED');
        controller = createQrSelectionSaveController({context, getUser: options.getUser, submit: options.submit,
            prepare: async (target, operationId) => {
                const seen = new Set();
                for (const account of [model.account, target]) if (account && !seen.has(JSON.stringify(account))) {
                    seen.add(JSON.stringify(account));
                    if (await options.assertNoPendingAccount(account) !== true) throw Error('PROFILE_LINK_PENDING_MUTATION');
                    check();
                }
                return source.prepare(target, operationId);
            }, createRequest: (prepared, operationId) => {
                if (prepared.operationId !== operationId) throw Error('OPERATION_CHANGED');
                return validateProfileLinkRequest(prepared);
            }, onState: ({status: state}) => {
                if (disposed || context.signal.aborted) return;
                save.disabled = choose.disabled = state !== 'idle'; retry.hidden = state !== 'unknown';
                status.textContent = ({preparing: 'Verifica del collegamento…', saving: 'Salvataggio…', saved: 'Collegamento salvato.',
                    unknown: 'Conferma non ricevuta. Riprova lo stesso collegamento.', invalid: 'Dati cambiati o modifiche in attesa. Riapri il profilo.'})[state] || '';
            }});
        host.append(heading, summary, pickerHost, save, choose, retry, cancel, status); root.append(host);
        cancel.addEventListener('click', () => {dispose(); options.onCancel();}, {signal: controls.signal});
        choose.addEventListener('click', () => {void openPicker().catch(report);}, {signal: controls.signal});
        save.addEventListener('click', () => {
            if (!model?.canSave || save.disabled || selected === undefined) return;
            void act(() => controller.save(selected));
        }, {signal: controls.signal});
        retry.addEventListener('click', () => {void act(() => controller.retry());}, {signal: controls.signal});
        if (!model.canSave) status.textContent = 'I collegamenti si possono modificare quando sei online.';
        else if (options.mode === 'unlink') {
            selected = null; save.disabled = false; summary.textContent = 'Scollegare questo dato? L’Account e i suoi contenuti vengono conservati.';
        } else await openPicker();
        return dispose;
    } catch (error) {dispose(); throw error;}
}
