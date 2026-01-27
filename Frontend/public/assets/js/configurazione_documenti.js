
// configurazione_documenti.js v1.7 - Titanium Gold
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { initComponents } from './components.js';
import { t } from './translations.js';

// Setup Base (Header/Footer)
initComponents().then(() => {
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        headerStack.style.display = 'flex';
        headerStack.style.alignItems = 'center';
        headerStack.style.justifyContent = 'space-between';
        headerStack.style.width = '100%';
        headerStack.className = "px-4";

        headerStack.innerHTML = `
            <div class="header-stack w-full flex items-center justify-between relative">
                <a href="regole_scadenze_veicoli.html" class="btn-icon-header flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-900 dark:text-white">
                    <span class="material-symbols-outlined">arrow_back</span>
                </a>
                <h2 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-900 dark:text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                    ${t('header_config_documents')}
                </h2>
                <a href="home_page.html" class="btn-icon-header flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-900 dark:text-white">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
    }

    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="footer-stack" style="width: 100%; display: flex; justify-content: center; opacity: 0.3;">
                <span class="text-[9px] font-bold uppercase tracking-[0.3em] font-mono text-gray-900/50 dark:text-white/50 user-select-none">${t('version')}</span>
            </div>
        `;
    }

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
    console.log("[Config Documenti] " + msg);
}

const DEFAULT_CONFIG = {
    deadlineTypes: [],
    models: [],
    emailTemplates: []
};

let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let currentUser = null;

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
        const safeListKey = listKey.replace(/'/g, "\\'");

        tr.innerHTML = `
             <td class="px-4 py-3 flex justify-between items-center text-gray-700 dark:text-gray-300">
                <span class="font-medium">${item}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button class="size-8 flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 transition-colors"
                        onclick="window.editItem('${safeListKey}', ${index})">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                        onclick="window.deleteItem('${safeListKey}', ${index})">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.renderAllTables = () => {
    try {
        const tbodyTypes = document.getElementById('tbody_types');
        if (tbodyTypes) {
            tbodyTypes.innerHTML = '';
            if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
                tbodyTypes.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-gray-500 italic text-center text-xs">${t('no_data_configured')}</td></tr>`;
            } else {
                currentConfig.deadlineTypes.forEach((item, index) => {
                    if (typeof item === 'string') {
                        item = { name: item, period: 30, freq: 15 };
                        currentConfig.deadlineTypes[index] = item;
                    }
                    const name = item.name || '';
                    const period = item.period || 30;
                    const freq = item.freq || 15;

                    const tr = document.createElement('tr');
                    tr.className = "group hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5 last:border-0";
                    tr.innerHTML = `
                         <td class="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">${name}</td>
                        <td class="px-2 py-3 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">${t('text_notice')}</span>
                                <span class="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] border border-amber-500/20">${period}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-3 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">${t('text_replica')}</span>
                                <span class="font-bold text-gray-700 dark:text-gray-300 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded text-[10px] border border-slate-200 dark:border-white/10">${freq}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-3 text-right">
                             <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 transition-colors"
                                    onclick="window.editType(${index})">
                                    <span class="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                                    onclick="window.deleteItem('deadlineTypes', ${index})">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
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
    const newName = prompt(t('prompt_edit_doc_name'), item.name);
    if (newName === null) return;
    let newPeriod = prompt(t('prompt_days_notice'), item.period);
    if (newPeriod === null) return;
    let newFreq = prompt(t('prompt_freq_days'), item.freq);
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
    const name = prompt(t('prompt_new_doc_type'));
    if (!name) return;
    const period = prompt(t('prompt_period_default').replace('14', '30'), "30");
    if (period === null) return;
    const freq = prompt(t('prompt_freq_default').replace('7', '15'), "15");
    if (freq === null) return;

    if (!currentConfig.deadlineTypes) currentConfig.deadlineTypes = [];
    currentConfig.deadlineTypes.push({
        name: name.trim(),
        period: parseInt(period) || 30,
        freq: parseInt(freq) || 15
    });

    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.addDocumentDetail = async () => {
    const value = prompt(t('prompt_new_doc_detail'));
    if (!value || !value.trim()) return;
    if (!currentConfig.models) currentConfig.models = [];
    currentConfig.models.push(value.trim());
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.saveConfig = async (newConfig) => {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "settings", "documentConfig");
        await setDoc(docRef, newConfig);
        currentConfig = JSON.parse(JSON.stringify(newConfig));
    } catch (e) {
        log("Firestore Save ERROR: " + e.message);
    }
};

window.loadConfig = async () => {
    if (!currentUser) return;
    try {
        let docRef = doc(db, "users", currentUser.uid, "settings", "documentConfig");
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
    const value = prompt(promptText);
    if (!value || !value.trim()) return;
    if (!currentConfig[listKey]) currentConfig[listKey] = [];
    currentConfig[listKey].push(value.trim());
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.editItem = async (listKey, index) => {
    const currentValue = currentConfig[listKey][index];
    const newValue = prompt(t('prompt_edit_item'), currentValue);
    if (newValue === null || !newValue.trim()) return;
    currentConfig[listKey][index] = newValue.trim();
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.deleteItem = async (listKey, index) => {
    if (!confirm(t('confirm_delete_item'))) return;
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
