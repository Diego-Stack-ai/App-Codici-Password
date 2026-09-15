import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showInputModal, showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createAccountWidget, deleteAccountWidget, updateAccountWidget
} from '../data/account-widget-client.js';
import {
    listAccountWidgets, listAccountWidgetsConfirmed, listSharedVaultDataConfirmed
} from '../data/vault-repository.js';
import {linkSharedCredential} from '../data/shared-vault-data-client.js';
import {auth} from '../../firebase-config.js?v=1.2.125';

const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
let mountVersion = 0;

function availableCommonCredentials(records, widgets, context) {
    const linked = new Set(widgets.filter(widget => widget.kind === 'shared-reference' &&
        widget.context === context.context && widget.accountId === context.accountId &&
        (context.context !== 'company' || widget.companyId === context.companyId))
        .map(widget => widget.sharedDataId));
    return records.filter(record => !linked.has(record.id));
}

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
    value.spellcheck = false;
    value.setAttribute('autocapitalize', 'off');
    value.classList.toggle('local-data-masked', field.encrypted === true);
    const visibilityIcon = createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'});
    const visibility = createElement('button', {
        type: 'button', className: `shared-account-reveal${field.encrypted === true ? '' : ' hidden'}`,
        'aria-label': 'Mostra valore', hidden: field.encrypted !== true,
        onclick: () => {
            const masked = value.classList.toggle('local-data-masked');
            visibility.setAttribute('aria-label', masked ? 'Mostra valore' : 'Nascondi valore');
            visibilityIcon.textContent = masked ? 'visibility' : 'visibility_off';
        }
    }, [visibilityIcon]);
    const sensitive = createElement('label', {className: 'account-widget-sensitive'}, [
        createElement('input', {type: 'checkbox', checked: field.encrypted === true}),
        createElement('span', {textContent: 'Dato sensibile cifrato'})
    ]);
    sensitive.firstElementChild.addEventListener('change', event => {
        value.classList.toggle('local-data-masked', event.target.checked);
        visibility.hidden = !event.target.checked;
        visibility.classList.toggle('hidden', !event.target.checked);
        visibility.setAttribute('aria-label', 'Mostra valore');
        visibilityIcon.textContent = 'visibility';
    });
    const remove = createElement('button', {
        type: 'button', className: 'account-widget-remove', 'aria-label': 'Rimuovi campo',
        onclick: () => row.remove()
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})]);
    setChildren(row, [label, createElement('div', {className: 'account-widget-inline-control'}, [value, visibility]), sensitive, remove]);
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
        ...(Object.prototype.hasOwnProperty.call(widget, 'bankId') ? {bankId: widget.bankId} : {}),
        title: widget.title,
        description: widget.description || '',
        icon: widget.icon || 'widgets',
        color: widget.color || '#3b82f6',
        order: Number(widget.order || 0),
        collapsed,
        fields
    };
}

async function openEditor(widget, context, refresh, templates = [], commonRecords = []) {
    const fields = await editableFields(widget);
    const overlay = createElement('div', {className: 'modal-overlay active'});
    let closed = false;
    const close = () => { closed = true; overlay.remove(); };
    const title = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Titolo del widget', value: widget?.title || '', required: true
    });
    const bankHosts = [...document.querySelectorAll('[data-bank-widget-id]')];
    const selectedBankId = widget?.bankId || context.bankId || '';
    const placement = createElement('select', {
        className: 'shared-account-select-control', 'aria-label': 'Posizione del Widget'
    }, [
        createElement('option', {value: '', textContent: 'Account: Widget generico'}),
        ...bankHosts.map((host, index) => createElement('option', {
            value: host.dataset.bankWidgetId, textContent: `Conto bancario #${index + 1}`
        }))
    ]);
    if (selectedBankId && !bankHosts.some(host => host.dataset.bankWidgetId === selectedBankId)) {
        placement.appendChild(createElement('option', {value: selectedBankId, textContent: 'Conto bancario non disponibile'}));
    }
    placement.value = selectedBankId;
    const fieldList = createElement('div', {className: 'account-widget-editor-fields'});
    fields.forEach(field => fieldList.appendChild(fieldRow(field)));
    const templateSelect = !widget && (templates.length || commonRecords.length) ? createElement('select', {
        className: 'shared-account-select-control', 'aria-label': 'Modello widget o credenziale comune'
    }, [
        createElement('option', {value: '', textContent: 'Crea widget personalizzato'}),
        ...templates.map((template, index) => createElement('option', {
            value: String(index), textContent: `Modello: ${template.title} · ${template.fields.length} campi`
        })),
        ...commonRecords.map((record, index) => createElement('option', {
            value: `common:${index}`, textContent: `Collega credenziale comune: ${record.title || 'Senza titolo'}`
        }))
    ]) : null;
    templateSelect?.addEventListener('change', () => {
        const common = templateSelect.value.startsWith('common:');
        placement.hidden = common;
        title.hidden = fieldList.hidden = addField.hidden = common;
        title.required = !common;
        save.textContent = common ? 'Collega credenziale comune' : 'Salva';
        if (templateSelect.value === '') return;
        if (common) return;
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
    const form = createElement('form', {className: 'account-widget-editor', autocomplete: 'off', 'data-form-type': 'other'});
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (save.disabled || closed) return;
        if (templateSelect?.value.startsWith('common:')) {
            const record = commonRecords[Number(templateSelect.value.slice(7))];
            if (!record || !context.editable || context.readOnly || !context.active?.()) return;
            save.disabled = true;
            try {
                await linkSharedCredential(record.id, Number(record.revision || 0), {
                    context: context.context, accountId: context.accountId,
                    ...(context.context === 'company' ? {companyId: context.companyId} : {}),
                    order: 0, collapsed: false
                });
                close();
                if (!context.active()) return;
                await context.onSharedLinked?.();
                if (context.active()) showToast('Credenziale comune collegata. I valori restano condivisi.', 'success');
            } catch {
                if (context.active()) showToast('Collegamento non completato. Aggiorna e riprova.', 'error');
            } finally { save.disabled = false; }
            return;
        }
        if (placement.value && context.isBankSaved && !context.isBankSaved(placement.value)) {
            showToast('Salva prima l’Account per registrare il conto bancario, poi riapri Modifica e aggiungi il Widget. I campi inseriti qui restano disponibili.', 'warning');
            return;
        }
        const rows = [...fieldList.children];
        if (!title.value.trim() || !rows.length || rows.some(row => !row.getValue().label.trim())) {
            showToast('Inserisci titolo e nome di ogni campo.', 'warning');
            return;
        }
        save.disabled = true;
        try {
            const data = widgetData({
                bankId: placement.value || null,
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
            showToast((String(error.message || '').includes('ACCOUNT_WIDGET_BANK') || error.message?.includes('Il conto bancario collegato al Widget non è disponibile'))
                ? 'Salva prima l’Account con questo conto bancario, poi aggiungi il Widget.'
                : error.message || 'Salvataggio del Widget non riuscito.', 'error');
        } finally {
            save.disabled = false;
        }
    });
    setChildren(form, [
        createElement('h2', {className: 'modal-title', textContent: widget ? 'Modifica widget' : 'Nuovo widget'}),
        createElement('p', {className: 'modal-text', textContent: 'Crea campi per questo Account oppure collega una Credenziale comune: i suoi valori restano condivisi con gli altri Account.'}),
        templateSelect, placement, title, fieldList, addField,
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
    const fields = createElement('div', {className: 'shared-account-fields account-widget-fields'});
    const fieldReaders = [];
    const markDirty = () => { dirty = true; };
    const sourceFields = [...(widget.fields || [])].sort((a, b) => a.order - b.order);
    for (const field of sourceFields) {
        if (context.editable) {
            const input = createElement('input', {
                className: 'account-widget-inline-input',
                type: 'text',
                spellcheck: false,
                autocapitalize: 'off',
                maxlength: 10000,
                value: field.value ?? '',
                'aria-label': field.label
            });
            input.classList.toggle('local-data-masked', field.encrypted === true);
            input.addEventListener('input', markDirty);
            const controls = [input];
            if (field.encrypted) {
                controls.push(createElement('button', {
                    type: 'button', className: 'shared-account-reveal',
                    'aria-label': `Mostra ${field.label}`,
                    onclick: event => {
                        const revealed = !input.classList.contains('local-data-masked');
                        input.classList.toggle('local-data-masked', revealed);
                        event.currentTarget.setAttribute('aria-label', `${revealed ? 'Mostra' : 'Nascondi'} ${field.label}`);
                        const icon = event.currentTarget.querySelector('.material-symbols-outlined');
                        if (icon) icon.textContent = revealed ? 'visibility' : 'visibility_off';
                    }
                }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
            }
            fields.appendChild(createElement('div', {
                className: 'account-widget-inline-field'
            }, [
                createElement('strong', {textContent: field.label}),
                createElement('div', {className: 'account-widget-inline-control'}, controls)
            ]));
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
    const applyCollapsedState = () => {
        fields.hidden = collapsed;
        fields.classList.toggle('hidden', collapsed);
    };
    applyCollapsedState();
    const toggle = createElement('button', {
        type: 'button', className: 'account-widget-toggle',
        'aria-label': `${collapsed ? 'Apri' : 'Chiudi'} ${widget.title}`,
        'aria-expanded': String(!collapsed),
        onclick: event => {
            collapsed = !collapsed;
            applyCollapsedState();
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
    const version = ++mountVersion;
    context = {...context, active: () => version === mountVersion && auth.currentUser?.uid === context.uid};
    const section = document.getElementById('account-widgets-section');
    const list = document.getElementById('account-widgets-list');
    const add = document.getElementById('btn-add-account-widget');
    const emptyController = {
        hasPendingChanges: () => false,
        savePendingChanges: async () => false,
        placeBankWidgets: () => {},
        openNewWidget: async () => false
    };
    if (!section || !list || !context?.uid || !context.accountId) return emptyController;
    if (context.readOnly) { section.classList.add('hidden'); return emptyController; }
    let availableTemplates = [];
    const cards = new Map();
    const placeBankWidgets = () => {
        const hosts = new Map([...document.querySelectorAll('[data-bank-widget-id]')].map(host => [host.dataset.bankWidgetId, host]));
        for (const {widget, card} of cards.values()) {
            const host = widget.bankId ? hosts.get(widget.bankId) : null;
            (host || list).appendChild(card);
            if (host) {
                document.getElementById('section-banking')?.classList.remove('hidden');
                document.getElementById('banking-section')?.classList.remove('hidden');
            }
        }
        section.classList.toggle('hidden', !context.editable && list.children.length === 0);
    };
    const openNewWidget = async (bankId = null) => {
        if (!context.editable || !context.active()) return false;
        if (typeof bankId === 'string' && context.isBankSaved && !context.isBankSaved(bankId)) {
            showToast('Salva prima l’Account per registrare questo conto bancario, poi riapri Modifica e aggiungi il Widget.', 'warning');
            return false;
        }
        if (!navigator.onLine) {
            showToast('La creazione dei Widget richiede internet.', 'warning');
            return false;
        }
        try {
            const [records, currentWidgets] = await Promise.all([
                listSharedVaultDataConfirmed(context.uid), listAccountWidgetsConfirmed(context.uid)
            ]);
            if (!context.active()) return false;
            await openEditor(null, {...context, bankId: typeof bankId === 'string' ? bankId : null}, refresh, availableTemplates,
                typeof bankId === 'string' ? [] : availableCommonCredentials(records, currentWidgets, context));
            return true;
        } catch {
            if (context.active()) showToast('Impossibile caricare i Widget disponibili. Riprova.', 'error');
            return false;
        }
    };
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
        availableTemplates = templates;
        for (const {card} of cards.values()) card.remove();
        cards.clear();
        clearElement(list);
        const editableWidgets = context.editable
            ? await Promise.all(widgets.map(editableFields))
            : widgets.map(widget => widget.fields || []);
        widgets.forEach((widget, index) => cards.set(widget.id, {widget, card: widgetCard({
            ...widget,
            fields: editableWidgets[index]
        }, context, refresh)}));
        placeBankWidgets();
        if (add) {
            add.classList.toggle('hidden', !context.editable);
            add.onclick = openNewWidget;
        }
    };
    await refresh(false);
    return {
        openNewWidget,
        placeBankWidgets,
        hasPendingChanges: () => [...cards.values()].some(({card}) => card.hasPendingChanges?.()),
        savePendingChanges: async () => {
            const pending = [...cards.values()].map(({card}) => card).filter(card => card.hasPendingChanges?.());
            if (!pending.length) return false;
            await Promise.all(pending.map(card => card.savePendingChanges()));
            await refresh(true);
            return true;
        }
    };
}
