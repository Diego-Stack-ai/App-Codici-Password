import { getDocSmart as getDoc, getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { db, auth, storage } from '../../firebase-config.js?v=1.2.41';
import { getFooterReady } from '../../footer-state.js';
import { LOG } from '../../logger.js';
import { collection, addDoc, Timestamp, doc, updateDoc, setDoc, arrayUnion, writeBatch } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL } from "/assets/js/vendor/firebase-runtime.js";
import { onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal, showInputModal } from '../../ui-core-v129.js';

import { t } from '../../translations.js';
import { initDatePickerV5 } from '../../datepicker_v5.js';
import { ensureMasterKey } from '../core/security-manager.js';
import { createStorageObjectName, encryptAttachmentFile, validateAttachmentFile } from '../shared/attachment-security.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
const typeSelect = document.getElementById('tipo_scadenza');

let _preventEmailSeed = false;
let currentUser = null;
let currentRule = null;
let currentMode = 'automezzi';
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');
let selectedFiles = [];
let existingAttachments = [];
let deadlineRecipients = [];
let recipientContacts = [];
let profileDocumentLinkDraft = null;
let linkedSourceRef = null;

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
    
    if (!user) return;
    currentUser = user;

    editingScadenzaId = new URLSearchParams(window.location.search).get('id');
    const profileDocumentId = new URLSearchParams(window.location.search).get('profileDocumentId');
    if (!editingScadenzaId && profileDocumentId) {
        try {
            const draft = JSON.parse(sessionStorage.getItem('profile-deadline-link-draft') || 'null');
            if (draft?.profileDocumentId === profileDocumentId) profileDocumentLinkDraft = draft;
        } catch { profileDocumentLinkDraft = null; }
    }

    // Mode Switching Listeners
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
    });

    // Custom Datepicker V5.0
    initDatePickerV5('dueDate');

    initProxyDropdowns();
    initAttachmentSystem();

    setupDeadlineRecipientsUI();

    // --- FOOTER ACTIONS SYSTEM (Event Contract V6.1) ---
    function initFooterFromDetail(detail) {
        const { center: footerCenter, right: footerRight } = detail;
        if (!footerCenter || !footerRight) return;

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

    // V6.1: Late-subscriber safe — se il footer è già pronto, inizializza subito
    const _footerState = getFooterReady();
    if (_footerState) {
        initFooterFromDetail(_footerState);
    } else {
        document.addEventListener('footer:ready', (e) => initFooterFromDetail(e.detail), { once: true });
    }

    // LIST MANAGEMENT SYSTEM (Dynamic Config)
    document.querySelectorAll('.btn-manage-config-inline').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const configId = btn.dataset.configId;

            if (configId === 'tipo_scadenza') {
                // Chiediamo nome, periodo e frequenza per le Categorie
                const name = await showInputModal(`Aggiungi Nuova Categoria`, '', `Nome categoria...`);
                if (!name || !name.trim()) return;
                const period = await showInputModal(`Giorni di preavviso`, "14", `Inserisci giorni (es. 14)`);
                if (period === null) return;
                const freq = await showInputModal(`Frequenza notifica`, "7", `Inserisci giorni (es. 7)`);
                if (freq === null) return;

                await addConfigItem(configId, {
                    name: name.trim(),
                    period: parseInt(period) || 14,
                    freq: parseInt(freq) || 7
                });
            } else {
                const newVal = await showInputModal(`Aggiungi Nuovo`, '', `Inserisci nuovo valore...`);
                if (newVal && newVal.trim()) {
                    await addConfigItem(configId, newVal.trim());
                }
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
    } else {
        // Forza l'aggiornamento UI per la modalità di default ('automezzi') in "Aggiungi"
        setMode(currentMode);
        if (profileDocumentLinkDraft) {
            setMode('documenti');
            const nameInput = document.getElementById('nome_cognome');
            const dateInput = document.getElementById('dueDate');
            if (nameInput) nameInput.value = profileDocumentLinkDraft.name || 'Documento';
            if (dateInput) {
                dateInput.value = profileDocumentLinkDraft.dueDate || '';
                dateInput.dataset.isoValue = profileDocumentLinkDraft.dueDate || '';
            }
            if (typeSelect && profileDocumentLinkDraft.name && [...typeSelect.options].some(option => option.value === profileDocumentLinkDraft.name)) {
                typeSelect.value = profileDocumentLinkDraft.name;
            }
        }
    }

    
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
    updateDynamicOptions(null);
}

async function loadDynamicConfig() {
    if (!currentUser) return;
    try {
        const [autoSnap, docSnap, genSnap, userSnap, contactsSnap] = await Promise.all([
            getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfig")),
            getDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments")),
            getDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig")),
            getDoc(doc(db, "users", currentUser.uid)),
            getDocs(collection(db, "users", currentUser.uid, "contacts"))
        ]);

        const rawGenData = genSnap.exists() ? genSnap.data() : {};

        let notificationEmails = rawGenData.notificationEmails || [];
        if (notificationEmails.length === 0 && userSnap.exists()) {
            const userData = userSnap.data();
            const contactEmails = (userData.contactEmails || []).filter(e => e && e.address).map(e => e.address);
            if (contactEmails.length > 0) {
                notificationEmails = contactEmails;
                rawGenData.notificationEmails = notificationEmails;
                if (!_preventEmailSeed) {
                    setDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig"), { notificationEmails }, { merge: true });
                    _preventEmailSeed = true;
                }
            }
        }

        unifiedConfigs.generali = { deadlineTypes: [], emailTemplates: [], names: [], notificationEmails: [], ...rawGenData };
        populateEmailSelects(unifiedConfigs.generali.notificationEmails);
        recipientContacts = contactsSnap.docs.map(contactDoc => ({ id: contactDoc.id, ...contactDoc.data() }));
        notificationEmails.forEach(email => {
            const normalized = normalizeRecipientEmail(email);
            if (normalized && !recipientContacts.some(contact => normalizeRecipientEmail(contact.email) === normalized)) {
                recipientContacts.push({ id: '', nome: 'Email salvata', cognome: '', email: normalized });
            }
        });
        populateRecipientContacts();

        // --- AUTOMEZZI ---
        const defaultAuto = {
            deadlineTypes: [
                { name: 'Revisione Moto', freq: 7, period: 14 },
                { name: 'Assicurazione', freq: 7, period: 14 },
                { name: 'Revisione Auto', freq: 7, period: 14 },
                { name: 'Bollo', freq: 7, period: 14 },
                { name: 'Tagliando', freq: 7, period: 28 },
                { name: 'Olio motore', freq: 7, period: 14 }
            ],
            models: [],
            // I veicoli vengono aggiunti dall'utente nelle impostazioni
            emailTemplates: [
                "l'assicurazione del motociclo targato",
                "l'assicurazione dell'auto targata",
                "la revisione del motociclo targato",
                "la revisione dell'auto targata",
                "Il bollo del motociclo targato",
                "Il bollo dell'auto targata",
                "Il tagliando del motociclo targato",
                "Il tagliando dell'auto targata",
                "Il bollo del carrello targato",
                "Olio motore da controllare"
            ]
        };
        const dAuto = autoSnap.exists() ? autoSnap.data() : defaultAuto;
        if (!autoSnap.exists()) {
            setDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfig"), defaultAuto);
        }
        unifiedConfigs.automezzi = { deadlineTypes: [], models: [], emailTemplates: [], names: [], notificationEmails: [], ...dAuto };

        // --- DOCUMENTI ---
        const defaultDoc = {
            deadlineTypes: [
                { name: 'Patente', freq: 7, period: 56 },
                { name: 'Carta Identità', freq: 14, period: 56 },
                { name: 'Passaporto', freq: 14, period: 28 },
                { name: 'Codice fiscale', freq: 7, period: 56 }
            ],
            models: [],
            // I documenti vengono aggiunti dall'utente nelle impostazioni
            emailTemplates: [
                "la tua patente",
                "Il tuo documento di Identità",
                "Il tuo passaporto",
                "Il tuo codice fiscale"
            ]
        };
        const dDoc = docSnap.exists() ? docSnap.data() : defaultDoc;
        if (!docSnap.exists()) {
            setDoc(doc(db, "users", currentUser.uid, "settings", "deadlineConfigDocuments"), defaultDoc);
        }
        unifiedConfigs.documenti = { deadlineTypes: [], models: [], emailTemplates: [], names: [], notificationEmails: [], ...dDoc };

        // --- GENERALI ---
        const defaultGen = {
            deadlineTypes: [
                { name: 'Sale Addolcitore', freq: 7, period: 14 },
                { name: "Comodato d'uso", freq: 7, period: 28 },
                { name: 'Federazione Italiana Vela', freq: 7, period: 70 },
                { name: 'Visita medica', freq: 7, period: 14 },
                { name: 'Contratto', freq: 7, period: 14 },
                { name: 'Tessera isola ecologica', freq: 7, period: 14 }
            ],
            emailTemplates: [
                "Il sale dell'addolcitore",
                "Il comodato d'uso dell'auto targata",
                "E' in scadenza il tuo certificato medico",
                "E' in scadenza la tua tessera FIV",
                "Isola ecologica"
            ]
        };
        const dGen = genSnap.exists() ? rawGenData : defaultGen;
        // Seed se documento assente O se deadlineTypes è vuoto (documento incompleto)
        const needsSeedGen = !genSnap.exists() || !rawGenData.deadlineTypes || rawGenData.deadlineTypes.length === 0;
        if (needsSeedGen) {
            const mergedGen = { ...defaultGen, notificationEmails: rawGenData.notificationEmails || [] };
            setDoc(doc(db, "users", currentUser.uid, "settings", "generalConfig"), mergedGen, { merge: true });
            dGen.deadlineTypes = defaultGen.deadlineTypes;
            dGen.emailTemplates = dGen.emailTemplates && dGen.emailTemplates.length > 0 ? dGen.emailTemplates : defaultGen.emailTemplates;
        }
        unifiedConfigs.generali = {
            deadlineTypes: [], emailTemplates: [], names: [], notificationEmails: rawGenData.notificationEmails || [], ...dGen
        };

        updateCurrentDynamicConfig();
        finishLoad();
    } catch (e) {
        console.error("Config Load Error", e);
    }
}

async function _addNotificationEmailBtn(selectId = 'email_primaria_select') {
    const v = await showInputModal('Nuova Email', '', 'Inserisci un nuovo indirizzo email...');
    if (v && v.trim()) await addConfigItem(selectId, v.trim());
}

function normalizeRecipientEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidRecipientEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRecipientEmail(value));
}

function addDeadlineRecipient({ email, displayName = '', contactId = '', sendEmail = true, sendPush = true }) {
    const normalized = normalizeRecipientEmail(email);
    if (!isValidRecipientEmail(normalized)) return false;
    const existing = deadlineRecipients.find(item => item.email === normalized);
    if (existing) {
        existing.displayName = existing.displayName || String(displayName || '').trim();
        existing.contactId = existing.contactId || contactId;
        existing.sendEmail = existing.sendEmail || sendEmail === true;
        existing.sendPush = existing.sendPush || sendPush === true;
    } else {
        deadlineRecipients.push({ email: normalized, displayName: String(displayName || '').trim(), contactId, sendEmail: sendEmail === true, sendPush: sendPush === true });
    }
    renderDeadlineRecipients();
    return true;
}

function renderDeadlineRecipients() {
    const container = document.getElementById('deadline-recipients-list');
    if (!container) return;
    clearElement(container);
    if (!deadlineRecipients.length) {
        container.appendChild(createElement('p', { className: 'deadline-recipient-help', textContent: 'Nessun destinatario aggiuntivo. Il proprietario continuerà a ricevere le proprie Push.' }));
        return;
    }
    deadlineRecipients.forEach((recipient, index) => {
        const emailToggle = createElement('input', { type: 'checkbox', checked: recipient.sendEmail, dataset: { recipientIndex: String(index), channel: 'email' } });
        const pushToggle = createElement('input', { type: 'checkbox', checked: recipient.sendPush, dataset: { recipientIndex: String(index), channel: 'push' } });
        const card = createElement('div', { className: `deadline-recipient-card${recipient.sendEmail || recipient.sendPush ? '' : ' is-paused'}` }, [
            createElement('div', {}, [
                createElement('span', { className: 'deadline-recipient-name', textContent: recipient.displayName || 'Destinatario' }),
                createElement('span', { className: 'deadline-recipient-email', textContent: recipient.email })
            ]),
            createElement('div', { className: 'deadline-recipient-controls' }, [
                createElement('label', { className: 'deadline-channel-label' }, [emailToggle, document.createTextNode('Email')]),
                createElement('label', { className: 'deadline-channel-label' }, [pushToggle, document.createTextNode('Push')]),
                createElement('button', { type: 'button', className: 'deadline-recipient-remove', dataset: { recipientRemove: String(index) }, title: 'Rimuovi destinatario' }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
                ])
            ])
        ]);
        container.appendChild(card);
    });
}

function populateRecipientContacts() {
    const select = document.getElementById('deadline-contact-select');
    if (!select) return;
    clearElement(select);
    select.appendChild(new Option('Seleziona dalla rubrica…', ''));
    recipientContacts.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'it')).forEach(contact => {
        const email = normalizeRecipientEmail(contact.email);
        if (!email) return;
        const label = [contact.nome, contact.cognome].filter(Boolean).join(' ').trim() || email;
        select.appendChild(new Option(`${label} — ${email}`, contact.id || `email:${email}`));
    });
}

function setupDeadlineRecipientsUI() {
    document.getElementById('btn-add-deadline-contact')?.addEventListener('click', () => {
        const select = document.getElementById('deadline-contact-select');
        const selectedValue = select?.value || '';
        const contact = recipientContacts.find(item => item.id === selectedValue || `email:${normalizeRecipientEmail(item.email)}` === selectedValue);
        if (!contact) return showToast('Seleziona prima una persona dalla rubrica.', 'info');
        addDeadlineRecipient({ contactId: contact.id, displayName: [contact.nome, contact.cognome].filter(Boolean).join(' '), email: contact.email });
        select.value = '';
    });
    document.getElementById('btn-add-deadline-email')?.addEventListener('click', async () => {
        const email = normalizeRecipientEmail(await showInputModal('Nuovo destinatario', '', 'Inserisci indirizzo email'));
        if (!email) return;
        if (!isValidRecipientEmail(email)) return showToast('Inserisci un indirizzo email valido.', 'warning');
        const displayName = String(await showInputModal('Nome o descrizione', '', 'Es. Maria Rossi o Commercialista') || '').trim();
        if (!addDeadlineRecipient({ email, displayName })) return;
        const known = recipientContacts.some(contact => normalizeRecipientEmail(contact.email) === email);
        if (!known && await showConfirmModal('Salva in rubrica', 'Vuoi riutilizzare questa persona anche in futuro?')) {
            const parts = displayName.split(/\s+/).filter(Boolean);
            const contactData = { nome: parts.shift() || displayName || email, cognome: parts.join(' '), email, emailNormalized: email, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const ref = await addDoc(collection(db, 'users', currentUser.uid, 'contacts'), contactData);
            recipientContacts.push({ id: ref.id, ...contactData });
            const recipient = deadlineRecipients.find(item => item.email === email);
            if (recipient) recipient.contactId = ref.id;
            populateRecipientContacts(); renderDeadlineRecipients();
        }
    });
    document.getElementById('deadline-recipients-list')?.addEventListener('change', event => {
        const input = event.target.closest('input[data-recipient-index]');
        if (!input) return;
        const recipient = deadlineRecipients[Number(input.dataset.recipientIndex)];
        if (!recipient) return;
        if (input.dataset.channel === 'email') recipient.sendEmail = input.checked;
        if (input.dataset.channel === 'push') recipient.sendPush = input.checked;
        renderDeadlineRecipients();
    });
    document.getElementById('deadline-recipients-list')?.addEventListener('click', event => {
        const button = event.target.closest('[data-recipient-remove]');
        if (!button) return;
        deadlineRecipients.splice(Number(button.dataset.recipientRemove), 1); renderDeadlineRecipients();
    });
    renderDeadlineRecipients();
}

function updateCurrentDynamicConfig() {
    if (currentMode === 'automezzi') dynamicConfig = unifiedConfigs.automezzi;
    else if (currentMode === 'documenti') dynamicConfig = unifiedConfigs.documenti;
    else if (currentMode === 'generali') dynamicConfig = unifiedConfigs.generali;

    // names: solo quelli della modalità corrente (contestuali)
    dynamicConfig.names = (dynamicConfig.names || []).sort();

    // notificationEmails: quelli della modalità corrente
    populateEmailSelects(dynamicConfig.notificationEmails || []);
}

async function addConfigItem(selectId, valueStringOrObject) {
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
        } else if (selectId === 'email_primaria_select' || selectId === 'email_secondaria_select') {
            field = 'notificationEmails';
            // Opzione B: email per modalità corrente
            if (currentMode === 'automezzi') docName = 'deadlineConfig';
            else if (currentMode === 'documenti') docName = 'deadlineConfigDocuments';
            else docName = 'generalConfig';
        }

        if (!docName || !field) return;

        // Update local state — per notificationEmails usa il config della modalità corrente
        const configToUpdate = (currentMode === 'automezzi') ? unifiedConfigs.automezzi :
            (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali;

        if (!configToUpdate[field]) configToUpdate[field] = [];

        let valueToPush = valueStringOrObject;

        // Check for duplicates
        if (selectId === 'tipo_scadenza') {
            const exists = configToUpdate[field].some(item => {
                const checkedName = typeof item === 'object' ? item.name : item;
                const newName = typeof valueStringOrObject === 'object' ? valueStringOrObject.name : valueStringOrObject;
                return checkedName === newName;
            });
            if (exists) return showToast("Valore già esistente", "info");
        } else {
            if (configToUpdate[field].includes(valueStringOrObject)) return showToast("Valore già esistente", "info");
        }

        configToUpdate[field].push(valueToPush);

        // Sort
        if (selectId === 'tipo_scadenza') {
            configToUpdate[field].sort((a, b) => {
                const nameA = typeof a === 'object' ? a.name : a;
                const nameB = typeof b === 'object' ? b.name : b;
                return nameA.localeCompare(nameB);
            });
        } else {
            configToUpdate[field].sort();
        }

        // Save to Firestore
        await setDoc(doc(db, "users", currentUser.uid, "settings", docName), {
            [field]: configToUpdate[field]
        }, { merge: true });

        showToast("Lista aggiornata!", "success");
        updateCurrentDynamicConfig();
        finishLoad(); // Re-populate and sync

        setTimeout(() => {
            const select = document.getElementById(selectId);
            if (select) {
                select.value = typeof valueToPush === 'object' ? valueToPush.name : valueToPush;
                select.dispatchEvent(new Event('change'));
            }
        }, 100);
    } catch (e) {
        console.error("Add Config Error", e);
        showToast("Errore durante l'aggiornamento", "error");
    }
}

async function editConfigItem(selectId, oldValue) {
    if (!currentUser) return;
    try {
        const newValue = await showInputModal(`Modifica Voce`, oldValue, `Inserisci nuovo valore...`);
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
        } else if (selectId === 'email_primaria_select' || selectId === 'email_secondaria_select') {
            field = 'notificationEmails';
            docName = 'generalConfig';
        }

        if (!docName || !field) return;

        const configToUpdate = (field === 'notificationEmails') ? unifiedConfigs.generali :
            ((currentMode === 'automezzi') ? unifiedConfigs.automezzi :
                (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali);

        const idx = configToUpdate[field].indexOf(oldValue);
        if (idx !== -1) {
            configToUpdate[field][idx] = newValue.trim();
            configToUpdate[field].sort();
            // Save
            await setDoc(doc(db, "users", currentUser.uid, "settings", docName), {
                [field]: configToUpdate[field]
            }, { merge: true });

            showToast("Voce modificata!", "success");
            updateCurrentDynamicConfig();
            finishLoad();
        }
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
        } else if (selectId === 'email_primaria_select' || selectId === 'email_secondaria_select') {
            field = 'notificationEmails';
            docName = 'generalConfig';
        }

        if (!docName || !field) return;

        const configToUpdate = (field === 'notificationEmails') ? unifiedConfigs.generali :
            ((currentMode === 'automezzi') ? unifiedConfigs.automezzi :
                (currentMode === 'documenti') ? unifiedConfigs.documenti : unifiedConfigs.generali);

        configToUpdate[field] = configToUpdate[field].filter(v => typeof v === 'object' ? v.name !== value : v !== value);

        await setDoc(doc(db, "users", currentUser.uid, "settings", docName), {
            [field]: configToUpdate[field]
        }, { merge: true });

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
    if (unifiedConfigs.generali && unifiedConfigs.generali.notificationEmails) {
        populateEmailSelects(unifiedConfigs.generali.notificationEmails);
    }

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
            const isObj = typeof item === 'object';
            const key = isObj ? item.name : item;
            const opt = new Option(key, key);

            if (isObj) {
                if (item.period !== undefined) opt.dataset.period = item.period;
                if (item.freq !== undefined) opt.dataset.freq = item.freq;
            }

            typeSelect.appendChild(opt);
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

function updateDynamicOptions(rule) {
    const modelSel = document.getElementById('modello_veicolo');
    const textSel = document.getElementById('testo_email_select');

    if (!modelSel || !textSel) return;

    if (currentMode !== 'generali') {
        if (modelSel) populateSimpleSelect(modelSel, dynamicConfig.models || []);
    }

    if (textSel) {
        document.getElementById('testo_email_wrapper')?.classList.remove('hidden');
        const combined = [...new Set([...(dynamicConfig.emailTemplates || []), ...(rule?.emailTextOptions || [])])];
        populateSimpleSelect(textSel, combined);
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

function populateEmailSelects(emails) {
    ['email_primaria_select', 'email_secondaria_select'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        clearElement(sel);
        sel.appendChild(new Option('Seleziona email...', ''));

        emails.forEach(email => {
            sel.appendChild(new Option(email, email));
        });

        if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
            sel.value = currentVal;
        } else if (currentVal && currentVal !== 'manual') {
            sel.appendChild(new Option(currentVal, currentVal));
            sel.value = currentVal;
        }
    });
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


let isSubmitting = false;

function setupSaveLogic() {
    const oldBtnSave = document.getElementById('save-btn');
    if (!oldBtnSave) return;

    // Rimuoviamo eventuali vecchi listener clonando il nodo
    const btnSave = oldBtnSave.cloneNode(true);
    oldBtnSave.parentNode.replaceChild(btnSave, oldBtnSave);

    btnSave.addEventListener('click', async () => {
        if (!auth.currentUser || isSubmitting) {
            LOG("[FRONTEND] Click ignorato: processo già in corso o utente non loggato.");
            return;
        }

        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const dateInput = document.getElementById('dueDate');
        let date = dateInput.dataset.isoValue;

        // Fallback or Manual Parse if isoValue missing
        if (!date && dateInput.value) {
            const v = dateInput.value;
            if (v.includes('/')) {
                const parts = v.split('/');
                if (parts.length === 3) date = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
                date = v;
            }
        }

        if (!name || !type || !date) {
            return showToast("Compila i campi obbligatori (Nome, Categoria, Data)", "error");
        }

        try {
            isSubmitting = true;
            LOG("[FRONTEND-TRACE] Lock UI attivato. Singolo salvataggio in corso...");

            // --- UI LOCK ---
            btnSave.disabled = true;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined animate-spin mr-2', textContent: 'progress_activity' }),
                createElement('span', { id: 'save-btn-text', textContent: 'Inizio...' })
            ]);
            const btnText = document.getElementById('save-btn-text');

            // --- 1. UPLOAD ALLEGATI (PRIMA della scrittura DB) ---
            const uploadedAttachments = [];
            if (selectedFiles.length > 0) {
                const vaultKey = await ensureMasterKey();
                LOG(`[FRONTEND-TRACE] Inizio upload di ${selectedFiles.length} file...`);
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    validateAttachmentFile(file);
                    if (btnText) btnText.textContent = `Upload ${i + 1}/${selectedFiles.length}...`;

                    const folderId = editingScadenzaId || `new_${Date.now()}`;
                    const storagePath = `users/${currentUser.uid}/scadenze/${folderId}/${createStorageObjectName(file)}`;
                    const sRef = ref(storage, storagePath);

                    const encryptedFile = await encryptAttachmentFile(file, vaultKey);
                    const snap = await uploadBytes(sRef, encryptedFile.blob, {
                        contentType: 'application/octet-stream',
                        customMetadata: { encrypted: 'v1' }
                    });
                    const url = await getDownloadURL(snap.ref);

                    uploadedAttachments.push({
                        name: file.name,
                        url: url,
                        storagePath,
                        type: file.type,
                        size: file.size,
                        encryption: encryptedFile.metadata,
                        createdAt: new Date().toISOString()
                    });
                    LOG(`[FRONTEND-TRACE] File ${i + 1} caricato con successo.`);
                }
            }

            // --- 2. COSTRUZIONE DOCUMENTO UNIFICATO ---
            if (btnText) btnText.textContent = "Salvataggio DB...";
            const finalAttachments = [...existingAttachments, ...uploadedAttachments];

            const recipients = deadlineRecipients.map(recipient => ({
                ...(recipient.contactId ? { contactId: recipient.contactId } : {}),
                displayName: String(recipient.displayName || '').trim(),
                email: normalizeRecipientEmail(recipient.email),
                sendEmail: recipient.sendEmail === true,
                sendPush: recipient.sendPush === true
            }));
            const legacyEmailRecipients = recipients.filter(recipient => recipient.sendEmail).map(recipient => recipient.email);

            const scadenzaData = {
                uid: currentUser.uid,
                name: name,
                type: type,
                dueDate: date,
                veicolo_modello: document.getElementById('modello_veicolo')?.value || '',
                notes: document.getElementById('notes').value,
                status: 'active',
                completed: false,
                attachments: finalAttachments,
                updatedAt: Timestamp.now(),
                mode: currentMode,
                templateText: document.getElementById('testo_email_select')?.value || '',
                recipients,
                email1: legacyEmailRecipients[0] || '',
                email2: legacyEmailRecipients[1] || '',
                notifChannel: 'multichannel',
                notif_days_before: Number(document.getElementById('notif_days_before')?.value || 14),
                notif_frequency: Number(document.getElementById('notif_frequency')?.value || 7)
            };
            if (profileDocumentLinkDraft?.profileDocumentId) {
                scadenzaData.sourceRef = { type: 'profileDocument', id: profileDocumentLinkDraft.profileDocumentId };
            } else if (linkedSourceRef?.type === 'profileDocument') {
                scadenzaData.sourceRef = linkedSourceRef;
            }

            // Solo per le nuove scadenze aggiungiamo createdAt
            if (!editingScadenzaId) {
                scadenzaData.createdAt = Timestamp.now();
            }

            // --- 3. SCRITTURA UNICA (SINGLE WRITE) ---
            let finalDocId = editingScadenzaId;
            LOG("[FRONTEND-TRACE] Scrittura documento Firestore...");

            if (editingScadenzaId && linkedSourceRef?.type === 'profileDocument') {
                const profileRef = doc(db, 'users', currentUser.uid);
                const profileSnap = await getDoc(profileRef);
                const documents = profileSnap.data()?.documenti || [];
                const batch = writeBatch(db);
                batch.update(doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId), scadenzaData);
                batch.update(profileRef, {
                    documenti: documents.map(item => item.id === linkedSourceRef.id ? { ...item, expiry_date: date } : item)
                });
                await batch.commit();
            } else if (editingScadenzaId) {
                await updateDoc(doc(db, "users", currentUser.uid, "scadenze", editingScadenzaId), scadenzaData);
            } else if (profileDocumentLinkDraft?.profileDocumentId) {
                const deadlineRef = doc(collection(db, "users", currentUser.uid, "scadenze"));
                finalDocId = deadlineRef.id;
                const profileRef = doc(db, 'users', currentUser.uid);
                const profileSnap = await getDoc(profileRef);
                const documents = profileSnap.data()?.documenti || [];
                const batch = writeBatch(db);
                batch.set(deadlineRef, scadenzaData);
                batch.update(profileRef, {
                    documenti: documents.map(item => item.id === profileDocumentLinkDraft.profileDocumentId
                        ? { ...item, expiryReference: { deadlineId: finalDocId } }
                        : item)
                });
                await batch.commit();
                sessionStorage.removeItem('profile-deadline-link-draft');
                profileDocumentLinkDraft = null;
            } else {
                const docRef = await addDoc(collection(db, "users", currentUser.uid, "scadenze"), scadenzaData);
                finalDocId = docRef.id;
            }

            LOG(`[FRONTEND-TRACE] Documento ${finalDocId} salvato. Trigger backend atteso.`);

            // Aggiorna il campo 'names' nel documento config corretto per l'autocomplete
            if (!editingScadenzaId && name) {
                let configDocName = 'generalConfig';
                if (currentMode === 'automezzi') configDocName = 'deadlineConfig';
                else if (currentMode === 'documenti') configDocName = 'deadlineConfigDocuments';
                setDoc(
                    doc(db, "users", currentUser.uid, "settings", configDocName),
                    { names: arrayUnion(name) },
                    { merge: true }
                ).catch(e => console.warn('[TRACE] names update failed:', e));

                // Salva anche le email nel config della modalità corrente (Opzione B)
                const emailsToSave = recipients.map(recipient => recipient.email);
                if (emailsToSave.length > 0) {
                    setDoc(
                        doc(db, "users", currentUser.uid, "settings", configDocName),
                        { notificationEmails: arrayUnion(...emailsToSave) },
                        { merge: true }
                    ).catch(e => console.warn('[TRACE] emails update failed:', e));
                }
            }

            if (btnText) btnText.textContent = "Completato!";
            showToast(editingScadenzaId ? "Scadenza aggiornata!" : "Scadenza salvata!", "success");

            setTimeout(() => {
                window.location.replace(`dettaglio_scadenza.html?id=${finalDocId}`);
            }, 1000);

        } catch (e) {
            console.error("[FRONTEND-ERROR] Errore critico nel flusso di salvataggio:", e);
            showToast("Errore durante il salvataggio: " + e.message, "error");
            btnSave.disabled = false;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
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
        linkedSourceRef = data.sourceRef || null;

        // 1. Identifica il Mode corretto in base al tipo salvato
        let foundMode = 'automezzi';
        if (unifiedConfigs.documenti?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'documenti';
        else if (unifiedConfigs.generali?.deadlineTypes?.some(t => (t.name || t) === data.type)) foundMode = 'generali';

        // 2. Imposta il Mode (popola i select nativi)
        setMode(foundMode);

        // 3. Riempi i campi base e i menu a tendina
        document.getElementById('nome_cognome').value = data.name || '';
        if (typeSelect && data.type) typeSelect.value = data.type;

        const modVeicolo = document.getElementById('modello_veicolo');
        if (modVeicolo && data.veicolo_modello) modVeicolo.value = data.veicolo_modello;

        const notifChannel = document.getElementById('notif_channel_select');
        if (notifChannel && data.notifChannel) notifChannel.value = data.notifChannel;
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
                dateInput.dataset.isoValue = `${year}-${month}-${day}`;
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

        // 4. Notifiche (Valori numerici)
        const dNotice = document.getElementById('display_notif_days');
        const iNotice = document.getElementById('notif_days_before');
        const period = data.notif_days_before || data.period || '14';
        if (dNotice) dNotice.textContent = period;
        if (iNotice) iNotice.value = period;

        const dFreq = document.getElementById('display_notif_freq');
        const iFreq = document.getElementById('notif_frequency');
        const freq = data.notif_frequency || data.freq || '7';
        if (dFreq) dFreq.textContent = freq;
        if (iFreq) iFreq.value = freq;


        const storedRecipients = Array.isArray(data.recipients) ? data.recipients : [];
        const legacyEmails = Array.isArray(data.emails)
            ? data.emails.map(email => typeof email === 'object' && email !== null ? email.address : email)
            : [data.email1, data.email2];
        deadlineRecipients = (storedRecipients.length ? storedRecipients : legacyEmails
            .filter(Boolean).map(email => ({ email, sendEmail: true, sendPush: false })))
            .map(recipient => ({
                contactId: String(recipient.contactId || ''),
                displayName: String(recipient.displayName || recipient.name || '').trim(),
                email: normalizeRecipientEmail(recipient.email || recipient.address),
                sendEmail: recipient.sendEmail !== false,
                sendPush: recipient.sendPush === true
            })).filter(recipient => isValidRecipientEmail(recipient.email));
        renderDeadlineRecipients();

        const testoEmailSelect = document.getElementById('testo_email_select');
        if (data.templateText && testoEmailSelect) {
            const opt = Array.from(testoEmailSelect.options).find(o => o.value === data.templateText);
            if (opt) { testoEmailSelect.value = data.templateText; }
        }

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

            if (['testo_email_select', 'modello_veicolo'].includes(select.id)) {
                if (typeof updatePreview === 'function') updatePreview();
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
                createElement('span', {
                    textContent: opt.textContent,
                    className: 'truncate',
                    dataset: opt.dataset.t ? { t: opt.dataset.t } : {}
                })
            ]);

            // Add delete button for user-defined items (skip placeholders or manual triggers)
            const isUserItem = opt.value && !['manual', ''].includes(opt.value);
            const isManageable = ['tipo_scadenza', 'modello_veicolo', 'testo_email_select', 'email_primaria_select', 'email_secondaria_select'].includes(sel.id);

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

                // --- Nuovo: Aggiorna campi notifica se presenti nel dataset dell'opzione ---
                if (sel.id === 'tipo_scadenza') {
                    if (opt.dataset.period) {
                        const displayPeriod = document.getElementById('display_notif_days');
                        const inputPeriod = document.getElementById('notif_days_before');
                        if (displayPeriod) displayPeriod.textContent = opt.dataset.period;
                        if (inputPeriod) inputPeriod.value = opt.dataset.period;
                    }
                    if (opt.dataset.freq) {
                        const displayFreq = document.getElementById('display_notif_freq');
                        const inputFreq = document.getElementById('notif_frequency');
                        if (displayFreq) displayFreq.textContent = opt.dataset.freq;
                        if (inputFreq) inputFreq.value = opt.dataset.freq;
                    }
                }

                parent.classList.remove('show');
            };
            parent.appendChild(item);
        }
    });
}

function updatePreview() {
    const previewArea = document.getElementById('oggetto_email');
    if (!previewArea) return;

    const templateText = document.getElementById('testo_email_select')?.value || '';
    if (!templateText) {
        previewArea.value = '';
        return;
    }

    let compiledText = '';
    if (currentMode === 'automezzi') {
        const vehicle = document.getElementById('modello_veicolo')?.value || '';
        const vehicleStr = vehicle ? ` ${vehicle.trim()}` : '';
        compiledText = `E' in scadenza ${templateText.trim()}${vehicleStr}`;
    } else if (currentMode === 'documenti') {
        const vehicle = document.getElementById('modello_veicolo')?.value || '';
        let code = vehicle.trim();
        if (code.includes(' - ')) {
            code = code.split(' - ')[1].trim();
        }
        const vehicleStr = code ? ` ${code}` : '';
        compiledText = `E' in scadenza ${templateText.trim()}${vehicleStr}`;
    } else {
        compiledText = `E' in scadenza ${templateText.trim()}`;
    }

    previewArea.value = compiledText;
}
