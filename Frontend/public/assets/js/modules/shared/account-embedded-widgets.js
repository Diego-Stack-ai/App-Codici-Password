import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showConfirmModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createAccountWidget, deleteAccountWidget, updateAccountWidget
} from '../data/account-widget-client.js';
import {
    listEmbeddedAccountWidgets, listEmbeddedAccountWidgetsConfirmed
} from '../data/vault-repository.js';

const newId = prefix => `${prefix}-${crypto.randomUUID()}`;

async function editableFields(widget) {
    if (!widget) return [{id: newId('field'), label: '', value: '', encrypted: false}];
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return Promise.all((widget.fields || []).map(async field => ({
        ...field,
        value: field.encrypted ? await decrypt(field.valueEnc, vaultKeyMaterial) : field.value ?? ''
    })));
}

function fieldRow(field = {}) {
    const row = createElement('div', {className: 'account-widget-editor-field'});
    const label = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Nome del campo', value: field.label || '', 'aria-label': 'Nome del campo'
    });
    const value = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 10000,
        placeholder: 'Valore', value: field.value ?? '', 'aria-label': 'Valore del campo'
    });
    const sensitive = createElement('label', {className: 'account-widget-sensitive'}, [
        createElement('input', {type: 'checkbox', checked: field.encrypted === true}),
        createElement('span', {textContent: 'Dato sensibile cifrato'})
    ]);
    const remove = createElement('button', {
        type: 'button', className: 'account-widget-remove', 'aria-label': 'Rimuovi campo',
        onclick: () => row.remove()
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})]);
    setChildren(row, [label, value, sensitive, remove]);
    row.getValue = () => ({
        id: field.id || newId('field'), label: label.value, value: value.value,
        type: sensitive.firstElementChild.checked ? 'sensitive' : 'text',
        encrypted: sensitive.firstElementChild.checked, order: 0
    });
    return row;
}

async function openEditor(widget, context, refresh) {
    const fields = await editableFields(widget);
    const overlay = createElement('div', {className: 'modal-overlay active'});
    const close = () => overlay.remove();
    const title = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Titolo del widget', value: widget?.title || '', required: true
    });
    const fieldList = createElement('div', {className: 'account-widget-editor-fields'});
    fields.forEach(field => fieldList.appendChild(fieldRow(field)));
    const addField = createElement('button', {
        type: 'button', className: 'btn-modal btn-secondary', textContent: 'Aggiungi campo',
        onclick: () => fieldList.appendChild(fieldRow())
    });
    const save = createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: 'Salva'});
    const form = createElement('form', {className: 'account-widget-editor'});
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const rows = [...fieldList.children];
        if (!title.value.trim() || !rows.length || rows.some(row => !row.getValue().label.trim())) {
            showToast('Inserisci titolo e nome di ogni campo.', 'warning');
            return;
        }
        save.disabled = true;
        try {
            const data = {
                title: title.value, description: widget?.description || '', icon: widget?.icon || 'widgets',
                color: widget?.color || '#3b82f6', order: widget?.order || 0,
                collapsed: widget?.collapsed === true,
                fields: rows.map((row, order) => ({...row.getValue(), order}))
            };
            if (widget) await updateAccountWidget(widget.id, Number(widget.revision || 0), data, context);
            else await createAccountWidget(data, context);
            close();
            await refresh(true);
            showToast(widget ? 'Widget aggiornato.' : 'Widget creato.', 'success');
        } catch (error) {
            showToast(error.message || 'Salvataggio del Widget non riuscito.', 'error');
        } finally {
            save.disabled = false;
        }
    });
    setChildren(form, [
        createElement('h2', {className: 'modal-title', textContent: widget ? 'Modifica widget' : 'Nuovo widget'}),
        createElement('p', {className: 'modal-text', textContent: 'Aggiungi uno o più campi specifici per questo Account.'}),
        title, fieldList, addField,
        createElement('div', {className: 'modal-actions account-widget-editor-actions'}, [
            createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: 'Annulla', onclick: close}),
            save
        ])
    ]);
    overlay.appendChild(createElement('section', {
        className: 'modal-box account-widget-editor-modal', role: 'dialog', 'aria-modal': 'true'
    }, [form]));
    document.body.appendChild(overlay);
    title.focus();
}

async function reveal(button, field) {
    try {
        const key = await ensureVaultKeyMaterial({promptImmediately: true});
        button.previousElementSibling.textContent = await decrypt(field.valueEnc, key) || '—';
        button.remove();
    } catch {
        showToast('Sblocca la Vault per visualizzare il dato.', 'warning');
    }
}

function widgetCard(widget, context, refresh) {
    const fields = createElement('div', {className: 'shared-account-fields'});
    for (const field of [...(widget.fields || [])].sort((a, b) => a.order - b.order)) {
        const value = createElement('span', {
            className: 'shared-account-value',
            textContent: field.encrypted ? '••••••••' : String(field.value ?? '—')
        });
        const children = [createElement('strong', {textContent: field.label}), value];
        if (field.encrypted) children.push(createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': `Mostra ${field.label}`,
            onclick: event => reveal(event.currentTarget, field)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
        fields.appendChild(createElement('div', {className: 'shared-account-field'}, children));
    }
    return createElement('article', {className: 'shared-account-card'}, [
        createElement('div', {className: 'shared-account-card-heading'}, [
            createElement('span', {className: 'material-symbols-outlined', textContent: widget.icon || 'widgets'}),
            createElement('strong', {textContent: widget.title}),
            createElement('span', {className: 'account-widget-card-actions'}, [
                createElement('button', {
                    type: 'button', className: 'shared-account-reveal', 'aria-label': 'Modifica widget',
                    onclick: () => openEditor(widget, context, refresh)
                }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'edit'})]),
                createElement('button', {
                    type: 'button', className: 'shared-account-reveal account-widget-delete', 'aria-label': 'Elimina widget',
                    onclick: async () => {
                        if (!await showConfirmModal('Elimina widget', `Eliminare “${widget.title}”?`, 'Elimina', 'Annulla')) return;
                        try { await deleteAccountWidget(widget); await refresh(true); showToast('Widget eliminato.', 'success'); }
                        catch (error) { showToast(error.message || 'Eliminazione non riuscita.', 'error'); }
                    }
                }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})])
            ])
        ]),
        fields
    ]);
}

export async function initAccountEmbeddedWidgets(context) {
    const section = document.getElementById('account-widgets-section');
    const list = document.getElementById('account-widgets-list');
    const add = document.getElementById('btn-add-account-widget');
    if (!section || !list || !context?.uid || !context.accountId) return;
    if (context.readOnly) { section.classList.add('hidden'); return; }
    const refresh = async confirmed => {
        const read = confirmed ? listEmbeddedAccountWidgetsConfirmed : listEmbeddedAccountWidgets;
        const widgets = await read(context.uid, context);
        clearElement(list);
        widgets.forEach(widget => list.appendChild(widgetCard(widget, context, refresh)));
        section.classList.remove('hidden');
        add.onclick = () => navigator.onLine
            ? openEditor(null, context, refresh)
            : showToast('La creazione dei Widget richiede internet.', 'warning');
    };
    await refresh(false);
}
