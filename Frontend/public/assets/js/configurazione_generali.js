import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

let currentConfig = {
    deadlineTypes: [],
    emailTemplates: []
};

const log = (msg) => console.log(`[ConfigGenerali] ${msg}`);

window.toggleSection = (id) => {
    const container = document.getElementById(`container_${id}`);
    const icon = document.getElementById(`icon_${id}`);
    if (!container || !icon) return;

    const isHidden = container.classList.contains('hidden');
    container.classList.toggle('hidden');
    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.loadConfig = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(db, "users", user.uid, "settings", "generalConfig");
        const docSnap = await getDoc(docRef);

        const genConfig = docSnap.exists() ? docSnap.data() : {};

        if (genConfig.deadlineTypes && genConfig.deadlineTypes.length > 0) {
            currentConfig = genConfig;
            log("Config loaded from Firestore");
        } else {
            log("No specific config found or empty, using new defaults");
            currentConfig = {
                deadlineTypes: [
                    { name: "Sale Addolcitore", period: 7, freq: 14 },
                    { name: "Federazione Italiana Vela", period: 7, freq: 70 },
                    { name: "Visita medica", period: 7, freq: 14 },
                    { name: "Tessera isola ecologica", period: 7, freq: 14 }
                ],
                emailTemplates: [
                    "Il sale dell'addolcitore",
                    "E' in scadenza il tuo certificato medico",
                    "E' in scadenza la tua tessera FIV",
                    "Isola ecologica"
                ]
            };
            await window.saveConfig(currentConfig);
        }

        window.renderAllTables();
    } catch (error) {
        console.error("Error loading config:", error);
    }
};

window.saveConfig = async (config) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(db, "users", user.uid, "settings", "generalConfig");
        await setDoc(docRef, config);
        log("Config saved to standardized Firestore path");
    } catch (error) {
        console.error("Error saving config:", error);
    }
};

window.renderAllTables = () => {
    renderTypesTable();
    renderTemplatesTable();
};

function renderTypesTable() {
    const tbody = document.getElementById('tbody_types');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!currentConfig.deadlineTypes || currentConfig.deadlineTypes.length === 0) {
        tbody.innerHTML = `<tr><td class="p-4 text-center text-gray-500 italic text-xs">Nessuna voce configurata</td></tr>`;
        return;
    }

    currentConfig.deadlineTypes.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
        tr.innerHTML = `
            <td class="p-4 font-medium text-gray-300">${item.name}</td>
            <td class="p-4 text-center text-gray-400 text-xs">
                <span class="inline-flex items-center gap-1 bg-black/20 px-2 py-1 rounded border border-white/5">
                    <span class="text-teal-400 font-bold">${item.period}g</span>
                    <span class="text-gray-600">/</span>
                    <span class="text-gray-300 font-bold">${item.freq}g</span>
                </span>
            </td>
            <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onclick="window.editType(${index})" class="size-8 flex items-center justify-center rounded-lg hover:bg-teal-500/20 text-teal-500 transition-colors">
                        <span class="material-symbols-outlined !text-[18px]">edit</span>
                    </button>
                    <button onclick="window.deleteItem('deadlineTypes', ${index})" class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-500 transition-colors">
                        <span class="material-symbols-outlined !text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTemplatesTable() {
    const tbody = document.getElementById('tbody_templates');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!currentConfig.emailTemplates || currentConfig.emailTemplates.length === 0) {
        tbody.innerHTML = `<tr><td class="p-4 text-center text-gray-500 italic text-xs">Nessun testo configurato</td></tr>`;
        return;
    }

    currentConfig.emailTemplates.forEach((text, index) => {
        const tr = document.createElement('tr');
        tr.className = "group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0";
        tr.innerHTML = `
            <td class="p-4 text-gray-400 leading-relaxed text-xs">"${text}"</td>
            <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onclick="window.editTemplate(${index})" class="size-8 flex items-center justify-center rounded-lg hover:bg-teal-500/20 text-teal-500 transition-colors">
                        <span class="material-symbols-outlined !text-[18px]">edit</span>
                    </button>
                    <button onclick="window.deleteItem('emailTemplates', ${index})" class="size-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-500 transition-colors">
                        <span class="material-symbols-outlined !text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.addTypeItem = async () => {
    const name = prompt("Nome Scadenza:");
    if (!name) return;
    const period = parseInt(prompt("Giorni Preavviso:", "30"));
    const freq = parseInt(prompt("Giorni Replica:", "7"));

    if (isNaN(period) || isNaN(freq)) return;

    currentConfig.deadlineTypes.push({ name, period, freq });
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.editType = async (index) => {
    const item = currentConfig.deadlineTypes[index];
    const name = prompt("Modifica Nome:", item.name);
    if (!name) return;
    const period = parseInt(prompt("Modifica Preavviso:", item.period));
    const freq = parseInt(prompt("Modifica Replica:", item.freq));

    if (isNaN(period) || isNaN(freq)) return;

    currentConfig.deadlineTypes[index] = { name, period, freq };
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.editTemplate = async (index) => {
    const currentText = currentConfig.emailTemplates[index];
    const newText = prompt("Modifica Testo Email:", currentText);

    if (newText === null || !newText.trim()) return;

    currentConfig.emailTemplates[index] = newText.trim();
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.addItem = async (key, promptMsg) => {
    const val = prompt(promptMsg);
    if (!val || !val.trim()) return;

    if (!currentConfig[key]) currentConfig[key] = [];
    currentConfig[key].push(val.trim());

    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.deleteItem = async (key, index) => {
    if (!confirm("Sei sicuro di voler eliminare questa voce?")) return;
    currentConfig[key].splice(index, 1);
    window.renderAllTables();
    await window.saveConfig(currentConfig);
};

window.resetDefaults = async () => {
    if (!confirm("Vuoi ripristinare i dati di default (Sale, FIV, ecc.)? Questa azione eliminerà le tue modifiche attuali.")) return;

    currentConfig = {
        deadlineTypes: [
            { name: "Sale Addolcitore", period: 7, freq: 14 },
            { name: "Federazione Italiana Vela", period: 7, freq: 70 },
            { name: "Visita medica", period: 7, freq: 14 },
            { name: "Tessera isola ecologica", period: 7, freq: 14 }
        ],
        emailTemplates: [
            "Il sale dell'addolcitore",
            "E' in scadenza il tuo certificato medico",
            "E' in scadenza la tua tessera FIV",
            "Isola ecologica"
        ]
    };

    window.renderAllTables();
    await window.saveConfig(currentConfig);
    alert("Dati ripristinati correttamente!");
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.loadConfig();
    } else {
        window.location.href = 'index.html';
    }
});
