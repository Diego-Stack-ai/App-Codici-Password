/**
 * CONFIGURAZIONE GENERALI MODULE (V4.1)
 * Gestisce la configurazione delle scadenze generali.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';

const DEFAULT_CONFIG = {
    deadlineTypes: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Buttons Listeners
    document.getElementById('btn-add-type')?.addEventListener('click', () => addTypeItem());
    document.getElementById('btn-add-template')?.addEventListener('click', () => addItem('emailTemplates', 'Nuovo Testo Email:'));

    // Delegated actions for list items
    ['container-types', 'container-templates'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', (e) => {
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
        const snap = await getDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig"));
        if (snap.exists()) {
            currentConfig = snap.data();
            if (!currentConfig.deadlineTypes) currentConfig.deadlineTypes = [];
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
        await setDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig"), currentConfig);
        showToast("Configurazione salvata", "success");
        renderAll();
    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio", "error");
    }
}

function renderAll() {
    renderTypes();
    renderSimpleList('container-templates', currentConfig.emailTemplates, 'emailTemplates');
}

function renderTypes() {
    const container = document.getElementById('container-types');
    if (!container) return;

    clearElement(container);

    if (currentConfig.deadlineTypes.length === 0) {
        container.appendChild(createElement('p', {
            className: 'text-[10px] text-white/30 uppercase text-center py-4',
            textContent: 'Nessun tipo configurato'
        }));
        return;
    }

    const items = currentConfig.deadlineTypes.map((item, index) => {
        if (typeof item === 'string') {
            item = { name: item, period: 14, freq: 7 };
            currentConfig.deadlineTypes[index] = item;
        }
        return createElement('div', {
            className: 'p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group'
        }, [
            createElement('div', { className: 'flex-1' }, [
                createElement('span', { className: 'block text-sm font-bold text-white mb-1', textContent: item.name }),
                createElement('div', { className: 'flex gap-2' }, [
                    createElement('span', {
                        className: 'text-[9px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold uppercase tracking-widest',
                        textContent: `Preavviso ${item.period}gg`
                    }),
                    createElement('span', {
                        className: 'text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-bold uppercase tracking-widest',
                        textContent: `Frequenza ${item.freq}gg`
                    })
                ])
            ]),
            createElement('div', { className: 'flex gap-1 opacity-0 group-hover:opacity-100 transition-all' }, [
                createElement('button', {
                    className: 'btn-edit-item glass-btn-sm',
                    dataset: { list: 'deadlineTypes', index: index.toString() }
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'edit' })
                ]),
                createElement('button', {
                    className: 'btn-delete-item glass-btn-sm text-red-400',
                    dataset: { list: 'deadlineTypes', index: index.toString() }
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
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
        container.appendChild(createElement('p', {
            className: 'text-[10px] text-white/30 uppercase text-center py-4',
            textContent: 'Nessun dato'
        }));
        return;
    }

    const items = data.map((item, index) => createElement('div', {
        className: 'p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group'
    }, [
        createElement('span', { className: 'text-xs text-white/80 truncate pr-4', textContent: item }),
        createElement('div', { className: 'flex gap-1 opacity-0 group-hover:opacity-100 transition-all' }, [
            createElement('button', {
                className: 'btn-edit-item glass-btn-sm',
                dataset: { list: listKey, index: index.toString() }
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'edit' })
            ]),
            createElement('button', {
                className: 'btn-delete-item glass-btn-sm text-red-400',
                dataset: { list: listKey, index: index.toString() }
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ])
        ])
    ]));
    setChildren(container, items);
}

async function addTypeItem() {
    const name = await window.showInputModal("NOME SCADENZA", "", "Es. Assicurazione Generica");
    if (!name) return;
    const period = await window.showInputModal("GIORNI PREAVVISO", "14");
    if (period === null) return;
    const freq = await window.showInputModal("FREQUENZA NOTIFICA", "7");
    if (freq === null) return;

    currentConfig.deadlineTypes.push({ name: name.trim(), period: parseInt(period) || 14, freq: parseInt(freq) || 7 });
    saveConfig();
}

async function editType(index) {
    const item = currentConfig.deadlineTypes[index];
    const name = await window.showInputModal("MODIFICA", item.name);
    if (name === null) return;
    const period = await window.showInputModal("GIORNI PREAVVISO", item.period.toString());
    if (period === null) return;
    const freq = await window.showInputModal("FREQUENZA NOTIFICA", item.freq.toString());
    if (freq === null) return;

    currentConfig.deadlineTypes[index] = { name: name.trim(), period: parseInt(period) || 14, freq: parseInt(freq) || 7 };
    saveConfig();
}

async function addItem(listKey, prompt) {
    const val = await window.showInputModal("AGGIUNGI", "", prompt);
    if (!val || !val.trim()) return;
    currentConfig[listKey].push(val.trim());
    saveConfig();
}

async function editItem(listKey, index) {
    const current = currentConfig[listKey][index];
    const val = await window.showInputModal("MODIFICA", current);
    if (val === null || !val.trim()) return;
    currentConfig[listKey][index] = val.trim();
    saveConfig();
}

async function deleteItem(listKey, index) {
    const confirmed = await window.showConfirmModal("ELIMINA", "Confermi?");
    if (!confirmed) return;
    currentConfig[listKey].splice(index, 1);
    saveConfig();
}

