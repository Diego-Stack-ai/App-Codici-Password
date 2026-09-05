import { getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
import { auth, db } from '../../firebase-config.js?v=1.2.42';
import { collection, deleteDoc, doc, setDoc } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { encrypt, decrypt, ensureMasterKey } from '../core/security-manager.js';
import { PROFILE_TABS, PROFILE_WIDGET_FIELD_LIMIT, PROFILE_WIDGET_TABS, validateProfileWidget } from './profile-model.js';
import { showProfileModal } from './profilo-modal.js';

let widgets = [];
let onChanged = null;

const newId = prefix => `${prefix}-${crypto.randomUUID()}`;
const widgetCollection = uid => collection(db, 'users', uid, 'profileWidgets');

export async function initProfileWidgets(callbacks = {}) {
    onChanged = callbacks.onChanged || null;
    await loadWidgets();
    renderWidgets();
}

export async function setWidgetFieldQr(widgetId, fieldId, includeInQr) {
    const widget = widgets.find(item => item.id === widgetId);
    const field = widget?.fields.find(item => item.id === fieldId);
    if (!widget || !field || field.encrypted || ['sensitive', 'password', 'pin', 'puk', 'attachment', 'pdf', 'photo'].includes(field.type)) return;
    field.includeInQr = includeInQr === true;
    await persistWidget(widget);
    renderWidgets();
}

async function loadWidgets() {
    const user = auth.currentUser;
    if (!user) return;
    const snapshot = await getDocs(widgetCollection(user.uid));
    const masterKey = await ensureMasterKey();
    widgets = await Promise.all(snapshot.docs.map(async item => {
        const data = { id: item.id, ...item.data() };
        data.fields = await Promise.all((data.fields || []).map(async field => ({
            ...field,
            value: field.encrypted && field.valueEnc && masterKey ? await decrypt(field.valueEnc, masterKey) : (field.value || '')
        })));
        return data;
    }));
    widgets.sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function persistWidget(widget) {
    const user = auth.currentUser;
    if (!user) return;
    const validation = validateProfileWidget(widget);
    if (!validation.valid) throw new Error(`Widget non valido: ${validation.errors.join(', ')}`);
    const masterKey = await ensureMasterKey();
    const fields = await Promise.all(widget.fields.map(async field => {
        const stored = { ...field };
        if (field.encrypted === true) {
            stored.valueEnc = await encrypt(field.value || '', masterKey);
            delete stored.value;
        } else {
            stored.value = field.value || '';
            delete stored.valueEnc;
        }
        return stored;
    }));
    const payload = { ...widget, fields, updatedAt: new Date().toISOString(), schemaVersion: 1 };
    delete payload.id;
    await setDoc(doc(db, 'users', user.uid, 'profileWidgets', widget.id), payload, { merge: true });
}

function widgetFields() {
    return [
        { key: 'title', label: 'Titolo', icon: 'title' },
        { key: 'description', label: 'Descrizione', icon: 'description', type: 'textarea' },
        { key: 'icon', label: 'Icona Material Symbols', icon: 'emoji_symbols' },
        { key: 'color', label: 'Colore', icon: 'palette' },
        { key: 'tab', label: 'Linguetta', icon: 'tab', type: 'select', options: PROFILE_WIDGET_TABS },
        { key: 'size', label: 'Dimensione', icon: 'aspect_ratio', type: 'select', options: ['small', 'medium', 'wide'] }
    ];
}

export function addWidget(defaultTab = 'personal') {
    const initial = { title: '', description: '', icon: 'widgets', color: '#3b82f6', tab: defaultTab, size: 'medium' };
    showProfileModal('Nuovo widget', widgetFields(), initial, async values => {
        const widget = { id: newId('widget'), ...initial, ...values, order: widgets.length, collapsed: false, fields: [] };
        await persistWidget(widget);
        widgets.push(widget);
        renderWidgets();
        showToast('Widget creato.', 'success');
    });
}

function editWidget(widget) {
    showProfileModal('Modifica widget', widgetFields(), widget, async values => {
        Object.assign(widget, values);
        await persistWidget(widget);
        renderWidgets();
    });
}

function addField(widget) {
    if (widget.fields.length >= PROFILE_WIDGET_FIELD_LIMIT) {
        showToast(`Il widget può contenere al massimo ${PROFILE_WIDGET_FIELD_LIMIT} campi.`, 'warning');
        return;
    }
    const types = ['text', 'textarea', 'number', 'date', 'phone', 'email', 'address', 'url', 'select', 'boolean', 'identifier', 'sensitive', 'expiry', 'account-link', 'address-link'];
    showProfileModal('Nuovo campo', fieldEditorFields(types), {
        label: '', type: 'text', value: '', previewChoice: 'Sì', copyChoice: 'Sì', qrChoice: 'No', qrLabel: '', qrOrder: '0'
    }, async values => {
        widget.fields.push(normalizeFieldEditorValues({ id: newId('field'), ...values, order: widget.fields.length }));
        await persistWidget(widget);
        renderWidgets();
    });
}

function fieldEditorFields(types) {
    return [
        { key: 'label', label: 'Etichetta', icon: 'label' },
        { key: 'type', label: 'Tipo', icon: 'data_object', type: 'select', options: types },
        { key: 'value', label: 'Valore', icon: 'edit', type: 'textarea' },
        { key: 'previewChoice', label: 'Mostra in anteprima', icon: 'preview', type: 'select', options: ['Sì', 'No'] },
        { key: 'copyChoice', label: 'Consenti copia', icon: 'content_copy', type: 'select', options: ['Sì', 'No'] },
        { key: 'qrChoice', label: 'Includi nel QR', icon: 'qr_code', type: 'select', options: ['No', 'Sì'] },
        { key: 'qrLabel', label: 'Etichetta QR', icon: 'label' },
        { key: 'qrOrder', label: 'Ordine QR', icon: 'sort' }
    ];
}

function normalizeFieldEditorValues(field) {
    const encrypted = field.type === 'sensitive';
    const qrForbidden = encrypted || ['password', 'pin', 'puk', 'secret', 'attachment', 'pdf', 'photo'].includes(field.type);
    const normalized = {
        ...field,
        sensitivity: encrypted ? 'secret' : 'normal',
        encrypted,
        preview: field.previewChoice !== 'No',
        copyable: !encrypted && field.copyChoice !== 'No',
        includeInQr: !qrForbidden && field.qrChoice === 'Sì',
        qrLabel: field.qrLabel || field.label,
        qrOrder: Number(field.qrOrder) || 0,
        linkedEntity: field.linkedEntity || null,
        expiryReference: field.expiryReference || null
    };
    delete normalized.previewChoice;
    delete normalized.copyChoice;
    delete normalized.qrChoice;
    return normalized;
}

function editField(widget, field) {
    const types = ['text', 'textarea', 'number', 'date', 'phone', 'email', 'address', 'url', 'select', 'boolean', 'identifier', 'sensitive', 'expiry', 'account-link', 'address-link'];
    showProfileModal('Modifica campo', fieldEditorFields(types), {
        ...field,
        previewChoice: field.preview === false ? 'No' : 'Sì',
        copyChoice: field.copyable === false ? 'No' : 'Sì',
        qrChoice: field.includeInQr === true ? 'Sì' : 'No'
    }, async values => {
        const index = widget.fields.findIndex(item => item.id === field.id);
        widget.fields[index] = normalizeFieldEditorValues({ ...field, ...values });
        await persistWidget(widget);
        renderWidgets();
    });
}

async function removeField(widget, field) {
    if (!await showConfirmModal('Elimina campo', `Eliminare “${field.label}”?`)) return;
    widget.fields = widget.fields.filter(item => item.id !== field.id).map((item, order) => ({ ...item, order }));
    await persistWidget(widget);
    renderWidgets();
}

async function moveField(widget, field, direction) {
    const ordered = [...widget.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = ordered.findIndex(item => item.id === field.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ordered.length) return;
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    widget.fields = ordered.map((item, order) => ({ ...item, order }));
    await persistWidget(widget);
    renderWidgets();
}

async function removeWidget(widget) {
    if (!await showConfirmModal('Elimina widget', `Eliminare definitivamente “${widget.title}”?`)) return;
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'profileWidgets', widget.id));
    widgets = widgets.filter(item => item.id !== widget.id);
    renderWidgets();
}

async function duplicateWidget(widget) {
    const copy = {
        ...widget,
        id: newId('widget'),
        title: `${widget.title} — copia`,
        order: widgets.length,
        fields: widget.fields.map(field => ({ ...field, id: newId('field') }))
    };
    await persistWidget(copy);
    widgets.push(copy);
    renderWidgets();
}

async function toggleCollapsed(widget) {
    widget.collapsed = !widget.collapsed;
    await persistWidget(widget);
    renderWidgets();
}

async function moveWidget(widget, direction) {
    const inTab = widgets.filter(item => item.tab === widget.tab).sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = inTab.findIndex(item => item.id === widget.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= inTab.length) return;
    [inTab[index], inTab[next]] = [inTab[next], inTab[index]];
    inTab.forEach((item, order) => { item.order = order; });
    await Promise.all(inTab.map(persistWidget));
    widgets.sort((a, b) => (a.order || 0) - (b.order || 0));
    renderWidgets();
}

function fieldCard(field) {
    const hidden = field.encrypted === true;
    return createElement('div', { className: 'profile-widget-field' }, [
        createElement('span', { className: 'data-label', textContent: field.label }),
        createElement('span', { className: 'data-value', textContent: field.preview === false ? 'Nascosto in anteprima' : (hidden ? '••••••••' : (field.value || '—')) }),
        createElement('div', { className: 'profile-widget-field-actions' })
    ]);
}

function renderWidgets() {
    document.querySelectorAll('.profile-widget-zone').forEach(zone => zone.remove());
    PROFILE_TABS.filter(tab => !['overview', 'digital-card'].includes(tab)).forEach(tab => {
        const panels = [...document.querySelectorAll(`[data-profile-tab="${tab}"]`)];
        const anchor = panels.at(-1);
        if (!anchor) return;
        const zone = createElement('section', { className: 'profile-widget-zone', dataset: { profileTab: tab, widgetZone: tab } }, [
            createElement('div', { className: 'profile-widget-zone-heading' }, [
                createElement('h3', { className: 'form-section-title', textContent: 'Widget personalizzati' }),
                createElement('button', { className: 'btn-upload-trigger', textContent: 'Aggiungi widget', onclick: () => addWidget(tab) })
            ]),
            createElement('div', { className: 'profile-widget-grid' }, widgets.filter(widget => widget.tab === tab).map(widget => createElement('article', {
                className: `form-card profile-widget profile-widget-${widget.size || 'medium'}`,
                style: { borderTopColor: widget.color || 'var(--accent)' }
            }, [
                createElement('header', { className: 'profile-widget-header' }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: widget.icon || 'widgets' }),
                    createElement('div', { className: 'profile-widget-title' }, [
                        createElement('strong', { textContent: widget.title }),
                        widget.description ? createElement('small', { textContent: widget.description }) : null
                    ]),
                    createElement('div', { className: 'profile-widget-actions' }, [
                        createElement('button', { textContent: '↑', title: 'Sposta widget su', onclick: () => moveWidget(widget, -1) }),
                        createElement('button', { textContent: '↓', title: 'Sposta widget giù', onclick: () => moveWidget(widget, 1) }),
                        createElement('button', { textContent: widget.collapsed ? 'Apri' : 'Comprimi', onclick: () => toggleCollapsed(widget) }),
                        createElement('button', { textContent: 'Modifica', onclick: () => editWidget(widget) }),
                        createElement('button', { textContent: 'Duplica', onclick: () => duplicateWidget(widget) }),
                        createElement('button', { textContent: 'Elimina', onclick: () => removeWidget(widget) })
                    ])
                ]),
                widget.collapsed ? null : createElement('div', { className: 'profile-widget-body' }, [
                    ...widget.fields.sort((a, b) => (a.order || 0) - (b.order || 0)).map(field => {
                        const card = fieldCard(field);
                        setChildren(card.querySelector('.profile-widget-field-actions'), [
                            field.copyable && !field.encrypted ? createElement('button', {
                                textContent: 'Copia',
                                onclick: async () => {
                                    await navigator.clipboard.writeText(field.value || '');
                                    showToast('Valore copiato.', 'success');
                                }
                            }) : null,
                            createElement('button', { textContent: '↑', title: 'Sposta su', onclick: () => moveField(widget, field, -1) }),
                            createElement('button', { textContent: '↓', title: 'Sposta giù', onclick: () => moveField(widget, field, 1) }),
                            createElement('button', { textContent: 'Modifica', onclick: () => editField(widget, field) }),
                            createElement('button', { textContent: 'Elimina', onclick: () => removeField(widget, field) })
                        ].filter(Boolean));
                        return card;
                    }),
                    createElement('button', { className: 'btn-upload-trigger', textContent: 'Aggiungi campo', onclick: () => addField(widget) })
                ])
            ])))
        ]);
        anchor.insertAdjacentElement('afterend', zone);
    });
    onChanged?.(widgets);
}
