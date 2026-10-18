/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { auth } from '../../firebase-config.js?v=1.2.203';
import { getFooterReady } from '../../footer-state.js';
import { LOG } from '../../logger.js';
import { onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';

import { getCurrentLanguage, t } from '../../translations.js';
import { initDatePickerV5 } from '../../datepicker_v5.js';
import { normalizeExternalUrl } from '../shared/attachment-security.js';
import { getDeadline } from '../data/vault-repository.js';
import { deadlineRecipientsFromRecord } from './deadline-recipient-model.js';
import {
    deadlineDateDisplay,
    deadlineDateForSave,
    deadlineDateInputFields,
    profileDocumentDeadlineMessage
} from './deadline-model.js';
import { createDeadlineAttachmentController } from './deadline-attachment-controller.js';
import { createDeadlineRecipientController } from './deadline-recipient-controller.js';
import {
    DEADLINE_EDITOR_RETURN_DRAFT_KEY,
    consumeDeadlineEditorReturnDraft,
    createDeadlineEditorReturnDraft,
    deadlineEditorReturnTarget
} from './deadline-editor-return-draft.js';
import { createDeadlineConfigController, deadlineConfigValuesMatch } from './deadline-config-controller.js';
import { saveDeadline } from './deadline-save-service.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
const typeSelect = document.getElementById('tipo_scadenza');

let currentUser = null;
let currentMode = 'automezzi';
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');
const attachmentController = createDeadlineAttachmentController();
const recipientController = createDeadlineRecipientController({ onManageContacts: openRecipientManager });
const configController = createDeadlineConfigController({
    recipientController,
    onRender: () => syncCustomDropdowns()
});
let profileDocumentLinkDraft = null;
let accountDeadlineLinkDraft = null;
let linkedSourceRef = null;
let profileDocumentEditorData = null;

const PROFILE_DEADLINE_DRAFT_KEY = 'profile-deadline-link-draft';
const ACCOUNT_DEADLINE_DRAFT_KEY = 'account-deadline-link-draft';

function deadlineEditorFieldValues() {
    const dateInput = document.getElementById('dueDate');
    return {
        name: document.getElementById('nome_cognome')?.value,
        type: typeSelect?.value,
        dueDate: dateInput?.value,
        dueDateIso: dateInput?.dataset.isoValue,
        detail: document.getElementById('modello_veicolo')?.value,
        referenceUrl: document.getElementById('deadline_url')?.value,
        notes: document.getElementById('notes')?.value,
        templateText: isProfileDocumentEditor()
            ? document.getElementById('oggetto_email')?.value
            : document.getElementById('testo_email_select')?.value,
        notice: document.getElementById('notif_days_before')?.value,
        frequency: document.getElementById('notif_frequency')?.value
    };
}

function isProfileDocumentEditor() {
    return Boolean(profileDocumentLinkDraft?.profileDocumentId || linkedSourceRef?.type === 'profileDocument');
}

function legacyDocumentNumber(detail = '') {
    const parts = String(detail || '').split(' - ');
    return (parts.length > 1 ? parts.slice(1).join(' - ') : parts[0]).trim();
}

function setSummaryValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value || '').trim() || t('profile_document_not_provided');
}

function configureProfileDocumentEditor(data = {}, {suggestedTemplate = '', message = ''} = {}) {
    profileDocumentEditorData = {
        name: String(data.name || '').trim(),
        documentType: String(data.documentType || data.type || '').trim(),
        documentNumber: String(data.documentNumber || legacyDocumentNumber(data.detail || data.veicolo_modello)).trim(),
        documentIssuer: String(data.documentIssuer || '').trim(),
        dueDate: String(data.dueDate || '').trim()
    };
    document.getElementById('deadline-mode-selector')?.classList.add('hidden');
    document.getElementById('deadline-generic-info-section')?.classList.add('hidden');
    document.getElementById('deadline-date-field')?.classList.add('hidden');
    document.getElementById('profile-document-summary')?.classList.remove('hidden');
    document.getElementById('testo_email_wrapper')?.classList.add('hidden');
    document.getElementById('vehicle_fields_wrapper')?.classList.add('hidden');
    document.getElementById('profile-document-message-help')?.classList.remove('hidden');

    setSummaryValue('profile-document-holder', profileDocumentEditorData.name);
    setSummaryValue('profile-document-type', profileDocumentEditorData.documentType);
    setSummaryValue('profile-document-number', profileDocumentEditorData.documentNumber);
    setSummaryValue('profile-document-issuer', profileDocumentEditorData.documentIssuer);
    setSummaryValue('profile-document-expiry', deadlineDateDisplay(profileDocumentEditorData.dueDate, getCurrentLanguage()));

    const messageLabel = document.getElementById('deadline-message-label');
    if (messageLabel) {
        messageLabel.dataset.t = 'profile_document_message_label';
        messageLabel.textContent = t('profile_document_message_label');
    }
    const preview = document.getElementById('oggetto_email');
    if (preview) {
        preview.readOnly = false;
        preview.removeAttribute('aria-readonly');
        preview.classList.remove('italic');
        preview.closest('.input-wrapper')?.classList.remove('read-only');
        preview.value = String(message || '').trim() || profileDocumentDeadlineMessage({
            ...profileDocumentEditorData,
            templateText: suggestedTemplate
        }, t);
    }
}

async function openRecipientManager(returnTo) {
    if (attachmentController.getSelectedFiles().length) {
        const confirmed = await showConfirmModal(
            t('notification_recipients'),
            t('recipient_attachment_navigation_warning'),
            t('confirm'),
            t('cancel')
        );
        if (!confirmed) return;
    }
    const draft = createDeadlineEditorReturnDraft({
        ownerUid: currentUser?.uid,
        returnTarget: returnTo,
        mode: currentMode,
        fields: deadlineEditorFieldValues(),
        recipients: recipientController.getRecipients()
    });
    if (!draft) return showToast(t('recipient_manager_unavailable'), 'error');
    try {
        sessionStorage.setItem(DEADLINE_EDITOR_RETURN_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        return showToast(t('deadline_draft_preserve_error'), 'error');
    }
    window.location.href = `gestione_destinatari.html?return=${encodeURIComponent(returnTo)}`;
}

function restoreDeadlineEditorAfterRecipientManagement() {
    const draft = consumeDeadlineEditorReturnDraft(sessionStorage, {
        ownerUid: currentUser?.uid,
        returnTarget: deadlineEditorReturnTarget(window.location)
    });
    if (!draft) return;
    setMode(draft.mode);
    const fields = draft.fields || {};
    const nameInput = document.getElementById('nome_cognome');
    if (nameInput) nameInput.value = fields.name || '';
    if (typeSelect && fields.type) selectValuePreservingCustomOption(typeSelect, fields.type);
    const dateInput = document.getElementById('dueDate');
    if (dateInput && !profileDocumentLinkDraft) {
        dateInput.value = fields.dueDate || '';
        dateInput.dataset.isoValue = fields.dueDateIso || '';
    }
    const detailSelect = document.getElementById('modello_veicolo');
    if (detailSelect && fields.detail) selectValuePreservingCustomOption(detailSelect, fields.detail);
    const templateSelect = document.getElementById('testo_email_select');
    if (isProfileDocumentEditor()) {
        const preview = document.getElementById('oggetto_email');
        if (preview && fields.templateText) preview.value = fields.templateText;
    } else if (templateSelect && fields.templateText) {
        selectValuePreservingCustomOption(templateSelect, fields.templateText);
    }
    const directValues = {
        deadline_url: fields.referenceUrl,
        notes: fields.notes,
        notif_days_before: fields.notice,
        notif_frequency: fields.frequency
    };
    Object.entries(directValues).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.value = value || '';
    });
    const contactsById = new Map(recipientController.getContacts()
        .filter(contact => contact.id)
        .map(contact => [contact.id, contact]));
    const reconciledRecipients = (draft.recipients || []).map(recipient => {
        const contact = contactsById.get(recipient.contactId);
        return contact ? {
            ...recipient,
            displayName: [contact.nome, contact.cognome].filter(Boolean).join(' ').trim(),
            email: contact.email
        } : recipient;
    });
    recipientController.setRecipients(reconciledRecipients);
    syncCustomDropdowns();
    updatePreview();
    showToast(t('deadline_draft_restored'), 'success');
}

function discardProfileDocumentDraft() {
    sessionStorage.removeItem(PROFILE_DEADLINE_DRAFT_KEY);
    profileDocumentLinkDraft = null;
}

function discardAccountDeadlineDraft() {
    sessionStorage.removeItem(ACCOUNT_DEADLINE_DRAFT_KEY);
    accountDeadlineLinkDraft = null;
    linkedSourceRef = null;
}

function selectValuePreservingCustomOption(select, value, dataset = {}) {
    if (!select || !value) return null;
    let option = Array.from(select.options).find(item => deadlineConfigValuesMatch(item.value, value));
    if (!option) {
        option = new Option(value, value);
        select.appendChild(option);
    }
    Object.entries(dataset).forEach(([key, entry]) => {
        if (entry !== undefined && entry !== null) option.dataset[key] = String(entry);
    });
    select.value = option.value;
    return option;
}

/**
 * AGGIUNGI SCADENZA MODULE (V5.0 ADAPTER)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * - Entry Point: initAggiungiScadenza(user)
 */

export async function initAggiungiScadenza(user) {
    
    if (!user) return;
    currentUser = user;
    profileDocumentLinkDraft = null;
    accountDeadlineLinkDraft = null;
    linkedSourceRef = null;
    profileDocumentEditorData = null;

    editingScadenzaId = new URLSearchParams(window.location.search).get('id');
    const profileDocumentId = new URLSearchParams(window.location.search).get('profileDocumentId');
    if (!editingScadenzaId && profileDocumentId) {
        try {
            const draft = JSON.parse(sessionStorage.getItem(PROFILE_DEADLINE_DRAFT_KEY) || 'null');
            if (draft?.profileDocumentId === profileDocumentId && draft.ownerUid === user.uid) {
                profileDocumentLinkDraft = draft;
            } else {
                discardProfileDocumentDraft();
            }
        } catch {
            discardProfileDocumentDraft();
        }
    } else {
        discardProfileDocumentDraft();
    }
    const accountSource = new URLSearchParams(window.location.search).get('accountSource');
    if (!editingScadenzaId && accountSource === '1') {
        try {
            const draft = JSON.parse(sessionStorage.getItem(ACCOUNT_DEADLINE_DRAFT_KEY) || 'null');
            if (draft?.sourceRef?.type === 'account' && draft.sourceRef.id) {
                accountDeadlineLinkDraft = draft;
                linkedSourceRef = draft.sourceRef;
            } else {
                discardAccountDeadlineDraft();
            }
        } catch {
            discardAccountDeadlineDraft();
        }
    } else {
        discardAccountDeadlineDraft();
    }

    // Mode Switching Listeners
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
    });

    // La data delle Scadenze collegate deriva esclusivamente dal Documento.
    // Il calendario resta disponibile per tutte le altre Scadenze.
    if (!profileDocumentLinkDraft) initDatePickerV5('dueDate');

    initProxyDropdowns();
    attachmentController.init();
    const linkedDraftAttachments = profileDocumentLinkDraft?.attachments || accountDeadlineLinkDraft?.attachments;
    if (linkedDraftAttachments) {
        attachmentController.setExistingAttachments(linkedDraftAttachments);
    }

    recipientController.init();

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
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'tune' })
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
                if (!editingScadenzaId) {
                    discardProfileDocumentDraft();
                    discardAccountDeadlineDraft();
                }
                if (editingScadenzaId) window.location.href = `dettaglio_scadenza.html?id=${editingScadenzaId}`;
                else window.location.href = 'scadenze.html';
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'close' })
        ]);

        const saveBtn = createElement('button', {
            id: 'save-btn',
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva Scadenza',
            dataset: { label: t('save_short') || 'Salva' }
        }, [
            createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'save' })
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

    configController.initManagementButtons();
    configController.render();
    try {
        await configController.load(currentUser);
    } catch (error) {
        console.error('Config Load Error', error);
    }
    updateAttachmentsUI();

    if (editingScadenzaId) {
        // UI update immediately
        const pageTitle = document.querySelector('.detail-title-value');
        if (pageTitle) pageTitle.textContent = "Modifica Scadenza";
        await loadScadenzaForEdit(editingScadenzaId);
    } else {
        // Forza l'aggiornamento UI per la modalità di default ('automezzi') in "Aggiungi"
        setMode(currentMode);
        const sourceDraft = profileDocumentLinkDraft || accountDeadlineLinkDraft;
        if (sourceDraft) {
            setMode(profileDocumentLinkDraft ? 'documenti' : 'generali');
            const nameInput = document.getElementById('nome_cognome');
            const dateInput = document.getElementById('dueDate');
            if (nameInput) nameInput.value = sourceDraft.name || 'Account';
            if (dateInput) {
                const dateFields = deadlineDateInputFields({dueDate: sourceDraft.dueDate}, getCurrentLanguage());
                dateInput.value = dateFields.displayValue;
                dateInput.dataset.isoValue = dateFields.isoValue;
                if (profileDocumentLinkDraft) {
                    dateInput.type = 'text';
                    dateInput.readOnly = true;
                    dateInput.setAttribute('aria-readonly', 'true');
                    dateInput.classList.add('linked-document-date');
                    document.getElementById('linked-document-date-help')?.classList.remove('hidden');
                }
            }
            if (typeSelect && sourceDraft.documentType) selectValuePreservingCustomOption(typeSelect, sourceDraft.documentType);
            if (typeSelect && profileDocumentLinkDraft?.profileDocumentId) {
                const documentType = profileDocumentLinkDraft.documentType || '';
                const schedule = configController.getSuggestedSchedule(documentType);
                selectValuePreservingCustomOption(typeSelect, documentType, schedule || {});
                const noticeInput = document.getElementById('notif_days_before');
                const frequencyInput = document.getElementById('notif_frequency');
                if (schedule?.period !== undefined) {
                    if (noticeInput) noticeInput.value = String(schedule.period);
                }
                if (schedule?.freq !== undefined) {
                    if (frequencyInput) frequencyInput.value = String(schedule.freq);
                }
                const template = configController.getSuggestedTemplate(documentType) || documentType;
                const templateSelect = document.getElementById('testo_email_select');
                if (templateSelect && template) selectValuePreservingCustomOption(templateSelect, template);
                configureProfileDocumentEditor(sourceDraft, {suggestedTemplate: template});
            }
            const detailsSelect = document.getElementById('modello_veicolo');
            if (detailsSelect && sourceDraft.detail) {
                selectValuePreservingCustomOption(detailsSelect, sourceDraft.detail);
            }
            syncCustomDropdowns();
        }
    }

    restoreDeadlineEditorAfterRecipientManagement();

    
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

    configController.setMode(mode);
    if (isProfileDocumentEditor()) {
        vehicleSection?.classList.add('hidden');
        document.getElementById('testo_email_wrapper')?.classList.add('hidden');
    }
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
        if (!auth.currentUser || auth.currentUser.uid !== currentUser?.uid) {
            discardProfileDocumentDraft();
            discardAccountDeadlineDraft();
            LOG("[FRONTEND] Click ignorato: sessione utente non coerente.");
            return;
        }
        if (isSubmitting) {
            LOG("[FRONTEND] Click ignorato: processo già in corso o utente non loggato.");
            return;
        }

        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const dateInput = document.getElementById('dueDate');
        const date = deadlineDateForSave(profileDocumentLinkDraft, dateInput.dataset.isoValue, dateInput.value);

        if (!name || !type || !date) {
            return showToast("Compila i campi obbligatori (Nome, Categoria, Data)", "error");
        }

        const rawReferenceUrl = document.getElementById('deadline_url')?.value.trim() || '';
        const referenceUrl = rawReferenceUrl ? normalizeExternalUrl(rawReferenceUrl) : '';
        if (rawReferenceUrl && !referenceUrl) {
            return showToast('Inserisci un URL valido (http o https).', 'error');
        }

        try {
            isSubmitting = true;
            LOG("[FRONTEND-TRACE] Lock UI attivato. Singolo salvataggio in corso...");

            // --- UI LOCK ---
            btnSave.disabled = true;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined animate-spin mr-2 notranslate', textContent: 'progress_activity' }),
                createElement('span', { id: 'save-btn-text', textContent: 'Inizio...' })
            ]);
            const btnText = document.getElementById('save-btn-text');

            const result = await saveDeadline({
                user: currentUser,
                editingDeadlineId: editingScadenzaId,
                profileDocumentLinkDraft,
                linkedSourceRef,
                mode: currentMode,
                data: {
                    name,
                    type,
                    dueDate: date,
                    veicolo_modello: isProfileDocumentEditor()
                        ? profileDocumentEditorData?.documentNumber || ''
                        : document.getElementById('modello_veicolo')?.value || '',
                    referenceUrl,
                    notes: document.getElementById('notes').value,
                    status: 'active',
                    completed: false,
                    templateText: isProfileDocumentEditor()
                        ? document.getElementById('oggetto_email')?.value.trim() || ''
                        : document.getElementById('testo_email_select')?.value || '',
                    notifChannel: 'multichannel',
                    notif_days_before: Number(document.getElementById('notif_days_before')?.value || 14),
                    notif_frequency: Number(document.getElementById('notif_frequency')?.value || 7)
                },
                recipients: recipientController.getRecipients(),
                selectedFiles: attachmentController.getSelectedFiles(),
                existingAttachments: attachmentController.getExistingAttachments(),
                onProgress(progress) {
                    if (!btnText) return;
                    btnText.textContent = progress.phase === 'upload'
                        ? `Upload ${progress.current}/${progress.total}...`
                        : 'Salvataggio DB...';
                }
            });
            const finalDocId = result.deadlineId;
            if (result.consumedProfileDocumentDraft) {
                discardProfileDocumentDraft();
            }
            if (!editingScadenzaId && accountDeadlineLinkDraft) {
                discardAccountDeadlineDraft();
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
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'save' })
            ]);
        }
    });
}

/**
 * SISTEMA ALLEGATI (V4.1)
 * Gestione Modali, Picker e Render
 */
async function showSuccessModal() {
    window.location.href = 'scadenze.html';
}

async function loadScadenzaForEdit(id) {
    try {
        const data = await getDeadline(currentUser.uid, id);
        if (!data) {
            showToast("Scadenza non trovata", "error");
            return;
        }
        linkedSourceRef = data.sourceRef || null;

        // 1. Identifica il Mode corretto in base al tipo salvato
        const foundMode = linkedSourceRef?.type === 'profileDocument'
            ? 'documenti'
            : configController.getModeForDeadlineType(data.type);

        // 2. Imposta il Mode (popola i select nativi)
        setMode(foundMode);

        // 3. Riempi i campi base e i menu a tendina
        document.getElementById('nome_cognome').value = data.name || '';
        if (typeSelect && data.type) selectValuePreservingCustomOption(typeSelect, data.type);

        const modVeicolo = document.getElementById('modello_veicolo');
        if (modVeicolo && data.veicolo_modello) selectValuePreservingCustomOption(modVeicolo, data.veicolo_modello);

        const notifChannel = document.getElementById('notif_channel_select');
        if (notifChannel && data.notifChannel) notifChannel.value = data.notifChannel;
        const dateInput = document.getElementById('dueDate');
        const dateFields = deadlineDateInputFields(data, getCurrentLanguage());
        dateInput.value = dateFields.displayValue;
        dateInput.dataset.isoValue = dateFields.isoValue;
        const referenceUrlInput = document.getElementById('deadline_url');
        if (referenceUrlInput) referenceUrlInput.value = data.referenceUrl || data.url || '';
        document.getElementById('notes').value = data.notes || '';

        // 4. Notifiche (Valori numerici)
        const iNotice = document.getElementById('notif_days_before');
        const period = data.notif_days_before || data.period || '14';
        if (iNotice) iNotice.value = period;

        const iFreq = document.getElementById('notif_frequency');
        const freq = data.notif_frequency || data.freq || '7';
        if (iFreq) iFreq.value = freq;


        recipientController.setRecipients(deadlineRecipientsFromRecord(data));

        const testoEmailSelect = document.getElementById('testo_email_select');
        if (data.templateText && testoEmailSelect) {
            selectValuePreservingCustomOption(testoEmailSelect, data.templateText);
        }

        if (linkedSourceRef?.type === 'profileDocument') {
            dateInput.type = 'text';
            dateInput.readOnly = true;
            dateInput.setAttribute('aria-readonly', 'true');
            let sourceDraft = null;
            try {
                const {loadLinkedDocumentDeadlineDraft} = await import('../privato/profile-document-deadline-link.js?v=1.2.203');
                sourceDraft = await loadLinkedDocumentDeadlineDraft(currentUser.uid, linkedSourceRef.id);
            } catch (error) {
                console.warn('[TRACE] Documento sorgente non disponibile per il riepilogo:', error?.message || error);
            }
            configureProfileDocumentEditor(sourceDraft || {
                name: data.name,
                documentType: data.type,
                detail: data.veicolo_modello,
                dueDate: dateFields.isoValue
            }, {message: data.templateText});
        }

        // 6. Allegati esistenti
        attachmentController.setExistingAttachments(data.attachments);

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
                        configController.editItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'edit' })
                ]);

                const delBtn = createElement('button', {
                    type: 'button',
                    className: 'btn-delete-opt',
                    title: 'Elimina voce',
                    onclick: (e) => {
                        e.stopPropagation();
                        configController.deleteItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'delete' })
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
                        const inputPeriod = document.getElementById('notif_days_before');
                        if (inputPeriod) inputPeriod.value = opt.dataset.period;
                    }
                    if (opt.dataset.freq) {
                        const inputFreq = document.getElementById('notif_frequency');
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

    if (isProfileDocumentEditor()) return;

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
