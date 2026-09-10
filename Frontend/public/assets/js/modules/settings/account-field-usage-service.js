import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {isEncryptedValue} from '../core/crypto-utils.js';
import {normalizeBankingAccounts} from '../shared/banking-model.js';
import {
    listAccountWidgets, listAccountWidgetsConfirmed,
    listCompanies, listCompaniesConfirmed, listCompanyAccounts, listCompanyAccountsConfirmed,
    listPrivateAccounts, listPrivateAccountsConfirmed
} from '../data/vault-repository.js';
import {buildAccountFieldUsageReport} from './account-field-usage-model.js';

const READ_TIMEOUT_MS = 8_000;

function hasText(value) {
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

async function freshOrCached(freshRead, cachedRead) {
    let timeoutId;
    try {
        return await Promise.race([
            freshRead(),
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('ACCOUNT_FIELD_USAGE_READ_TIMEOUT')), READ_TIMEOUT_MS);
            })
        ]);
    } catch {
        return cachedRead();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function clearValue(value, encryptedRecord, vaultKeyMaterial) {
    if (!hasText(value)) return '';
    if (value === '--ERRORE--') throw new Error('ACCOUNT_FIELD_UNREADABLE');
    if (encryptedRecord === false || !isEncryptedValue(value)) return String(value);
    const result = await decrypt(value, vaultKeyMaterial);
    if (result === '--ERRORE--') throw new Error('ACCOUNT_FIELD_UNREADABLE');
    return String(result || '');
}

async function contentState(value, encryptedRecord, vaultKeyMaterial) {
    try {
        return hasText(await clearValue(value, encryptedRecord, vaultKeyMaterial));
    } catch {
        return null;
    }
}

function combineStates(states) {
    if (states.some(state => state === true)) return true;
    if (states.some(state => state === null)) return null;
    return false;
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const consume = async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index], index);
        }
    };
    await Promise.all(Array.from(
        {length: Math.min(Math.max(1, concurrency), items.length)}, consume
    ));
    return results;
}

async function accountStates(account, area, vaultKeyMaterial) {
    const encrypted = account._encrypted !== false;
    const banks = normalizeBankingAccounts(account);
    const cards = banks.flatMap(bank => Array.isArray(bank.cards) ? bank.cards : []);
    const bankState = async (field, sensitive = false) => combineStates(await Promise.all(
        banks.map(bank => sensitive
            ? contentState(bank?.[field], encrypted, vaultKeyMaterial)
            : Promise.resolve(hasText(bank?.[field])))
    ));
    const cardState = async (field, sensitive = false) => combineStates(await Promise.all(
        cards.map(card => sensitive
            ? contentState(card?.[field], encrypted, vaultKeyMaterial)
            : Promise.resolve(hasText(card?.[field])))
    ));
    return {
        nomeAccount: hasText(account.nomeAccount || account.nome),
        username: await contentState(account.username, encrypted, vaultKeyMaterial),
        account: await contentState(account.account, encrypted, vaultKeyMaterial),
        password: await contentState(account.password, encrypted, vaultKeyMaterial),
        url: hasText(account.url),
        note: await contentState(account.note ?? account.notes, encrypted, vaultKeyMaterial),
        logo: hasText(account.logo),
        linkedProfileEmail: area === 'privato' && account.linkedProfileField?.type === 'email',
        referenteNome: hasText(account.referenteNome || account.referente?.nome),
        referenteTelefono: hasText(account.referenteTelefono || account.referente?.telefono),
        referenteCellulare: hasText(account.referenteCellulare || account.referente?.cellulare),
        numeroIscrizione: area === 'azienda'
            ? await contentState(account.numeroIscrizione, encrypted, vaultKeyMaterial) : false,
        codiceSocieta: area === 'azienda'
            ? await contentState(account.codiceSocieta, encrypted, vaultKeyMaterial) : false,
        iban: await bankState('iban'),
        passwordDispositiva: await bankState('passwordDispositiva', true),
        bankReferenteNome: await bankState('referenteNome'),
        bankReferenteTelefono: await bankState('referenteTelefono'),
        bankReferenteCellulare: await bankState('referenteCellulare'),
        cardType: await cardState('cardType'),
        cardHolder: await cardState('titolare'),
        cardNumber: await cardState('cardNumber', true),
        cardExpiry: await cardState('expiry'),
        cardPin: await cardState('pin', true),
        cardCcv: await cardState('ccv', true)
    };
}

async function widgetEntries(widgets, activeAccountKeys, vaultKeyMaterial) {
    const entries = [];
    for (const widget of widgets) {
        if (widget.kind !== 'embedded') continue;
        const area = widget.context === 'company' ? 'azienda' : 'privato';
        const accountKey = area === 'azienda'
            ? `azienda:${widget.companyId}:${widget.accountId}`
            : `privato:${widget.accountId}`;
        if (!activeAccountKeys.has(accountKey)) continue;
        for (const field of widget.fields || []) {
            let filled;
            if (field.encrypted) filled = await contentState(field.valueEnc, true, vaultKeyMaterial);
            else filled = hasText(field.value);
            entries.push({accountKey, area, label: field.label, filled});
        }
    }
    return entries;
}

export async function inspectAccountFieldUsage(uid) {
    if (!uid) throw new Error('ACCOUNT_FIELD_USAGE_UID_REQUIRED');
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    const [privateAccounts, companies, widgets] = await Promise.all([
        navigator.onLine
            ? freshOrCached(() => listPrivateAccountsConfirmed(uid), () => listPrivateAccounts(uid))
            : listPrivateAccounts(uid),
        navigator.onLine
            ? freshOrCached(() => listCompaniesConfirmed(uid), () => listCompanies(uid))
            : listCompanies(uid),
        navigator.onLine
            ? freshOrCached(() => listAccountWidgetsConfirmed(uid), () => listAccountWidgets(uid))
            : listAccountWidgets(uid)
    ]);
    const companyGroups = await Promise.all(companies.map(async company => ({
        company,
        accounts: await (navigator.onLine
            ? freshOrCached(
                () => listCompanyAccountsConfirmed(uid, company.id),
                () => listCompanyAccounts(uid, company.id)
            )
            : listCompanyAccounts(uid, company.id))
    })));
    const sources = [
        ...privateAccounts.map(account => ({account, area: 'privato', accountKey: `privato:${account.id}`})),
        ...companyGroups.flatMap(({company, accounts}) => accounts.map(account => ({
            account,
            area: 'azienda',
            accountKey: `azienda:${company.id}:${account.id}`
        })))
    ];
    const active = sources.filter(source => source.account.isArchived !== true);
    const records = await mapWithConcurrency(active, 3, async source => ({
            area: source.area,
            accountKey: source.accountKey,
            fields: await accountStates(source.account, source.area, vaultKeyMaterial)
    }));
    const activeAccountKeys = new Set(active.map(source => source.accountKey));
    const report = buildAccountFieldUsageReport({
        records,
        widgetEntries: await widgetEntries(widgets, activeAccountKeys, vaultKeyMaterial),
        archivedExcluded: sources.length - active.length
    });
    records.length = 0;
    return report;
}
