import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const DEFAULT_CONFIG = {
    deadlineTypes: [],
    models: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    // Buttons Listeners
    document.getElementById('btn-add-type')?.addEventListener('click', () => addTypeItem());
    document.getElementById('btn-add-model')?.addEventListener('click', () => addItem('models', 'Dati Documento (Numero - Tipo - Proprietario):'));
    document.getElementById('btn-add-template')?.addEventListener('click', () => addItem('emailTemplates', 'Nuovo Testo Email:'));

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
        showToast("Configurazione salvata", "success");
        renderAll();
    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio", "error");
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

    if (currentConfig.deadlineTypes.length === 0) {
        container.innerHTML = `<p class="text-[10px] text-white/30 uppercase text-center py-4">Nessun tipo configurato</p>`;
        return;
    }

    container.innerHTML = currentConfig.deadlineTypes.map((item, index) => {
        if (typeof item === 'string') {
            item = { name: item, period: 14, freq: 7 };
            currentConfig.deadlineTypes[index] = item;
        }
        return `
            <div class="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group">
                <div class="flex-1">
                    <span class="block text-sm font-bold text-white mb-1">${item.name}</span>
                    <div class="flex gap-2">
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-widest">Preavviso ${item.period}gg</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-bold uppercase tracking-widest">Frequenza ${item.freq}gg</span>
                    </div>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button class="btn-edit-item glass-btn-sm" data-list="deadlineTypes" data-index="${index}">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button class="btn-delete-item glass-btn-sm text-red-400" data-list="deadlineTypes" data-index="${index}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderSimpleList(containerId, data, listKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-[10px] text-white/30 uppercase text-center py-4">Nessun dato</p>`;
        return;
    }

    container.innerHTML = data.map((item, index) => `
        <div class="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group">
            <span class="text-xs text-white/80 truncate pr-4">${item}</span>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button class="btn-edit-item glass-btn-sm" data-list="${listKey}" data-index="${index}">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button class="btn-delete-item glass-btn-sm text-red-400" data-list="${listKey}" data-index="${index}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

async function addTypeItem() {
    const name = await window.showInputModal("TIPO DOCUMENTO", "", "Es. Patente");
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
