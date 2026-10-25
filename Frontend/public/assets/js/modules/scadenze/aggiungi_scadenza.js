/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { auth } from '../../firebase-config.js?v=1.2.235';
import { getFooterReady } from '../../footer-state.js';
import { LOG } from '../../logger.js';
import { onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';

import { getCurrentLanguage, t } from '../../translations.js';
import { initDatePickerV5 } from '../../datepicker_v5.js';
import { normalizeExternalUrl } from '../shared/attachment-security.js';
import { getDeadline, getUserProfile, getUserSetting, listContacts } from '../data/vault-repository.js';
import { deadlineRecipientsFromRecord, normalizeRecipientEmail } from './deadline-recipient-model.js';
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
import {
    DEADLINE_FORM_DOMAINS,
    buildDeadlineRuleCatalog,
    deadlineRuleLinkFields,
    findDeadlineParameter,
    findDeadlineRule
} from './deadline-form-model.js';
import { saveDeadline } from './deadline-save-service.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
const typeSelect = document.getElementById('tipo_scadenza');

let currentUser = null;
let currentMode = 'automezzi';
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');
const attachmentController = createDeadlineAttachmentController();
const recipientController = createDeadlineRecipientController({ onManageContacts: openRecipientManager });
let profileDocumentLinkDraft = null;
let accountDeadlineLinkDraft = null;
let linkedSourceRef = null;
let profileDocumentEditorData = null;
let deadlineRuleCatalog = [];
let currentDeadlineRule = null;
let currentDeadlineParameter = null;

const PROFILE_DEADLINE_DRAFT_KEY = 'profile-deadline-link-draft';
const ACCOUNT_DEADLINE_DRAFT_KEY = 'account-deadline-link-draft';

function availableDeadlineRules() {
    const personalOnly = isProfileDocumentEditor();
    return deadlineRuleCatalog.filter(rule => personalOnly ? rule.domain === 'personal' : rule.domain !== 'personal');
}

function replaceSelectOptions(select, entries, placeholder) {
    if (!select) return;
    clearElement(select);
    if (placeholder) select.appendChild(new Option(placeholder, ''));
    entries.forEach(entry => select.appendChild(new Option(entry.label, entry.value)));
}

function normalizeComparable(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[’`´]/g, "'").toLocaleLowerCase('it-IT').replace(/'/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function valuesMatch(left, right) {
    return normalizeComparable(left) === normalizeComparable(right);
}

async function loadDeadlineFormCatalog(user) {
    const [deadlineConfig, deadlineConfigDocuments, generalConfig, profile, contacts] = await Promise.all([
        getUserSetting(user.uid, 'deadlineConfig'),
        getUserSetting(user.uid, 'deadlineConfigDocuments'),
        getUserSetting(user.uid, 'generalConfig'),
        getUserProfile(user.uid),
        listContacts(user.uid)
    ]);
    const general = generalConfig || {};
    const recipientContacts = (contacts || []).filter(contact => contact.active !== false);
    (general.notificationEmails || []).forEach(email => {
        const normalized = normalizeRecipientEmail(email);
        if (normalized && !recipientContacts.some(contact => normalizeRecipientEmail(contact.email) === normalized)) {
            recipientContacts.push({id: '', nome: 'Email salvata', cognome: '', email: normalized});
        }
    });
    recipientController.setContacts(recipientContacts);
    const names = [...new Set([
        ...(deadlineConfig?.names || []),
        ...(deadlineConfigDocuments?.names || []),
        ...(general.names || []),
        profile?.displayName,
        ...recipientContacts.map(contact => [contact.nome, contact.cognome].filter(Boolean).join(' ').trim())
    ].filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right), 'it'));
    const namesList = document.getElementById('names-list');
    if (namesList) {
        clearElement(namesList);
        names.forEach(name => namesList.appendChild(new Option(name, name)));
    }
    return buildDeadlineRuleCatalog({
        deadlineConfig: deadlineConfig || {},
        deadlineConfigDocuments: deadlineConfigDocuments || {},
        generalConfig: general
    });
}

function deadlineDomainLabel(domain) {
    const entry = DEADLINE_FORM_DOMAINS.find(item => item.id === domain);
    return entry ? t(entry.labelKey) : domain;
}

function setDeadlineRuleSummary() {
    const name = document.getElementById('deadline-rule-summary-name');
    const schedule = document.getElementById('deadline-rule-summary-schedule');
    if (name) name.textContent = currentDeadlineRule
        ? `${deadlineDomainLabel(currentDeadlineRule.domain)} · ${currentDeadlineRule.name}` : '—';
    if (schedule) schedule.textContent = currentDeadlineRule
        ? `${t('deadline_personal_notice')} ${currentDeadlineRule.period} ${t('deadline_personal_days')} · ${t('deadline_personal_frequency')} ${currentDeadlineRule.frequency} ${t('deadline_personal_days')}` : '—';
}

function applyDeadlineRuleValues() {
    if (!currentDeadlineRule) return;
    currentMode = currentDeadlineRule.mode;
    setMode(currentMode);
    selectValuePreservingCustomOption(typeSelect, currentDeadlineRule.name, {
        period: currentDeadlineRule.period,
        freq: currentDeadlineRule.frequency
    });
    const parameter = currentDeadlineParameter;
    const detailSelect = document.getElementById('modello_veicolo');
    if (detailSelect && parameter?.detail) selectValuePreservingCustomOption(detailSelect, parameter.detail);
    const templateSelect = document.getElementById('testo_email_select');
    if (templateSelect && parameter?.templateText) {
        selectValuePreservingCustomOption(templateSelect, parameter.templateText);
    }
    const notice = document.getElementById('notif_days_before');
    const frequency = document.getElementById('notif_frequency');
    if (notice) notice.value = String(currentDeadlineRule.period);
    if (frequency) frequency.value = String(currentDeadlineRule.frequency);
    setDeadlineRuleSummary();
    document.getElementById('deadline-rule-summary')?.classList.remove('hidden');
    updatePreview();
}

function hasPreferredParameter(preferred = {}) {
    return Boolean(preferred.ruleParameterId || preferred.detail);
}

function renderDeadlineParameters(preferred = {}, {selectFirst = false} = {}) {
    const select = document.getElementById('deadline-parameter-select');
    const sourceParameters = currentDeadlineRule?.parameters || [];
    const preferredParameter = hasPreferredParameter(preferred)
        ? findDeadlineParameter(currentDeadlineRule, preferred)
        : null;
    replaceSelectOptions(select, sourceParameters.map(parameter => ({
        value: parameter.id,
        label: parameter.label || parameter.detail || currentDeadlineRule.name
    })), sourceParameters.length ? t('deadline_form_select_reference') : t('deadline_form_no_parameter'));
    currentDeadlineParameter = preferredParameter || (selectFirst ? sourceParameters[0] : null) || null;
    if (select) {
        select.disabled = !sourceParameters.length;
        select.value = currentDeadlineParameter?.id || '';
    }
    document.getElementById('deadline-parameter-field')?.classList.toggle('hidden', !currentDeadlineRule);
    applyDeadlineRuleValues();
}

function deadlineFormDomains() {
    return isProfileDocumentEditor()
        ? DEADLINE_FORM_DOMAINS.filter(domain => domain.id === 'personal')
        : DEADLINE_FORM_DOMAINS;
}

function renderDeadlineDomainTabs(selectedDomain = '') {
    const container = document.getElementById('deadline-domain-tabs');
    if (!container) return;
    setChildren(container, deadlineFormDomains().map(domain => createElement('button', {
        type: 'button',
        className: 'deadline-domain-tab',
        role: 'tab',
        'aria-selected': String(domain.id === selectedDomain),
        tabIndex: domain.id === selectedDomain || (!selectedDomain && domain.id === deadlineFormDomains()[0]?.id) ? 0 : -1,
        dataset: {deadlineDomain: domain.id},
        disabled: isProfileDocumentEditor(),
        'aria-disabled': String(isProfileDocumentEditor()),
        onclick: () => {
            const domainSelect = document.getElementById('deadline-domain-select');
            if (domainSelect) domainSelect.value = domain.id;
            renderDeadlineDomainTabs(domain.id);
            renderDeadlineRules();
            [...container.querySelectorAll('[role="tab"]')]
                .find(tab => tab.dataset.deadlineDomain === domain.id)?.focus();
        }
    }, [
        createElement('span', {
            className: 'material-symbols-outlined notranslate',
            translate: 'no',
            textContent: domain.icon
        }),
        createElement('span', {textContent: t(domain.labelKey)})
    ])));
}

function clearDeadlineRuleState({clearRules = true} = {}) {
    currentDeadlineRule = null;
    currentDeadlineParameter = null;
    if (clearRules) {
        replaceSelectOptions(document.getElementById('deadline-rule-select'), [], t('deadline_form_select_rule'));
    }
    replaceSelectOptions(document.getElementById('deadline-parameter-select'), [], t('deadline_form_select_reference'));
    document.getElementById('deadline-parameter-select')?.setAttribute('disabled', '');
    document.getElementById('deadline-rule-summary')?.classList.add('hidden');
    setDeadlineRuleSummary();
    updatePreview();
}

function renderDeadlineRules(preferred = {}) {
    const domainSelect = document.getElementById('deadline-domain-select');
    const ruleSelect = document.getElementById('deadline-rule-select');
    const selectedDomain = domainSelect?.value || '';
    const rules = availableDeadlineRules().filter(rule => rule.domain === selectedDomain);
    const preferredRule = findDeadlineRule(rules, preferred);
    const personalGuidance = selectedDomain === 'personal' && !isProfileDocumentEditor();
    const noRules = Boolean(selectedDomain) && !personalGuidance && !rules.length;
    document.getElementById('deadline-personal-guidance')?.classList.toggle('hidden', !personalGuidance);
    document.getElementById('deadline-domain-empty-state')?.classList.toggle('hidden', !noRules);
    document.getElementById('deadline-rule-fields')?.classList.toggle('hidden', !selectedDomain || personalGuidance || noRules);
    replaceSelectOptions(ruleSelect, rules.map(rule => ({value: rule.id, label: rule.name})), t('deadline_form_select_rule'));
    currentDeadlineRule = preferredRule || null;
    if (ruleSelect) {
        ruleSelect.disabled = !rules.length;
        ruleSelect.value = currentDeadlineRule?.id || '';
    }
    if (!currentDeadlineRule) {
        clearDeadlineRuleState({clearRules: !rules.length});
        document.getElementById('deadline-rule-fields')?.classList.toggle('hidden', !selectedDomain || personalGuidance || noRules);
        return;
    }
    renderDeadlineParameters(preferred, {selectFirst: isProfileDocumentEditor()});
}

function selectDeadlineRule(preferred = {}) {
    const domainSelect = document.getElementById('deadline-domain-select');
    const candidates = availableDeadlineRules();
    const preferredRule = findDeadlineRule(candidates, preferred);
    const preferredDomain = preferredRule?.domain || preferred.ruleDomain || preferred.domain;
    const domains = deadlineFormDomains();
    replaceSelectOptions(domainSelect, domains.map(domain => ({value: domain.id, label: t(domain.labelKey)})), t('deadline_form_select_domain'));
    if (domainSelect) domainSelect.value = domains.some(domain => domain.id === preferredDomain)
        ? preferredDomain : (isProfileDocumentEditor() ? 'personal' : '');
    renderDeadlineDomainTabs(domainSelect?.value || '');
    renderDeadlineRules({...preferred, ruleId: preferredRule?.ruleId || preferred.ruleId});
}

function initDeadlineRuleSelector() {
    const domainSelect = document.getElementById('deadline-domain-select');
    const domains = deadlineFormDomains();
    replaceSelectOptions(domainSelect, domains.map(domain => ({value: domain.id, label: t(domain.labelKey)})), t('deadline_form_select_domain'));
    const initialDomain = isProfileDocumentEditor() ? 'personal' : '';
    if (domainSelect) domainSelect.value = initialDomain;
    renderDeadlineDomainTabs(initialDomain);
    domainSelect?.addEventListener('change', () => {
        renderDeadlineDomainTabs(domainSelect.value);
        renderDeadlineRules();
    });
    document.getElementById('deadline-domain-tabs')?.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
        const currentIndex = tabs.indexOf(document.activeElement);
        if (currentIndex < 0 || !tabs.length) return;
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        tabs[(currentIndex + delta + tabs.length) % tabs.length]?.focus();
    });
    document.getElementById('deadline-rule-select')?.addEventListener('change', event => {
        currentDeadlineRule = availableDeadlineRules().find(rule => rule.id === event.currentTarget.value) || null;
        if (!currentDeadlineRule) {
            clearDeadlineRuleState({clearRules: false});
            return;
        }
        renderDeadlineParameters();
    });
    document.getElementById('deadline-parameter-select')?.addEventListener('change', event => {
        currentDeadlineParameter = currentDeadlineRule?.parameters.find(parameter => parameter.id === event.currentTarget.value) || null;
        applyDeadlineRuleValues();
    });
    renderDeadlineRules();
}

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
        frequency: document.getElementById('notif_frequency')?.value,
        ...deadlineRuleLinkFields(currentDeadlineRule, currentDeadlineParameter)
    };
}

function isProfileDocumentEditor() {
    return Boolean(profileDocumentLinkDraft?.profileDocumentId || linkedSourceRef?.type === 'profileDocument');
}

function lockDeadlineRuleSelector() {
    document.getElementById('deadline-rule-selector-section')?.classList.add('deadline-rule-locked');
    document.getElementById('deadline-domain-select')?.setAttribute('disabled', '');
    document.getElementById('deadline-rule-select')?.setAttribute('disabled', '');
    document.getElementById('deadline-parameter-select')?.setAttribute('disabled', '');
    document.querySelectorAll('#deadline-domain-tabs [role="tab"]').forEach(tab => {
        tab.disabled = true;
        tab.setAttribute('aria-disabled', 'true');
    });
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
    document.getElementById('deadline-date-field')?.classList.remove('hidden');
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
        preview.readOnly = true;
        preview.setAttribute('aria-readonly', 'true');
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
    selectDeadlineRule(fields);
    const nameInput = document.getElementById('nome_cognome');
    if (nameInput) nameInput.value = fields.name || '';
    if (typeSelect && fields.type) selectValuePreservingCustomOption(typeSelect, fields.type);
    const dateInput = document.getElementById('dueDate');
    if (dateInput) {
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
    let option = Array.from(select.options).find(item => valuesMatch(item.value, value));
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
    deadlineRuleCatalog = [];
    currentDeadlineRule = null;
    currentDeadlineParameter = null;

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

    // Il calendario è disponibile anche per le Scadenze collegate: il
    // salvataggio aggiorna nella stessa transazione Scadenza e Documento.
    initDatePickerV5('dueDate');

    attachmentController.init();
    const linkedDraftAttachments = profileDocumentLinkDraft?.attachments || accountDeadlineLinkDraft?.attachments;
    if (linkedDraftAttachments) {
        attachmentController.setExistingAttachments(linkedDraftAttachments);
    }

    recipientController.init(user.email);

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

    try {
        deadlineRuleCatalog = await loadDeadlineFormCatalog(currentUser);
        initDeadlineRuleSelector();
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
                    dateInput.classList.add('linked-document-date');
                    document.getElementById('linked-document-date-help')?.classList.remove('hidden');
                }
            }
            if (typeSelect && sourceDraft.documentType) selectValuePreservingCustomOption(typeSelect, sourceDraft.documentType);
            if (typeSelect && profileDocumentLinkDraft?.profileDocumentId) {
                const documentType = profileDocumentLinkDraft.documentType || '';
                selectDeadlineRule({type: documentType, domain: 'personal'});
                const schedule = currentDeadlineRule
                    ? {period: currentDeadlineRule.period, freq: currentDeadlineRule.frequency}
                    : null;
                selectValuePreservingCustomOption(typeSelect, documentType, schedule || {});
                const noticeInput = document.getElementById('notif_days_before');
                const frequencyInput = document.getElementById('notif_frequency');
                if (schedule?.period !== undefined) {
                    if (noticeInput) noticeInput.value = String(schedule.period);
                }
                if (schedule?.freq !== undefined) {
                    if (frequencyInput) frequencyInput.value = String(schedule.freq);
                }
                const template = currentDeadlineParameter?.templateText || documentType;
                const templateSelect = document.getElementById('testo_email_select');
                if (templateSelect && template) selectValuePreservingCustomOption(templateSelect, template);
                configureProfileDocumentEditor(sourceDraft, {suggestedTemplate: template});
                lockDeadlineRuleSelector();
            } else if (sourceDraft.documentType) {
                selectDeadlineRule({type: sourceDraft.documentType, detail: sourceDraft.detail});
            }
            const detailsSelect = document.getElementById('modello_veicolo');
            if (detailsSelect && sourceDraft.detail) {
                selectValuePreservingCustomOption(detailsSelect, sourceDraft.detail);
            }
        }
    }

    restoreDeadlineEditorAfterRecipientManagement();

    
}
function setMode(mode) {
    currentMode = mode;
    // Il nuovo form usa Ambito → Regola → Parametro. Le vecchie select
    // restano soltanto come adattatore per leggere e modificare record legacy.
    document.getElementById('vehicle_fields_wrapper')?.classList.add('hidden');
    document.getElementById('deadline-category-field')?.classList.add('hidden');
    document.getElementById('testo_email_wrapper')?.classList.add('hidden');
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
        const type = currentDeadlineRule?.name || typeSelect.value;
        const dateInput = document.getElementById('dueDate');
        const date = deadlineDateForSave(profileDocumentLinkDraft, dateInput.dataset.isoValue, dateInput.value);

        if (!name || !currentDeadlineRule || !currentDeadlineParameter || !date) {
            return showToast(t('deadline_form_required'), "error");
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

            const selectedVehicle = currentDeadlineParameter.detail || '';
            const vehicleParts = currentDeadlineParameter.model || currentDeadlineParameter.plate
                ? {model: currentDeadlineParameter.model || '', plate: currentDeadlineParameter.plate || ''}
                : null;
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
                        : selectedVehicle,
                    vehicleModel: vehicleParts?.model || '',
                    vehiclePlate: vehicleParts?.plate || '',
                    referenceUrl,
                    notes: document.getElementById('notes').value,
                    status: 'active',
                    completed: false,
                    templateText: document.getElementById('oggetto_email')?.value.trim()
                        || currentDeadlineParameter.templateText || '',
                    notifChannel: 'multichannel',
                    notif_days_before: Number(currentDeadlineRule.period),
                    notif_frequency: Number(currentDeadlineRule.frequency),
                    ...deadlineRuleLinkFields(currentDeadlineRule, currentDeadlineParameter)
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
        selectDeadlineRule({
            ruleId: data.ruleId,
            ruleSourceId: data.ruleSourceId,
            ruleRouteKey: data.ruleRouteKey,
            ruleParameterId: data.ruleParameterId,
            ruleDomain: data.ruleDomain,
            type: data.type,
            detail: data.veicolo_modello
        });

        // 1. Identifica il Mode corretto in base al tipo salvato
        const foundMode = currentDeadlineRule?.mode || (linkedSourceRef?.type === 'profileDocument'
            ? 'documenti'
            : 'generali');

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
        const period = currentDeadlineRule?.period ?? data.notif_days_before ?? data.period ?? '14';
        if (iNotice) iNotice.value = period;

        const iFreq = document.getElementById('notif_frequency');
        const freq = currentDeadlineRule?.frequency ?? data.notif_frequency ?? data.freq ?? '7';
        if (iFreq) iFreq.value = freq;


        recipientController.setRecipients(deadlineRecipientsFromRecord(data));

        const testoEmailSelect = document.getElementById('testo_email_select');
        if (data.templateText && testoEmailSelect) {
            selectValuePreservingCustomOption(testoEmailSelect, data.templateText);
        }

        if (linkedSourceRef?.type === 'profileDocument') {
            dateInput.classList.add('linked-document-date');
            document.getElementById('linked-document-date-help')?.classList.remove('hidden');
            let sourceDraft = null;
            try {
                const {loadLinkedDocumentDeadlineDraft} = await import('../privato/profile-document-deadline-link.js?v=1.2.235');
                sourceDraft = await loadLinkedDocumentDeadlineDraft(currentUser.uid, linkedSourceRef.id);
            } catch (error) {
                console.warn('[TRACE] Documento sorgente non disponibile per il riepilogo:', error?.message || error);
            }
            configureProfileDocumentEditor(sourceDraft || {
                name: data.name,
                documentType: data.type,
                detail: data.veicolo_modello,
                dueDate: dateFields.isoValue
            }, {suggestedTemplate: currentDeadlineParameter?.templateText || data.templateText});
            lockDeadlineRuleSelector();
        }

        // 6. Allegati esistenti
        attachmentController.setExistingAttachments(data.attachments);

        // 7. Refresh Anteprima Oggetto
        updatePreview();

    } catch (e) {
        console.error("Errore caricamento modifica:", e);
        showToast("Errore nel caricamento dei dati", "error");
    }
}

function updatePreview() {
    const previewArea = document.getElementById('oggetto_email');
    if (!previewArea) return;

    if (currentDeadlineRule && currentDeadlineParameter) {
        if (isProfileDocumentEditor() && profileDocumentEditorData) {
            previewArea.value = profileDocumentDeadlineMessage({
                ...profileDocumentEditorData,
                templateText: currentDeadlineParameter.templateText || currentDeadlineRule.name
            }, t);
        } else {
            previewArea.value = currentDeadlineParameter.templateText
                || `È in scadenza ${currentDeadlineRule.name}`;
        }
        return;
    }

    previewArea.value = '';
}
