import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listCompanies, listCompanyAccounts, listPrivateAccounts
} from '../data/vault-repository.js';
import {accountModeFromRecord, ACCOUNT_MODES} from '../shared/account-mode-model.js';
import {analyzeCredentialHealth} from './credential-health-model.js';

async function decryptPassword(record, vaultKeyMaterial) {
    if (!record.password) return '';
    if (record._encrypted === false) return String(record.password);
    const cleartext = await decrypt(record.password, vaultKeyMaterial);
    if (cleartext === '--ERRORE--') throw new Error('CREDENTIAL_UNREADABLE');
    return cleartext;
}

function isCredentialRecord(record) {
    const mode = accountModeFromRecord(record);
    return !record.isArchived
        && mode !== ACCOUNT_MODES.MEMO_PRIVATE
        && mode !== ACCOUNT_MODES.MEMO_SHARED;
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

export async function inspectOwnerCredentialHealth(uid) {
    if (!uid) throw new Error('CREDENTIAL_HEALTH_UID_REQUIRED');
    const vaultKeyMaterial = await ensureVaultKeyMaterial();
    const [privateAccounts, companies] = await Promise.all([
        listPrivateAccounts(uid), listCompanies(uid)
    ]);
    const companyGroups = await Promise.all(companies.map(async company => ({
        company,
        accounts: await listCompanyAccounts(uid, company.id)
    })));
    const sources = [
        ...privateAccounts.map(account => ({account, area: 'privato', companyName: ''})),
        ...companyGroups.flatMap(({company, accounts}) => accounts.map(account => ({
            account, area: 'azienda', companyName: company.nome || company.ragioneSociale || ''
        })))
    ].filter(({account}) => isCredentialRecord(account));

    const decrypted = await mapWithConcurrency(sources, 4, async source => {
        try {
            const password = await decryptPassword(source.account, vaultKeyMaterial);
            if (!password) return {record: null, unavailable: false};
            return {
                unavailable: false,
                record: {
                    id: `${source.area}:${source.account.id}`,
                    password,
                    passwordUpdatedAt: source.account.passwordUpdatedAt,
                    updatedAt: source.account.updatedAt
                }
            };
        } catch {
            return {record: null, unavailable: true};
        }
    });
    const readable = decrypted.flatMap(item => item.record ? [item.record] : []);
    const unavailable = decrypted.filter(item => item.unavailable).length;

    const findings = await analyzeCredentialHealth(readable);
    const labels = new Map(sources.map(({account, area, companyName}) => [
        `${area}:${account.id}`,
        {
            title: String(account.nomeAccount || account.nome || 'Account senza nome'),
            area,
            companyName: String(companyName)
        }
    ]));
    const results = findings
        .filter(item => item.flags.length)
        .map(item => ({...item, ...labels.get(item.recordId)}));

    readable.length = 0;
    return Object.freeze({
        scanned: findings.length,
        atRisk: results.length,
        unavailable,
        results
    });
}
