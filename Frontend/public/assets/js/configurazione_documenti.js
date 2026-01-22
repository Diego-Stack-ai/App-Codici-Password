
// configurazione_documenti.js v1.0

function log(msg) {
    console.log("[Config Doc] " + msg);
}

log("Script Loading Started...");

import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

log("Imports Successful.");

// --- CONFIGURATION ---
// Usiamo un documento diverso per non sovrascrivere la configurazione automezzi
const CONFIG_DOC_PATH = "settings/deadlineConfigDocuments";

const DEFAULT_CONFIG = {
    deadlineTypes: [], // Oggetti Documento
    models: [],       // Intestatari/Dettagli
    emailTemplates: [] // Testi Email
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

        const safeListKey = listKey.replace(/'/g, "\\'");

        tr.innerHTML = `
            <td class="px-4 py-3 flex justify-between items-center text-gray-300">
                <span class="font-medium">${item}</span>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button class="size-8 flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-amber-500 transition-colors"
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

        const tbodyTypes = document.getElementById('tbody_types');
        if (tbodyTypes) {
            tbodyTypes.innerHTML = '';
            if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
                tbodyTypes.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-gray-500 italic text-center text-xs">Nessun dato configurato</td></tr>';
            } else {
                currentConfig.deadlineTypes.forEach((item, index) => {
                    if (typeof item === 'string') {
                        item = { name: item, period: 30, freq: 7 };
                        currentConfig.deadlineTypes[index] = item;
                    }
                    const name = item.name || '';
                    const period = item.period || 30;
                    const freq = item.freq || 7;

                    const tr = document.createElement('tr');
                    tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
                    tr.innerHTML = `
                        <td class="px-4 py-3 font-medium text-gray-300">${name}</td>
                        <td class="px-2 py-3 text-center">
                            <div class="inline-flex flex-col items-center gap-1">
                                <span class="text-[9px] text-gray-500 uppercase tracking-widest">Preavviso</span>
                                <span class="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] border border-amber-500/20">${period}gg</span>
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
                                <button class="size-8 flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-amber-500 transition-colors"
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

    const newName = prompt("Modifica Nome Documento:", item.name);
    if (newName === null) return;

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
    const name = prompt("Nuovo Tipo Documento (es. Passaporto):");
    if (!name) return;

    const period = prompt("Periodo (Preavviso gg) - Default 30:", "30");
    if (period === null) return;

    const freq = prompt("Frequenza (gg) - Default 7:", "7");
    if (freq === null) return;

    if (!currentConfig.deadlineTypes) currentConfig.deadlineTypes = [];
    currentConfig.deadlineTypes.push({
        name: name.trim(),
        period: parseInt(period) || 30,
        freq: parseInt(freq) || 7
    });

    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.addDocumentDetail = async () => {
    // 1. Numero Documento
    const numeroInput = prompt("Inserisci il Numero del Documento (es. AH12345):");
    if (!numeroInput || !numeroInput.trim()) return;
    const numero = numeroInput.trim().toUpperCase();

    // 2. Tipo Documento (Selezionabile)
    const tipoScelto = prompt("Seleziona Tipo Documento:\n1. Patente\n2. Carta Identità\n3. Altro (inserimento manuale)");
    let tipoStr = "";
    if (tipoScelto === "1") tipoStr = "Patente";
    else if (tipoScelto === "2") tipoStr = "Carta Identità";
    else if (tipoScelto === "3") tipoStr = prompt("Inserisci Tipo Documento manualmente:") || "Documento";
    else return; // Annullato o scelta non valida

    // 3. Proprietario (Selezionabile)
    const proprietarioScelto = prompt("Seleziona Proprietario:\n1. Boschetto Diego\n2. Graziano Ester\n3. Altro (inserimento manuale)");
    let proprietarioStr = "";
    if (proprietarioScelto === "1") proprietarioStr = "Boschetto Diego";
    else if (proprietarioScelto === "2") proprietarioStr = "Graziano Ester";
    else if (proprietarioScelto === "3") proprietarioStr = prompt("Inserisci Proprietario manualmente:") || "Privato";
    else return; // Annullato o scelta non valida

    const finalModel = `${numero} - ${tipoStr} - ${proprietarioStr}`;

    if (!currentConfig.models) currentConfig.models = [];
    currentConfig.models.push(finalModel);

    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.saveConfig = async (newConfig) => {
    if (!currentUser) return;
    try {
        log("Saving to Firestore (Documents)...");
        const docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments");
        await setDoc(docRef, newConfig);
        currentConfig = JSON.parse(JSON.stringify(newConfig));
        log("Saved successfully.");
    } catch (e) {
        log("Firestore Save ERROR: " + e.message);
    }
};

window.loadConfig = async () => {
    if (!currentUser) return;
    try {
        log("Loading config from Firestore...");
        let docRef = doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments");
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentConfig = docSnap.data();
            log("Config found in Cloud.");
        } else {
            log("No config found. Initializing with defaults...");
            currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }

        // --- PRE-POPULATE IF EMPTY ---
        const initialTypes = [
            "la tua patente",
            "Il tuo documento di Identità",
            "Il tuo passaporto",
            "Il tuo codice fiscale"
        ];

        if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
            log("Auto-populating deadlineTypes...");
            currentConfig.deadlineTypes = [
                { name: "la tua patente", period: 30, freq: 7 },
                { name: "Il tuo documento di Identità", period: 30, freq: 7 },
                { name: "Il tuo passaporto", period: 30, freq: 7 },
                { name: "Il tuo codice fiscale", period: 30, freq: 7 }
            ];
            await window.saveConfig(currentConfig);
        }

        // --- PRE-POPULATE EMAIL TEMPLATES IF EMPTY ---
        if (!currentConfig.emailTemplates || currentConfig.emailTemplates.length === 0) {
            log("Auto-populating emailTemplates...");
            currentConfig.emailTemplates = [
                "la tua patente",
                "Il tuo documento di Identità",
                "Il tuo passaporto",
                "Il tuo codice fiscale"
            ];
            await window.saveConfig(currentConfig);
        }

        // --- PRE-POPULATE DOCUMENT DATA IF EMPTY ---

        // --- PRE-POPULATE DOCUMENT DATA IF EMPTY ---
        if (!currentConfig.models || currentConfig.models.length === 0) {
            log("Auto-populating document models...");
            currentConfig.models = [
                "VI5686435H - Patente - Boschetto Diego",
                "CA55677EP - Carta Identità - Boschetto Diego",
                "CA80827BP - Carta Identità - Graziano Ester",
                "U16P52625C - Patente - Graziano Ester"
            ];
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

    if (newValue === null) return;
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

// --- INITIALIZATION ---

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await window.loadConfig();
    }
});
