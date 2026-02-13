/**
 * CONFIGURAZIONE AUTOMEZZI MODULE (V4.1)
 * Gestisce la configurazione delle scadenze per automezzi.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';

const DEFAULT_CONFIG = {
    deadlineTypes: [],
    models: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Buttons Listeners
    document.getElementById('btn-add-type')?.addEventListener('click', () => addTypeItem());
    document.getElementById('btn-add-model')?.addEventListener('click', () => addItem('models', t('prompt_new_vehicle')));
    document.getElementById('btn-add-template')?.addEventListener('click', () => addItem('emailTemplates', t('prompt_new_email_text')));

    // Delegated actions for list items
    ['container-types', 'container-models', 'container-templates'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            const btnEdit = e.target.closest('.btn-edit-item');
            const btnDelete = e.target.closest('.btn-delete-item');

            if (btnEdit) {
                const { list, index } = btnEdit.dataset;
                if (list === 'deadlineTypes') editType(parseInt(index));
                else editItem(list, parseInt(index));
            } else if (btnDelete) {
                const { list, index } = btnDelete.dataset;
                deleteItem(list, parseInt(index));
            }
        });
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadConfig();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadConfig() {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfig"));
        if (snap.exists()) {
            currentConfig = snap.data();
            // Ensure defaults
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
        await setDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfig"), currentConfig);
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

    const items = currentConfig.deadlineTypes.map((item, index) => {
        // Handle migration from string to object
        if (typeof item === 'string') {
            item = { name: item, period: 14, freq: 7 };
            currentConfig.deadlineTypes[index] = item;
        }

        return createElement('div', {
            className: 'config-list-item'
        }, [
            createElement('div', { className: 'config-item-main' }, [
                createElement('span', { className: 'config-item-name', textContent: item.name }),
                createElement('div', { className: 'config-badge-group' }, [
                    createElement('span', {
                        className: 'config-badge config-badge-blue',
                        textContent: `${t('text_notice')} ${item.period}gg`
                    }),
                    createElement('span', {
                        className: 'config-badge config-badge-amber',
                        textContent: `${t('text_replica')} ${item.freq}gg`
                    })
                ])
            ]),
            createElement('div', { className: 'config-item-actions' }, [
                createElement('button', {
                    className: 'btn-edit-item btn-manage-account-semantic',
                    dataset: { list: 'deadlineTypes', index: index.toString() }
                }, [
                    createElement('span', { className: 'material-symbols-outlined icon-size-sm', textContent: 'edit' })
                ]),
                createElement('button', {
                    className: 'btn-delete-item btn-manage-account-semantic btn-delete-item-semantic',
                    dataset: { list: 'deadlineTypes', index: index.toString() }
                }, [
                    createElement('span', { className: 'material-symbols-outlined icon-size-sm', textContent: 'delete' })
                ])
            ])
        ]);
    });
    setChildren(container, items);
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

    const items = data.map((item, index) => createElement('div', {
        className: 'config-list-item'
    }, [
        createElement('span', { className: 'config-item-desc truncate pr-4', textContent: item }),
        createElement('div', { className: 'config-item-actions' }, [
            createElement('button', {
                className: 'btn-edit-item btn-manage-account-semantic',
                dataset: { list: listKey, index: index.toString() }
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'edit' })
            ]),
            createElement('button', {
                className: 'btn-delete-item btn-manage-account-semantic text-red-400',
                dataset: { list: listKey, index: index.toString() }
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ])
        ])
    ]));
    setChildren(container, items);
}

async function addTypeItem() {
    const name = await window.showInputModal(t('prompt_new_subject'), "", t('placeholder_type_vehicle'));
    if (!name) return;
    const period = await window.showInputModal(t('prompt_days_notice'), "14", t('desc_notice_period'));
    if (period === null) return;
    const freq = await window.showInputModal(t('prompt_freq_days'), "7", t('desc_frequency'));
    if (freq === null) return;

    currentConfig.deadlineTypes.push({
        name: name.trim(),
        period: parseInt(period) || 14,
        freq: parseInt(freq) || 7
    });
    saveConfig();
}

async function editType(index) {
    const item = currentConfig.deadlineTypes[index];
    const name = await window.showInputModal(t('prompt_edit_item'), item.name);
    if (name === null) return;
    const period = await window.showInputModal(t('prompt_days_notice'), item.period.toString());
    if (period === null) return;
    const freq = await window.showInputModal(t('prompt_freq_days'), item.freq.toString());
    if (freq === null) return;

    currentConfig.deadlineTypes[index] = {
        name: name.trim(),
        period: parseInt(period) || 14,
        freq: parseInt(freq) || 7
    };
    saveConfig();
}

async function addItem(listKey, prompt) {
    const val = await window.showInputModal(t('modal_title_add'), "", prompt);
    if (!val || !val.trim()) return;
    currentConfig[listKey].push(val.trim());
    saveConfig();
}

async function editItem(listKey, index) {
    const current = currentConfig[listKey][index];
    const val = await window.showInputModal(t('modal_title_edit'), current);
    if (val === null || !val.trim()) return;
    currentConfig[listKey][index] = val.trim();
    saveConfig();
}

async function deleteItem(listKey, index) {
    const confirmed = await window.showConfirmModal(t('confirm_delete_title'), t('confirm_delete_item'));
    if (!confirmed) return;
    currentConfig[listKey].splice(index, 1);
    saveConfig();
}

