/**
 * BANKING RENDERER (V1.0 — Shared Module)
 * Renderer UI per la sezione conti bancari e carte nei form account.
 * Estratto da form_account_azienda.js e form_account_privato.js.
 *
 * Pattern: renderBankAccounts(bankAccounts, onRender) — stateless renderer.
 * Il chiamante passa l'array e un callback per re-render al cambio di stato.
 */

import { createElement, clearElement } from '../../dom-utils.js';
import { showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';

/**
 * Renderizza la lista dei conti bancari nel container #iban-list-container.
 * @param {Array} bankAccounts - Array di oggetti conto bancario (mutabile)
 * @param {Function} rerender - Callback da chiamare per ri-rendere (es. () => renderBankAccounts(...))
 */
export function renderBankAccounts(bankAccounts, rerender) {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    bankAccounts.forEach((acc, idx) => {
        const isOpen = acc._isOpen !== false;

        const div = createElement('div', { className: 'bank-account-card border-glow' }, [
            createElement('div', {
                className: 'bank-header',
                onclick: () => { acc._isOpen = !isOpen; rerender(); }
            }, [
                createElement('div', { className: 'bank-header-left' }, [
                    createElement('span', {
                        className: 'material-symbols-outlined bank-expand-icon',
                        style: `transform: rotate(${isOpen ? '0' : '-90'}deg)`,
                        textContent: 'expand_more'
                    }),
                    createElement('span', { className: 'bank-title', textContent: acc.iban ? `Conto: ${acc.iban.substring(0, 10)}...` : `Nuovo Conto #${idx + 1}` })
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
                }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })])
            ]),

            isOpen ? createElement('div', { className: 'bank-details' }, [
                _createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
                _createInputField('Pass. Disp.', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock'),
                _createInputField('Tel. Banca', acc.referenteTelefono, (val) => bankAccounts[idx].referenteTelefono = val, 'call'),
                _createInputField('Cell. Banca', acc.referenteCellulare, (val) => bankAccounts[idx].referenteCellulare = val, 'smartphone'),

                createElement('div', { className: 'bank-cards-section' }, [
                    createElement('div', { className: 'bank-cards-header' }, [
                        createElement('span', { className: 'bank-cards-title', textContent: 'Carte Associate' }),
                        createElement('button', {
                            className: 'btn-add-card',
                            onclick: () => {
                                if (!acc.cards) acc.cards = [];
                                acc.cards.push({ cardType: '', cardNumber: '', expiry: '', titolare: '', ccv: '', pin: '', _isOpen: true });
                                rerender();
                            }
                        }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'add_card' })])
                    ]),
                    createElement('div', { className: 'flex-col-gap' }, (acc.cards || []).map((card, cIdx) => _renderCardEntry(bankAccounts, idx, cIdx, card, rerender)))
                ])
            ]) : null
        ]);
        container.appendChild(div);
    });
}

/**
 * Renderizza una singola carta di credito/debito.
 * @private
 */
function _renderCardEntry(bankAccounts, bankIdx, cardIdx, card, rerender) {
    const isOpen = card._isOpen !== false;
    return createElement('div', { className: 'card-entry border-glow' }, [
        createElement('div', {
            className: 'card-entry-header',
            onclick: () => { card._isOpen = !isOpen; rerender(); }
        }, [
            createElement('div', { className: 'card-entry-title-row' }, [
                createElement('span', { className: 'material-symbols-outlined card-entry-icon', textContent: 'credit_card' }),
                createElement('span', { className: 'card-entry-label', textContent: card.cardType || `Carta #${cardIdx + 1}` })
            ])
        ]),
        createElement('button', {
            className: 'btn-delete-card',
            onclick: async (e) => {
                e.stopPropagation();
                const msg = t('confirm_delete_card') || 'Eliminare questa carta?';
                const ok = await showConfirmModal('Elimina Carta', msg, 'Elimina', 'Annulla');
                if (ok) {
                    bankAccounts[bankIdx].cards.splice(cardIdx, 1);
                    rerender();
                }
            }
        }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })]),

        isOpen ? createElement('div', { className: 'flex-col-gap animate-fade-in' }, [
            _createInputField('Nome Carta', card.cardType, (val) => bankAccounts[bankIdx].cards[cardIdx].cardType = val, 'credit_card'),
            _createInputField('Titolare', card.titolare, (val) => bankAccounts[bankIdx].cards[cardIdx].titolare = val, 'person'),
            _createInputField('Numero Carta', card.cardNumber, (val) => bankAccounts[bankIdx].cards[cardIdx].cardNumber = val, 'numbers'),
            createElement('div', { className: 'form-grid-2' }, [
                _createInputField('Scadenza', card.expiry, (val) => bankAccounts[bankIdx].cards[cardIdx].expiry = val, 'calendar_month'),
                _createInputField('PIN', card.pin, (val) => bankAccounts[bankIdx].cards[cardIdx].pin = val, 'pin'),
                _createInputField('CCV', card.ccv, (val) => bankAccounts[bankIdx].cards[cardIdx].ccv = val, 'shield')
            ])
        ]) : null
    ]);
}

/**
 * Crea un campo input generico per i form bancari.
 * @private
 */
function _createInputField(label, value, onInput, icon) {
    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'field-input',
                value: value || '',
                placeholder: label,
                oninput: (e) => onInput(e.target.value),
                autocomplete: 'off'
            })
        ])
    ]);
}
