import {parseAccountDestination} from './account-route.mjs';
const bankFields = ['iban', 'passwordDispositiva', 'numeroVerde', 'referenteNome', 'referenteTelefono', 'referenteCellulare'];
const cardFields = ['cardType', 'type', 'titolare', 'cardNumber', 'expiry', 'pin', 'ccv'];
const secretFields = new Set(['passwordDispositiva', 'pin', 'ccv']);
const validId = value => typeof value === 'string' && value.trim() && !/[\\/%\u0000-\u001f\u007f]/u.test(value) && !['.', '..'].includes(value);
const fail = () => {throw new Error('BANKING_UNAVAILABLE');};

// Inject the canonical normalizer, never ensureBankIds: consultation cannot
// generate persistent identities. Renderers receive metadata/read capabilities.
export function createBankingReader({context, getUser, repository, selection, normalize, isEncryptedValue, isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    if (!selection || !['private', 'company'].includes(selection.domain) || !validId(selection.id) ||
        (selection.domain === 'private' ? selection.companyId !== undefined : !validId(selection.companyId))) fail();
    const target = parseAccountDestination(`dettaglio_account_${selection.domain === 'private' ? 'privato' : 'azienda'}.html?id=${encodeURIComponent(selection.id)}` +
        (selection.domain === 'company' ? `&aziendaId=${encodeURIComponent(selection.companyId)}` : ''), {uid, companyId: selection.companyId});
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    const fields = (record, allowed) => allowed.filter(field => record[field] !== undefined && record[field] !== null && record[field] !== '').map(field => {
        if (typeof record[field] !== 'string') fail();
        return Object.freeze({id: field, secret: secretFields.has(field)});
    });
    async function load() {
        check(); const suffix = isOnline() ? 'Confirmed' : '';
        const account = target.domain === 'company'
            ? await repository['getCompanyAccount' + suffix](uid, target.companyId, target.id)
            : await repository['getPrivateAccount' + suffix](uid, target.id);
        check();
        if (!account || account.isArchived || (Object.hasOwn(account, 'ownerId') && account.ownerId !== uid)) fail();
        const banks = normalize(structuredClone(account)); check();
        if (!Array.isArray(banks)) fail();
        const ids = new Set();
        for (const bank of banks) {
            if (!bank || typeof bank !== 'object' || Array.isArray(bank)) fail();
            if (bank.bankId != null) {
                if (!validId(bank.bankId) || ids.has(bank.bankId)) fail();
                ids.add(bank.bankId);
            }
            fields(bank, bankFields);
            if (bank.cards != null && !Array.isArray(bank.cards)) fail();
            for (const card of bank.cards || []) {
                if (!card || typeof card !== 'object' || Array.isArray(card)) fail();
                fields(card, cardFields);
            }
        }
        return banks;
    }
    return async function list() {
        const banks = await load(); check();
        return Object.freeze(banks.map((bank, index) => {
            const bankId = bank.bankId ?? null, fingerprint = JSON.stringify(bank);
            const resolve = async () => {
                const current = await load(); check();
                const found = bankId === null ? current[index] : current.find(item => item.bankId === bankId);
                if (!found || JSON.stringify(found) !== fingerprint) throw new Error('BANKING_CHANGED');
                return found;
            };
            const read = async (field, cardIndex) => {
                check();
                const allowed = cardIndex === undefined ? bankFields : cardFields;
                if (!allowed.includes(field) || (cardIndex !== undefined && (!Number.isInteger(cardIndex) || cardIndex < 0))) fail();
                const current = await resolve();
                const record = cardIndex === undefined ? current : current.cards?.[cardIndex];
                if (!record || typeof record[field] !== 'string') fail();
                const raw = record[field];
                const value = isEncryptedValue(raw) ? await context.read({ownerId: uid, ciphertext: raw}) : raw;
                check(); await resolve(); check();
                if (typeof value !== 'string' || (isEncryptedValue(raw) && (value === raw || value === '--ERRORE--'))) fail();
                return value;
            };
            return Object.freeze({bankId, index, fields: Object.freeze(fields(bank, bankFields)),
                cards: Object.freeze((bank.cards || []).map((card, cardIndex) => Object.freeze({index: cardIndex,
                    fields: Object.freeze(fields(card, cardFields)), read: field => read(field, cardIndex)}))),
                read: field => read(field)});
        }));
    };
}
