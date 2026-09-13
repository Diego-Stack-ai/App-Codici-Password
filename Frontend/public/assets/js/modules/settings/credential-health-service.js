import {decrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    listCompanies, listCompanyAccounts, listCompanyAccountsConfirmed,
    listPrivateAccounts, listPrivateAccountsConfirmed
} from '../data/vault-repository.js';
import {accountModeFromRecord, ACCOUNT_MODES} from '../shared/account-mode-model.js';
import {analyzeCredentialHealth} from './credential-health-model.js';
import {auth} from '../../firebase-config.js?v=1.2.124';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';

const CONFIRMED_READ_TIMEOUT_MS = 8_000;

async function freshOrCached(freshRead, cachedRead, check) {
    let timeoutId;
    try {
        return await Promise.race([
            freshRead(),
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('CREDENTIAL_HEALTH_READ_TIMEOUT')),
                    CONFIRMED_READ_TIMEOUT_MS);
            })
        ]);
    } catch {
        check();
        return cachedRead();
    } finally {
        clearTimeout(timeoutId);
    }
}

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

export async function inspectOwnerCredentialHealth(uid, {signal, isActive = () => true} = {}) {
    if (!uid) throw new Error('CREDENTIAL_HEALTH_UID_REQUIRED');
    let invalidated = false, vaultKeyMaterial = null, unsubscribe = () => {};
    const retained = [];
    const invalidate = () => {
        invalidated = true; vaultKeyMaterial = null;
        for (const record of retained) record.password = '';
        retained.length = 0;
    };
    const check = () => {
        if (invalidated || signal?.aborted || auth.currentUser?.uid !== uid || !isActive()) {
            invalidate(); throw new Error('CREDENTIAL_HEALTH_SESSION_CHANGED');
        }
    };
    check();
    signal?.addEventListener('abort', invalidate, {once: true});
    globalThis.addEventListener?.('vault-session-locked', invalidate);
    globalThis.addEventListener?.('pagehide', invalidate);
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) invalidate(); });
    try {
    vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    check();
    const [privateAccounts, companies] = await Promise.all([
        navigator.onLine
            ? freshOrCached(() => listPrivateAccountsConfirmed(uid), () => listPrivateAccounts(uid), check)
            : listPrivateAccounts(uid),
        listCompanies(uid)
    ]);
    check();
    const companyGroups = await Promise.all(companies.map(async company => ({
        company,
        accounts: await (navigator.onLine
            ? freshOrCached(
                () => listCompanyAccountsConfirmed(uid, company.id),
                () => listCompanyAccounts(uid, company.id), check
            )
            : listCompanyAccounts(uid, company.id))
    })));
    check();
    const sources = [
        ...privateAccounts.map(account => ({account, area: 'privato', companyId: '', companyName: ''})),
        ...companyGroups.flatMap(({company, accounts}) => accounts.map(account => ({
            account, area: 'azienda', companyId: company.id, companyName: company.nome || company.ragioneSociale || ''
        })))
    ].filter(({account}) => isCredentialRecord(account));

    const decrypted = await mapWithConcurrency(sources, 4, async source => {
        try {
            check();
            const password = await decryptPassword(source.account, vaultKeyMaterial);
            check();
            if (!password) return {record: null, unavailable: false};
            const record = {
                    id: JSON.stringify([source.area, source.companyId, source.account.id]),
                    password,
                    passwordUpdatedAt: source.account.passwordUpdatedAt,
                    updatedAt: source.account.updatedAt
            };
            retained.push(record);
            return {unavailable: false, record};
        } catch {
            check();
            return {record: null, unavailable: true};
        }
    });
    const readable = decrypted.flatMap(item => item.record ? [item.record] : []);
    const unavailable = decrypted.filter(item => item.unavailable).length;

    const findings = await analyzeCredentialHealth(readable, {isActive: () => { check(); return true; }});
    check();
    const labels = new Map(sources.map(({account, area, companyId, companyName}) => [
        JSON.stringify([area, companyId, account.id]),
        {
            title: String(account.nomeAccount || account.nome || 'Account senza nome'),
            area,
            companyName: String(companyName)
        }
    ]));
    const results = findings.map(item => ({...item, ...labels.get(item.recordId)}));

    readable.length = 0;
    return Object.freeze({
        scanned: findings.length,
        atRisk: results.filter(item => item.flags.length).length,
        unavailable,
        results
    });
    } finally {
        invalidate(); unsubscribe();
        signal?.removeEventListener('abort', invalidate);
        globalThis.removeEventListener?.('vault-session-locked', invalidate);
        globalThis.removeEventListener?.('pagehide', invalidate);
    }
}
