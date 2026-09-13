/**
 * Normalizza i dati bancari degli account privati e aziendali.
 * Il formato canonico e `banking[]`; i formati storici restano leggibili.
 */

const LEGACY_BANKING_FIELDS = [
    'iban',
    'cards',
    'passwordDispositiva',
    'referenteNome',
    'numeroVerde',
    'referenteTelefono',
    'referenteCellulare'
];

export function ensureBankIds(banks) {
    for (const bank of banks) {
        if (typeof bank.bankId !== 'string' || !bank.bankId.trim()) bank.bankId = crypto.randomUUID();
    }
    return banks;
}

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
        numeroVerde: account.numeroVerde || '',
        referenteTelefono: account.referenteTelefono || '',
        referenteCellulare: account.referenteCellulare || ''
    }];
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

// General account contacts are not evidence of a legacy bank account. Once
// banking is established, preserve all its historical fields while editing.
export function normalizeEditableBankingAccounts(account = {}) {
    const canonical = Array.isArray(account.banking)
        || Boolean(account.banking && typeof account.banking === 'object');
    const legacy = account.isBanking === true || hasText(account.iban)
        || hasText(account.passwordDispositiva) || hasText(account.numeroVerde)
        || (Array.isArray(account.cards) && account.cards.some(hasRealCardData));
    return canonical || legacy ? normalizeBankingAccounts(account) : [];
}

function hasRealCardData(card) {
    if (!card || typeof card !== 'object') return false;
    return ['cardNumber', 'cardType', 'type', 'pin', 'ccv']
        .some(field => hasText(card[field]));
}

export function hasRealBankingData(account = {}) {
    const hasCanonicalBanking = Array.isArray(account.banking)
        || Boolean(account.banking && typeof account.banking === 'object');
    return normalizeBankingAccounts(account).some(bank => (
        hasText(bank.iban)
        || hasText(bank.passwordDispositiva)
        || (hasCanonicalBanking && hasText(bank.referenteNome))
        || hasText(bank.numeroVerde)
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
