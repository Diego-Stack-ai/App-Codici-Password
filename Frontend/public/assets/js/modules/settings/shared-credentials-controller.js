import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listSharedVaultData, listSharedVaultDataConfirmed,
    listSharedVaultLinks, listSharedVaultLinksConfirmed
} from '../data/vault-repository.js';
import {
    createSharedCredential,
    deleteSharedCredential,
    updateSharedCredential
} from '../data/shared-vault-data-client.js';

function modalShell(title, close) {
    const overlay = createElement('div', {className: 'modal-overlay active'});
    const body = createElement('div', {className: 'shared-credentials-body'});
    const box = createElement('section', {className: 'modal-box shared-credentials-modal', role: 'dialog', 'aria-modal': 'true'});
    setChildren(box, [
        createElement('div', {className: 'shared-credentials-heading'}, [
            createElement('h2', {className: 'modal-title', textContent: title}),
            createElement('button', {
                type: 'button', className: 'shared-credentials-icon-button',
                'aria-label': 'Chiudi', onclick: close
            }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'close'})])
        ]),
        body
    ]);
    overlay.appendChild(box);
    return {overlay, body};
}

function fieldEditor(field = {}) {
    const row = createElement('div', {className: 'shared-credential-field'});
    const label = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 120,
        placeholder: 'Nome del campo', value: field.label || '', 'aria-label': 'Nome del campo'
    });
    const value = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 10000,
        placeholder: 'Valore', value: field.value || '', 'aria-label': 'Valore del campo'
    });
    const sensitive = createElement('label', {className: 'shared-credentials-sensitive'}, [
        createElement('input', {type: 'checkbox', checked: field.encrypted !== false}),
        createElement('span', {textContent: 'Dato sensibile cifrato'})
    ]);
    const remove = createElement('button', {
        type: 'button', className: 'shared-credentials-remove', 'aria-label': 'Rimuovi campo',
        onclick: () => row.remove()
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})]);
    setChildren(row, [label, value, sensitive, remove]);
    row.getValue = () => ({
        id: field.id || crypto.randomUUID(),
        label: label.value,
        value: value.value,
        type: sensitive.firstElementChild.checked ? 'sensitive' : 'text',
        encrypted: sensitive.firstElementChild.checked
    });
    return row;
}

async function editableFields(record) {
    if (!record) return [{}];
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return Promise.all((record.fields || []).map(async field => ({
        ...field,
        value: field.encrypted && field.valueEnc
            ? await decrypt(field.valueEnc, vaultKeyMaterial)
            : field.value ?? ''
    })));
}

async function openEditor(record, refresh) {
    const fields = await editableFields(record);
    let overlay;
    const close = () => overlay.remove();
    const shell = modalShell(record ? 'Modifica Credenziale comune' : 'Nuova Credenziale comune', close);
    overlay = shell.overlay;
    const form = createElement('form', {className: 'shared-credentials-form'});
    const title = createElement('input', {
        className: 'shared-credentials-input', type: 'text', maxlength: 120, required: true,
        placeholder: 'Titolo, per esempio Codice app Legal Mail', value: record?.title || ''
    });
    const description = createElement('textarea', {
        className: 'shared-credentials-input shared-credentials-textarea', maxlength: 500,
        placeholder: 'Descrizione facoltativa', value: record?.description || ''
    });
    const fieldList = createElement('div', {className: 'shared-credentials-fields'});
    fields.forEach(field => fieldList.appendChild(fieldEditor(field)));
    const addField = createElement('button', {
        type: 'button', className: 'btn-modal shared-credentials-add',
        onclick: () => fieldList.appendChild(fieldEditor())
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'add'}), 'Aggiungi campo']);
    const save = createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: 'Salva'});
    const actions = [createElement('button', {type: 'button', className: 'btn-modal', textContent: 'Annulla', onclick: close})];
    if (record) actions.unshift(createElement('button', {
        type: 'button', className: 'btn-modal shared-credentials-delete', textContent: 'Elimina',
        onclick: async () => {
            const confirmed = await showConfirmModal(
                'Elimina Credenziale comune',
                'La cancellazione sarà consentita solo se non è collegata ad alcun Account.',
                'Elimina', 'Annulla'
            );
            if (!confirmed) return;
            try {
                await deleteSharedCredential(record.id, Number(record.revision || 0));
                close();
                await refresh(true);
                showToast('Credenziale comune eliminata.', 'success');
            } catch (error) {
                showToast(error.message || 'Eliminazione non riuscita.', 'error');
            }
        }
    }));
    actions.push(save);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const rows = [...fieldList.children];
        if (!rows.length) {
            showToast('Aggiungi almeno un campo.', 'warning');
            return;
        }
        save.disabled = true;
        try {
            const data = {title: title.value, description: description.value, fields: rows.map(row => row.getValue())};
            if (record) await updateSharedCredential(record.id, Number(record.revision || 0), data);
            else await createSharedCredential(data);
            close();
            await refresh(true);
            showToast(record ? 'Credenziale comune aggiornata.' : 'Credenziale comune creata.', 'success');
        } catch (error) {
            showToast(error.message || 'Salvataggio non riuscito.', 'error');
        } finally {
            save.disabled = false;
        }
    });
    setChildren(form, [
        createElement('p', {className: 'modal-text', textContent: 'Questi dati restano separati dagli Account. Il collegamento sarà aggiunto nel passaggio successivo.'}),
        title, description, fieldList, addField,
        createElement('div', {className: 'modal-actions'}, actions)
    ]);
    shell.body.appendChild(form);
    document.body.appendChild(overlay);
    title.focus();
}

export async function openSharedCredentialsSettings(user) {
    if (!user?.uid) throw new Error('Accesso richiesto.');
    let overlay;
    const close = () => overlay.remove();
    const shell = modalShell('Credenziali comuni', close);
    overlay = shell.overlay;
    const render = async (serverConfirmed = false) => {
        clearElement(shell.body);
        const loading = createElement('p', {className: 'modal-text', textContent: 'Caricamento…'});
        shell.body.appendChild(loading);
        const readData = serverConfirmed ? listSharedVaultDataConfirmed : listSharedVaultData;
        const readLinks = serverConfirmed ? listSharedVaultLinksConfirmed : listSharedVaultLinks;
        const [records, links] = await Promise.all([readData(user.uid), readLinks(user.uid)]);
        clearElement(shell.body);
        shell.body.appendChild(createElement('p', {
            className: 'modal-text',
            textContent: navigator.onLine
                ? 'Ogni valore esiste una sola volta e potrà essere richiamato da più Account.'
                : 'Modalità offline: puoi consultare i dati già sincronizzati, ma non modificarli.'
        }));
        const list = createElement('div', {className: 'shared-credentials-list'});
        if (!records.length) list.appendChild(createElement('p', {className: 'shared-credentials-empty', textContent: 'Nessuna Credenziale comune presente.'}));
        for (const record of records) {
            const linkCount = links.filter(link => link.sharedDataId === record.id).length;
            list.appendChild(createElement('button', {
                type: 'button', className: 'shared-credentials-card', disabled: !navigator.onLine,
                onclick: () => openEditor(record, render)
            }, [
                createElement('span', {className: 'material-symbols-outlined', textContent: record.icon || 'key'}),
                createElement('span', {className: 'shared-credentials-card-copy'}, [
                    createElement('strong', {textContent: record.title || 'Credenziale comune'}),
                    createElement('small', {textContent: `${record.fields?.length || 0} campi · ${linkCount} Account collegati`})
                ]),
                createElement('span', {className: 'material-symbols-outlined', textContent: 'chevron_right'})
            ]));
        }
        shell.body.appendChild(list);
        shell.body.appendChild(createElement('div', {className: 'modal-actions'}, [
            createElement('button', {type: 'button', className: 'btn-modal', textContent: 'Chiudi', onclick: close}),
            createElement('button', {
                type: 'button', className: 'btn-modal btn-primary', disabled: !navigator.onLine,
                textContent: 'Nuova credenziale', onclick: () => openEditor(null, render)
            })
        ]));
    };
    document.body.appendChild(overlay);
    await render();
}
