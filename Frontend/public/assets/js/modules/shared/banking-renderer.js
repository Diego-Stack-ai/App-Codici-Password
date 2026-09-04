/**
 * BANKING RENDERER (V2.0 — Unified)
 * Renderer UI per la sezione conti bancari e carte nei form account.
 * Unifica il meglio di form_account_privato.js (UX/sicurezza) e
 * form_account_azienda.js (architettura rerender callback).
 *
 * Miglioramenti V2.0 rispetto a V1.0:
 * - _createInputField supporta parametro `type` (password, text, ecc.)
 * - autocomplete: 'new-password' per tutti i campi (blocca autofill browser)
 * - Nuove card inizializzate con { type: 'Credit' }
 * - Carte già aperte chiuse prima di aggiungerne una nuova
 * - Delete button dentro card-entry-header (layout inline con titolo)
 * - expand-icon su card-entry con rotazione animata
 * - cursor:pointer su bank-header-left e card-entry-title-row
 * - Label 'Nome Carta' più descrittiva
 * - Icone: 'event' per Scadenza, 'verified_user' per CCV
 *
 * Architettura:
 * - renderBankAccounts(bankAccounts, rerender) — stateless, pattern callback
 * - Il btn-add-iban va collegato una volta sola in setupUI() del chiamante
 */

import { createElement, clearElement } from '../../dom-utils.js';
import { showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';

/**
 * Renderizza la lista dei conti bancari nel container #iban-list-container.
 * @param {Array} bankAccounts - Array di oggetti conto bancario (mutabile)
 * @param {Function} rerender - Callback da chiamare per ri-rendere dopo ogni cambio di stato
 */
export function renderBankAccounts(bankAccounts, rerender) {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    bankAccounts.forEach((acc, idx) => {
        const isOpen = acc._isOpen !== false;

        const div = createElement('div', { className: 'bank-account-card border-glow' }, [
            createElement('div', { className: 'bank-header' }, [
                createElement('div', {
                    className: 'bank-header-left bank-toggle-row',
                    onclick: () => { acc._isOpen = !isOpen; rerender(); }
                }, [
                    createElement('span', {
                        className: `material-symbols-outlined bank-expand-icon${isOpen ? '' : ' is-collapsed'}`,
                        textContent: 'expand_more'
                    }),
                    createElement('span', {
                        className: 'bank-title',
                        textContent: acc.iban ? `Conto: ${acc.iban.substring(0, 10)}...` : `Nuovo Conto #${idx + 1}`
                    })
                ]),
                createElement('button', {
                    className: 'btn-delete-bank',
                    onclick: async (e) => {
                        e.stopPropagation();
                        const ok = await showConfirmModal('Elimina Conto', 'Vuoi eliminare interamente questo conto?', 'Elimina', 'Annulla');
                        if (ok) {
                            bankAccounts.splice(idx, 1);
                            rerender();
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
            ]),

            isOpen ? createElement('div', { className: 'bank-details' }, [
                _createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
                _createInputField('Pass. Dispositiva', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock'),
                _createInputField('Tel. Banca', acc.referenteTelefono, (val) => bankAccounts[idx].referenteTelefono = val, 'call'),
                _createInputField('Cell. Banca', acc.referenteCellulare, (val) => bankAccounts[idx].referenteCellulare = val, 'smartphone'),

                createElement('div', { className: 'bank-cards-section' }, [
                    createElement('div', { className: 'bank-cards-header' }, [
                        createElement('span', { className: 'bank-cards-title', textContent: 'Carte Associate' }),
                        createElement('button', {
                            className: 'btn-add-card',
                            onclick: () => {
                                if (!acc.cards) acc.cards = [];
                                // Chiudi le altre carte prima di aggiungere
                                acc.cards.forEach(c => c._isOpen = false);
                                acc.cards.push({
                                    cardType: '',
                                    cardNumber: '',
                                    expiry: '',
                                    titolare: '',
                                    ccv: '',
                                    pin: '',
                                    type: 'Credit',
                                    _isOpen: true
                                });
                                rerender();
                            }
                        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'add_card' })])
                    ]),
                    createElement('div', { className: 'flex-col-gap' },
                        (acc.cards || []).map((card, cIdx) => _renderCardEntry(bankAccounts, idx, cIdx, card, rerender))
                    )
                ])
            ]) : null
        ]);
        container.appendChild(div);
    });
}

/**
 * Renderizza una singola carta di credito/debito.
 * Layout: header inline (titolo + cestino), body espandibile.
 * @private
 */
function _renderCardEntry(bankAccounts, bankIdx, cardIdx, card, rerender) {
    const isOpen = card._isOpen !== false;

    return createElement('div', { className: 'card-entry border-glow' }, [
        createElement('div', { className: 'card-entry-header' }, [
            createElement('div', {
                className: 'card-entry-title-row bank-toggle-row',
                onclick: () => { card._isOpen = !isOpen; rerender(); }
            }, [
                createElement('span', {
                    className: `material-symbols-outlined card-entry-icon${isOpen ? '' : ' is-collapsed'}`,
                    textContent: 'credit_card'
                }),
                createElement('span', {
                    className: 'card-entry-label',
                    textContent: card.cardType || `Carta #${cardIdx + 1}`
                })
            ]),
            createElement('button', {
                className: 'btn-delete-bank',
                onclick: async (e) => {
                    e.stopPropagation();
                    const msg = t('confirm_delete_card') || 'Eliminare questa carta?';
                    const ok = await showConfirmModal('Elimina Carta', msg, 'Elimina', 'Annulla');
                    if (ok) {
                        bankAccounts[bankIdx].cards.splice(cardIdx, 1);
                        rerender();
                    }
                }
            }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
        ]),

        isOpen ? createElement('div', { className: 'flex-col-gap animate-fade-in' }, [
            _createInputField('Nome Carta (es. Visa, Mastercard...)', card.cardType, (val) => bankAccounts[bankIdx].cards[cardIdx].cardType = val, 'credit_card'),
            _createInputField('Titolare', card.titolare, (val) => bankAccounts[bankIdx].cards[cardIdx].titolare = val, 'person'),
            _createInputField('Numero Carta', card.cardNumber, (val) => bankAccounts[bankIdx].cards[cardIdx].cardNumber = val, 'numbers'),
            _createInputField('Scadenza', card.expiry, (val) => bankAccounts[bankIdx].cards[cardIdx].expiry = val, 'event'),
            _createInputField('PIN', card.pin, (val) => bankAccounts[bankIdx].cards[cardIdx].pin = val, 'pin'),
            _createInputField('CCV', card.ccv, (val) => bankAccounts[bankIdx].cards[cardIdx].ccv = val, 'verified_user')
        ]) : null
    ]);
}

/**
 * Crea un campo input per i form bancari.
 * @param {string} label - Etichetta del campo
 * @param {string} value - Valore iniziale
 * @param {Function} onInput - Callback al cambio valore
 * @param {string} icon - Icona Material Symbols
 * @param {string} [type='text'] - Tipo input HTML (text, password, ecc.)
 * @private
 */
function _createInputField(label, value, onInput, icon, type = 'text') {
    return createElement('div', { className: 'glass-field-container w-full' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'field-input',
                type: type,
                value: value || '',
                placeholder: label,
                oninput: (e) => onInput(e.target.value),
                autocomplete: 'new-password'  // blocca autofill browser su tutti i campi
            })
        ])
    ]);
}
