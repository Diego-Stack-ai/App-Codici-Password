/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth } from '../../firebase-config.js';
import { collection, addDoc, Timestamp, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { EMAILS, buildEmailSubject } from './scadenza_templates.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
const typeSelect = document.getElementById('tipo_scadenza');
const emailSubjectInput = document.getElementById('oggetto_email');
const notifDaysInput = document.getElementById('notif_days_before');
const notifFreqInput = document.getElementById('notif_frequency');
const emailPrimariaSelect = document.getElementById('email_primaria_select');
const emailSecondariaSelect = document.getElementById('email_secondaria_select');

let currentUser = null;
let currentRule = null;
let currentMode = 'automezzi';
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');

let dynamicConfig = {
    deadlineTypes: [],
    models: [],
    plates: [],
    emailTemplates: [],
    names: []
};
let unifiedConfigs = {
    automezzi: null,
    documenti: null,
    generali: null
};

document.addEventListener('DOMContentLoaded', () => {
    // Mode Switching Listeners
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
    });

    // Toggle Manual Email Inputs
    setupEmailToggle(emailPrimariaSelect, 'email_primaria_input');
    setupEmailToggle(emailSecondariaSelect, 'email_secondaria_input');

    // Email Exclusion logic
    emailPrimariaSelect?.addEventListener('change', updateEmailExclusion);
    emailSecondariaSelect?.addEventListener('change', updateEmailExclusion);

    // Preview Updates
    ['dueDate', 'tipo_scadenza', 'modello_veicolo', 'testo_email_select'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updatePreview);
    });

    // Footer Save Button Injection
    const interval = setInterval(() => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            clearInterval(interval);
            const saveBtn = createElement('button', {
                id: 'save-btn',
                className: 'base-btn-primary flex-center-gap',
                title: 'Salva Scadenza'
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
                createElement('span', { dataset: { t: 'save_deadline' }, textContent: 'Salva' })
            ]);

            clearElement(footerRight);
            setChildren(footerRight, saveBtn);
            setupSaveLogic();
        }
    }, 100);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadDynamicConfig();
            updateAttachmentsUI();

            if (editingScadenzaId) {
                await loadScadenzaForEdit(editingScadenzaId);
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    initialStaticLoad();
});

function setMode(mode) {
    currentMode = mode;
    updateUIButtons(mode);

    // Update labels and visibility
    const vehicleSection = document.getElementById('vehicle_fields_wrapper');
    const vehicleLabel = vehicleSection?.querySelector('.view-label');
    const vehicleIcon = document.getElementById('vehicle-icon');

    if (mode === 'automezzi') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) vehicleLabel.textContent = "Dettaglio Veicolo";
        if (vehicleIcon) vehicleIcon.textContent = 'directions_car';
    } else if (mode === 'documenti') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) vehicleLabel.textContent = "Intestatario / Dettagli";
        if (vehicleIcon) vehicleIcon.textContent = 'badge';
    } else if (mode === 'generali') {
        vehicleSection?.classList.add('hidden');
    }

    updateCurrentDynamicConfig();
    finishLoad();
}

function updateUIButtons(activeMode) {
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            if (mode === activeMode) {
                btn.classList.add('bg-white/20', 'text-white');
                btn.classList.remove('opacity-50');
            } else {
                btn.classList.remove('bg-white/20', 'text-white');
                btn.classList.add('opacity-50');
            }
        }
    });
}

function initialStaticLoad() {
    populateTypeSelect();
    populateEmailSelect(emailPrimariaSelect);
    populateEmailSelect(emailSecondariaSelect);
    updateDynamicOptions(null);
}

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

        updateCurrentDynamicConfig();
        finishLoad();
    } catch (e) {
        console.error("Config Load Error", e);
    }
}

function updateCurrentDynamicConfig() {
    if (currentMode === 'automezzi') dynamicConfig = unifiedConfigs.automezzi;
    else if (currentMode === 'documenti') dynamicConfig = unifiedConfigs.documenti;
    else if (currentMode === 'generali') dynamicConfig = unifiedConfigs.generali;

    const allNames = new Set([
        ...(unifiedConfigs.automezzi?.names || []),
        ...(unifiedConfigs.documenti?.names || []),
        ...(unifiedConfigs.generali?.names || [])
    ]);
    dynamicConfig.names = [...allNames].sort();
}

function finishLoad() {
    populateTypeSelect();
    updateDynamicOptions(currentRule);

    const namesList = document.getElementById('names-list');
    if (namesList && dynamicConfig.names) {
        clearElement(namesList);
        dynamicConfig.names.forEach(n => {
            namesList.appendChild(new Option(n, n));
        });
    }
}

function populateTypeSelect() {
    if (!typeSelect) return;
    const currentVal = typeSelect.value;
    clearElement(typeSelect);
    typeSelect.appendChild(new Option('Scegli categoria...', ''));

    const addGroup = (label, items) => {
        if (!items || items.length === 0) return;
        const group = createElement('optgroup', { label });
        items.forEach(item => {
            const key = (typeof item === 'object') ? item.name : item;
            group.appendChild(new Option(key, key));
        });
        typeSelect.appendChild(group);
    };

    addGroup("AUTOMEZZI", unifiedConfigs.automezzi?.deadlineTypes);
    addGroup("DOCUMENTI", unifiedConfigs.documenti?.deadlineTypes);
    addGroup("GENERALI", unifiedConfigs.generali?.deadlineTypes);

    if (currentVal) typeSelect.value = currentVal;
}

function populateEmailSelect(select) {
    if (!select) return;
    const currentVal = select.value;
    clearElement(select);
    select.appendChild(new Option('Seleziona...', ''));

    EMAILS?.forEach(email => {
        select.appendChild(new Option(email, email));
    });

    select.appendChild(new Option('Scrivi Nuova...', 'manual'));

    if (currentVal) select.value = currentVal;
}

function updateDynamicOptions(rule) {
    const modelSel = document.getElementById('modello_veicolo');
    const textSel = document.getElementById('testo_email_select');

    if (!modelSel || !textSel) return;

    if (currentMode !== 'generali') {
        document.getElementById('vehicle_fields_wrapper')?.classList.remove('hidden');
        populateSimpleSelect(modelSel, dynamicConfig.models || []);
    }

    if (dynamicConfig.emailTemplates?.length > 0 || rule?.emailTextOptions?.length > 0) {
        document.getElementById('testo_email_wrapper')?.classList.remove('hidden');
        const combined = [...new Set([...(dynamicConfig.emailTemplates || []), ...(rule?.emailTextOptions || [])])];
        populateSimpleSelect(textSel, combined);
    } else {
        document.getElementById('testo_email_wrapper')?.classList.add('hidden');
    }
}

function populateSimpleSelect(select, options) {
    const currentVal = select.value;
    clearElement(select);
    select.appendChild(new Option('Seleziona...', ''));
    options.forEach(opt => {
        select.appendChild(new Option(opt, opt));
    });
    if (currentVal && options.includes(currentVal)) select.value = currentVal;
}

function setupEmailToggle(select, inputId) {
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    select.addEventListener('change', () => {
        if (select.value === 'manual') {
            select.parentElement.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
        }
    });
    input.addEventListener('blur', () => {
        if (!input.value.trim()) {
            input.classList.add('hidden');
            select.parentElement.classList.remove('hidden');
            select.value = '';
        }
    });
}

function updateEmailExclusion() {
    const val1 = emailPrimariaSelect.value;
    const val2 = emailSecondariaSelect.value;
    if (val1 && val2 && val1 === val2 && val1 !== "manual") {
        emailSecondariaSelect.value = "";
        showToast("Email già selezionata come primaria", "error");
    }
}

function updatePreview() {
    const objectName = typeSelect.value;
    const detail = document.getElementById('modello_veicolo')?.value || '';
    emailSubjectInput.value = buildEmailSubject(objectName, detail);
}

function updateAttachmentsUI() {
    const placeholder = document.getElementById('attachments-placeholder-new');
    const linkDiv = document.getElementById('attachments-link-edit');
    const btnManage = document.getElementById('btn-manage-attachments');

    if (editingScadenzaId) {
        placeholder?.classList.add('hidden');
        linkDiv?.classList.remove('hidden');
        if (btnManage) {
            btnManage.href = `gestione_allegati.html?id=${editingScadenzaId}&context=scadenza&ownerId=${currentUser.uid}`;
        }
    } else {
        placeholder?.classList.remove('hidden');
        linkDiv?.classList.add('hidden');
    }
}

function setupSaveLogic() {
    const btnSave = document.getElementById('save-btn');
    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
        if (!auth.currentUser) return;

        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const date = document.getElementById('dueDate').value;
        const email1 = (emailPrimariaSelect.value === 'manual') ? document.getElementById('email_primaria_input').value.trim() : emailPrimariaSelect.value;
        const email2 = (emailSecondariaSelect.value === 'manual') ? document.getElementById('email_secondaria_input').value.trim() : emailSecondariaSelect.value;

        if (!name || !type || !date || !email1) {
            return showToast("Compila i campi obbligatori", "error");
        }

        const data = {
            uid: currentUser.uid,
            type,
            veicolo_modello: document.getElementById('modello_veicolo')?.value || '',
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

        try {
            btnSave.disabled = true;
            const originalContent = Array.from(btnSave.childNodes).map(n => n.cloneNode(true));
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined animate-spin mr-2', textContent: 'progress_activity' }),
                createElement('span', { dataset: { t: 'saving' }, textContent: 'Salvataggio...' })
            ]);

            if (editingScadenzaId) {
                await updateDoc(doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId), data);
                showToast("Aggiornato!", "success");
                setTimeout(() => window.location.href = 'scadenze.html', 1000);
            } else {
                const docRef = await addDoc(collection(db, "users", currentUser.uid, "scadenze"), data);
                showSuccessModal(docRef.id);
            }
        } catch (e) {
            console.error(e);
            showToast("Errore: " + e.message, "error");
            btnSave.disabled = false;
            // Restore button content
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
                createElement('span', { dataset: { t: 'save_deadline' }, textContent: 'Salva' })
            ]);
        }
    });
}

async function showSuccessModal(newId) {
    if (window.showConfirmModal) {
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
    } else {
        window.location.href = 'scadenze.html';
    }
}

async function loadScadenzaForEdit(id) {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid, "scadenze", id));
        if (!snap.exists()) return;

        const data = snap.data();
        document.getElementById('nome_cognome').value = data.name || '';
        document.getElementById('dueDate').value = data.dueDate || '';
        document.getElementById('notes').value = data.notes || '';
        document.getElementById('whatsapp_enable').checked = data.whatsappEnabled || false;

        typeSelect.value = data.type || '';

        // Auto-switch mode based on type
        let foundMode = 'automezzi';
        if (unifiedConfigs.documenti?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'documenti';
        else if (unifiedConfigs.generali?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'generali';
        setMode(foundMode);

        setTimeout(() => {
            const modelSel = document.getElementById('modello_veicolo');
            if (modelSel) modelSel.value = data.veicolo_modello || '';

            const textSel = document.getElementById('testo_email_select');
            if (textSel) textSel.value = data.email_testo_selezionato || '';

            if (data.emails?.[0]) emailPrimariaSelect.value = data.emails[0];
            if (data.emails?.[1]) emailSecondariaSelect.value = data.emails[1];

            updatePreview();
        }, 300);

    } catch (e) {
        console.error("Edit load error", e);
    }
}

