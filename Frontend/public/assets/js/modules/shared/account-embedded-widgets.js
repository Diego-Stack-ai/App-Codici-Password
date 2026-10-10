import {createElement, setChildren, clearElement} from '../../dom-utils.js';
import {showToast} from '../../ui-core-v129.js';
import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createAccountWidget, deleteAccountWidget, updateAccountWidget
} from '../data/account-widget-client.js';
import {createWidgetProfile} from '../data/widget-profile-client.js';
import {
    listAccountWidgetProfiles, listAccountWidgetProfilesConfirmed,
    listAccountWidgets, listAccountWidgetsConfirmed
} from '../data/vault-repository.js';
import {createAccountWidgetLifecycle, clearWidgetValues} from './account-widget-lifecycle.js';
import {
    isProfileAlreadyInserted, profileFieldSummary, profilesForCategory, structuralTitleCase
} from './widget-profile-model.js';

const newId = prefix => `${prefix}-${crypto.randomUUID()}`;


async function editableFields(widget) {
    if (!widget) return [];
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return Promise.all((widget.fields || []).map(async field => ({
        ...field,
        value: Object.prototype.hasOwnProperty.call(field, 'value')
            ? field.value ?? ''
            : field.encrypted ? await decrypt(field.valueEnc, vaultKeyMaterial) : ''
    })));
}

function fieldRow(field = {}, structureLocked = false) {
    const row = createElement('div', {className: 'account-widget-editor-field'});
    const label = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Nome del campo', value: field.label || '', 'aria-label': 'Nome del campo', disabled: structureLocked
    });
    label.addEventListener('blur', () => { label.value = structuralTitleCase(label.value); });
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
        createElement('input', {type: 'checkbox', checked: field.encrypted === true, disabled: structureLocked}),
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
        onclick: () => row.remove(), hidden: structureLocked
    }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'delete'})]);
    setChildren(row, [label, createElement('div', {className: 'account-widget-inline-control'}, [value, visibility]), sensitive, remove]);
    row.getValue = () => ({
        id: field.id || newId('field'), label: structuralTitleCase(label.value), value: value.value,
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
        ...(widget?.profileId ? {profileId: widget.profileId, profileCategory: widget.profileCategory} : {}),
        fields
    };
}

async function openEditor(widget, context, refresh) {
    if (!context.active()) return false;
    let fields;
    try { fields = await editableFields(widget); } catch {
        if (context.active()) showToast('Impossibile aprire i campi del Widget.', 'warning');
        return false;
    }
    if (!context.active()) { fields.forEach(field => { field.value = ''; }); return false; }
    const overlay = createElement('div', {className: 'modal-overlay active'});
    let closed = false, unregister = () => {};
    const close = () => {
        closed = true;
        clearWidgetValues(overlay);
        fields.forEach(field => { field.value = ''; });
        overlay.remove();
        unregister();
    };
    unregister = context.registerCleanup(close);
    const title = createElement('input', {
        className: 'shared-account-select-control', type: 'text', maxlength: 120,
        placeholder: 'Titolo del widget', value: widget?.title || '', required: true, disabled: Boolean(widget?.profileId)
    });
    title.addEventListener('blur', () => { title.value = structuralTitleCase(title.value); });
    const bankHosts = [...document.querySelectorAll('[data-bank-widget-id]')];
    const selectedBankId = widget?.bankId || context.bankId || '';
    const placement = createElement('select', {
        className: 'shared-account-select-control', 'aria-label': 'Posizione del Widget', disabled: Boolean(widget?.profileId)
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
    fields.forEach(field => fieldList.appendChild(fieldRow(field, Boolean(widget?.profileId))));
    const addField = createElement('button', {
        type: 'button', className: 'btn-modal btn-secondary', textContent: 'Aggiungi campo',
        onclick: () => fieldList.appendChild(fieldRow()), hidden: Boolean(widget?.profileId)
    });
    const save = createElement('button', {type: 'submit', className: 'btn-modal btn-primary', textContent: 'Salva'});
    const form = createElement('form', {className: 'account-widget-editor', autocomplete: 'off', 'data-form-type': 'other'});
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (save.disabled || closed || !context.active()) return;
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
            const category = placement.value ? 'bank' : 'account';
            if (widget?.profileCategory && widget.profileCategory !== category) {
                showToast('Un Widget Account non può diventare bancario e viceversa. Crea un nuovo profilo Widget.', 'warning');
                return;
            }
            const draftFields = rows.map((row, order) => ({...row.getValue(), order}));
            let profileId = widget?.profileId;
            if (!widget) {
                const profile = await createWidgetProfile({
                    category,
                    title: structuralTitleCase(title.value),
                    description: widget?.description || '',
                    icon: widget?.icon || 'widgets',
                    color: widget?.color || '#3b82f6',
                    fields: draftFields
                });
                profileId = profile.profileId;
            }
            const data = widgetData({
                bankId: placement.value || null,
                profileId,
                profileCategory: widget?.profileCategory || category,
                title: structuralTitleCase(title.value),
                description: widget?.description || '',
                icon: widget?.icon || 'widgets',
                color: widget?.color || '#3b82f6',
                order: widget?.order || 0,
                collapsed: widget?.collapsed === true
            }, draftFields);
            if (widget) await updateAccountWidget(widget.id, Number(widget.revision || 0), data, context);
            else await createAccountWidget(data, context);
            close();
            if (!context.active()) return;
            await refresh(true);
            if (context.active()) showToast(widget ? 'Widget aggiornato.' : 'Widget creato.', 'success');
        } catch (error) {
            if (context.active()) showToast((String(error.message || '').includes('ACCOUNT_WIDGET_BANK') || error.message?.includes('Il conto bancario collegato al Widget non è disponibile'))
                ? 'Salva prima l’Account con questo conto bancario, poi aggiungi il Widget.'
                : error.message || 'Salvataggio del Widget non riuscito.', 'error');
        } finally {
            save.disabled = false;
        }
    });
    setChildren(form, [
        createElement('h2', {className: 'modal-title', textContent: widget ? 'Modifica widget' : 'Nuovo widget'}),
        createElement('p', {className: 'modal-text', textContent: widget
            ? 'Modifica i valori di questo Widget.'
            : 'Crea liberamente un nuovo profilo: aggiungi soltanto i campi che ti servono. Il profilo sarà riutilizzabile.'}),
        placement, title, fieldList, addField,
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
    return true;
}

async function reveal(button, field, context) {
    if (!context.active()) return;
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
        if (!context.active()) return;
        const decoded = await decrypt(field.valueEnc, key);
        if (!context.active()) return;
        value.textContent = decoded || '—';
        button.dataset.revealed = 'true';
        if (icon) icon.textContent = 'visibility_off';
        button.setAttribute('aria-label', `Nascondi ${field.label}`);
    } catch {
        if (context.active()) showToast('Sblocca la Vault per visualizzare il dato.', 'warning');
    }
}

async function copyField(field, context) {
    if (!context.active()) return;
    try {
        let value = field.value ?? '';
        if (field.encrypted) {
            const key = await ensureVaultKeyMaterial({promptImmediately: true});
            if (!context.active()) return;
            value = await decrypt(field.valueEnc, key) || '';
        }
        if (!context.active()) return;
        if (!value) return showToast('Il campo è vuoto.', 'warning');
        await navigator.clipboard.writeText(String(value));
        if (context.active()) showToast('Copiato!', 'success');
    } catch {
        if (context.active()) showToast('Sblocca la Vault per copiare il dato.', 'warning');
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
                        if (!context.active()) return;
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
            onclick: event => reveal(event.currentTarget, field, context)
        }, [createElement('span', {className: 'material-symbols-outlined', textContent: 'visibility'})]));
        children.push(createElement('button', {
            type: 'button', className: 'shared-account-reveal', 'aria-label': `Copia ${field.label}`,
            onclick: () => copyField(field, context)
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
            if (!context.active()) return;
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
                if (!context.active()) return;
                const confirmation = await context.requestDecision('Elimina widget',
                    `Per eliminare definitivamente “${widget.title}”, riscrivi esattamente il nome del widget.`,
                    'Elimina', 'Annulla', {placeholder: widget.title});
                if (!context.active() || confirmation === null) return;
                if (confirmation.trim() !== widget.title.trim()) {
                    showToast('Il nome inserito non corrisponde. Widget non eliminato.', 'warning');
                    return;
                }
                try {
                    await deleteAccountWidget(widget, context);
                    if (!context.active()) return;
                    await refresh(true);
                    if (context.active()) showToast('Widget eliminato.', 'success');
                }
                catch (error) { if (context.active()) showToast(error.message || 'Eliminazione non riuscita.', 'error'); }
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
    let unregister = () => {};
    card.destroy = () => {
        dirty = false;
        clearWidgetValues(card);
        if (context.editable) widget.fields.forEach(field => { field.value = ''; });
        unregister();
    };
    unregister = context.registerCleanup(card.destroy);
    card.hasPendingChanges = () => context.active() && dirty;
    card.savePendingChanges = async () => {
        if (!context.active()) throw new Error('WIDGET_VIEW_DISPOSED');
        if (!dirty || !context.editable) return false;
        await updateAccountWidget(
            widget.id,
            Number(widget.revision || 0),
            widgetData(widget, currentFields(), collapsed),
            context
        );
        if (!context.active()) throw new Error('WIDGET_VIEW_DISPOSED');
        dirty = false;
        return true;
    };
    return card;
}

export async function initAccountEmbeddedWidgets(context) {
    const section = document.getElementById('account-widgets-section');
    const list = document.getElementById('account-widgets-list');
    const add = document.getElementById('btn-add-account-widget');
    const templateSelect = document.getElementById('account-widget-template-select');
    const attachTemplate = document.getElementById('btn-attach-account-widget');
    const widgetActions = document.getElementById('account-widget-actions');
    const emptyController = {
        destroy() {},
        hasPendingChanges: () => false,
        savePendingChanges: async () => false,
        openNewWidget: async () => false,
        placeBankWidgets: () => {}
    };
    if (!section || !list || !context?.uid || !context.accountId) return emptyController;
    const lifecycle = createAccountWidgetLifecycle(context, {section, list, add});
    context = {...context, ...lifecycle};
    const editable = context.editable === true && context.readOnly !== true;
    widgetActions?.classList.toggle('hidden', !editable);
    if (context.readOnly) { section.classList.add('hidden'); return {...emptyController, destroy: lifecycle.destroy}; }
    let readVersion = 0;
    let availableTemplates = [];
    let insertedWidgets = [];
    let templateChoices = new Map();
    const cards = new Map();
    context.registerCleanup(() => {
        availableTemplates = [];
        insertedWidgets = [];
        templateChoices.clear();
        if (templateSelect) { templateSelect.value = ''; clearElement(templateSelect); }
        if (attachTemplate) { attachTemplate.onclick = null; attachTemplate.disabled = true; }
        widgetActions?.classList.add('hidden');
        for (const {card} of cards.values()) { card.destroy?.(); card.remove(); }
        cards.clear();
    });
    const placeBankWidgets = () => {
        if (!context.active()) return;
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
    const openProfileCatalog = (category, bankId = null) => {
        const overlay = createElement('div', {className: 'modal-overlay active'});
        let unregister = () => {};
        const close = () => { overlay.remove(); unregister(); };
        unregister = context.registerCleanup(close);
        const bankCatalog = category === 'bank';
        const profiles = profilesForCategory(availableTemplates, category);
        const cards = profiles.map(profile => {
            const duplicate = isProfileAlreadyInserted(insertedWidgets, profile.id, bankId);
            const fieldNames = profileFieldSummary(profile);
            return createElement('article', {className: 'account-widget-block'}, [
                createElement('strong', {textContent: profile.title}),
                profile.description ? createElement('p', {className: 'modal-text', textContent: profile.description}) : null,
                createElement('p', {className: 'modal-text', textContent: `Campi presenti: ${fieldNames}`}),
                createElement('button', {
                    type: 'button', className: 'btn-modal btn-secondary',
                    textContent: duplicate ? 'Widget già inserito' : bankCatalog ? 'Aggiungi al conto' : 'Aggiungi all’Account',
                    onclick: async () => {
                        if (duplicate) return showToast('Widget già inserito. Crea un nuovo profilo widget.', 'warning');
                        const fields = profile.fields.map((field, order) => ({
                            id: newId('field'), label: field.label, type: field.type,
                            encrypted: field.encrypted === true, value: '', order
                        }));
                        try {
                            await createAccountWidget(widgetData({...profile, profileId: profile.id,
                                profileCategory: category, bankId, order: insertedWidgets.length}, fields, false), context);
                            close();
                            await refresh(true);
                            if (context.active()) showToast(bankCatalog
                                ? 'Widget aggiunto al conto bancario.' : 'Widget aggiunto all’Account.', 'success');
                        } catch (error) {
                            if (context.active()) showToast(error.message || 'Aggiunta del Widget non riuscita.', 'error');
                        }
                    }
                })
            ]);
        });
        const body = createElement('div', {className: 'account-widget-editor-fields'}, cards.length ? cards : [
            createElement('p', {className: 'modal-text', textContent: bankCatalog
                ? 'Non hai ancora creato profili Widget bancari.' : 'Non hai ancora creato profili Widget Account.'})
        ]);
        const createNew = createElement('button', {
            type: 'button', className: 'btn-modal btn-primary',
            textContent: bankCatalog ? 'Crea nuovo profilo Widget bancario' : 'Crea nuovo profilo Widget Account',
            onclick: async () => { close(); await openEditor(null, {...context, bankId}, refresh); }
        });
        overlay.appendChild(createElement('section', {className: 'modal-box account-widget-editor-modal', role: 'dialog', 'aria-modal': 'true'}, [
            createElement('h2', {className: 'modal-title', textContent: bankCatalog
                ? 'Profili Widget bancari' : 'Profili Widget Account'}),
            createElement('p', {className: 'modal-text', textContent: bankCatalog
                ? 'Scegli un profilo riutilizzabile. I valori saranno salvati soltanto in questo conto.'
                : 'Scegli un profilo riutilizzabile. I valori saranno salvati soltanto in questo Account.'}),
            body,
            createElement('div', {className: 'modal-actions account-widget-editor-actions'}, [
                createElement('button', {type: 'button', className: 'btn-modal btn-secondary', textContent: 'Chiudi', onclick: close}),
                createNew
            ])
        ]));
        document.body.appendChild(overlay);
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
            if (typeof bankId === 'string') {
                openProfileCatalog('bank', bankId);
                return true;
            }
            openProfileCatalog('account');
            return true;
        } catch {
            if (context.active()) showToast('Impossibile caricare i Widget disponibili. Riprova.', 'error');
            return false;
        }
    };
    const updateTemplateMenu = () => {
        if (!templateSelect || !attachTemplate) return;
        templateChoices = new Map();
        const choices = [];
        availableTemplates.forEach((template, templateIndex) => {
            if (template.category !== 'account') return;
            const value = `${templateIndex}:account`;
            templateChoices.set(value, {template, bankId: null});
            const fields = template.fields.map(field => field.label).join(', ');
            choices.push(createElement('option', {value, textContent: `Account: ${template.title} — Campi: ${fields}`}));
        });
        setChildren(templateSelect, [
            createElement('option', {
                value: '',
                textContent: choices.length ? 'Scegli un widget già creato…' : 'Nessun widget già creato'
            }),
            ...choices
        ]);
        templateSelect.disabled = choices.length === 0;
        templateSelect.value = '';
        attachTemplate.disabled = true;
    };
    const addSelectedTemplate = async () => {
        if (!editable || !context.active() || !templateSelect || !attachTemplate) return false;
        const choice = templateChoices.get(templateSelect.value);
        if (!choice) return false;
        if (!navigator.onLine) {
            showToast('L’aggiunta di un Widget richiede internet.', 'warning');
            return false;
        }
        attachTemplate.disabled = true;
        try {
            const alreadyInserted = isProfileAlreadyInserted(insertedWidgets, choice.template.id, choice.bankId);
            if (alreadyInserted) throw new Error('Widget già inserito. Crea un nuovo profilo widget.');
            const fields = (choice.template.fields || []).map((field, order) => ({
                id: newId('field'), label: field.label, type: field.type,
                encrypted: field.encrypted === true, value: '', order
            }));
            await createAccountWidget(widgetData({
                ...choice.template,
                profileId: choice.template.id,
                profileCategory: choice.template.category,
                bankId: choice.bankId,
                order: cards.size,
                collapsed: false
            }, fields, false), context);
            if (!context.active()) return false;
            await refresh(true);
            if (context.active()) showToast(choice.bankId ? 'Widget aggiunto al conto bancario.' : 'Widget aggiunto all’Account.', 'success');
            return true;
        } catch (error) {
            if (context.active()) showToast(error.message || 'Aggiunta del Widget non riuscita.', 'error');
            return false;
        } finally {
            if (context.active()) attachTemplate.disabled = !templateSelect.value;
        }
    };
    const refresh = async confirmed => {
        if (!context.active()) return;
        const reading = ++readVersion;
        const readWidgets = confirmed ? listAccountWidgetsConfirmed : listAccountWidgets;
        const readProfiles = confirmed ? listAccountWidgetProfilesConfirmed : listAccountWidgetProfiles;
        const [allWidgets, profiles] = await Promise.all([readWidgets(context.uid), readProfiles(context.uid)]);
        if (!context.active() || reading !== readVersion) return;
        const widgets = allWidgets.filter(widget => widget.kind === 'embedded' &&
            widget.context === context.context && widget.accountId === context.accountId &&
            (context.context !== 'company' || widget.companyId === context.companyId))
            .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
        const editableWidgets = context.editable
            ? await Promise.all(widgets.map(editableFields))
            : widgets.map(widget => widget.fields || []);
        if (!context.active() || reading !== readVersion) {
            if (context.editable) editableWidgets.flat().forEach(field => { field.value = ''; });
            return;
        }
        insertedWidgets = widgets;
        availableTemplates = [
            ...profilesForCategory(profiles, 'account'),
            ...profilesForCategory(profiles, 'bank')
        ];
        updateTemplateMenu();
        for (const {card} of cards.values()) { card.destroy?.(); card.remove(); }
        cards.clear();
        clearWidgetValues(list);
        clearElement(list);
        widgets.forEach((widget, index) => cards.set(widget.id, {widget, card: widgetCard({
            ...widget,
            fields: editableWidgets[index]
        }, context, refresh)}));
        placeBankWidgets();
        if (add) {
            add.classList.toggle('hidden', !editable);
            add.onclick = openNewWidget;
        }
        if (templateSelect && attachTemplate) {
            templateSelect.onchange = () => { attachTemplate.disabled = !templateChoices.has(templateSelect.value); };
            attachTemplate.onclick = addSelectedTemplate;
        }
    };
    try { await refresh(false); } catch (error) { lifecycle.destroy(); throw error; }
    return {
        destroy: lifecycle.destroy,
        openNewWidget,
        placeBankWidgets,
        hasPendingChanges: () => context.active() && [...cards.values()].some(({card}) => card.hasPendingChanges?.()),
        savePendingChanges: async () => {
            if (!context.active()) throw new Error('WIDGET_VIEW_DISPOSED');
            const pending = [...cards.values()].map(({card}) => card).filter(card => card.hasPendingChanges?.());
            if (!pending.length) return false;
            await Promise.all(pending.map(card => card.savePendingChanges()));
            await refresh(true);
            if (!context.active()) throw new Error('WIDGET_VIEW_DISPOSED');
            return true;
        }
    };
}
