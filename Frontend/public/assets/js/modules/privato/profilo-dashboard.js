import { createElement, setChildren } from '../../dom-utils.js';
import { buildProfileOverview } from './profile-model.js';
import { t } from '../../translations.js';

const formatTranslation = (key, values = {}) => Object.entries(values)
    .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

let _getState;
let _callbacks;

export function initProfileDashboard(getState, callbacks) {
    _getState = getState;
    _callbacks = callbacks;
    setupTabs();
    renderProfileOverview();
}

function setupTabs() {
    const tabs = [...document.querySelectorAll('[data-profile-tab-target]')];
    tabs.forEach((tab, index) => {
        tab.id = `profile-tab-${tab.dataset.profileTabTarget}`;
        tab.tabIndex = index === 0 ? 0 : -1;
        tab.onclick = () => activateProfileTab(tab.dataset.profileTabTarget);
        tab.onkeydown = event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            let next = index;
            if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            tabs[next].focus();
            activateProfileTab(tabs[next].dataset.profileTabTarget);
        };
    });
}

export function activateProfileTab(name) {
    document.querySelectorAll('[data-profile-tab-target]').forEach(tab => {
        const active = tab.dataset.profileTabTarget === name;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-profile-tab]').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.profileTab !== name);
    });
    sessionStorage.setItem('profile-active-tab', name);
    _callbacks?.onTabActivated?.(name);
}

export function renderProfileOverview() {
    const container = document.getElementById('profile-overview');
    if (!container || !_getState) return;
    const state = _getState();
    const overview = buildProfileOverview({
        ...state.currentUserData,
        contactPhones: state.contactPhones,
        contactEmails: state.contactEmails,
        userAddresses: state.userAddresses,
        documenti: state.userDocuments
    });
    const notProvided = t('profile_value_not_provided');
    const summary = [
        ['badge', t('label_cf'), overview.fiscalCode || notProvided, _callbacks?.editFiscalDocument],
        ['call', t('profile_primary_phone'), overview.primaryPhone?.number || notProvided],
        ['mail', t('profile_primary_email'), overview.primaryEmail?.address || notProvided],
        ['home', t('profile_primary_address'), overview.primaryAddress ?
            `${overview.primaryAddress.address || ''} ${overview.primaryAddress.civic || ''}, ${overview.primaryAddress.city || ''}`.trim() : notProvided]
    ];
    const cards = summary.map(([icon, label, value, onActivate]) => createElement(onActivate ? 'button' : 'article', {
        className: `profile-summary-card${onActivate ? ' profile-summary-card-action' : ''}`,
        type: onActivate ? 'button' : undefined,
        onclick: onActivate
    }, [
        createElement('span', { className: 'material-symbols-outlined notranslate', textContent: icon }),
        createElement('div', {}, [
            createElement('span', { className: 'data-label', textContent: label }),
            createElement('p', { className: 'data-value', textContent: value })
        ])
    ]));
    const expiryItems = overview.expiringDocuments.length
        ? overview.expiringDocuments.map(item => createElement('button', {
            className: 'profile-expiry-item',
            textContent: `${item.type || t('profile_document_fallback')} — ${item.expiry_date}`,
            onclick: () => activateProfileTab('documents')
        }))
        : [createElement('p', { className: 'card-no-data', textContent: t('profile_no_expiring_documents') })];
    setChildren(container, [
        createElement('div', { className: 'profile-overview-heading' }, [
            createElement('div', {}, [
                createElement('span', { className: 'data-label', textContent: t('profile_overview_label') }),
                createElement('h2', { className: 'profile-overview-name', textContent: overview.fullName || t('profile_user_fallback') })
            ]),
            createElement('button', {
                className: 'btn-upload-trigger',
                textContent: t('profile_edit_personal'),
                onclick: () => {
                    activateProfileTab('personal');
                    _callbacks?.editPersonalData?.();
                }
            })
        ]),
        createElement('div', { className: 'profile-summary-grid' }, cards),
        createElement('section', { className: 'form-card profile-expiry-card' }, [
            createElement('h3', { className: 'form-section-title', textContent: t('profile_expiring_documents') }),
            ...expiryItems
        ])
    ]);
    const preferred = new URLSearchParams(window.location.search).get('profileTab') || sessionStorage.getItem('profile-active-tab');
    if (preferred) activateProfileTab(preferred);
    const documentId = new URLSearchParams(window.location.search).get('profileDocumentId');
    if (documentId) requestAnimationFrame(() => document.querySelector(`[data-profile-document-id="${CSS.escape(documentId)}"]`)?.scrollIntoView({ block: 'center' }));
}

function qrChoice(label, checked, onChange, warning = '') {
    return createElement('label', { className: 'digital-card-choice' }, [
        createElement('input', { type: 'checkbox', checked, onchange: event => onChange(event.target.checked) }),
        createElement('span', {}, [
            createElement('strong', { textContent: label }),
            warning ? createElement('small', { textContent: warning }) : null
        ].filter(Boolean))
    ]);
}

export function renderDigitalCard() {
    const container = document.getElementById('profile-digital-card');
    if (!container || !_getState) return;
    const state = _getState();
    const vcardSize = new TextEncoder().encode(_callbacks.getQRPayload?.() || _callbacks.getVCard()).length;
    const capacityWarning = vcardSize > 1200;
    const selected = (type, item, index) => state.qrCodeInclusions[type]?.includes(item.id) || state.qrCodeInclusions[type]?.includes(index);
    const choices = [
        qrChoice(t('digital_card_photo_choice'), state.qrCodeInclusions.photo === true, value => _callbacks.setQRScalar('photo', value), t('digital_card_photo_warning')),
        qrChoice(t('label_name_surname'), state.qrCodeInclusions.nome, value => _callbacks.setQRScalar('nome', value)),
        qrChoice(t('label_cf'), state.qrCodeInclusions.cf, value => _callbacks.setQRScalar('cf', value), t('digital_card_cf_warning')),
        qrChoice(t('label_birth_data'), state.qrCodeInclusions.nascita, value => _callbacks.setQRScalar('nascita', value), t('digital_card_birth_warning')),
        ...state.contactPhones.map((item, index) => qrChoice(`${t('phone')}: ${item.label || item.number}`, selected('phones', item, index), () => _callbacks.toggleQRInclusion('phones', item.id))),
        ...state.contactEmails.map((item, index) => qrChoice(`${t('email_label')}: ${item.label || item.address}`, selected('emails', item, index), () => _callbacks.toggleQRInclusion('emails', item.id))),
        ...state.userAddresses.map((item, index) => qrChoice(`${t('address')}: ${item.type || item.address}`, selected('addresses', item, index), () => _callbacks.toggleQRInclusion('addresses', item.id))),
        ...(state.customWidgets || []).flatMap(widget => (widget.fields || [])
            .filter(field => !field.encrypted && !['sensitive', 'password', 'pin', 'puk', 'attachment', 'pdf', 'photo'].includes(field.type))
            .map(field => qrChoice(`${t('digital_card_custom_field')}: ${field.label}`, field.includeInQr === true,
                value => _callbacks.setWidgetFieldQr(widget.id, field.id, value))))
    ];
    const qrWrapper = document.querySelector('.qr-code-wrapper');
    setChildren(container, [
        createElement('div', { className: 'digital-card-layout' }, [
            createElement('section', { className: 'form-card digital-card-preview' }, [
                createElement('h2', { className: 'form-section-title', textContent: t('digital_card_preview_title') }),
                qrWrapper,
                createElement('p', { className: 'digital-card-warning', textContent: t('digital_card_plaintext_warning') }),
                createElement('p', {
                    className: capacityWarning ? 'digital-card-capacity is-warning' : 'digital-card-capacity',
                    textContent: capacityWarning
                        ? formatTranslation('digital_card_capacity_warning', { bytes: vcardSize })
                        : formatTranslation('digital_card_capacity_used', { bytes: vcardSize })
                }),
                createElement('div', { className: 'digital-card-actions' }, [
                    createElement('button', { className: 'btn-upload-trigger', textContent: t('digital_card_save_vcard'), onclick: () => _callbacks.downloadVCard() }),
                    createElement('button', { className: 'btn-upload-trigger', textContent: t('digital_card_share'), onclick: () => _callbacks.shareVCard() })
                ])
            ]),
            createElement('section', { className: 'form-card digital-card-fields' }, [
                createElement('h2', { className: 'form-section-title', textContent: t('digital_card_included_data') }),
                createElement('p', { className: 'data-value-sub', textContent: t('digital_card_no_auto_include') }),
                ...choices
            ])
        ])
    ]);
}
