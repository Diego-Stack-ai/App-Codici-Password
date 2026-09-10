/**
 * Normalizza i dati bancari degli account privati e aziendali.
 * Il formato canonico e `banking[]`; i formati storici restano leggibili.
 */

const LEGACY_BANKING_FIELDS = [
    'iban',
    'cards',
    'passwordDispositiva',
    'referenteNome',
    'referenteTelefono',
    'referenteCellulare'
];

function hasLegacyBankingFields(account) {
    return LEGACY_BANKING_FIELDS.some(field => {
        const value = account?.[field];
        return Array.isArray(value) ? value.length > 0 : value != null && value !== '';
    });
}

export function normalizeBankingAccounts(account = {}) {
    if (Array.isArray(account.banking)) {
        return account.banking.filter(bank => bank && typeof bank === 'object');
    }

    if (account.banking && typeof account.banking === 'object') {
        return [account.banking];
    }

    if (!hasLegacyBankingFields(account)) return [];

    return [{
        iban: account.iban || '',
        cards: Array.isArray(account.cards) ? account.cards : [],
        passwordDispositiva: account.passwordDispositiva || '',
        referenteNome: account.referenteNome || '',
        referenteTelefono: account.referenteTelefono || '',
        referenteCellulare: account.referenteCellulare || ''
    }];
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasRealCardData(card) {
    if (!card || typeof card !== 'object') return false;
    return ['cardNumber', 'cardType', 'type', 'pin', 'ccv']
        .some(field => hasText(card[field]));
}

export function hasRealBankingData(account = {}) {
    return normalizeBankingAccounts(account).some(bank => (
        hasText(bank.iban)
        || hasText(bank.passwordDispositiva)
        || hasText(bank.referenteTelefono)
        || hasText(bank.referenteCellulare)
        || (Array.isArray(bank.cards) && bank.cards.some(hasRealCardData))
    ));
}

export function formatCardExpiry(value = '') {
    const digits = String(value).replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function isValidCardExpiry(value = '') {
    if (!String(value).trim()) return true;
    const normalized = formatCardExpiry(value);
    if (!/^\d{2}\/\d{2}$/.test(normalized)) return false;
    const month = Number(normalized.slice(0, 2));
    return month >= 1 && month <= 12;
}

export function hasInvalidCardExpiry(bankAccounts = []) {
    return bankAccounts.some(bank => (bank?.cards || []).some(card => !isValidCardExpiry(card?.expiry)));
}
