import { clearElement, createElement, setChildren } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { hasRealBankingData, normalizeBankingAccounts } from './banking-model.js';

function createReadonlyField(label, value, icon, isPassword = false) {
    const id = `bank-field-${crypto.randomUUID()}`;
    const copyButton = createElement('button', {
        className: 'btn-icon-header copy-btn cursor-pointer',
        type: 'button',
        onclick: async event => {
            event.stopPropagation();
            try {
                await navigator.clipboard.writeText(value);
                showToast(t('copied') || 'Copiato!');
            } catch (error) {
                logError('CopyBankingValue', error);
                showToast(t('error_generic'), 'error');
            }
        }
    }, [createElement('span', {
        className: 'material-symbols-outlined text-[14px]',
        textContent: 'content_copy'
    })]);
    const actions = createElement('div', {
        className: 'detail-field-actions flex items-center gap-2'
    }, [copyButton]);

    if (isPassword) {
        actions.prepend(createElement('button', {
            className: 'btn-icon-header btn-field-toggle cursor-pointer',
            type: 'button',
            onclick: event => {
                event.stopPropagation();
                const input = document.getElementById(id);
                if (!input) return;
                const hidden = input.type === 'password' || input.classList.contains('base-shield');
                input.type = hidden ? 'text' : 'password';
                input.classList.toggle('base-shield', !hidden);
                const toggleIcon = event.currentTarget.querySelector('span');
                if (toggleIcon) toggleIcon.textContent = hidden ? 'visibility_off' : 'visibility';
            }
        }, [createElement('span', {
            className: 'material-symbols-outlined text-[14px]',
            textContent: 'visibility'
        })]));
    }

    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', {
                className: 'material-symbols-outlined ml-4 opacity-40',
                textContent: icon
            }),
            createElement('input', {
                id,
                className: `field-input w-full no-transform ${isPassword ? 'base-shield field-value-password' : ''}`,
                value: value || '-',
                readonly: true,
                autocomplete: 'new-password'
            }),
            actions
        ])
    ]);
}

function createBankCard(card, index) {
    return createElement('div', { className: 'card-entry border-glow' }, [
        createElement('div', { className: 'card-entry-header cursor-default' }, [
            createElement('div', { className: 'card-entry-title-row' }, [
                createElement('span', {
                    className: 'material-symbols-outlined card-entry-icon',
                    textContent: 'credit_card'
                }),
                createElement('span', {
                    className: 'card-entry-label',
                    textContent: card.cardType || card.type || `Carta #${index + 1}`
                })
            ])
        ]),
        createElement('div', { className: 'flex-col-gap' }, [
            card.titolare ? createReadonlyField('Intestatario', card.titolare, 'person') : null,
            card.cardNumber ? createReadonlyField('Numero', card.cardNumber, 'credit_card') : null,
            card.expiry ? createReadonlyField('Scadenza', card.expiry, 'calendar_month') : null,
            card.pin ? createReadonlyField('PIN', card.pin, 'dialpad', true) : null,
            card.ccv ? createReadonlyField('CCV', card.ccv, 'shield', true) : null
        ].filter(Boolean))
    ]);
}

function createBankAccount(bank, index) {
    const fields = [
        bank.iban ? createReadonlyField('IBAN', bank.iban, 'account_balance') : null,
        bank.passwordDispositiva ? createReadonlyField('Pass. Disp.', bank.passwordDispositiva, 'lock', true) : null,
        bank.referenteTelefono ? createReadonlyField('Tel. Banca', bank.referenteTelefono, 'call') : null,
        bank.referenteCellulare ? createReadonlyField('Cell. Banca', bank.referenteCellulare, 'smartphone') : null
    ].filter(Boolean);

    if (bank.cards?.length) {
        fields.push(createElement('div', { className: 'bank-cards-section' }, [
            createElement('div', { className: 'bank-cards-header' }, [
                createElement('span', { className: 'bank-cards-title', textContent: 'Carte Associate' })
            ]),
            createElement('div', { className: 'flex-col-gap' }, bank.cards.map(createBankCard))
        ]));
    }

    return createElement('div', { className: 'bank-account-card border-glow cursor-default' }, [
        createElement('div', { className: 'bank-header cursor-default' }, [
            createElement('div', { className: 'bank-header-left' }, [
                createElement('span', {
                    className: 'material-symbols-outlined bank-expand-icon',
                    textContent: 'account_balance'
                }),
                createElement('span', {
                    className: 'bank-title',
                    textContent: bank.iban ? `Conto: ${bank.iban.substring(0, 10)}...` : `Conto Bancario #${index + 1}`
                })
            ])
        ]),
        createElement('div', { className: 'bank-details' }, fields)
    ]);
}

export function renderAccountBanking(account, { isReadOnly = false, onAddBanking, promptText } = {}) {
    const section = document.getElementById('section-banking');
    const content = document.getElementById('banking-content');
    const prompt = document.getElementById('add-banking-prompt');
    const hasBanking = hasRealBankingData(account);

    section?.classList.toggle('hidden', !hasBanking);
    prompt?.classList.toggle('hidden', hasBanking || isReadOnly);

    const infoButton = document.getElementById('btn-banking-info');
    if (infoButton && !hasBanking && !isReadOnly) {
        const infoText = infoButton.querySelector('.info-text');
        if (infoText && promptText) infoText.textContent = promptText;
        infoButton.onclick = onAddBanking;
    }

    if (!content) return;
    clearElement(content);
    if (!hasBanking) return;
    setChildren(content, normalizeBankingAccounts(account).map(createBankAccount));
}
