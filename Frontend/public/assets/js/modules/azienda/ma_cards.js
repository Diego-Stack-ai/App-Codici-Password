/**
 * MA CARDS (V1.0)
 * Form dinamico: populateForm, email extra, sedi extra, createFieldBox.
 * Estratto da modifica_azienda.js (righe 269–632).
 *
 * Import graph: ma_state, ma_attachments, security-manager, dom-utils, ui-core, translations
 */

import { state } from './ma_state.js';
import { renderAttachments } from './ma_attachments.js';
import { decrypt, ensureMasterKey } from '../core/security-manager.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';

// ─── POPULATE FORM ────────────────────────────────────────────────────────────

export async function populateForm(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    set('ragione-sociale', data.ragioneSociale);
    set('forma-giuridica', data.formaGiuridica);
    set('tipo-sede-legale', data.tipoSedeLegale || 'Sede Legale');
    set('telefono-azienda', data.telefonoAzienda);
    set('fax-azienda', data.faxAzienda);
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('referente-ruolo', data.referenteTitolo || data.referenteRuolo);
    set('referente-nome', data.referenteNome);
    set('referente-cognome', data.referenteCognome);
    set('referente-cellulare', data.referenteCellulare);
    set('indirizzo', data.indirizzoSede);
    set('civico', data.civicoSede);
    set('citta', data.cittaSede);
    set('provincia', data.provinciaSede);
    set('cap', data.capSede);
    set('cciaa', data.numeroCCIAA);
    set('data-iscrizione', data.dataIscrizione);
    // note-azienda è cifrata: impostata dopo la decrittazione

    // 🔐 PROTOCOLLO BLINDA: logica decrypt hoistata fuori da if(data.emails)
    // così copre anche il campo note (cifrato in saveAzienda)
    let masterKey = null;
    const needsDecryption = data._encrypted === true;
    if (needsDecryption) {
        try { masterKey = await ensureMasterKey(); } catch (e) {
            showToast('Dati cifrati: chiave obbligatoria per modificare.', 'error');
            history.back();
            return;
        }
    }

    const decryptIfPossible = async (val) => {
        if (!needsDecryption || !val) return val;
        try { return await decrypt(val, masterKey); } catch (e) { return '---ERRORE DECRYPT---'; }
    };

    // Campo note (cifrato su save) → decifrato qui
    set('note-azienda', await decryptIfPossible(data.note));

    if (data.emails) {
        set('type-pec', data.emails.pec?.tipo || 'PEC Aziendale');
        set('email-pec', data.emails.pec?.email);
        set('email-pec-password', await decryptIfPossible(data.emails.pec?.password));
        set('email-pec-note', data.emails.pec?.note);
        set('type-amministrazione', data.emails.amministrazione?.tipo || 'Amministrazione');
        set('email-amministrazione', data.emails.amministrazione?.email);
        set('email-amministrazione-password', await decryptIfPossible(data.emails.amministrazione?.password));
        set('email-amministrazione-note', data.emails.amministrazione?.note);
        set('type-personale', data.emails.personale?.tipo || 'Personale');
        set('email-personale', data.emails.personale?.email);
        set('email-personale-password', await decryptIfPossible(data.emails.personale?.password));
        set('email-personale-note', data.emails.personale?.note);

        // Extra Sedi
        const sediContainer = document.getElementById('altre-sedi-container');
        if (sediContainer) clearElement(sediContainer);
        if (data.altreSedi && Array.isArray(data.altreSedi)) {
            data.altreSedi.forEach(s => addExtraSede(s));
        }

        // Extra Email (con decrittazione)
        const emailContainer = document.getElementById('email-extra-container');
        if (emailContainer) clearElement(emailContainer);
        if (data.emails.extra && Array.isArray(data.emails.extra)) {
            for (const item of data.emails.extra) {
                const decItem = { ...item, password: await decryptIfPossible(item.password) };
                addExtraEmail(decItem);
            }
        }
    }

    if (data.logo) {
        const p = document.getElementById('logo-preview');
        const h = document.getElementById('logo-placeholder');
        if (p) { p.src = data.logo; p.classList.remove('hidden'); }
        if (h) h.classList.add('hidden');
    }
    if (data.referentePhoto) {
        const p = document.getElementById('referente-photo-preview');
        const h = document.getElementById('referente-photo-placeholder');
        if (p) { p.src = data.referentePhoto; p.classList.remove('hidden'); }
        if (h) h.classList.add('hidden');
    }

    document.querySelectorAll('input[data-qr-field]').forEach(cb => {
        const field = cb.dataset.qrField;
        if (data.qrConfig && data.qrConfig.hasOwnProperty(field)) cb.checked = data.qrConfig[field];
    });

    state.existingAttachments = data.allegati || [];
    renderAttachments();
}

// ─── EXTRA EMAILS ─────────────────────────────────────────────────────────────

export function addExtraEmail(data = null) {
    const container = document.getElementById('email-extra-container');
    if (!container) return;
    const uniqueId = 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const bodyId = `body_${uniqueId}`;
    const arrowId = `arrow-${bodyId}`;

    const wrapper = createElement('div', { className: 'glass-card inside-card email-extra-item' });

    // HEADER
    const header = createElement('div', {
        className: 'email-card-header btn-toggle-section',
        'data-target': bodyId
    }, [
        createElement('input', {
            id: `type_${uniqueId}`,
            type: 'text',
            className: 'email-type-input email-type',
            placeholder: t('email_type_placeholder') || 'TIPO EMAIL',
            value: data ? data.tipo : '',
            'data-stop-propagation': true,
            autocomplete: 'new-password'
        }),
        createElement('div', { className: 'email-actions-group' }, [
            createElement('div', { className: 'field-action-qr opacity-40' }, [
                createElement('input', {
                    id: `qr_${uniqueId}`,
                    type: 'checkbox',
                    className: 'checkbox-qr email-qr',
                    checked: data ? (data.qr !== false) : true,
                    'data-stop-propagation': true
                }),
                createElement('label', { for: `qr_${uniqueId}`, className: 'sr-only', textContent: 'QR' })
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                'data-stop-propagation': true,
                onclick: () => wrapper.remove()
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]),
            createElement('span', {
                id: arrowId,
                className: 'material-symbols-outlined icon-chevron transition-transform',
                textContent: 'expand_more'
            })
        ])
    ]);

    // BODY
    const body = createElement('div', {
        id: bodyId,
        className: 'email-card-body collapsible-section'
    }, [
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('email_address') }),
            createElement('div', { className: 'detail-field-box border-glow' }, [
                createElement('input', {
                    type: 'email',
                    className: 'detail-field-input email-value',
                    placeholder: 'codex@codex.it',
                    value: data ? data.email : '',
                    autocomplete: 'new-password'
                })
            ])
        ]),
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('password') }),
            createElement('div', { className: 'detail-field-box border-glow' }, [
                createElement('input', {
                    id: `pass_${uniqueId}`,
                    type: 'text',
                    className: 'detail-field-input base-shield email-pass',
                    placeholder: 'Password',
                    value: data ? data.password : '',
                    autocomplete: 'new-password'
                }),
                createElement('div', { className: 'detail-field-actions' }, [
                    createElement('button', {
                        type: 'button',
                        className: 'btn-toggle-pass btn-icon-header',
                        'data-target': `pass_${uniqueId}`
                    }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'visibility' })
                    ])
                ])
            ])
        ]),
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('notes') }),
            createElement('div', { className: 'detail-field-box border-glow note-box' }, [
                createElement('textarea', {
                    className: 'form-textarea email-note',
                    placeholder: 'Note accessorie email...',
                    textContent: data ? data.note : '',
                    autocomplete: 'new-password'
                })
            ])
        ])
    ]);

    setChildren(wrapper, [header, body]);
    container.appendChild(wrapper);
}

// ─── EXTRA SEDI ───────────────────────────────────────────────────────────────

export function addExtraSede(data = null) {
    const container = document.getElementById('altre-sedi-container');
    if (!container) return;
    const uniqueId = 'sede-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const bodyId = `body_${uniqueId}`;
    const arrowId = `arrow-${bodyId}`;

    const wrapper = createElement('div', { className: 'glass-card inside-card extra-sede-item' });

    const header = createElement('div', {
        className: 'email-card-header btn-toggle-section',
        'data-target': bodyId
    }, [
        createElement('div', { className: 'flex items-center gap-3 flex-1' }, [
            createElement('span', { className: 'material-symbols-outlined icon-accent-blue', textContent: 'location_on' }),
            createElement('input', {
                id: `tipo_${uniqueId}`,
                type: 'text',
                className: 'email-type-input text-blue-400 sede-tipo',
                placeholder: t('office_type_placeholder') || 'Altra Sede',
                value: data ? (data.tipo || '') : '',
                'data-stop-propagation': true,
                autocomplete: 'off'
            })
        ]),
        createElement('div', { className: 'email-actions-group' }, [
            createElement('div', { className: 'field-action-qr opacity-40' }, [
                createElement('input', {
                    id: `qr_${uniqueId}`,
                    type: 'checkbox',
                    className: 'checkbox-qr sede-qr',
                    checked: data ? (data.qr !== false) : true,
                    'data-stop-propagation': true,
                    'aria-label': 'Includi sede nel QR'
                }),
                createElement('label', { for: `qr_${uniqueId}`, className: 'sr-only', textContent: 'QR' })
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                'data-stop-propagation': true,
                onclick: () => wrapper.remove()
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]),
            createElement('span', {
                id: arrowId,
                className: 'material-symbols-outlined icon-chevron transition-transform',
                textContent: 'expand_more'
            })
        ])
    ]);

    const body = createElement('div', {
        id: bodyId,
        className: 'email-card-body collapsible-section'
    }, [
        createElement('div', {
            style: 'display: grid; grid-template-columns: 1fr 80px; gap: 0.75rem;'
        }, [
            createFieldBox('Indirizzo', 'address', 'text', data?.indirizzo, 'sede-indirizzo', 'Via / Piazza', 'address_placeholder'),
            createFieldBox('N.', 'civic_number', 'text', data?.civico, 'sede-civico', 'N.', 'civic_number', true)
        ]),
        createElement('div', { className: 'form-grid-3' }, [
            createFieldBox('Città', 'city', 'text', data?.citta, 'sede-citta', 'Città', 'city'),
            createFieldBox('Prov', 'province', 'text', data?.provincia, 'sede-provincia', 'PR', 'province_short', true, true),
            createFieldBox('CAP', 'cap', 'tel', data?.cap, 'sede-cap', 'CAP', 'cap', true)
        ])
    ]);

    setChildren(wrapper, [header, body]);
    container.appendChild(wrapper);
}

// ─── FIELD BOX HELPER ─────────────────────────────────────────────────────────

export function createFieldBox(labelText, labelT, type, val, cls, place, placeT, center = false, uppercase = false) {
    const uniqueId = `field_${Math.random().toString(36).substr(2, 5)}`;
    const fieldId = `id_${cls}_${uniqueId}`;

    // t() restituisce la chiave come fallback → confronto esplicito per usare labelText
    const resolvedLabel = (() => { const tr = t(labelT); return (tr && tr !== labelT) ? tr : labelText; })();
    const resolvedPlaceholder = (() => { const tr = t(placeT); return (tr && tr !== placeT) ? tr : place; })();

    // maxLength: NON passare undefined → el.maxLength=undefined → ToInt32(NaN)=0 → nessun input!
    const maxLengthProp = uppercase ? { maxLength: 2 } : cls.includes('cap') ? { maxLength: 5 } : {};

    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', for: fieldId, 'data-t': labelT, textContent: resolvedLabel }),
        createElement('div', { className: 'detail-field-box border-glow' }, [
            createElement('input', {
                id: fieldId,
                type: type,
                name: `${cls}_${uniqueId}`,
                className: `detail-field-input ${cls}${center ? ' text-center' : ''}${uppercase ? ' uppercase' : ''}`,
                value: val || '',
                placeholder: resolvedPlaceholder,
                'data-t-placeholder': placeT,
                ...maxLengthProp,
                autocomplete: 'off', autocorrect: 'off', spellcheck: 'false'
            })
        ])
    ]);
}
