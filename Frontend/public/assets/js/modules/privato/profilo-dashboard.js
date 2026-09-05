import { createElement, setChildren } from '../../dom-utils.js';
import { buildProfileOverview } from './profile-model.js';

let _getState;
let _callbacks;

export function initProfileDashboard(getState, callbacks) {
    _getState = getState;
    _callbacks = callbacks;
    setupTabs();
    renderProfileOverview();
    renderDigitalCard();
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
    const summary = [
        ['badge', 'Codice fiscale', overview.fiscalCode || 'Non indicato'],
        ['call', 'Telefono principale', overview.primaryPhone?.number || 'Non indicato'],
        ['mail', 'Email principale', overview.primaryEmail?.address || 'Non indicata'],
        ['home', 'Indirizzo principale', overview.primaryAddress ?
            `${overview.primaryAddress.address || ''} ${overview.primaryAddress.civic || ''}, ${overview.primaryAddress.city || ''}`.trim() : 'Non indicato']
    ];
    const cards = summary.map(([icon, label, value]) => createElement('article', { className: 'profile-summary-card' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: icon }),
        createElement('div', {}, [
            createElement('span', { className: 'data-label', textContent: label }),
            createElement('p', { className: 'data-value', textContent: value })
        ])
    ]));
    const expiryItems = overview.expiringDocuments.length
        ? overview.expiringDocuments.map(item => createElement('button', {
            className: 'profile-expiry-item',
            textContent: `${item.type || 'Documento'} — ${item.expiry_date}`,
            onclick: () => activateProfileTab('documents')
        }))
        : [createElement('p', { className: 'card-no-data', textContent: 'Nessun documento in scadenza nei prossimi 90 giorni.' })];
    setChildren(container, [
        createElement('div', { className: 'profile-overview-heading' }, [
            createElement('div', {}, [
                createElement('span', { className: 'data-label', textContent: 'Profilo personale' }),
                createElement('h2', { className: 'profile-overview-name', textContent: overview.fullName || 'Utente' })
            ]),
            createElement('button', { className: 'btn-upload-trigger', textContent: 'Modifica anagrafica', onclick: () => activateProfileTab('personal') })
        ]),
        createElement('div', { className: 'profile-summary-grid' }, cards),
        createElement('section', { className: 'form-card profile-expiry-card' }, [
            createElement('h3', { className: 'form-section-title', textContent: 'Documenti prossimi alla scadenza' }),
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
    const vcardSize = new TextEncoder().encode(_callbacks.getVCard()).length;
    const capacityWarning = vcardSize > 1200;
    const selected = (type, item, index) => state.qrCodeInclusions[type]?.includes(item.id) || state.qrCodeInclusions[type]?.includes(index);
    const choices = [
        qrChoice('Nome e cognome', state.qrCodeInclusions.nome, value => _callbacks.setQRScalar('nome', value)),
        qrChoice('Codice fiscale', state.qrCodeInclusions.cf, value => _callbacks.setQRScalar('cf', value), 'Dato personale: sarà leggibile da chi scansiona il QR.'),
        qrChoice('Dati di nascita', state.qrCodeInclusions.nascita, value => _callbacks.setQRScalar('nascita', value), 'Dato personale: condividilo solo se necessario.'),
        ...state.contactPhones.map((item, index) => qrChoice(`Telefono: ${item.label || item.number}`, selected('phones', item, index), () => _callbacks.toggleQRInclusion('phones', item.id))),
        ...state.contactEmails.map((item, index) => qrChoice(`Email: ${item.label || item.address}`, selected('emails', item, index), () => _callbacks.toggleQRInclusion('emails', item.id))),
        ...state.userAddresses.map((item, index) => qrChoice(`Indirizzo: ${item.type || item.address}`, selected('addresses', item, index), () => _callbacks.toggleQRInclusion('addresses', item.id))),
        ...(state.customWidgets || []).flatMap(widget => (widget.fields || [])
            .filter(field => !field.encrypted && !['sensitive', 'password', 'pin', 'puk', 'attachment', 'pdf', 'photo'].includes(field.type))
            .map(field => qrChoice(`Campo personalizzato: ${field.label}`, field.includeInQr === true,
                value => _callbacks.setWidgetFieldQr(widget.id, field.id, value))))
    ];
    const qrWrapper = document.querySelector('.qr-code-wrapper');
    setChildren(container, [
        createElement('div', { className: 'digital-card-layout' }, [
            createElement('section', { className: 'form-card digital-card-preview' }, [
                createElement('h2', { className: 'form-section-title', textContent: 'Anteprima Tessera digitale' }),
                qrWrapper,
                createElement('p', { className: 'digital-card-warning', textContent: 'Il QR contiene dati in chiaro. Password, PIN, chiavi e allegati sono sempre esclusi.' }),
                createElement('p', {
                    className: capacityWarning ? 'digital-card-capacity is-warning' : 'digital-card-capacity',
                    textContent: capacityWarning
                        ? `Il QR contiene ${vcardSize} byte: riduci i campi per renderlo più facile da leggere.`
                        : `Capacità utilizzata: ${vcardSize} byte.`
                }),
                createElement('div', { className: 'digital-card-actions' }, [
                    createElement('button', { className: 'btn-upload-trigger', textContent: 'Salva vCard', onclick: () => _callbacks.downloadVCard() }),
                    createElement('button', { className: 'btn-upload-trigger', textContent: 'Condividi', onclick: () => _callbacks.shareVCard() })
                ])
            ]),
            createElement('section', { className: 'form-card digital-card-fields' }, [
                createElement('h2', { className: 'form-section-title', textContent: 'Dati inclusi' }),
                createElement('p', { className: 'data-value-sub', textContent: 'Nessun dato viene incluso automaticamente. Ogni scelta aggiorna subito il QR.' }),
                ...choices
            ])
        ])
    ]);
}
