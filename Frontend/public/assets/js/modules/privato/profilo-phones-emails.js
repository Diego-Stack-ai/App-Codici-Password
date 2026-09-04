/**
 * PROFILO PRIVATO — PHONES & EMAILS MODULE (V1.0)
 * Render e CRUD per telefoni ed email del profilo privato.
 * Estratto da profilo_privato.js.
 *
 * Init: initPhonesEmailsModule(getState, callbacks)
 * Import graph (no circular deps):
 *   profilo_privato.js → profilo-phones-emails.js → profilo-modal.js, profilo-sync.js
 */

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { showProfileModal } from './profilo-modal.js';

let _getState = null;
let _callbacks = null;

/**
 * Inizializza il modulo telefoni + email.
 * @param {Function} getState - () => { contactPhones, contactEmails, profileLabels, qrCodeInclusions }
 * @param {{ syncData: Function, toggleQRInclusion: Function, deletePhone: Function, deleteEmail: Function }} callbacks
 */
export function initPhonesEmailsModule(getState, callbacks) {
    _getState = getState;
    _callbacks = callbacks;
}

// ─── Helper locale ────────────────────────────────────────────────────────────

function createCopyBtn(text) {
    return createElement('button', {
        className: 'btn-action-mini',
        title: 'Copia',
        onclick: (e) => {
            e.stopPropagation();
            if (!text || text === '-') return;
            navigator.clipboard.writeText(text);
            showToast(t('copied') || 'Copiato!', 'success');
        }
    }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'content_copy' })
    ]);
}

// ─── PHONES ──────────────────────────────────────────────────────────────────

export function renderPhonesView() {
    if (!_getState) return;  // moduli non ancora inizializzati
    const { contactPhones } = _getState();
    const container = document.getElementById('telefoni-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_call' }),
        createElement('span', { textContent: t('add_phone') || 'Aggiungi Telefono' })
    ]);
    btnAdd.onclick = () => _addPhone();

    const cards = contactPhones.map((phone, idx) => _createPhoneCard(phone, idx));
    setChildren(container, [btnAdd, ...cards]);
}

function _createPhoneCard(phone, idx) {
    const { qrCodeInclusions } = _getState();
    return createElement('div', {
        className: 'form-card profile-data-card'
    }, [
        createElement('div', { className: 'card-header-row' }, [
            createElement('div', { className: 'card-icon-stack' }, [
                createElement('div', { className: 'card-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: 'call' })
                ]),
                createElement('span', { className: 'card-title-accent', textContent: phone.label || 'Telefono' })
            ]),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', onclick: () => editPhone(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', onclick: () => _callbacks.deletePhone(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                ])
            ])
        ]),
        createElement('div', { className: 'card-fields-container' }, [
            createElement('div', { className: 'card-field-group' }, [
                createElement('div', { className: 'field-header' }, [
                    createElement('input', {
                        type: 'checkbox',
                        className: 'qr-checkbox',
                        checked: qrCodeInclusions.phones.includes(idx),
                        onclick: (e) => { e.stopPropagation(); _callbacks.toggleQRInclusion('phones', idx); }
                    }),
                    createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                    createElement('span', { className: 'data-label', textContent: 'Numero' })
                ]),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: phone.number || '-' }),
                    createCopyBtn(phone.number)
                ])
            ])
        ])
    ]);
}

async function _addPhone() {
    const { profileLabels, contactPhones } = _getState();
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.phoneLabels, configKey: 'phoneLabels' },
        { key: 'number', label: 'Numero', icon: 'call' }
    ];
    showProfileModal('Aggiungi Telefono', fields, {}, async (newData) => {
        try {
            contactPhones.push(newData);
            await _callbacks.syncData();
            renderPhonesView();
            showToast(t('success_save'), 'success');
        } catch (e) {
            contactPhones.pop();
            console.error('[addPhone] Errore:', e);
            showToast('Errore durante il salvataggio del telefono.', 'error');
        }
    });
}

export async function editPhone(idx) {
    const { profileLabels, contactPhones } = _getState();
    const phone = contactPhones[idx];
    if (!phone.label) phone.label = profileLabels.phoneLabels[0];
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.phoneLabels, configKey: 'phoneLabels' },
        { key: 'number', label: 'Numero', icon: 'call' }
    ];
    showProfileModal('Modifica Telefono', fields, phone, async (newData) => {
        const backup = { ...contactPhones[idx] };
        try {
            contactPhones[idx] = newData;
            await _callbacks.syncData();
            renderPhonesView();
            showToast(t('success_save'), 'success');
        } catch (e) {
            contactPhones[idx] = backup;
            console.error('[editPhone] Errore:', e);
            showToast('Errore durante la modifica del telefono.', 'error');
        }
    });
}

// ─── EMAILS ──────────────────────────────────────────────────────────────────

export function renderEmailsView() {
    if (!_getState) return;  // moduli non ancora inizializzati
    const { contactEmails, qrCodeInclusions } = _getState();
    const container = document.getElementById('email-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'alternate_email' }),
        createElement('span', { textContent: t('add_email') })
    ]);
    btnAdd.onclick = () => editEmail(-1);

    const items = contactEmails.map((e, idx) => createElement('div', {
        className: 'form-card profile-data-card'
    }, [
        createElement('div', { className: 'card-header-row' }, [
            createElement('div', { className: 'field-header' }, [
                createElement('input', {
                    type: 'checkbox',
                    className: 'qr-checkbox',
                    checked: qrCodeInclusions.emails.includes(idx),
                    onclick: (ev) => { ev.stopPropagation(); _callbacks.toggleQRInclusion('emails', idx); }
                }),
                createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                createElement('span', { className: 'card-title-accent', textContent: e.label || 'Email' })
            ]),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-email', idx } }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-email', idx } }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                ])
            ])
        ]),
        createElement('div', { className: 'card-fields-container' }, [
            createElement('div', { className: 'field-value-row' }, [
                createElement('span', { className: 'data-value truncate', textContent: e.address || '-' }),
                createCopyBtn(e.address)
            ]),
            e.password ? createElement('div', { className: 'field-value-row' }, [
                createElement('span', { className: 'data-value-sub', textContent: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', dataset: { pwd: e.password, visible: 'false' } }),
                createElement('div', { className: 'flex-center-row profile-password-actions' }, [
                    createElement('button', {
                        className: 'btn-action-mini',
                        onclick: (event) => {
                            event.stopPropagation();
                            const span = event.currentTarget.parentElement.parentElement.querySelector('.data-value-sub');
                            const isVisible = span.dataset.visible === 'true';
                            span.textContent = isVisible ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : span.dataset.pwd;
                            span.dataset.visible = !isVisible;
                            event.currentTarget.querySelector('span').textContent = isVisible ? 'visibility' : 'visibility_off';
                        }
                    }, [createElement('span', { className: 'material-symbols-outlined profile-mini-action-icon', textContent: 'visibility' })]),
                    createCopyBtn(e.password)
                ])
            ]) : createElement('span', { className: 'data-value-sub', textContent: 'No PWD' }),
            e.note ? createElement('div', {
                className: 'note-display-lite profile-contact-note'
            }, [createElement('span', { textContent: e.note })]) : null
        ])
    ]));

    setChildren(container, [btnAdd, ...items]);
}

async function _addEmail() {
    const { profileLabels, contactEmails } = _getState();
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' },
        { key: 'note', label: 'Note (opzionale)', icon: 'notes', type: 'textarea' }
    ];
    showProfileModal('Aggiungi Email', fields, { label: profileLabels.emailLabels[0] }, async (newData) => {
        try {
            contactEmails.push(newData);
            await _callbacks.syncData();
            renderEmailsView();
            showToast(t('success_save'), 'success');
        } catch (e) {
            contactEmails.pop();
            console.error('[addEmail] Errore:', e);
            showToast("Errore durante il salvataggio dell'email.", 'error');
        }
    });
}

export async function editEmail(idx) {
    if (idx === -1) { _addEmail(); return; }
    const { profileLabels, contactEmails } = _getState();
    const email = contactEmails[idx];
    if (!email.label) email.label = profileLabels.emailLabels[0];
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' },
        { key: 'note', label: 'Note (opzionale)', icon: 'notes', type: 'textarea' }
    ];
    showProfileModal('Modifica Email', fields, email, async (newData) => {
        const backup = { ...contactEmails[idx] };
        try {
            contactEmails[idx] = newData;
            await _callbacks.syncData();
            renderEmailsView();
            showToast(t('success_save'), 'success');
        } catch (e) {
            contactEmails[idx] = backup;
            console.error('[editEmail] Errore:', e);
            showToast("Errore durante la modifica dell'email.", 'error');
        }
    });
}
