import { auth, db, functions } from '../../firebase-config.js?v=1.2.110';
import { deleteField, doc, httpsCallable, onAuthStateChanged, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {
    getCompany,
    listArchivedPrivateAccounts,
    listCompanies,
    listCompanyAccounts
} from '../data/vault-repository.js';

function archiveSession(uid, {signal, isActive = () => true} = {}) {
    let invalid = false, unsubscribe = () => {};
    const dispose = () => {
        invalid = true;
        unsubscribe();
        signal?.removeEventListener('abort', dispose);
        globalThis.removeEventListener?.('vault-session-locked', dispose);
        globalThis.removeEventListener?.('pagehide', dispose);
    };
    const check = () => {
        if (invalid || !uid || auth.currentUser?.uid !== uid || signal?.aborted || !isActive()) {
            dispose();
            const error = new Error('ARCHIVE_SESSION_INVALIDATED');
            error.code = 'ARCHIVE_SESSION_INVALIDATED';
            throw error;
        }
    };
    check();
    signal?.addEventListener('abort', dispose, {once: true});
    globalThis.addEventListener?.('vault-session-locked', dispose, {once: true});
    globalThis.addEventListener?.('pagehide', dispose, {once: true});
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) dispose(); });
    if (invalid) unsubscribe();
    return {check, dispose};
}

async function withArchiveSession(uid, options, operation) {
    const session = archiveSession(uid, options);
    try {
        const result = await operation(session.check);
        session.check();
        return result;
    } finally { session.dispose(); }
}

function accountIdentity(account) {
    if (!account || typeof account.id !== 'string' || !account.id || typeof account.context !== 'string' || !account.context) {
        throw new Error('Account archiviato non valido.');
    }
    return {id: account.id, context: account.context, revision: account.revision};
}

function accountReference(uid, account) {
    if (account.context === 'privato') return doc(db, 'users', uid, 'accounts', account.id);
    return doc(db, 'users', uid, 'aziende', account.context, 'accounts', account.id);
}

async function loadPrivateArchive(uid, check) {
    check();
    const accounts = await listArchivedPrivateAccounts(uid);
    check();
    return accounts.map(account => ({ ...account, context: 'privato' }));
}

async function loadCompanyArchive(uid, company, check) {
    check();
    const accounts = await listCompanyAccounts(uid, company.id);
    check();
    return accounts
        .filter(account => account.isArchived === true)
        .map(account => ({
            ...account,
            context: company.id,
            businessName: company.ragioneSociale
        }));
}

async function loadAllCompanyArchives(uid, check) {
    check();
    const companies = await listCompanies(uid);
    check();
    const results = await Promise.allSettled(companies.map(company => loadCompanyArchive(uid, company, check)));
    check();
    return results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.warn('[ARCHIVIO] Una sorgente aziendale non è disponibile.');
        return [];
    });
}

async function loadSpecificCompanyArchive(uid, companyId, check) {
    check();
    const [company, accounts] = await Promise.all([
        getCompany(uid, companyId),
        listCompanyAccounts(uid, companyId)
    ]);
    check();
    const businessName = company?.ragioneSociale || companyId;
    return accounts
        .filter(account => account.isArchived === true)
        .map(account => ({ ...account, context: companyId, businessName }));
}

async function addSearchableUsernames(accounts, check) {
    check();
    const encryptedAccounts = accounts.filter(account => account._encrypted && account.username);
    if (!encryptedAccounts.length) return accounts;
    const vaultKeyMaterial = await ensureVaultKeyMaterial().catch(() => null);
    check();
    if (!vaultKeyMaterial) return accounts;

    return Promise.all(accounts.map(async account => {
        check();
        if (!account._encrypted || !account.username) return account;
        try {
            const username = await decrypt(account.username, vaultKeyMaterial);
            check();
            return { ...account, username };
        } catch (error) {
            check();
            console.warn('[ARCHIVIO] Un indice username non è disponibile.');
            return account;
        }
    }));
}

export async function listArchiveContexts(uid, options = {}) {
    return withArchiveSession(uid, options, () => listCompanies(uid));
}

export async function loadArchivedAccounts(uid, context = 'all', options = {}) {
    return withArchiveSession(uid, options, async check => {
    let accounts;
    if (context === 'privato') {
        accounts = await loadPrivateArchive(uid, check);
    } else if (context === 'all') {
        const [privateResult, companyResult] = await Promise.allSettled([
            loadPrivateArchive(uid, check),
            loadAllCompanyArchives(uid, check)
        ]);
        check();
        accounts = [privateResult, companyResult].flatMap(result => {
            if (result.status === 'fulfilled') return result.value;
            console.warn('[ARCHIVIO] Una sorgente non è disponibile.');
            return [];
        });
    } else {
        accounts = await loadSpecificCompanyArchive(uid, context, check);
    }
    check();
    return addSearchableUsernames(accounts, check);
    });
}

export async function restoreArchivedAccount(uid, account, options = {}) {
    const target = accountIdentity(account);
    return withArchiveSession(uid, options, async check => {
    check();
    await updateDoc(accountReference(uid, target), {
        isArchived: false,
        archiveSchemaVersion: deleteField(),
        archivedAt: deleteField(),
        purgeAfter: deleteField(),
        revision: Number.isInteger(target.revision) ? target.revision + 1 : 1
    });
    });
}

async function purgeAccountForSession(uid, account, check) {
    check();
    const purgeAccount = httpsCallable(functions, 'purgeArchivedAccount');
    const isPrivate = account.context === 'privato';
    const result = await purgeAccount({
        expectedOwnerUid: uid,
        accountId: account.id,
        operationId: crypto.randomUUID(),
        context: isPrivate ? 'private' : 'company',
        companyId: isPrivate ? null : account.context,
        expectedRevision: Number.isInteger(account.revision) ? account.revision : 0,
        confirmation: 'DELETE_FOREVER'
    });
    check();
    if (result.data?.status !== 'purged') throw new Error('Eliminazione definitiva non completata.');
}

export async function deleteArchivedAccount(uid, account, options = {}) {
    const target = accountIdentity(account);
    return withArchiveSession(uid, options, check => purgeAccountForSession(uid, target, check));
}

export async function emptyArchivedAccounts(uid, accounts, options = {}) {
    const targets = accounts.map(accountIdentity);
    return withArchiveSession(uid, options, async check => {
        for (const account of targets) await purgeAccountForSession(uid, account, check);
    });
}
