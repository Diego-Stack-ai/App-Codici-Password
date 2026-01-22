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
console.log("aggiungi_scadenza.js: Inizio caricamento modulo...");

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
    const vehicleLabel = document.querySelector('#vehicle_fields_wrapper span.text-slate-600');
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

// --- FUNZIONI DI POPOLAMENTO ---

/**
 * Popola il menu "Oggetto Email" (tipo scadenza)
 */
function populateTypeSelect() {
    if (!typeSelect) return;
    console.log("Popolamento Unificato Oggetto Email...");
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
    console.log("Popolamento Email Select:", select.id);
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
    console.log("Aggiornamento Opzioni Dinamiche. Regola:", rule ? "Selezionata" : "Nessuna (Fallback Statico)");
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
    console.log("Esecuzione Caricamento Statico (Fallback/Default)...");
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
        console.log("Caricamento unificato configurazioni...");

        // Caricamento parallelo delle tre fonti
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
    const vehicleLabel = document.querySelector('#vehicle_fields_wrapper span.text-slate-600');
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
        alert("Attenzione: Hai già selezionato questa email come Primaria.");
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
            alert("Compila tutti i campi obbligatori!");
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
            console.log("Aggiornamento scadenza esistente...");
            const docRef = doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId);
            await updateDoc(docRef, data);

            // In Edit Mode, we just go back usually, or show toast. 
            // Let's use standard alert for Edit for now as requested flow was about "New".
            alert("Scadenza aggiornata!");
            window.location.href = 'scadenze.html';
        } else {
            console.log("Creazione nuova scadenza...");
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "scadenze"), data);

            // Show Custom Success Modal
            showSuccessModal(docRef.id);
        }

    } catch (error) {
        console.error(error);
        alert("Errore salvataggio: " + error.message);
        saveButton.disabled = false;
        saveButton.innerHTML = originalBtnContent;
    }
});

function showSuccessModal(newId) {
    const modal = document.getElementById('success-modal');
    const btnAttach = document.getElementById('btn-success-attachments');
    const btnHome = document.getElementById('btn-success-home');

    if (modal) {
        modal.classList.remove('hidden');

        // Setup Navigation
        if (btnAttach) {
            btnAttach.onclick = () => {
                // Navigate DIRECTLY to attachments page
                window.location.href = `gestione_allegati.html?id=${newId}&context=scadenza&ownerId=${currentUser.uid}`;
            };
        }

        if (btnHome) {
            btnHome.onclick = () => {
                window.location.href = 'scadenze.html';
            };
        }
    } else {
        // Fallback if modal missing
        if (confirm("Scadenza salvata! Vuoi aggiungere allegati?")) {
            window.location.href = `aggiungi_scadenza.html?id=${newId}`;
        } else {
            window.location.href = 'scadenze.html';
        }
    }
}

// GESTIONE ISTRUZIONI
// GESTIONE ISTRUZIONI CON ANIMAZIONI
window.showInstructions = () => {
    const el = document.getElementById('instructionsModal');
    if (el) {
        el.classList.remove('hidden');
        // Doppi RAF per garantire che il browser registri il cambio di display prima della transizione
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.remove('opacity-0');
                const inner = el.querySelector('div');
                if (inner) {
                    inner.classList.remove('scale-95');
                    inner.classList.add('scale-100');
                }
            });
        });
    }
};

window.closeInstructions = () => {
    const el = document.getElementById('instructionsModal');
    if (el) {
        el.classList.add('opacity-0');
        const inner = el.querySelector('div');
        if (inner) {
            inner.classList.add('scale-95');
            inner.classList.remove('scale-100');
        }
        setTimeout(() => {
            el.classList.add('hidden');
        }, 300);
        localStorage.setItem('instructionsShown', 'true');
    }
};

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
