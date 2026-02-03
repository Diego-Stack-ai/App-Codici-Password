import { db, auth, storage } from './firebase-config.js';
import { collection, addDoc, Timestamp, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import {
    EMAILS,
    VEHICLES,
    DEADLINE_RULES,
    buildEmailBody,
    buildEmailSubject
} from './scadenza_templates.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
// Referenze DOM globali
const typeSelect = document.getElementById('tipo_scadenza');
const emailSubjectInput = document.getElementById('oggetto_email');
const saveButton = document.getElementById('save-button');
const notifDaysInput = document.getElementById('notif_days_before');
const notifFreqInput = document.getElementById('notif_frequency');
const emailPrimariaSelect = document.getElementById('email_primaria_select');
const emailSecondariaSelect = document.getElementById('email_secondaria_select');
const vehicle_fields_wrapper = document.getElementById('vehicle_fields_wrapper');
const testo_email_wrapper = document.getElementById('testo_email_wrapper');
const fileInput = document.getElementById('file-input');
const attachmentsList = document.getElementById('attachments-list');

// Accordion logic (Protocol V3.0 compliance)
function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', () => {
            const targetId = acc.dataset.target;
            const content = document.getElementById(targetId);
            const chevron = acc.querySelector('.settings-chevron');
            if (!content) return;

            const isVisible = content.classList.contains('show');

            if (isVisible) {
                content.classList.remove('show');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            } else {
                content.classList.add('show');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            }
        });
    });
}

let currentUser = null;
let currentRule = null;
let userHasConfig = false;
let currentMode = 'automezzi'; // 'automezzi' or 'documenti'
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');
let dynamicConfig = {
    deadlineTypes: [],
    models: [],
    plates: [],
    emailTemplates: [],
    names: []
};
// Oggetto per contenere tutte le config separate
let unifiedConfigs = {
    automezzi: null,
    documenti: null,
    generali: null
};

// --- MODE SWITCHING ---
window.setMode = (mode) => {
    currentMode = mode;
    const btnAuto = document.getElementById('mode-automezzi');
    const btnDoc = document.getElementById('mode-documenti');
    const btnGen = document.getElementById('mode-generali');
    const vehicleLabel = document.querySelector('#vehicle_fields_wrapper .settings-label');
    const vehicleIcon = document.querySelector('#vehicle_fields_wrapper .material-symbols-outlined');

    // Reset styles
    [btnAuto, btnDoc, btnGen].forEach(btn => {
        if (btn) btn.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-700";
    });

    // UI Update logic
    if (mode === 'automezzi') {
        if (btnAuto) btnAuto.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        if (vehicleLabel) vehicleLabel.innerHTML = 'Modello Veicolo <span class="text-red-500">*</span>';
        if (vehicleIcon) vehicleIcon.textContent = 'directions_car';
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.remove('hidden');
    } else if (mode === 'documenti') {
        if (btnDoc) btnDoc.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        if (vehicleLabel) vehicleLabel.innerHTML = 'Intestatario / Dettagli <span class="text-red-500">*</span>';
        if (vehicleIcon) vehicleIcon.textContent = 'badge';
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.remove('hidden');
    } else if (mode === 'generali') {
        if (btnGen) btnGen.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        // Per le scadenze generali nascondiamo il campo veicolo/dettagli extra se non necessario
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.add('hidden');
    }

    // Reload Config
    loadDynamicConfig();
};

// Stato Allegati
let selectedFiles = []; // Nuovi file da caricare
let existingAttachments = []; // Allegati già salvati (in caso di edit)

// --- FUNZIONI GESTIONE ALLEGATI INLINE ---

/**
 * Gestisce la selezione di file (camera o libreria)
 */
function handleFileSelection(input) {
    if (!input.files || input.files.length === 0) return;

    // Aggiungi i nuovi file all'array
    Array.from(input.files).forEach(file => {
        selectedFiles.push(file);
    });

    // Aggiorna UI
    renderAttachmentsList();
    updateAttachmentsCount();

    // Reset input
    input.value = '';
}

/**
 * Renderizza la lista degli allegati
 */
function renderAttachmentsList() {
    const list = document.getElementById('attachments-list');
    if (!list) return;

    list.innerHTML = '';

    if (selectedFiles.length === 0 && existingAttachments.length === 0) {
        list.innerHTML = `<p style="text-align: center; opacity: 0.3; font-size: 0.8rem; padding: 1rem;" data-t="no_attachments">Nessun allegato aggiunto</p>`;
        return;
    }

    // Mostra file nuovi (non ancora caricati)
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 8px;";
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span class="material-symbols-outlined" style="font-size: 16px; opacity: 0.7;">${file.type.startsWith('image/') ? 'image' : 'description'}</span>
                <span style="color: var(--text-primary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${file.name}</span>
                <span style="font-size: 0.7rem; opacity: 0.5;">(${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button onclick="removeAttachment(${index}, 'new')" style="background: none; border: none; color: rgba(255,50,50,0.8); cursor: pointer; padding: 2px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
            </button>
        `;
        list.appendChild(div);
    });

    // Mostra allegati esistenti (già caricati)
    existingAttachments.forEach((att, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: rgba(34,211,238,0.1); padding: 0.5rem; border-radius: 8px;";
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span class="material-symbols-outlined" style="font-size: 16px; color: #22d3ee;">check_circle</span>
                <a href="${att.url}" target="_blank" style="color: #22d3ee; text-decoration: underline; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${att.name}</a>
            </div>
            <button onclick="removeAttachment(${index}, 'existing')" style="background: none; border: none; color: rgba(255,50,50,0.8); cursor: pointer; padding: 2px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
            </button>
        `;
        list.appendChild(div);
    });
}

/**
 * Rimuove un allegato
 */
window.removeAttachment = (index, type) => {
    if (type === 'new') {
        selectedFiles.splice(index, 1);
    } else {
        existingAttachments.splice(index, 1);
    }
    renderAttachmentsList();
    updateAttachmentsCount();
};

/**
 * Aggiorna il contatore allegati
 */
function updateAttachmentsCount() {
    const counter = document.getElementById('attachments-count');
    if (counter) {
        const total = selectedFiles.length + existingAttachments.length;
        counter.textContent = total;
        counter.style.display = total > 0 ? 'inline' : 'none';
    }
}

// Event listeners per input file
document.addEventListener('DOMContentLoaded', () => {
    const cameraInput = document.getElementById('camera-input');
    const fileInput = document.getElementById('file-input');

    if (cameraInput) {
        cameraInput.addEventListener('change', (e) => handleFileSelection(e.target));
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFileSelection(e.target));
    }
});


// --- FUNZIONI DI POPOLAMENTO ---

/**
 * Popola il menu "Oggetto Email" (tipo scadenza)
 */
function populateTypeSelect() {
    if (!typeSelect) return;
    const currentVal = typeSelect.value;
    typeSelect.innerHTML = '<option value="">Seleziona Oggetto...</option>';

    // 1. Gruppo Automezzi
    if (unifiedConfigs.automezzi && unifiedConfigs.automezzi.deadlineTypes) {
        const group = document.createElement('optgroup');
        group.label = "AUTOMEZZI";
        unifiedConfigs.automezzi.deadlineTypes.forEach(t => group.appendChild(createOption(t)));
        typeSelect.appendChild(group);
    }

    // 2. Gruppo Documenti
    if (unifiedConfigs.documenti && unifiedConfigs.documenti.deadlineTypes) {
        const group = document.createElement('optgroup');
        group.label = "DOCUMENTI PERSONALI";
        unifiedConfigs.documenti.deadlineTypes.forEach(t => group.appendChild(createOption(t)));
        typeSelect.appendChild(group);
    }

    // 3. Gruppo Generali
    if (unifiedConfigs.generali && unifiedConfigs.generali.deadlineTypes) {
        const group = document.createElement('optgroup');
        group.label = "GENERALI";
        unifiedConfigs.generali.deadlineTypes.forEach(t => group.appendChild(createOption(t)));
        typeSelect.appendChild(group);
    }

    function createOption(item) {
        const key = (typeof item === 'object') ? item.name : item;
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        return option;
    }

    if (currentVal) typeSelect.value = currentVal;
}

/**
 * Popola i menu delle Email
 */
function populateEmailSelect(select) {
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Seleziona Email...</option>';

    if (EMAILS && Array.isArray(EMAILS)) {
        EMAILS.forEach(email => {
            const option = document.createElement('option');
            option.value = email;
            option.textContent = email;
            select.appendChild(option);
        });
    }

    const manualOpt = document.createElement('option');
    manualOpt.value = "manual";
    manualOpt.textContent = "Scrivi Nuova...";
    select.appendChild(manualOpt);

    if (currentVal) select.value = currentVal;
}

/**
 * Popola i menu dinamici (Veicoli e Testi Email) basati sulla regola selezionata
 */
function updateDynamicOptions(rule) {
    const modelSel = document.getElementById('modello_veicolo');
    const textSel = document.getElementById('testo_email_select');

    if (!modelSel || !textSel || !vehicle_fields_wrapper || !testo_email_wrapper) return;

    // A. VEICOLI
    const showVehicle = !rule || rule.hasVehicle;
    if (showVehicle) {
        vehicle_fields_wrapper.classList.remove('hidden');
        // Usare solo modelli da config dinamica, senza fallback statici vuoti
        let modelOptions = (dynamicConfig.models && dynamicConfig.models.length > 0) ? dynamicConfig.models : [];
        populateSimpleSelect(modelSel, modelOptions);
    } else {
        vehicle_fields_wrapper.classList.add('hidden');
        modelSel.value = '';
    }

    // B. TESTI EMAIL
    const hasOptions = rule && rule.emailTextOptions && rule.emailTextOptions.length > 0;
    const hasGlobalPool = dynamicConfig.emailTemplates && dynamicConfig.emailTemplates.length > 0;

    if (hasOptions || hasGlobalPool) {
        testo_email_wrapper.classList.remove('hidden');
        let combinedTemplates = [];
        if (dynamicConfig.emailTemplates) combinedTemplates.push(...dynamicConfig.emailTemplates);
        if (rule && rule.emailTextOptions) combinedTemplates.push(...rule.emailTextOptions);

        populateSimpleSelect(textSel, [...new Set(combinedTemplates)]);
    } else {
        testo_email_wrapper.classList.add('hidden');
        textSel.value = '';
    }
}

function populateSimpleSelect(select, options) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">Seleziona...</option>';
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    if (currentVal && options.includes(currentVal)) select.value = currentVal;
}

// --- LOGICA DI INIZIALIZZAZIONE ---

/**
 * Caricamento Statico Immediato (Base App)
 */
function initialStaticLoad() {
    populateTypeSelect();
    populateEmailSelect(emailPrimariaSelect);
    populateEmailSelect(emailSecondariaSelect);
    updateDynamicOptions(null); // Mostra veicoli di default (statici)
}

/**
 * Caricamento Dinamico da Firebase (Personalizzazioni)
 */
async function loadDynamicConfig() {
    if (!currentUser) return;
    try {
        const [autoSnap, docSnap, genSnap] = await Promise.all([
            getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfig")),
            getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments")),
            getDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig"))
        ]);

        unifiedConfigs.automezzi = autoSnap.exists() ? autoSnap.data() : { deadlineTypes: [], emailTemplates: [], names: [] };
        unifiedConfigs.documenti = docSnap.exists() ? docSnap.data() : { deadlineTypes: [], emailTemplates: [], names: [] };
        unifiedConfigs.generali = genSnap.exists() ? genSnap.data() : { deadlineTypes: [], emailTemplates: [], names: [] };

        // Unificazione Nomi per Autocomplete
        const allNames = new Set([
            ...(unifiedConfigs.automezzi.names || []),
            ...(unifiedConfigs.documenti.names || []),
            ...(unifiedConfigs.generali.names || [])
        ]);
        dynamicConfig.names = [...allNames].sort();

        // Imposta la config corrente basata sulla modalità attiva (di default automezzi o quella rilevata)
        updateCurrentDynamicConfig();

        userHasConfig = true;
        finishLoad();
    } catch (e) {
        console.error("Errore caricamento unificato:", e);
    }
}

function updateCurrentDynamicConfig() {
    if (currentMode === 'automezzi') dynamicConfig = unifiedConfigs.automezzi;
    else if (currentMode === 'documenti') dynamicConfig = unifiedConfigs.documenti;
    else if (currentMode === 'generali') dynamicConfig = unifiedConfigs.generali;

    // Assicuriamoci che names sia sempre quello globale unificato
    const allNames = new Set([
        ...(unifiedConfigs.automezzi?.names || []),
        ...(unifiedConfigs.documenti?.names || []),
        ...(unifiedConfigs.generali?.names || [])
    ]);
    dynamicConfig.names = [...allNames].sort();
}

function finishLoad() {
    // Rinfresca UI con i nuovi dati
    populateTypeSelect();
    populateEmailSelect(emailPrimariaSelect);
    populateEmailSelect(emailSecondariaSelect);
    updateDynamicOptions(currentRule);

    // Autocomplete Nomi
    const namesList = document.getElementById('names-list');
    if (namesList && dynamicConfig.names) {
        namesList.innerHTML = '';
        dynamicConfig.names.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            namesList.appendChild(opt);
        });
    }
}

// Inizializzazione Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        setupAccordions(); // Attiva i pannelli interni
        await loadDynamicConfig();

        // Inizializza UI Allegati (mostra placeholder o link)
        if (typeof updateAttachmentsUI === 'function') updateAttachmentsUI();

        if (editingScadenzaId) {
            await loadScadenzaForEdit(editingScadenzaId);
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Esegui popolamento statico IMMEDIATAMENTE
initialStaticLoad();

// --- EVENT LISTENERS ---

if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (!key) {
            currentRule = null;
            vehicle_fields_wrapper?.classList.add('hidden');
            testo_email_wrapper?.classList.add('hidden');
            return;
        }

        // 1. Determina automaticamente la modalità in base all'oggetto selezionato
        let foundSource = 'automezzi';
        let foundItem = null;

        if (unifiedConfigs.automezzi?.deadlineTypes?.find(t => (t.name || t) === key)) {
            foundSource = 'automezzi';
            foundItem = unifiedConfigs.automezzi.deadlineTypes.find(t => (t.name || t) === key);
        } else if (unifiedConfigs.documenti?.deadlineTypes?.find(t => (t.name || t) === key)) {
            foundSource = 'documenti';
            foundItem = unifiedConfigs.documenti.deadlineTypes.find(t => (t.name || t) === key);
        } else if (unifiedConfigs.generali?.deadlineTypes?.find(t => (t.name || t) === key)) {
            foundSource = 'generali';
            foundItem = unifiedConfigs.generali.deadlineTypes.find(t => (t.name || t) === key);
        }

        // Cambia modalità UI senza ricaricare dal DB
        console.log("Auto-switching to mode:", foundSource);
        currentMode = foundSource;
        updateUIForMode(foundSource);
        updateCurrentDynamicConfig();

        // 2. Trova le regole (preavviso/frequenza)
        let defaults = { freq: 7, period: 14 };
        if (foundItem && typeof foundItem === 'object') {
            defaults.freq = parseInt(foundItem.freq) || 7;
            defaults.period = parseInt(foundItem.period) || 14;
        }

        currentRule = { ...defaults, hasVehicle: foundSource !== 'generali', emailTextOptions: [] };

        notifDaysInput.value = currentRule.period;
        notifFreqInput.value = currentRule.freq;
        updateDynamicOptions(currentRule);
        updatePreview();
    });
}

function updateUIForMode(mode) {
    const btnAuto = document.getElementById('mode-automezzi');
    const btnDoc = document.getElementById('mode-documenti');
    const btnGen = document.getElementById('mode-generali');
    const vehicleLabel = document.querySelector('#vehicle_fields_wrapper .settings-label');
    const vehicleIcon = document.querySelector('#vehicle_fields_wrapper .material-symbols-outlined');

    [btnAuto, btnDoc, btnGen].forEach(btn => {
        if (btn) btn.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-700";
    });

    if (mode === 'automezzi') {
        if (btnAuto) btnAuto.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        if (vehicleLabel) vehicleLabel.innerHTML = 'Modello Veicolo <span class="text-red-500">*</span>';
        if (vehicleIcon) vehicleIcon.textContent = 'directions_car';
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.remove('hidden');
    } else if (mode === 'documenti') {
        if (btnDoc) btnDoc.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        if (vehicleLabel) vehicleLabel.innerHTML = 'Intestatario / Dettagli <span class="text-red-500">*</span>';
        if (vehicleIcon) vehicleIcon.textContent = 'badge';
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.remove('hidden');
    } else if (mode === 'generali') {
        if (btnGen) btnGen.className = "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all bg-white dark:bg-primary shadow-sm text-primary dark:text-white";
        // CRITICO: Nascondiamo completamente il campo per modalità generali
        if (vehicle_fields_wrapper) vehicle_fields_wrapper.classList.add('hidden');
    }
}

// Aggiorna anche la funzione setMode originale per usare la nuova logica UI
window.setMode = (mode) => {
    currentMode = mode;
    updateUIForMode(mode);
    updateCurrentDynamicConfig();
    finishLoad();
};

// Gestione manuale email
function setupEmailToggle(select, inputId) {
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    select.addEventListener('change', () => {
        if (select.value === 'manual') {
            select.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
        }
    });
    input.addEventListener('blur', () => {
        if (input.value.trim() === '' && select.value === 'manual') {
            input.classList.add('hidden');
            select.classList.remove('hidden');
            select.value = '';
        }
    });
}
setupEmailToggle(emailPrimariaSelect, 'email_primaria_input');
setupEmailToggle(emailSecondariaSelect, 'email_secondaria_input');

// Esclusione mutua email
function updateEmailExclusion() {
    const val1 = emailPrimariaSelect.value;
    const val2 = emailSecondariaSelect.value;
    if (val1 && val2 && val1 === val2 && val1 !== "manual" && val1 !== "-") {
        emailSecondariaSelect.value = "";
        if (window.showToast) {
            window.showToast("Attenzione: Hai già selezionato questa email come Primaria.", "error");
        }
    }
}
emailPrimariaSelect?.addEventListener('change', updateEmailExclusion);
emailSecondariaSelect?.addEventListener('change', updateEmailExclusion);

// Preview Logica
function updatePreview() {
    const objectName = typeSelect.value;
    const textSelect = document.getElementById('testo_email_select');
    const detailSelect = document.getElementById('modello_veicolo');
    const dueDateInput = document.getElementById('dueDate');

    const selectedText = textSelect?.value || '';
    const detail = detailSelect?.value || '';

    let dateStr = '...';
    if (dueDateInput?.value) {
        const parts = dueDateInput.value.split('-');
        if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    emailSubjectInput.value = buildEmailSubject(objectName, detail);
    console.log("Email Preview aggiornata");
}

document.getElementById('dueDate')?.addEventListener('change', updatePreview);
document.getElementById('tipo_scadenza')?.addEventListener('change', updatePreview);
document.getElementById('modello_veicolo')?.addEventListener('change', updatePreview);
document.getElementById('testo_email_select')?.addEventListener('change', updatePreview);
document.getElementById('modello_veicolo')?.addEventListener('change', updatePreview);
document.getElementById('testo_email_select')?.addEventListener('change', updatePreview);

// --- GESTIONE ALLEGATI UI ---
function updateAttachmentsUI() {
    const placeholder = document.getElementById('attachments-placeholder-new');
    const linkDiv = document.getElementById('attachments-link-edit');
    const btnManage = document.getElementById('btn-manage-attachments');

    if (editingScadenzaId) {
        // EDIT MODE
        if (placeholder) placeholder.classList.add('hidden');
        if (linkDiv) linkDiv.classList.remove('hidden');

        if (btnManage) {
            // Build Link for gestione_allegati
            // We pass id=SCAD_ID and assume context is standard (not profile)
            // gestione_allegati.js handles logic based on params.
            // If it's a personal deadline (scadenza), it might store in users/uid/accounts/SCAD_ID/attachments ??
            // OR users/uid/scadenze/SCAD_ID/attachments ??
            // Let's standardise on passing 'id' as the SCADENZA ID.
            // And maybe a context param if needed? 
            // gestione_allegati.js logic:
            // if aziendaId -> ...aziende/...
            // else -> ...accounts/currentId... 
            // Wait, scadenze are NOT accounts. 
            // But we can reuse the logic if we treat Scadenza ID as Account ID in the path structure OR update gestione_allegati to handle 'scadenze' context.
            // For now, let's look at how gestione_allegati constructs path:
            // return collection(db, "users", uid, "accounts", currentId, "attachments");

            // IF we want to save scadenze attachments in `users/UID/scadenze/SCAD_ID/attachments`, 
            // we need to pass a context='scadenza' to gestione_allegati.html and update gestione_allegati.js execution.
            // OR we alias it.

            // Let's pass context=scadenza to be safe, and I will update gestione_allegati.js NEXT step if needed.
            // For now, generate the link.
            btnManage.href = `gestione_allegati.html?id=${editingScadenzaId}&context=scadenza&ownerId=${currentUser.uid}`;
        }
    } else {
        // CREATE MODE
        if (placeholder) placeholder.classList.remove('hidden');
        if (linkDiv) linkDiv.classList.add('hidden');
    }
}

// SALVATAGGIO
saveButton?.addEventListener('click', async () => {
    if (!currentUser) return;
    saveButton.disabled = true;
    const originalBtnContent = saveButton.innerHTML;
    saveButton.innerHTML = '<span class="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>';

    try {
        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const date = document.getElementById('dueDate').value;
        const email1 = (emailPrimariaSelect.value === 'manual') ? document.getElementById('email_primaria_input').value.trim() : emailPrimariaSelect.value;
        const email2 = (emailSecondariaSelect.value === 'manual') ? document.getElementById('email_secondaria_input').value.trim() : emailSecondariaSelect.value;

        if (!name || !type || !date || !email1) {
            if (window.showToast) {
                window.showToast("Compila tutti i campi obbligatori!", "error");
            }
            saveButton.disabled = false;
            saveButton.innerHTML = originalBtnContent;
            return;
        }

        const vehicleFull = document.getElementById('modello_veicolo')?.value || '';
        let targaPart = '';
        if (vehicleFull.includes(' - ')) {
            targaPart = vehicleFull.split(' - ').slice(-1)[0].trim();
        }

        const data = {
            uid: currentUser.uid,
            type,
            veicolo_modello: vehicleFull,
            veicolo_targa: targaPart,
            email_testo_selezionato: document.getElementById('testo_email_select')?.value || '',
            title: emailSubjectInput.value,
            name,
            dueDate: date,
            notes: document.getElementById('notes').value,
            emails: [email1, email2].filter(e => e && e !== 'manual'),
            whatsappEnabled: document.getElementById('whatsapp_enable').checked,
            notificationDaysBefore: parseInt(notifDaysInput.value),
            notificationFrequency: parseInt(notifFreqInput.value),
            createdAt: Timestamp.now(),
            status: 'active',
            completed: false
        };

        // 3. AGGIORNA AUTOCOMPLETE NOMI
        if (name && dynamicConfig) {
            if (!dynamicConfig.names) dynamicConfig.names = [];
            if (!dynamicConfig.names.includes(name)) {
                dynamicConfig.names.push(name);
                dynamicConfig.names.sort();
                // Salva aggiornamento config in background
                if (currentMode === 'generali') {
                    const configRef = doc(db, "users", currentUser.uid, "settings", "generalConfig");
                    setDoc(configRef, dynamicConfig, { merge: true }).catch(err => console.warn("Errore salvataggio nome:", err));
                } else {
                    const configDoc = currentMode === 'documenti' ? "deadlineConfigDocuments" : "deadlineConfig";
                    const configRef = doc(db, "users", currentUser.uid, "settings", configDoc);
                    setDoc(configRef, dynamicConfig, { merge: true }).catch(err => console.warn("Errore salvataggio nome:", err));
                }
            }
        }

        if (editingScadenzaId) {
            const docRef = doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId);
            await updateDoc(docRef, data);

            // In Edit Mode, we just go back usually, or show toast. 
            if (window.showToast) {
                window.showToast("Scadenza aggiornata!", "success");
            }
            setTimeout(() => {
                window.location.href = 'scadenze.html';
            }, 1000);
        } else {
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "scadenze"), data);

            // Show Custom Success Modal
            showSuccessModal(docRef.id);
        }

    } catch (error) {
        if (window.showToast) {
            window.showToast("Errore salvataggio: " + error.message, "error");
        }
        saveButton.disabled = false;
        saveButton.innerHTML = originalBtnContent;
    }
});

async function showSuccessModal(newId) {
    const confirmed = await window.showConfirmModal(
        "SALVATA!",
        "Vuoi caricare degli allegati per questa scadenza?",
        "SÌ, GESTISCI",
        "NO, LISTA"
    );

    if (confirmed) {
        window.location.href = `gestione_allegati.html?id=${newId}&context=scadenza&ownerId=${currentUser.uid}`;
    } else {
        window.location.href = 'scadenze.html';
    }
}

// GESTIONE ISTRUZIONI (Legacy removed for Internal Pane V3.0)

/**
 * Carica i dati di una scadenza esistente per la modifica
 */
async function loadScadenzaForEdit(scadenzaId) {
    try {
        console.log("Caricamento scadenza per edit:", scadenzaId);
        const docRef = doc(db, "users", currentUser.uid, "scadenze", scadenzaId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            console.warn("Scadenza non trovata in Firebase.");
            return;
        }

        const data = snap.data();

        // Popola i campi base
        const nomeEl = document.getElementById('nome_cognome');
        const dateEl = document.getElementById('dueDate');
        const notesEl = document.getElementById('notes');
        const waEl = document.getElementById('whatsapp_enable');

        if (nomeEl) nomeEl.value = data.name || '';
        if (dateEl) dateEl.value = data.dueDate || '';
        if (notesEl) notesEl.value = data.notes || '';
        if (waEl) waEl.checked = data.whatsappEnabled || false;

        // Titolo (Oggetto Email)
        if (typeSelect) {
            typeSelect.value = data.type || '';
            // Forza il trigger del change per caricare le regole e aggiornare l'anteprima
            typeSelect.dispatchEvent(new Event('change'));
        }

        // Aspetta un istante per il popolamento dinamico prima di impostare i valori dipendenti
        setTimeout(() => {
            const modelSel = document.getElementById('modello_veicolo');
            if (modelSel) modelSel.value = data.veicolo_modello || '';

            const textSel = document.getElementById('testo_email_select');
            if (textSel) textSel.value = data.email_testo_selezionato || '';

            if (emailSubjectInput) emailSubjectInput.value = data.title || '';

            if (data.emails && data.emails.length > 0) {
                if (emailPrimariaSelect) emailPrimariaSelect.value = data.emails[0];
                if (data.emails.length > 1 && emailSecondariaSelect) emailSecondariaSelect.value = data.emails[1];
            }

            // Attachments UI Update
            updateAttachmentsUI();

            if (saveButton) saveButton.title = "Aggiorna Scadenza"; // Update tooltip only, keep icon
            const h1 = document.querySelector('h1');
            if (h1) h1.textContent = "Modifica Scadenza";

            // Trigger preview final check
            if (typeof updatePreview === 'function') updatePreview();
        }, 500);

    } catch (e) {
        console.error("Errore caricamento edit:", e);
    }
}
