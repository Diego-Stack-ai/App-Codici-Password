/**
 * PROFILO PRIVATO — ADDRESSES & DOCUMENTS MODULE (V1.0)
 * Render di indirizzi, utenze e documenti del profilo privato.
 * Estratto da profilo_privato.js.
 *
 * Init: initAddressesDocsModule(getState, callbacks)
 * Import graph (no circular deps):
 *   profilo_privato.js → profilo-addresses-docs.js → dom-utils, translations, utils
 */

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { formatDateToIT } from '../../utils.js';

let _getState = null;
let _callbacks = null;

/**
 * Inizializza il modulo indirizzi + documenti.
 * @param {Function} getState - () => { userAddresses, qrCodeInclusions, userDocuments }
 * @param {{ toggleQRInclusion: Function, onAddAddress: Function }} callbacks
 */
export function initAddressesDocsModule(getState, callbacks) {
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

// ─── ADDRESSES ───────────────────────────────────────────────────────────────

export function renderAddressesView() {
    if (!_getState) return;  // moduli non ancora inizializzati
    const { userAddresses } = _getState();
    const container = document.getElementById('indirizzi-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_location_alt' }),
        createElement('span', { textContent: t('add_address') })
    ]);
    btnAdd.onclick = () => _callbacks.onAddAddress();

    const cards = userAddresses.map((addr, idx) => _createAddressCard(addr, idx));
    setChildren(container, [btnAdd, ...cards]);
}

function _createAddressCard(addr, idx) {
    const { qrCodeInclusions } = _getState();
    const card = createElement('div', {
        className: 'form-card',
        style: 'margin-bottom: 1.25rem; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: none;'
    }, [
        createElement('div', { className: 'card-header-row' }, [
            createElement('div', { className: 'card-icon-stack' }, [
                createElement('div', { className: 'card-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: addr.type === 'Lavoro' ? 'work' : 'home' })
                ]),
                createElement('span', { className: 'card-title-accent', textContent: addr.type || t('profile_addresses') })
            ]),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-address', idx } }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-address', idx } }, [
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
                        checked: qrCodeInclusions.addresses.includes(idx),
                        onclick: (e) => { e.stopPropagation(); _callbacks.toggleQRInclusion('addresses', idx); }
                    }),
                    createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                    createElement('span', { className: 'data-label', textContent: t('label_address') })
                ]),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: `${addr.address}, ${addr.civic}` }),
                    createCopyBtn(`${addr.address}, ${addr.civic}`)
                ])
            ]),
            createElement('div', { className: 'card-field-group' }, [
                createElement('span', { className: 'data-label', textContent: t('label_locality') }),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: `${addr.cap} ${addr.city} (${addr.province})` }),
                    createCopyBtn(`${addr.cap} ${addr.city} (${addr.province})`)
                ])
            ])
        ])
    ]);

    const utilsList = createElement('div', { className: 'card-utility-list' });
    _renderUtilitiesInCard(addr.utilities || [], utilsList, idx);
    card.appendChild(utilsList);

    const btnAddUtil = createElement('button', {
        className: 'btn-upload-trigger',
        dataset: { action: 'add-utility', idx }
    }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_circle' }),
        createElement('span', { textContent: t('add_utility') })
    ]);
    card.appendChild(btnAddUtil);

    return card;
}

function _renderUtilitiesInCard(utils, list, addrIdx) {
    if (utils.length === 0) {
        setChildren(list, createElement('span', { className: 'card-no-data', textContent: t('no_utilities') }));
        return;
    }
    const items = utils.map((u, uIdx) => createElement('div', { className: 'card-utility-item' }, [
        createElement('div', { className: 'card-utility-header' }, [
            createElement('span', { className: 'data-label', textContent: u.type }),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-utility', idx: addrIdx, uidx: uIdx } }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-utility', idx: addrIdx, uidx: uIdx } }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
                ])
            ])
        ]),
        createElement('div', { className: 'field-value-row' }, [
            createElement('span', { className: 'data-value', textContent: u.value }),
            createCopyBtn(u.value)
        ])
    ]));
    setChildren(list, items);
}

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export function renderDocumentiView() {
    if (!_getState) return;  // moduli non ancora inizializzati
    const { userDocuments } = _getState();
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_card' }),
        createElement('span', { textContent: t('add_doc') })
    ]);
    btnAdd.onclick = () => _callbacks.onAddDoc();

    const items = userDocuments.map((docItem, idx) => {
        const num = docItem.num_serie || docItem.cf_value || docItem.id_number || docItem.license_number || docItem.cf || '-';
        const subDetails = [];
        if (docItem.categoria) subDetails.push(docItem.categoria);
        if (docItem.rilasciato_da) subDetails.push(docItem.rilasciato_da);
        if (docItem.luogo_rilascio) subDetails.push(docItem.luogo_rilascio);
        if (docItem.id_number) subDetails.push(docItem.id_number);

        return createElement('div', { className: 'form-card' }, [
            createElement('div', { className: 'card-header-row' }, [
                createElement('div', { className: 'card-icon-stack' }, [
                    createElement('div', { className: 'card-icon-box' }, [
                        createElement('span', { className: 'material-symbols-outlined filled', textContent: 'description' })
                    ]),
                    createElement('span', { className: 'card-title-accent', textContent: docItem.type })
                ]),
                createElement('div', { className: 'card-actions-row' }, [
                    createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-doc', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                    ]),
                    createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-doc', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                    ])
                ])
            ]),
            createElement('div', { className: 'card-fields-container' }, [
                createElement('div', { className: 'card-field-group' }, [
                    createElement('div', { className: 'field-value-row' }, [
                        createElement('span', { className: 'data-value', textContent: num }),
                        createCopyBtn(num)
                    ]),
                    subDetails.length > 0 ? createElement('span', { className: 'data-value-sub', style: 'display: block; margin-bottom: 4px;', textContent: subDetails.join(' - ') }) : null,

                    // Blocco Dati Accesso / Sicurezza (PIN, PUK, Username, Password)
                    (docItem.username || docItem.password || docItem.pin || docItem.puk || docItem.codice_app) ? createElement('div', {
                        className: 'flex-col-gap-xs',
                        style: 'margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;'
                    }, [
                        docItem.username ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'USERNAME:' }),
                            createElement('span', { className: 'data-value truncate', style: 'flex: 1;', textContent: docItem.username }),
                            createCopyBtn(docItem.username)
                        ]) : null,
                        docItem.password ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PASSWORD:' }),
                            createElement('span', { className: 'data-value base-shield', style: 'flex: 1;', textContent: docItem.password, dataset: { pwd: docItem.password, visible: 'false' } }),
                            createElement('div', { className: 'flex-center-row', style: 'gap: 4px;' }, [
                                createElement('button', {
                                    className: 'btn-action-mini',
                                    onclick: (e) => {
                                        const span = e.currentTarget.parentElement.parentElement.querySelector('.data-value');
                                        const isVisible = span.dataset.visible === 'true';
                                        span.classList.toggle('base-shield', isVisible);
                                        span.dataset.visible = !isVisible;
                                        e.currentTarget.querySelector('span').textContent = isVisible ? 'visibility' : 'visibility_off';
                                    }
                                }, [createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'visibility' })]),
                                createCopyBtn(docItem.password)
                            ])
                        ]) : null,
                        docItem.pin ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PIN:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.pin }),
                            createCopyBtn(docItem.pin)
                        ]) : null,
                        docItem.puk ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PUK:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.puk }),
                            createCopyBtn(docItem.puk)
                        ]) : null,
                        docItem.codice_app ? createElement('div', { className: 'field-value-row' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'APP CODE:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.codice_app }),
                            createCopyBtn(docItem.codice_app)
                        ]) : null
                    ].filter(Boolean)) : null,

                    createElement('div', { className: 'flex-col-gap-xs', style: 'margin-top: 10px; opacity: 0.8;' }, [
                        docItem.data_rilascio ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px;' }, [
                            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'history' }),
                            createElement('span', { className: 'data-value-sub', textContent: `Emesso: ${formatDateToIT(docItem.data_rilascio)}` })
                        ]) : null,
                        docItem.expiry_date ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px;' }, [
                            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'event' }),
                            createElement('span', { className: 'data-value-sub', textContent: `Scadenza: ${formatDateToIT(docItem.expiry_date)}` })
                        ]) : null
                    ].filter(Boolean)),

                    docItem.home_page ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px; margin-top: 10px;' }, [
                        createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 18px; color: var(--accent);', textContent: 'language' }),
                        createElement('a', {
                            href: docItem.home_page.startsWith('http') ? docItem.home_page : `https://${docItem.home_page}`,
                            target: '_blank',
                            className: 'data-value-sub truncate underline',
                            style: 'color: var(--accent);',
                            textContent: docItem.home_page
                        })
                    ]) : null,

                    docItem.note ? createElement('p', {
                        className: 'note-text',
                        style: 'margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; font-style: italic;',
                        textContent: docItem.note
                    }) : null
                ])
            ])
        ]);
    });
    setChildren(container, [btnAdd, ...items]);
}
