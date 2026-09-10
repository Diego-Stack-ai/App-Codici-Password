import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showInputModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createAccountWidget, deleteAccountWidget, updateAccountWidget
} from '../data/account-widget-client.js';
import {
    listAccountWidgets, listAccountWidgetsConfirmed
} from '../data/vault-repository.js';

const newId = prefix => `${prefix}-${crypto.randomUUID()}`;

async function editableFields(widget) {
    if (!widget) return [{id: newId('field'), label: '', value: '', encrypted: false}];
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return Promise.all((widget.fields || []).map(async field => ({
        ...field,
        value: Object.prototype.hasOwnProperty.call(field, 'value')
            ? field.value ?? ''
            : field.encrypted ? await decrypt(field.valueEnc, vaultKeyMaterial) : ''
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
        type: sensitive.firstElementChild.checked
            ? 'sensitive'
            : (field.type && field.type !== 'sensitive' ? field.type : 'text'),
        encrypted: sensitive.firstElementChild.checked, order: 0
    });
    return row;
}

function widgetData(widget, fields, collapsed = widget?.collapsed === true) {
    return {
        title: widget.title,
        description: widget.description || '',
        icon: widget.icon || 'widgets',
        color: widget.color || '#3b82f6',
        order: Number(widget.order || 0),
        collapsed,
        fields
    };
}

async function openEditor(widget, context, refresh, templates = []) {
    const fields = await editableFields(widget);
    const overlay = createElement('div', {className: 'modal-overlay active'});
    const close = () => overlay.remove();
    const title = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Titolo del widget', value: widget?.title || '', required: true
    });
    const fieldList = createElement('div', {className: 'account-widget-editor-fields'});
    fields.forEach(field => fieldList.appendChild(fieldRow(field)));
    const templateSelect = !widget && templates.length ? createElement('select', {
        className: 'shared-account-select-control', 'aria-label': 'Modello di widget esistente'
    }, [
        createElement('option', {value: '', textContent: 'Crea widget personalizzato'}),
        ...templates.map((template, index) => createElement('option', {
            value: String(index), textContent: `${template.title} · ${template.fields.length} campi`
        }))
    ]) : null;
    templateSelect?.addEventListener('change', () => {
        if (templateSelect.value === '') return;
        const template = templates[Number(templateSelect.value)];
        if (!template) return;
        title.value = template.title;
        clearElement(fieldList);
        template.fields.forEach(field => fieldList.appendChild(fieldRow({
            id: newId('field'), label: field.label, type: field.type,
            encrypted: field.encrypted === true, value: ''
        })));
    });
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
            const data = widgetData({
                title: title.value,
                description: widget?.description || '',
                icon: widget?.icon || 'widgets',
                color: widget?.color || '#3b82f6',
                order: widget?.order || 0,
                collapsed: widget?.collapsed === true
            }, rows.map((row, order) => ({...row.getValue(), order})));
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
        templateSelect, title, fieldList, addField,
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
    const value = button.previousElementSibling;
    const icon = button.querySelector('.material-symbols-outlined');
    if (button.dataset.revealed === 'true') {
        value.textContent = '••••••••';
        button.dataset.revealed = 'false';
        if (icon) icon.textContent = 'visibility';
        button.setAttribute('aria-label', `Mostra ${field.label}`);
        return;
    }
    try {
        const key = await ensureVaultKeyMaterial({promptImmediately: true});
        value.textContent = await decrypt(field.valueEnc, key) || '—';
        button.dataset.revealed = 'true';
        if (icon) icon.textContent = 'visibility_off';
        button.setAttribute('aria-label', `Nascondi ${field.label}`);
    } catch {
        showToast('Sblocca la Vault per visualizzare il dato.', 'warning');
    }
}

async function copyField(field) {
    try {
        let value = field.value ?? '';
        if (field.encrypted) {
            const key = await ensureVaultKeyMaterial({promptImmediately: true});
            value = await decrypt(field.valueEnc, key) || '';
        }
        if (!value) return showToast('Il campo è vuoto.', 'warning');
        await navigator.clipboard.writeText(String(value));
        showToast('Copiato!', 'success');
    } catch {
        showToast('Sblocca la Vault per copiare il dato.', 'warning');
    }
}

function widgetCard(widget, context, refresh) {
    let collapsed = widget.collapsed === true;
    let dirty = false;
    const fields = createElement('div', {className: 'shared-account-fields'});
    const fieldReaders = [];
    const markDirty = () => { dirty = true; };
    const sourceFields = [...(widget.fields || [])].sort((a, b) => a.order - b.order);
    for (const field of sourceFields) {
        if (context.editable) {
            const input = createElement('input', {
                className: 'account-widget-inline-input',
                type: field.encrypted ? 'password' : 'text',
                maxlength: 10000,
                value: field.value ?? '',
                'aria-label': field.label
            });
            input.addEventListener('input', markDirty);
            const children = [createElement('strong', {textContent: field.label}), input];
            if (field.encrypted) {
                children.push(createElement('button', {
                    type: 'button', className: 'shared-account-reveal',
                    'aria-label': `Mostra ${field.label}`,
                    onclick: event => {
                        const revealed = input.type === 'text';
                        input.type = revealed ? 'password' : 'text';
                        event.currentTarget.setAttribute('aria-label', `${revealed ? 'Mostra' : 'Nascondi'} ${field.label}`);
                        const icon = event.currentTarget.querySelector('.material-symbols-outlined');
                        if (icon) icon.textContent = revealed ? 'visibility' : 'visibility_off';
                    }
                }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
            }
            fields.appendChild(createElement('div', {
                className: 'shared-account-field glass-field border-glow account-widget-display-field account-widget-inline-field'
            }, children));
            fieldReaders.push(() => ({...field, value: input.value}));
            continue;
        }
        const value = createElement('span', {
            className: 'shared-account-value',
            textContent: field.encrypted ? '••••••••' : String(field.value ?? '—')
        });
        const children = [createElement('strong', {textContent: field.label}), value];
        if (field.encrypted) children.push(createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': `Mostra ${field.label}`,
            onclick: event => reveal(event.currentTarget, field)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
        children.push(createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': `Copia ${field.label}`,
            onclick: () => copyField(field)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'content_copy'})]));
        fields.appendChild(createElement('div', {className: 'shared-account-field glass-field border-glow account-widget-display-field'}, children));
    }
    fields.hidden = collapsed;
    const toggle = createElement('button', {
        type: 'button', className: 'account-widget-toggle',
        'aria-label': `${collapsed ? 'Apri' : 'Chiudi'} ${widget.title}`,
        'aria-expanded': String(!collapsed),
        onclick: event => {
            collapsed = !collapsed;
            fields.hidden = collapsed;
            event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
            event.currentTarget.setAttribute('aria-label', `${collapsed ? 'Apri' : 'Chiudi'} ${widget.title}`);
            if (context.editable) markDirty();
        }
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'expand_more'})]);
    const currentFields = () => fieldReaders.map((read, order) => ({...read(), order}));
    const draftWidget = () => ({...widget, collapsed, fields: currentFields()});
    const actions = context.editable ? createElement('span', {className: 'account-widget-card-actions'}, [
        createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': 'Modifica struttura widget',
            onclick: () => openEditor(draftWidget(), context, refresh)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'edit'})]),
        createElement('button', {
            type: 'button', className: 'shared-account-reveal account-widget-delete', 'aria-label': 'Elimina widget',
            onclick: async () => {
                const confirmation = await showInputModal(
                    'Elimina widget', '', widget.title,
                    `Per eliminare definitivamente “${widget.title}”, riscrivi esattamente il nome del widget.`
                );
                if (confirmation === null) return;
                if (confirmation.trim() !== widget.title.trim()) {
                    showToast('Il nome inserito non corrisponde. Widget non eliminato.', 'warning');
                    return;
                }
                try { await deleteAccountWidget(widget); await refresh(true); showToast('Widget eliminato.', 'success'); }
                catch (error) { showToast(error.message || 'Eliminazione non riuscita.', 'error'); }
            }
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})])
    ]) : null;
    const card = createElement('article', {className: 'account-widget-block'}, [
        createElement('div', {className: 'shared-account-card-heading account-widget-heading'}, [
            toggle,
            createElement('span', {className: 'material-symbols-outlined account-widget-kind-icon', textContent: widget.icon || 'widgets'}),
            createElement('strong', {textContent: widget.title}),
            actions
        ]),
        fields
    ]);
    card.hasPendingChanges = () => dirty;
    card.savePendingChanges = async () => {
        if (!dirty || !context.editable) return false;
        await updateAccountWidget(
            widget.id,
            Number(widget.revision || 0),
            widgetData(widget, currentFields(), collapsed),
            context
        );
        dirty = false;
        return true;
    };
    return card;
}

export async function initAccountEmbeddedWidgets(context) {
    const section = document.getElementById('account-widgets-section');
    const list = document.getElementById('account-widgets-list');
    const add = document.getElementById('btn-add-account-widget');
    const emptyController = {
        hasPendingChanges: () => false,
        savePendingChanges: async () => false
    };
    if (!section || !list || !context?.uid || !context.accountId) return emptyController;
    if (context.readOnly) { section.classList.add('hidden'); return emptyController; }
    const refresh = async confirmed => {
        const read = confirmed ? listAccountWidgetsConfirmed : listAccountWidgets;
        const allWidgets = await read(context.uid);
        const widgets = allWidgets.filter(widget => widget.kind === 'embedded' &&
            widget.context === context.context && widget.accountId === context.accountId &&
            (context.context !== 'company' || widget.companyId === context.companyId))
            .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
        const seenTemplates = new Set();
        const templates = allWidgets.filter(widget => {
            if (widget.kind !== 'embedded' || !Array.isArray(widget.fields) || !widget.fields.length) return false;
            const signature = `${widget.title}|${widget.fields.map(field => `${field.label}:${field.type}`).join('|')}`;
            if (seenTemplates.has(signature)) return false;
            seenTemplates.add(signature);
            return true;
        });
        clearElement(list);
        const editableWidgets = context.editable
            ? await Promise.all(widgets.map(editableFields))
            : widgets.map(widget => widget.fields || []);
        widgets.forEach((widget, index) => list.appendChild(widgetCard({
            ...widget,
            fields: editableWidgets[index]
        }, context, refresh)));
        section.classList.toggle('hidden', !context.editable && widgets.length === 0);
        if (add) {
            add.classList.toggle('hidden', !context.editable);
            add.onclick = () => navigator.onLine
                ? openEditor(null, context, refresh, templates)
                : showToast('La creazione dei Widget richiede internet.', 'warning');
        }
    };
    await refresh(false);
    return {
        hasPendingChanges: () => [...list.children].some(card => card.hasPendingChanges?.()),
        savePendingChanges: async () => {
            const pending = [...list.children].filter(card => card.hasPendingChanges?.());
            if (!pending.length) return false;
            await Promise.all(pending.map(card => card.savePendingChanges()));
            await refresh(true);
            return true;
        }
    };
}
