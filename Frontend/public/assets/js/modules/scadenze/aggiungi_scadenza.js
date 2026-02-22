/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth, storage } from '../../firebase-config.js';
import { collection, addDoc, Timestamp, doc, getDoc, getDocs, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { EMAILS, buildEmailSubject } from './scadenza_templates.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';

import { t } from '../../translations.js';
import { initDatePickerV5 } from '../../datepicker_v5.js';

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
let selectedFiles = [];
let existingAttachments = [];

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

/**
 * AGGIUNGI SCADENZA MODULE (V5.0 ADAPTER)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * - Entry Point: initAggiungiScadenza(user)
 */

export async function initAggiungiScadenza(user) {
    console.log("[ADD-SCADENZA] Init V5.0...");
    if (!user) return;
    currentUser = user;

    editingScadenzaId = new URLSearchParams(window.location.search).get('id');

    // Mode Switching Listeners
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
    });

    // Custom Datepicker V5.0
    initDatePickerV5('dueDate');

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

    initProxyDropdowns();
    initAttachmentSystem();
    setupNotificationChannels();
    setupMultiSelects();
    await loadPushUsers();

    // --- FOOTER ACTIONS SYSTEM (Home Page Style) ---
    const interval = setInterval(() => {
        const footerCenter = document.getElementById('footer-center-actions');
        const footerRight = document.getElementById('footer-right-actions');

        if (footerCenter && footerRight) {
            clearInterval(interval);

            // 1. Settings Link (Right)
            const settLink = createElement('div', { id: 'footer-settings-link' });
            settLink.appendChild(
                createElement('a', {
                    href: 'impostazioni.html',
                    className: 'btn-icon-header footer-settings-link',
                    title: 'Impostazioni'
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'tune' })
                ])
            );
            clearElement(footerRight);
            footerRight.appendChild(settLink);

            // 2. Main Actions (Center)
            clearElement(footerCenter);

            const cancelBtn = createElement('button', {
                className: 'btn-fab-action btn-fab-neutral',
                title: t('cancel') || 'Annulla',
                dataset: { label: t('cancel_short') || 'Annulla' },
                onclick: () => {
                    if (editingScadenzaId) window.location.href = `dettaglio_scadenza.html?id=${editingScadenzaId}`;
                    else window.location.href = 'scadenze.html';
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })
            ]);

            const saveBtn = createElement('button', {
                id: 'save-btn',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('save') || 'Salva Scadenza',
                dataset: { label: t('save_short') || 'Salva' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
            ]);

            const fabWrapper = createElement('div', {
                className: 'fab-group'
            }, [cancelBtn, saveBtn]);

            footerCenter.appendChild(fabWrapper);
            setupSaveLogic();

            // 3. Animations (Home Page Style)
            [cancelBtn, saveBtn].forEach((btn, index) => {
                btn.animate([
                    { transform: 'scale(0) translateY(20px)', opacity: 0 },
                    { transform: 'scale(1) translateY(0)', opacity: 1 }
                ], {
                    duration: 400,
                    delay: index * 100,
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    fill: 'forwards'
                });
            });
        }
    }, 100);

    // Timeout safety
    setTimeout(() => { if (interval) clearInterval(interval); }, 5000);

    // LIST MANAGEMENT SYSTEM (Dynamic Config)
    document.querySelectorAll('.btn-manage-config-inline').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;
            const newVal = await window.showInputModal(`Aggiungi Nuovo`, '', `Inserisci nuovo valore...`);
            if (newVal && newVal.trim()) {
                await addConfigItem(configId, newVal.trim());
            }
        };
    });

    initialStaticLoad();
    await loadDynamicConfig();
    updateAttachmentsUI();

    if (editingScadenzaId) {
        // UI update immediately
        const pageTitle = document.querySelector('.detail-title-value');
        if (pageTitle) pageTitle.textContent = "Modifica Scadenza";
        await loadScadenzaForEdit(editingScadenzaId);
    }

    console.log("[ADD-SCADENZA] Ready.");
}

function setMode(mode) {
    currentMode = mode;
    updateUIButtons(mode);

    // Update labels and visibility
    const vehicleSection = document.getElementById('vehicle_fields_wrapper');
    const vehicleLabel = vehicleSection?.querySelector('.label-sm');
    const vehicleIcon = document.getElementById('vehicle-icon');

    if (mode === 'automezzi') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) {
            vehicleLabel.textContent = "Dettaglio Veicolo";
            vehicleLabel.setAttribute('data-t', 'vehicle_extra');
        }
        if (vehicleIcon) vehicleIcon.textContent = 'directions_car';
    } else if (mode === 'documenti') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) {
            vehicleLabel.textContent = "Intestatario / Dettagli";
            vehicleLabel.setAttribute('data-t', 'holder_details');
        }
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
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
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

async function addConfigItem(selectId, value) {
    if (!currentUser) return;
    try {
        let field = '';
        let docName = '';

        if (selectId === 'tipo_scadenza') {
            field = 'deadlineTypes';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        } else if (selectId === 'modello_veicolo') {
            field = 'models';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
        } else if (selectId === 'testo_email_select') {
            field = 'emailTemplates';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        }

        if (!docName || !field) return;

        // Update local state
        const configToUpdate = (currentMode === 'automezzi') ? unifiedConfigs.automezzi :
            (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali;

        if (!configToUpdate[field]) configToUpdate[field] = [];
        if (configToUpdate[field].includes(value)) return showToast("Valore già esistente", "info");

        configToUpdate[field].push(value);
        configToUpdate[field].sort();

        // Save to Firestore
        await setDoc(doc(db, "users", currentUser.uid, "settings", docName), configToUpdate, { merge: true });

        showToast("Lista aggiornata!", "success");
        updateCurrentDynamicConfig();
        finishLoad(); // Re-populate and sync
    } catch (e) {
        console.error("Add Config Error", e);
        showToast("Errore durante l'aggiornamento", "error");
    }
}

async function editConfigItem(selectId, oldValue) {
    if (!currentUser) return;
    try {
        const newValue = await window.showInputModal(`Modifica Voce`, oldValue, `Inserisci nuovo valore...`);
        if (!newValue || !newValue.trim() || newValue === oldValue) return;

        let field = '';
        let docName = '';

        if (selectId === 'tipo_scadenza') {
            field = 'deadlineTypes';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        } else if (selectId === 'modello_veicolo') {
            field = 'models';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
        } else if (selectId === 'testo_email_select') {
            field = 'emailTemplates';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        }

        if (!docName || !field) return;

        const configToUpdate = (currentMode === 'automezzi') ? unifiedConfigs.automezzi :
            (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali;

        const idx = configToUpdate[field].indexOf(oldValue);
        if (idx !== -1) {
            configToUpdate[field][idx] = newValue.trim();
            configToUpdate[field].sort();
        }

        await setDoc(doc(db, "users", currentUser.uid, "settings", docName), configToUpdate, { merge: true });

        showToast("Voce modificata!", "success");
        updateCurrentDynamicConfig();
        finishLoad();
    } catch (e) {
        console.error("Edit Config Error", e);
        showToast("Errore durante la modifica", "error");
    }
}

async function deleteConfigItem(selectId, value) {
    const confirm = await showConfirmModal("Elimina Voce", `Sei sicuro di voler eliminare "${value}"? Questa azione non influirà sulle scadenze esistenti, ma la voce non sarà più disponibile per le nuove.`);
    if (!confirm) return;

    try {
        let field = '';
        let docName = '';

        if (selectId === 'tipo_scadenza') {
            field = 'deadlineTypes';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        } else if (selectId === 'modello_veicolo') {
            field = 'models';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
        } else if (selectId === 'testo_email_select') {
            field = 'emailTemplates';
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        }

        if (!docName || !field) return;

        const configToUpdate = (currentMode === 'automezzi') ? unifiedConfigs.automezzi :
            (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali;

        configToUpdate[field] = configToUpdate[field].filter(v => v !== value);

        await setDoc(doc(db, "users", currentUser.uid, "settings", docName), configToUpdate, { merge: true });

        showToast("Voce eliminata", "success");
        updateCurrentDynamicConfig();
        finishLoad();
    } catch (e) {
        console.error("Delete Config Error", e);
        showToast("Errore durante l'eliminazione", "error");
    }
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

    const addItems = (items) => {
        if (!items || items.length === 0) return;
        items.forEach(item => {
            const key = (typeof item === 'object') ? item.name : item;
            typeSelect.appendChild(new Option(key, key));
        });
    };

    if (currentMode === 'automezzi') addItems(unifiedConfigs.automezzi?.deadlineTypes);
    else if (currentMode === 'documenti') addItems(unifiedConfigs.documenti?.deadlineTypes);
    else if (currentMode === 'generali') addItems(unifiedConfigs.generali?.deadlineTypes);

    // Valida se il valore precedente appartiene ancora al nuovo set
    const valExists = Array.from(typeSelect.options).some(opt => opt.value === currentVal);
    if (currentVal && valExists) {
        typeSelect.value = currentVal;
    } else {
        typeSelect.value = '';
    }
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

    } else {
        placeholder?.classList.remove('hidden');
        linkDiv?.classList.add('hidden');
    }
}

/**
 * Logica Canali di Notifica (Push/Email)
 */
function setupNotificationChannels() {
    const channelSelect = document.getElementById('notif_channel_select');
    const pushWrapper = document.getElementById('push_recipients_wrapper');
    const emailWrapper = document.getElementById('email_recipients_wrapper');

    if (!channelSelect) return;

    channelSelect.addEventListener('change', () => {
        const val = channelSelect.value;
        if (val === 'push') {
            pushWrapper?.classList.remove('hidden');
            emailWrapper?.classList.add('hidden');
        } else if (val === 'email') {
            pushWrapper?.classList.add('hidden');
            emailWrapper?.classList.remove('hidden');
        } else if (val === 'both') {
            pushWrapper?.classList.remove('hidden');
            emailWrapper?.classList.remove('hidden');
        } else {
            pushWrapper?.classList.add('hidden');
            emailWrapper?.classList.add('hidden');
        }
    });
}

/**
 * Caricamento Utenti per Push (dalla Rubrica)
 */
async function loadPushUsers() {
    if (!currentUser) return;
    const menu = document.getElementById('push_users_menu');
    const nativeSelect = document.getElementById('push_users_select');
    if (!menu || !nativeSelect) return;

    try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "contacts"));
        clearElement(menu);
        clearElement(nativeSelect);

        if (snap.empty) {
            menu.appendChild(createElement('div', { className: 'dropdown-option disabled', textContent: 'Nessun contatto salvato' }));
            return;
        }

        snap.forEach(docSnap => {
            const contact = docSnap.data();
            const displayName = `${contact.nome} ${contact.cognome || ''}`.trim();
            const email = contact.email; // Usiamo l'email come identificatore per ora

            const opt = createElement('div', {
                className: 'dropdown-option',
                dataset: { value: email, label: displayName },
                textContent: displayName,
                onclick: (e) => {
                    e.stopPropagation();
                    togglePushRecipient(email, displayName);
                }
            });
            menu.appendChild(opt);

            const nativeOpt = new Option(displayName, email);
            nativeSelect.appendChild(nativeOpt);
        });

        // Se abbiamo già dei destinatari selezionati (es. caricati da Edit), aggiorniamo le label reali dalla rubrica
        if (selectedPushRecipients.length > 0) {
            selectedPushRecipients.forEach(r => {
                const found = Array.from(nativeSelect.options).find(opt => opt.value === r.email);
                if (found) r.label = found.textContent;
            });
            updatePushChips();
        }

    } catch (e) {
        console.error("Load Push Users Error:", e);
    }
}

let selectedPushRecipients = []; // Array di {email, label}

function togglePushRecipient(email, label) {
    const idx = selectedPushRecipients.findIndex(r => r.email === email);
    if (idx === -1) {
        selectedPushRecipients.push({ email, label });
    } else {
        selectedPushRecipients.splice(idx, 1);
    }
    updatePushChips();
    syncNativePushSelect();
}

function updatePushChips() {
    const container = document.getElementById('selected_push_chips');
    const menu = document.getElementById('push_users_menu');
    if (!container) return;
    clearElement(container);

    selectedPushRecipients.forEach(r => {
        const chip = createElement('div', { className: 'selected-chip' }, [
            createElement('span', { className: 'chip-text', textContent: r.label }),
            createElement('span', {
                className: 'material-symbols-outlined chip-remove',
                textContent: 'cancel',
                onclick: (e) => {
                    e.stopPropagation();
                    togglePushRecipient(r.email, r.label);
                }
            })
        ]);
        container.appendChild(chip);
    });

    // Sync active class in menu
    if (menu) {
        menu.querySelectorAll('.dropdown-option').forEach(opt => {
            const val = opt.dataset.value;
            opt.classList.toggle('active', selectedPushRecipients.some(r => r.email === val));
        });
    }
}

function syncNativePushSelect() {
    const select = document.getElementById('push_users_select');
    if (!select) return;
    Array.from(select.options).forEach(opt => {
        opt.selected = selectedPushRecipients.some(r => r.email === opt.value);
    });
}

function setupMultiSelects() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-multi-select] .dropdown-trigger');
        if (trigger) {
            e.stopPropagation();
            const container = trigger.closest('[data-multi-select]');
            const menu = container.querySelector('.base-dropdown-menu');
            if (menu) menu.classList.toggle('show');
        } else {
            document.querySelectorAll('[data-multi-select] .base-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
}

function setupSaveLogic() {
    const btnSave = document.getElementById('save-btn');
    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
        if (!auth.currentUser) return;

        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const dateInput = document.getElementById('dueDate');
        let date = dateInput.dataset.isoValue;

        // Fallback or Manual Parse if isoValue missing
        if (!date && dateInput.value) {
            const v = dateInput.value;
            if (v.includes('/')) {
                // Convert DD/MM/YYYY to YYYY-MM-DD
                const parts = v.split('/');
                if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                date = v; // Assume ISO
            }
        }
        const email1 = (emailPrimariaSelect.value === 'manual') ? document.getElementById('email_primaria_input').value.trim() : emailPrimariaSelect.value;
        const email2 = (emailSecondariaSelect.value === 'manual') ? document.getElementById('email_secondaria_input').value.trim() : emailSecondariaSelect.value;

        const notifChannel = document.getElementById('notif_channel_select').value;
        const pushRecipients = selectedPushRecipients.map(r => r.email);

        if (!name || !type || !date) {
            return showToast("Compila i campi obbligatori", "error");
        }

        // Validazione Canali
        if (notifChannel === 'email' || notifChannel === 'both') {
            if (!email1) return showToast("Seleziona un'email per le notifiche", "error");
        }
        if (notifChannel === 'push' || notifChannel === 'both') {
            if (pushRecipients.length === 0) return showToast("Seleziona almeno un utente per le notifiche push", "error");
        }
        if (notifChannel === 'none') {
            const proceed = await showConfirmModal(t('notification_channel'), t('in_app_only_warn'));
            if (!proceed) return;
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
            notificationChannel: notifChannel,
            pushRecipients: pushRecipients,
            notificationDaysBefore: parseInt(notifDaysInput.value),
            notificationFrequency: parseInt(notifFreqInput.value),
            createdAt: Timestamp.now(),
            status: 'active',
            completed: false
        };

        try {
            btnSave.disabled = true;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined animate-spin mr-2', textContent: 'progress_activity' }),
                createElement('span', { id: 'save-btn-text', textContent: 'Salvataggio...' })
            ]);

            const btnText = document.getElementById('save-btn-text');
            let finalDocId = editingScadenzaId;

            // 1. Salvataggio Documento per ottenere l'ID
            if (editingScadenzaId) {
                await updateDoc(doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId), data);
            } else {
                const docRef = await addDoc(collection(db, "users", currentUser.uid, "scadenze"), data);
                finalDocId = docRef.id;
            }

            // 2. Gestione Allegati (Upload sequenziale garantito)
            const uploadedRef = [];
            if (selectedFiles.length > 0) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    if (btnText) btnText.textContent = `Caricamento ${i + 1}/${selectedFiles.length}...`;

                    const storagePath = `users/${currentUser.uid}/scadenze/${finalDocId}/${Date.now()}_${file.name}`;
                    const sRef = ref(storage, storagePath);
                    const snap = await uploadBytes(sRef, file);
                    const url = await getDownloadURL(snap.ref);

                    uploadedRef.push({
                        name: file.name,
                        url: url,
                        type: file.type,
                        size: file.size,
                        createdAt: new Date().toISOString()
                    });
                }
            }

            // 3. Update finale con la lista allegati completa (Esistenti + Nuovi)
            const finalAttachments = [...existingAttachments, ...uploadedRef];
            await updateDoc(doc(db, "users", currentUser.uid, "scadenze", finalDocId), {
                attachments: finalAttachments
            });

            if (btnText) btnText.textContent = "Completato!";
            showToast(editingScadenzaId ? "Scadenza aggiornata!" : "Scadenza salvata!", "success");
            setTimeout(() => window.location.href = `dettaglio_scadenza.html?id=${finalDocId}`, 1000);

        } catch (e) {
            console.error("Errore Salvatggio:", e);
            showToast("Errore durante il salvataggio: " + e.message, "error");
            btnSave.disabled = false;
            // Restore button content
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined', style: 'color: white;', textContent: 'save' })
            ]);
        }
    });
}

/**
 * SISTEMA ALLEGATI (V4.1)
 * Gestione Modali, Picker e Render
 */
function initAttachmentSystem() {
    const btnTrigger = document.getElementById('btn-trigger-upload');
    const modal = document.getElementById('source-selector-modal');
    const btnCancel = document.getElementById('btn-cancel-source');

    if (!btnTrigger || !modal) return;

    btnTrigger.onclick = () => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    btnCancel.onclick = closeModal;

    // Source Selection
    modal.querySelectorAll('[data-source]').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.source;
            const input = document.getElementById(`input-${type}`);
            if (input) input.click();
            closeModal();
        };
    });

    // Inputs Change Listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                selectedFiles.push(...files);
                renderAttachments();
            }
            e.target.value = ''; // Reset per permettere ricaricamento stesso file
        });
    });
}

function renderAttachments() {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    clearElement(container);

    const all = [
        ...existingAttachments.map((f, i) => ({ ...f, existing: true, idx: i })),
        ...selectedFiles.map((f, i) => ({ name: f.name, existing: false, idx: i }))
    ];

    if (all.length === 0) {
        container.appendChild(createElement('p', {
            className: 'placeholder-text-standard',
            textContent: 'Nessun allegato'
        }));
        return;
    }

    all.forEach(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        let icon = 'description';
        let color = 'text-white/20';

        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { icon = 'image'; color = 'text-purple-400/40'; }
        else if (ext === 'pdf') { icon = 'picture_as_pdf'; color = 'text-red-400/40'; }

        const item = createElement('div', {
            className: 'attachment-item animate-in slide-in-from-left-2'
        }, [
            createElement('div', { className: 'attachment-info' }, [
                createElement('span', { className: `material-symbols-outlined attachment-icon ${color}`, textContent: icon }),
                createElement('div', { className: 'attachment-meta' }, [
                    createElement('span', { className: 'attachment-name', textContent: file.name }),
                    createElement('span', { className: 'attachment-status', textContent: file.existing ? 'Caricato' : 'Nuovo' })
                ])
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-delete-attachment',
                onclick: async (e) => {
                    e.stopPropagation();
                    const ok = await showConfirmModal("ELIMINA ALLEGATO", `Vuoi rimuovere l'allegato ${file.name}?`, "Elimina", "Annulla");
                    if (ok) removeAttachment(file.idx, file.existing);
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ])
        ]);

        container.appendChild(item);
    });
}

function removeAttachment(idx, existing) {
    if (existing) {
        existingAttachments.splice(idx, 1);
    } else {
        selectedFiles.splice(idx, 1);
    }
    renderAttachments();
}

async function showSuccessModal() {
    window.location.href = 'scadenze.html';
}

async function loadScadenzaForEdit(id) {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid, "scadenze", id));
        if (!snap.exists()) {
            showToast("Scadenza non trovata", "error");
            return;
        }

        const data = snap.data();

        // 1. Identifica il Mode corretto in base al tipo salvato
        let foundMode = 'automezzi';
        if (unifiedConfigs.documenti?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'documenti';
        else if (unifiedConfigs.generali?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'generali';

        // 2. Imposta il Mode (popola i select nativi)
        setMode(foundMode);

        // 3. Riempi i campi base
        document.getElementById('nome_cognome').value = data.name || '';
        // Date Formatting for V5.0 Custom Datepicker
        // Date Formatting for V5.0 Custom Datepicker & Robust Parsing
        const dateInput = document.getElementById('dueDate');
        if (data.dueDate) {
            let d = new Date(data.dueDate);
            let isValid = !isNaN(d.getTime());

            // Tentativo caricamento fallback se data salvata come DD/MM/YYYY string
            if (!isValid && typeof data.dueDate === 'string' && data.dueDate.includes('/')) {
                const parts = data.dueDate.split('/');
                if (parts.length === 3) {
                    // Try DD/MM/YYYY -> YYYY-MM-DD
                    const isoFix = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    d = new Date(isoFix);
                    isValid = !isNaN(d.getTime());
                }
            }

            if (isValid) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();

                dateInput.value = `${day}/${month}/${year}`;
                dateInput.dataset.isoValue = d.toISOString().split('T')[0];
            } else {
                console.warn("Invalid Date found:", data.dueDate);
                dateInput.value = data.dueDate || ''; // Show raw
                dateInput.dataset.isoValue = '';
            }
        } else {
            dateInput.value = '';
            dateInput.dataset.isoValue = '';
        }
        document.getElementById('notes').value = data.notes || '';

        // Canale Notifica
        const channelSelect = document.getElementById('notif_channel_select');
        if (channelSelect) {
            channelSelect.value = data.notificationChannel || 'email';
            channelSelect.dispatchEvent(new Event('change'));
            // Sync proxy dropdown manually since we changed native value
            syncCustomDropdowns();
        }

        // Destinatari Push
        if (data.pushRecipients && Array.isArray(data.pushRecipients)) {
            selectedPushRecipients = data.pushRecipients.map(email => ({ email, label: email }));
            updatePushChips();
            syncNativePushSelect();
        }

        // Notifiche
        document.getElementById('notif_days_before').value = data.notificationDaysBefore || 14;
        document.getElementById('notif_frequency').value = data.notificationFrequency || 7;
        document.getElementById('display_notif_days').textContent = data.notificationDaysBefore || 14;
        document.getElementById('display_notif_freq').textContent = data.notificationFrequency || 7;

        // 4. Seleziona i valori nei Dropdown (Ora che sono popolati da setMode)
        typeSelect.value = data.type || '';

        const modelSel = document.getElementById('modello_veicolo');
        if (modelSel) modelSel.value = data.veicolo_modello || '';

        const textSel = document.getElementById('testo_email_select');
        if (textSel) textSel.value = data.email_testo_selezionato || '';

        // 5. Gestione Email (Primaria e Secondaria) con supporto Manuale
        const handleEmailEdit = (select, emailsArray, index, inputId) => {
            if (!emailsArray || !emailsArray[index]) return;
            const email = emailsArray[index];
            const input = document.getElementById(inputId);

            if (EMAILS.includes(email)) {
                select.value = email;
            } else {
                select.value = 'manual';
                if (input) {
                    input.value = email;
                    input.classList.remove('hidden');
                    select.parentElement.classList.add('hidden');
                }
            }
        };

        handleEmailEdit(emailPrimariaSelect, data.emails, 0, 'email_primaria_input');
        handleEmailEdit(emailSecondariaSelect, data.emails, 1, 'email_secondaria_input');

        // 6. Allegati esistenti
        existingAttachments = data.attachments || [];
        renderAttachments();

        // 7. Sincronizzazione Dropdown Custom (V4.1 System)
        syncCustomDropdowns();

        // 8. Refresh Anteprima Oggetto
        updatePreview();

    } catch (e) {
        console.error("Errore caricamento modifica:", e);
        showToast("Errore nel caricamento dei dati", "error");
    }
}

/**
 * CUSTOM PREMIUM DROPDOWNS (PROXY SYSTEM)
 * Sincronizza i div 'base-dropdown' con i select nativi (hidden).
 */
function initProxyDropdowns() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.dropdown-trigger');
        const container = trigger?.closest('[data-custom-select]');
        const menu = container?.querySelector('.base-dropdown-menu');

        // Chiudi tutti gli altri
        document.querySelectorAll('.base-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        if (trigger && menu) {
            e.stopPropagation();
            menu.classList.toggle('show');
        } else {
            document.querySelectorAll('.base-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });

    // Auto-Sync iniziale e osservazione cambiamenti
    syncCustomDropdowns();
}

function syncCustomDropdowns() {
    document.querySelectorAll('[data-custom-select]').forEach(container => {
        const select = container.querySelector('select');
        const trigger = container.querySelector('.dropdown-trigger');
        const labelEl = container.querySelector('.dropdown-label');
        const menu = container.querySelector('.base-dropdown-menu');

        if (!select || !trigger || !menu) return;

        // Reset menu
        clearElement(menu);

        // Build items
        Array.from(select.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                menu.appendChild(createElement('div', { className: 'base-dropdown-group-label', textContent: child.label }));
                Array.from(child.children).forEach(opt => createItem(opt, menu, select, labelEl));
            } else {
                createItem(child, menu, select, labelEl);
            }
        });

        // Sync Label
        const updateSelectionUI = () => {
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt) {
                labelEl.textContent = selectedOpt.textContent;
                if (selectedOpt.dataset.t) labelEl.setAttribute('data-t', selectedOpt.dataset.t);
                else labelEl.removeAttribute('data-t');

                // Sync Active Class in menu
                menu.querySelectorAll('.base-dropdown-item').forEach(i => {
                    i.classList.toggle('active', i.dataset.value === select.value);
                });
            }
        };

        updateSelectionUI();

        // Ri-sincronizza se il select cambia (programmaticamente o via proxy)
        if (!select._proxyInit) {
            select.addEventListener('change', updateSelectionUI);
            // Osserva se cambiano le opzioni (es. populateTypeSelect)
            const observer = new MutationObserver(() => syncCustomDropdowns());
            observer.observe(select, { childList: true });
            select._proxyInit = true;
        }

        function createItem(opt, parent, sel, lab) {
            const item = createElement('div', {
                className: `base-dropdown-item ${opt.selected ? 'active' : ''}`,
                dataset: { value: opt.value }
            }, [
                createElement('span', { textContent: opt.textContent, className: 'truncate' })
            ]);

            // Add delete button for user-defined items (skip placeholders or manual triggers)
            const isUserItem = opt.value && !['manual', ''].includes(opt.value);
            const isManageable = ['tipo_scadenza', 'modello_veicolo', 'testo_email_select'].includes(sel.id);

            if (isUserItem && isManageable) {
                const actions = createElement('div', { className: 'dropdown-item-actions' });

                const editBtn = createElement('button', {
                    type: 'button',
                    className: 'btn-edit-opt',
                    title: 'Modifica voce',
                    onclick: (e) => {
                        e.stopPropagation();
                        editConfigItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
                ]);

                const delBtn = createElement('button', {
                    type: 'button',
                    className: 'btn-delete-opt',
                    title: 'Elimina voce',
                    onclick: (e) => {
                        e.stopPropagation();
                        deleteConfigItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
                ]);

                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
                item.appendChild(actions);
            }

            if (opt.dataset.t) item.setAttribute('data-t', opt.dataset.t);

            item.onclick = (e) => {
                e.stopPropagation();
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change'));
                parent.classList.remove('show');
            };
            parent.appendChild(item);
        }
    });
}

