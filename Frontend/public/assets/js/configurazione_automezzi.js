
// configurazione_automezzi.js v1.7 - Titanium Gold
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { initComponents } from './components.js';
import { t } from './translations.js';

// Setup Base (Traduzioni)
// --- ACCORDION LOGIC (Standalone) ---
const initAccordion = () => {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                const isShowing = targetContent.classList.toggle('show');

                const chevron = header.querySelector('.settings-chevron');
                if (chevron) {
                    chevron.style.transform = isShowing ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            }
        });
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccordion);
} else {
    initAccordion();
}

// Setup Base (Traduzioni)
initComponents().then(() => {
    // --- TRADUZIONE STATICA DEL DOM ---
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', t(key));
        } else {
            el.textContent = t(key);
        }
    });
});

function log(msg) {
    console.log("[Config Automezzi] " + msg);
}

// --- CONFIGURATION ---
const DEFAULT_CONFIG = {
    deadlineTypes: [],
    models: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;

// --- FUNCTIONS ---

function renderTable(tbodyId, dataArray, listKey) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = `<tr><td class="px-4 py-3 text-gray-500 italic">${t('no_data')}</td></tr>`;
        return;
    }

    dataArray.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5 last:border-0";

        // Escape quotes for safe injection in onclick
        const safeListKey = listKey.replace(/'/g, "\\'");

        tr.innerHTML = `
             <td class="px-3 py-2 flex justify-between items-center text-gray-700 dark:text-gray-300 text-xs">
                <span class="font-medium">${item}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button class="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-500/20 text-blue-600 dark:text-blue-500 transition-colors"
                        onclick="window.editItem('${safeListKey}', ${index})">
                        <span class="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                    <button class="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                        onclick="window.deleteItem('${safeListKey}', ${index})">
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.renderAllTables = () => {
    try {
        // Custom Render for Types (Table with Columns)
        const tbodyTypes = document.getElementById('tbody_types');
        if (tbodyTypes) {
            tbodyTypes.innerHTML = '';
            if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
                tbodyTypes.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-gray-500 italic text-center text-xs">${t('no_data_configured')}</td></tr>`;
            } else {
                currentConfig.deadlineTypes.forEach((item, index) => {
                    if (typeof item === 'string') {
                        item = { name: item, period: 14, freq: 7 };
                        currentConfig.deadlineTypes[index] = item;
                    }
                    const name = item.name || '';
                    const period = item.period || 14;
                    const freq = item.freq || 7;

                    const tr = document.createElement('tr');
                    tr.className = "group hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5 last:border-0";
                    tr.innerHTML = `
                         <td class="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 text-xs">${name}</td>
                        <td class="px-2 py-2 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">${t('text_notice')}</span>
                                <span class="font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] border border-blue-500/20">${period}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-2 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">${t('text_replica')}</span>
                                <span class="font-bold text-gray-700 dark:text-gray-300 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded text-[10px] border border-slate-200 dark:border-white/10">${freq}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-2 text-right">
                             <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button class="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-500/20 text-blue-600 dark:text-blue-500 transition-colors"
                                    onclick="window.editType(${index})">
                                    <span class="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button class="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                                    onclick="window.deleteItem('deadlineTypes', ${index})">
                                    <span class="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                            </div>
                        </td>
                    `;
                    tbodyTypes.appendChild(tr);
                });
            }
        }

        renderTable('tbody_models', currentConfig.models, 'models');
        renderTable('tbody_templates', currentConfig.emailTemplates, 'emailTemplates');
    } catch (e) {
        log("Render Error: " + e.message);
    }
};

window.editType = async (index) => {
    const item = currentConfig.deadlineTypes[index];
    const newName = await window.showInputModal(t('prompt_edit_subject'), item.name);
    if (newName === null) return;
    let newPeriod = await window.showInputModal(t('prompt_days_notice'), item.period);
    if (newPeriod === null) return;
    let newFreq = await window.showInputModal(t('prompt_freq_days'), item.freq);
    if (newFreq === null) return;

    if (newName && !isNaN(newPeriod) && !isNaN(newFreq)) {
        currentConfig.deadlineTypes[index] = {
            name: newName.trim(),
            period: parseInt(newPeriod),
            freq: parseInt(newFreq)
        };
        window.renderAllTables();
        await window.saveConfig(currentConfig);
    }
};

window.addTypeItem = async () => {
    const name = await window.showInputModal(t('prompt_new_subject'));
    if (!name) return;
    const period = await window.showInputModal(t('prompt_period_default'), "14");
    if (period === null) return;
    const freq = await window.showInputModal(t('prompt_freq_default'), "7");
    if (freq === null) return;

    if (!currentConfig.deadlineTypes) currentConfig.deadlineTypes = [];
    currentConfig.deadlineTypes.push({
        name: name.trim(),
        period: parseInt(period) || 14,
        freq: parseInt(freq) || 7
    });

    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.saveConfig = async (newConfig) => {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfig");
        await setDoc(docRef, newConfig);
        currentConfig = JSON.parse(JSON.stringify(newConfig));
        if (window.showToast) window.showToast("Configurazione salvata!", 'success');
    } catch (e) {
        log("Firestore Save ERROR: " + e.message);
        if (window.showToast) window.showToast("Errore salvataggio", 'error');
    }
};

window.loadConfig = async () => {
    if (!currentUser) return;
    try {
        let docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfig");
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            if (!cloudData.deadlineTypes) cloudData.deadlineTypes = DEFAULT_CONFIG.deadlineTypes;
            if (!cloudData.models) cloudData.models = DEFAULT_CONFIG.models;
            if (!cloudData.emailTemplates) cloudData.emailTemplates = DEFAULT_CONFIG.emailTemplates;
            currentConfig = cloudData;
        } else {
            currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            await window.saveConfig(currentConfig);
        }
        window.renderAllTables();
    } catch (e) {
        log("Firestore Load ERROR: " + e.message);
    }
};

window.toggleSection = (key) => {
    const container = document.getElementById(`container_${key}`);
    const icon = document.getElementById(`icon_${key}`);
    if (container) {
        const isHidden = container.classList.toggle('hidden');
        if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    }
};

window.addItem = async (listKey, promptText) => {
    const value = await window.showInputModal(promptText);
    if (!value || !value.trim()) return;
    if (!currentConfig[listKey]) currentConfig[listKey] = [];
    currentConfig[listKey].push(value.trim());
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.editItem = async (listKey, index) => {
    const currentValue = currentConfig[listKey][index];
    const newValue = await window.showInputModal(t('prompt_edit_item'), currentValue);
    if (newValue === null || !newValue.trim()) return;
    currentConfig[listKey][index] = newValue.trim();
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.deleteItem = async (listKey, index) => {
    const confirmed = await window.showConfirmModal(t('confirm_delete_item'));
    if (!confirmed) return;
    currentConfig[listKey].splice(index, 1);
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

// Initial Auth Setup
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await window.loadConfig();
    }
});
