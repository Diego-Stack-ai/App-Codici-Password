/**
 * CONFIGURAZIONE DOCUMENTI MODULE (V4.1)
 * Gestisce la configurazione delle scadenze per documenti.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal, showInputModal } from '../../ui-core.js';
import { t } from '../../translations.js';

const DEFAULT_CONFIG = {
    deadlineTypes: [],
    models: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;
let editingState = { list: null, index: null };

/**
 * CONFIGURAZIONE DOCUMENTI MODULE (V5.0 ADAPTER)
 * Gestione configurazione documenti.
 * - Entry Point: initConfigurazioneDocumenti(user)
 */

export async function initConfigurazioneDocumenti(user) {
    console.log("[CONF-DOC] Init V5.0...");
    if (!user) return;
    currentUser = user;

    // Buttons Listeners
    const btnAddType = document.getElementById('btn-add-type');
    if (btnAddType) btnAddType.onclick = () => addTypeItem();

    const btnAddModel = document.getElementById('btn-add-model');
    if (btnAddModel) btnAddModel.onclick = () => addItem('models', t('prompt_new_doc_detail'));

    const btnAddTemplate = document.getElementById('btn-add-template');
    if (btnAddTemplate) btnAddTemplate.onclick = () => addItem('emailTemplates', t('prompt_new_email_text'));

    // Delegated actions
    ['container-types', 'container-models', 'container-templates'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = (e) => {
            const btnEdit = e.target.closest('.btn-edit-item');
            const btnDelete = e.target.closest('.btn-delete-item');
            const btnSave = e.target.closest('.btn-save-inline');
            const btnCancel = e.target.closest('.btn-cancel-inline');

            if (btnEdit) {
                const { list, index } = btnEdit.dataset;
                startInlineEdit(list, parseInt(index));
            } else if (btnDelete) {
                const { list, index } = btnDelete.dataset;
                deleteItem(list, parseInt(index));
            } else if (btnSave) {
                saveInlineEdit();
            } else if (btnCancel) {
                cancelInlineEdit();
            }
        };
    });

    await loadConfig();
    console.log("[CONF-DOC] Ready.");
}

async function loadConfig() {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments"));
        if (snap.exists()) {
            currentConfig = snap.data();
            if (!currentConfig.deadlineTypes) currentConfig.deadlineTypes = [];
            if (!currentConfig.models) currentConfig.models = [];
            if (!currentConfig.emailTemplates) currentConfig.emailTemplates = [];
        } else {
            currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
        renderAll();
    } catch (e) {
        console.error(e);
    }
}

async function saveConfig() {
    try {
        await setDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments"), currentConfig);
        showToast(t('success_config_saved'), "success");
        renderAll();
    } catch (e) {
        console.error(e);
        showToast(t('error_config_save'), "error");
    }
}

function renderAll() {
    renderTypes();
    renderSimpleList('container-models', currentConfig.models, 'models');
    renderSimpleList('container-templates', currentConfig.emailTemplates, 'emailTemplates');
}

function startInlineEdit(list, index) {
    editingState = { list, index };
    renderAll();
}

function cancelInlineEdit() {
    editingState = { list: null, index: null };
    renderAll();
}

async function saveInlineEdit() {
    const { list, index } = editingState;
    if (list === 'deadlineTypes') {
        const name = document.getElementById('edit-type-name')?.value;
        const period = document.getElementById('edit-type-period')?.value;
        const freq = document.getElementById('edit-type-freq')?.value;

        if (!name || !name.trim()) return;

        currentConfig.deadlineTypes[index] = {
            name: name.trim(),
            period: parseInt(period) || 14,
            freq: parseInt(freq) || 7
        };
    } else {
        const val = document.getElementById(`edit-item-${list}-${index}`)?.value;
        if (val === undefined || !val.trim()) return;
        currentConfig[list][index] = val.trim();
    }

    editingState = { list: null, index: null };
    saveConfig();
}

function renderTypes() {
    const container = document.getElementById('container-types');
    if (!container) return;
    clearElement(container);

    if (currentConfig.deadlineTypes.length === 0) {
        container.appendChild(createElement('div', { className: 'archive-loading-container' }, [
            createElement('p', { className: 'archive-loading-text', textContent: t('no_data_configured') })
        ]));
        return;
    }

    currentConfig.deadlineTypes.forEach((item, index) => {
        if (typeof item === 'string') {
            item = { name: item, period: 14, freq: 7 };
            currentConfig.deadlineTypes[index] = item;
        }

        const isEditing = editingState.list === 'deadlineTypes' && editingState.index === index;

        if (isEditing) {
            container.appendChild(createElement('div', { className: 'config-list-item' }, [
                createElement('div', { className: 'inline-edit-container' }, [
                    createElement('div', { className: 'inline-edit-row' }, [
                        createElement('input', { id: 'edit-type-name', type: 'text', value: item.name, placeholder: t('placeholder_type_doc'), className: 'inline-input-glass detail-input' })
                    ]),
                    createElement('div', { className: 'inline-edit-row' }, [
                        createElement('span', { className: 'config-item-desc', textContent: t('text_notice') }),
                        createElement('input', { id: 'edit-type-period', type: 'number', value: item.period, className: 'inline-input-glass short-code-input' }),
                        createElement('span', { className: 'config-item-desc', textContent: t('text_replica') }),
                        createElement('input', { id: 'edit-type-freq', type: 'number', value: item.freq, className: 'inline-input-glass short-code-input' })
                    ])
                ]),
                createElement('div', { className: 'config-item-actions' }, [
                    createElement('button', { className: 'btn-save-inline btn-icon-save' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'check' })]),
                    createElement('button', { className: 'btn-cancel-inline btn-icon-cancel' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })])
                ])
            ]));
        } else {
            container.appendChild(createElement('div', { className: 'config-list-item' }, [
                createElement('div', { className: 'config-item-main' }, [
                    createElement('span', { className: 'config-item-name', textContent: item.name }),
                    createElement('div', { className: 'config-badge-group' }, [
                        createElement('span', { className: 'config-badge config-badge-blue', textContent: `${t('text_notice')} ${item.period}gg` }),
                        createElement('span', { className: 'config-badge config-badge-amber', textContent: `${t('text_replica')} ${item.freq}gg` })
                    ])
                ]),
                createElement('div', { className: 'config-item-actions flex-align-center gap-1' }, [
                    createElement('button', { className: 'btn-edit-item btn-icon-edit', dataset: { list: 'deadlineTypes', index: index.toString() } }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })]),
                    createElement('button', { className: 'btn-delete-item btn-icon-delete', dataset: { list: 'deadlineTypes', index: index.toString() } }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
                ])
            ]));
        }
    });
}

function renderSimpleList(containerId, data, listKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    clearElement(container);

    if (!data || data.length === 0) {
        container.appendChild(createElement('div', { className: 'archive-loading-container' }, [
            createElement('p', { className: 'archive-loading-text', textContent: t('no_data') })
        ]));
        return;
    }

    data.forEach((item, index) => {
        const isEditing = editingState.list === listKey && editingState.index === index;
        if (isEditing) {
            container.appendChild(createElement('div', { className: 'config-list-item' }, [
                createElement('div', { className: 'inline-edit-row' }, [
                    createElement('input', { id: `edit-item-${listKey}-${index}`, type: 'text', value: item, className: 'inline-input-glass detail-input' })
                ]),
                createElement('div', { className: 'config-item-actions' }, [
                    createElement('button', { className: 'btn-save-inline btn-icon-save' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'check' })]),
                    createElement('button', { className: 'btn-cancel-inline btn-icon-cancel' }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })])
                ])
            ]));
        } else {
            container.appendChild(createElement('div', { className: 'config-list-item' }, [
                createElement('span', { className: 'config-item-desc truncate pr-4', textContent: item }),
                createElement('div', { className: 'config-item-actions' }, [
                    createElement('button', { className: 'btn-edit-item btn-icon-edit', dataset: { list: listKey, index: index.toString() } }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })]),
                    createElement('button', { className: 'btn-delete-item btn-icon-delete', dataset: { list: listKey, index: index.toString() } }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
                ])
            ]));
        }
    });
}

async function addTypeItem() {
    const name = await showInputModal(t('prompt_new_doc_type'), "", t('placeholder_type_doc'));
    if (!name) return;
    const period = await showInputModal(t('prompt_days_notice'), "14");
    if (period === null) return;
    const freq = await showInputModal(t('prompt_freq_days'), "7");
    if (freq === null) return;

    currentConfig.deadlineTypes.push({ name: name.trim(), period: parseInt(period) || 14, freq: parseInt(freq) || 7 });
    saveConfig();
}

async function addItem(listKey, promptText) {
    const val = await showInputModal(t('modal_title_add'), "", promptText);
    if (!val || !val.trim()) return;
    currentConfig[listKey].push(val.trim());
    saveConfig();
}

async function deleteItem(listKey, index) {
    const confirmed = await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_item'));
    if (!confirmed) return;
    currentConfig[listKey].splice(index, 1);
    saveConfig();
}
