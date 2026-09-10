import { db, functions } from '../../firebase-config.js?v=1.2.93';
import { deleteField, doc, httpsCallable, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {
    getCompany,
    listArchivedPrivateAccounts,
    listCompanies,
    listCompanyAccounts
} from '../data/vault-repository.js';

function accountReference(uid, account) {
    if (account.context === 'privato') return doc(db, 'users', uid, 'accounts', account.id);
    return doc(db, 'users', uid, 'aziende', account.context, 'accounts', account.id);
}

async function loadPrivateArchive(uid) {
    const accounts = await listArchivedPrivateAccounts(uid);
    return accounts.map(account => ({ ...account, context: 'privato' }));
}

async function loadCompanyArchive(uid, company) {
    const accounts = await listCompanyAccounts(uid, company.id);
    return accounts
        .filter(account => account.isArchived === true)
        .map(account => ({
            ...account,
            context: company.id,
            businessName: company.ragioneSociale
        }));
}

async function loadAllCompanyArchives(uid) {
    const companies = await listCompanies(uid);
    const results = await Promise.allSettled(companies.map(company => loadCompanyArchive(uid, company)));
    return results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.warn(`[ARCHIVIO] Account aziendali non disponibili per ${companies[index].id}.`, result.reason?.message);
        return [];
    });
}

async function loadSpecificCompanyArchive(uid, companyId) {
    const [company, accounts] = await Promise.all([
        getCompany(uid, companyId),
        listCompanyAccounts(uid, companyId)
    ]);
    const businessName = company?.ragioneSociale || companyId;
    return accounts
        .filter(account => account.isArchived === true)
        .map(account => ({ ...account, context: companyId, businessName }));
}

async function addSearchableUsernames(accounts) {
    const encryptedAccounts = accounts.filter(account => account._encrypted && account.username);
    if (!encryptedAccounts.length) return accounts;
    const vaultKeyMaterial = await ensureVaultKeyMaterial().catch(() => null);
    if (!vaultKeyMaterial) return accounts;

    return Promise.all(accounts.map(async account => {
        if (!account._encrypted || !account.username) return account;
        try {
            return { ...account, username: await decrypt(account.username, vaultKeyMaterial) };
        } catch (error) {
            console.warn(`[ARCHIVIO] Indice username non disponibile per ${account.id}.`, error?.message);
            return account;
        }
    }));
}

export async function listArchiveContexts(uid) {
    return listCompanies(uid);
}

export async function loadArchivedAccounts(uid, context = 'all') {
    let accounts;
    if (context === 'privato') {
        accounts = await loadPrivateArchive(uid);
    } else if (context === 'all') {
        const [privateResult, companyResult] = await Promise.allSettled([
            loadPrivateArchive(uid),
            loadAllCompanyArchives(uid)
        ]);
        accounts = [privateResult, companyResult].flatMap(result => {
            if (result.status === 'fulfilled') return result.value;
            console.warn('[ARCHIVIO] Una sorgente non è disponibile.', result.reason?.message);
            return [];
        });
    } else {
        accounts = await loadSpecificCompanyArchive(uid, context);
    }
    return addSearchableUsernames(accounts);
}

export async function restoreArchivedAccount(uid, account) {
    await updateDoc(accountReference(uid, account), {
        isArchived: false,
        archiveSchemaVersion: deleteField(),
        archivedAt: deleteField(),
        purgeAfter: deleteField(),
        revision: Number.isInteger(account.revision) ? account.revision + 1 : 1
    });
}

export async function deleteArchivedAccount(uid, account) {
    if (!uid || !account?.id) throw new Error('Account archiviato non valido.');
    const purgeAccount = httpsCallable(functions, 'purgeArchivedAccount');
    const isPrivate = account.context === 'privato';
    const result = await purgeAccount({
        accountId: account.id,
        operationId: crypto.randomUUID(),
        context: isPrivate ? 'private' : 'company',
        companyId: isPrivate ? null : account.context,
        expectedRevision: Number.isInteger(account.revision) ? account.revision : 0,
        confirmation: 'DELETE_FOREVER'
    });
    if (result.data?.status !== 'purged') throw new Error('Eliminazione definitiva non completata.');
}

export async function emptyArchivedAccounts(uid, accounts) {
    for (const account of accounts) await deleteArchivedAccount(uid, account);
}
