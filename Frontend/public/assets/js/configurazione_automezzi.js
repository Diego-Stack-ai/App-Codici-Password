
// configurazione_automezzi.js v1.6

function log(msg) {
    console.log("[Config] " + msg);
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.classList.remove('hidden');
        const entry = document.createElement('div');
        entry.textContent = "> " + msg;
        debugLog.appendChild(entry);
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

log("Script Loading Started...");

import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

log("Imports Successful.");

// --- CONFIGURATION ---
const CONFIG_DOC_PATH = "settings/deadlineConfig";

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
    if (!tbody) {
        log("Tbody not found: " + tbodyId);
        return;
    }

    tbody.innerHTML = '';
    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = '<tr><td class="px-4 py-3 text-gray-400 italic">Nessun dato</td></tr>';
        return;
    }

    dataArray.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";

        // Escape quotes for safe injection in onclick
        const safeListKey = listKey.replace(/'/g, "\\'");

        tr.innerHTML = `
             <td class="px-4 py-3 flex justify-between items-center text-gray-300">
                <span class="font-medium">${item}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button class="size-8 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-blue-500 transition-colors"
                        onclick="window.editItem('${safeListKey}', ${index})">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
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
        log("Rendering all tables...");

        // Custom Render for Types (Table with Columns)
        const tbodyTypes = document.getElementById('tbody_types');
        if (tbodyTypes) {
            tbodyTypes.innerHTML = '';
            if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
                tbodyTypes.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-gray-500 italic text-center text-xs">Nessun dato configurato</td></tr>';
            } else {
                // Header (Injected once)
                // We'll rely on tbody rows structure matching a clean table layout

                currentConfig.deadlineTypes.forEach((item, index) => {
                    // Migration: If item is string, convert to object
                    if (typeof item === 'string') {
                        item = { name: item, period: 14, freq: 7 };
                        currentConfig.deadlineTypes[index] = item; // Update in memory
                    }
                    const name = item.name || '';
                    const period = item.period || 14;
                    const freq = item.freq || 7;

                    const tr = document.createElement('tr');
                    tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
                    tr.innerHTML = `
                         <td class="px-4 py-3 font-medium text-gray-300">${name}</td>
                        <td class="px-2 py-3 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">Preavviso</span>
                                <span class="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] border border-blue-500/20">${period}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-3 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">Replica</span>
                                <span class="font-bold text-gray-300 bg-white/5 px-2 py-0.5 rounded text-[10px] border border-white/10">${freq}gg</span>
                            </div>
                        </td>
                        <td class="px-2 py-3 text-right">
                             <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-blue-500 transition-colors"
                                    onclick="window.editType(${index})">
                                    <span class="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
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
        log("Render complete.");
    } catch (e) {
        log("Render Error: " + e.message);
    }
};

window.editType = async (index) => {
    const item = currentConfig.deadlineTypes[index];
    // Simple Prompt-based editing (for now, or usage of a small modal inside here?)
    // User asked for "implementare la tabella oggetto email col frequenza e il periodo".
    // 3 prompts or 1 custom logic? Custom logic is cleaner but prompt is faster to implement.
    // Let's use prompts for stability in this step.

    const newName = prompt("Modifica Nome Oggetto:", item.name);
    if (newName === null) return;

    // Validate numbers
    let newPeriod = prompt("Giorni di Periodo (Preavviso):", item.period);
    if (newPeriod === null) return;

    let newFreq = prompt("Giorni di Frequenza:", item.freq);
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
    const name = prompt("Nuovo Oggetto Email:");
    if (!name) return;

    const period = prompt("Periodo (Preavviso gg) - Default 14:", "14");
    if (period === null) return;

    const freq = prompt("Frequenza (gg) - Default 7:", "7");
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
        log("Saving to Firestore (User-Specific)...");
        const docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfig");
        await setDoc(docRef, newConfig);
        currentConfig = JSON.parse(JSON.stringify(newConfig));
        log("Saved successfully.");
    } catch (e) {
        log("Firestore Save ERROR: " + e.message);
        alert("Errore Firestore: " + e.message);
    }
};

window.loadConfig = async () => {
    if (!currentUser) return;
    try {
        log("Loading config from Firestore...");
        // Prova percorso utente
        let docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfig");
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            log("Config found in Cloud.");

            // Merge logic (Schema Migration)
            let dirty = false;
            if (!cloudData.deadlineTypes) { cloudData.deadlineTypes = DEFAULT_CONFIG.deadlineTypes; dirty = true; }
            if (!cloudData.models) { cloudData.models = DEFAULT_CONFIG.models; dirty = true; }
            if (!cloudData.emailTemplates) { cloudData.emailTemplates = DEFAULT_CONFIG.emailTemplates; dirty = true; }
            if (cloudData.plates) { delete cloudData.plates; dirty = true; }

            currentConfig = cloudData;
            if (dirty) {
                log("Data missing some fields, updating User-Specific Cloud...");
                await window.saveConfig(currentConfig);
            }
        } else {
            log("No config found in Cloud at all. Initializing with defaults...");
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
    const newValue = prompt("Modifica voce:", currentValue);

    if (newValue === null) return; //Annullato
    if (!newValue.trim()) return;

    currentConfig[listKey][index] = newValue.trim();
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.deleteItem = async (listKey, index) => {
    if (!confirm("Eliminare voce?")) return;
    currentConfig[listKey].splice(index, 1);
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.resetToDefaults = async () => {
    if (!confirm("Ripristinare tutti i valori originali?")) return;
    log("Resetting to defaults...");
    currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    window.renderAllTables();
    await window.saveConfig(currentConfig);
    alert("Valori ripristinati correttamente.");
};

// --- INITIALIZATION ---

try {
    log("Running Initial Render...");
    window.renderAllTables();

    log("Setting up Auth Listener...");
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            log("Auth: User active (" + user.uid + ")");
            currentUser = user;
            await window.loadConfig();
        } else {
            log("Auth: No user found.");
        }
    });
} catch (e) {
    log("Initialization CRASH: " + e.message);
}

log("Script Initialization Completed.");
