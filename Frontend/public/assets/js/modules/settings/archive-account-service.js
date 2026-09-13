import { auth, db, functions } from '../../firebase-config.js?v=1.2.124';
import { deleteField, doc, httpsCallable, onAuthStateChanged, runTransaction } from '/assets/js/vendor/firebase-runtime.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {
    getCompany,
    listArchivedPrivateAccounts,
    listCompanies,
    listCompanyAccounts
} from '../data/vault-repository.js';

function archiveSession(uid, {signal, isActive = () => true} = {}) {
    let invalid = false, unsubscribe = () => {};
    const cleanups = new Set();
    const dispose = () => {
        if (invalid) return;
        invalid = true;
        unsubscribe();
        signal?.removeEventListener('abort', dispose);
        globalThis.removeEventListener?.('vault-session-locked', dispose);
        globalThis.removeEventListener?.('pagehide', dispose);
        for (const cleanup of cleanups) cleanup();
        cleanups.clear();
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
    return {check, dispose, own: cleanup => { if (invalid) cleanup(); else cleanups.add(cleanup); }};
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
        const invalid = code => Object.assign(new Error(code), {code});
        const revisionOf = value => {
            // Legacy documents without revision represent version zero. Null,
            // coercible strings and unsafe numbers are not legacy defaults.
            if (value === undefined) return 0;
            if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) {
                throw invalid('ARCHIVE_RESTORE_REVISION_INVALID');
            }
            return value;
        };
        const expectedRevision = revisionOf(target.revision);
        const reference = accountReference(uid, target);
        // CAS protects the selected archived version. It does not coordinate the
        // separate purge preparation/recursiveDelete protocol.
        await runTransaction(db, async transaction => {
            check();
            const snapshot = await transaction.get(reference);
            check();
            if (!snapshot.exists()) throw invalid('ARCHIVE_RESTORE_MISSING');
            const current = snapshot.data();
            const currentRevision = revisionOf(current.revision);
            if (current.isArchived !== true || currentRevision !== expectedRevision) throw invalid('ARCHIVE_RESTORE_CONFLICT');
            transaction.update(reference, {
                isArchived: false,
                archiveSchemaVersion: deleteField(),
                archivedAt: deleteField(),
                purgeAfter: deleteField(),
                revision: currentRevision + 1
            });
        });
    });
}

const deletionPlans = new WeakMap();

function deletionError(code, state, retryable = false) {
    const error = new Error(code);
    error.code = code;
    error.retryable = retryable;
    error.progress = {confirmedCount: state.confirmedCount, totalCount: state.totalCount,
        mayHaveApplied: state.attemptedCount > 0};
    return error;
}

// Created only after the UI's deletion confirmation. The opaque plan retains
// the original commands in memory; retries cannot replace targets or IDs.
export function prepareArchiveDeletion(uid, accounts, options = {}) {
    const targets = accounts.map(accountIdentity);
    if (!targets.length) throw new Error('ARCHIVE_DELETION_EMPTY');
    const keys = new Set(targets.map(target => JSON.stringify([target.context, target.id])));
    if (keys.size !== targets.length) throw new Error('ARCHIVE_DELETION_DUPLICATE');
    const session = archiveSession(uid, options);
    const plan = Object.freeze({});
    const state = {session, commands: [], confirmedCount: 0, totalCount: targets.length,
        attemptedCount: 0, uncertain: false, inFlight: false, blocked: false};
    try {
        state.commands = Object.freeze(targets.map(account => {
            const isPrivate = account.context === 'privato';
            return Object.freeze({expectedOwnerUid: uid, accountId: account.id, operationId: crypto.randomUUID(),
                context: isPrivate ? 'private' : 'company', companyId: isPrivate ? null : account.context,
                expectedRevision: Number.isInteger(account.revision) ? account.revision : 0, confirmation: 'DELETE_FOREVER'});
        }));
        deletionPlans.set(plan, state);
        session.own(() => { state.commands = []; deletionPlans.delete(plan); });
        session.check();
        return plan;
    } catch (error) { session.dispose(); throw error; }
}

export function releaseArchiveDeletion(plan) {
    deletionPlans.get(plan)?.session.dispose();
    deletionPlans.delete(plan);
}

export async function executeArchiveDeletion(plan, {retry = false} = {}) {
    const state = deletionPlans.get(plan);
    if (!state) throw new Error('ARCHIVE_PLAN_INVALID');
    const {check} = state.session;
    check();
    if (state.inFlight) throw deletionError('ARCHIVE_DELETION_IN_PROGRESS', state);
    if (state.blocked) throw deletionError('ARCHIVE_DELETION_BLOCKED', state);
    if (state.uncertain && retry !== true) throw deletionError('ARCHIVE_RETRY_REQUIRED', state, true);
    state.inFlight = true;
    try {
        const purgeAccount = httpsCallable(functions, 'purgeArchivedAccount');
        while (state.confirmedCount < state.totalCount) {
            check();
            state.attemptedCount++;
            state.uncertain = true;
            const result = await purgeAccount(state.commands[state.confirmedCount]);
            check();
            if (result.data?.status !== 'purged') {
                state.blocked = true;
                state.uncertain = false;
                throw deletionError('ARCHIVE_DELETION_FAILED', state);
            }
            state.uncertain = false;
            state.confirmedCount++;
        }
        return {status: 'purged', confirmedCount: state.confirmedCount};
    } catch (cause) {
        check();
        const definitive = ['invalid-argument', 'failed-precondition', 'permission-denied', 'unauthenticated', 'not-found', 'already-exists']
            .includes(String(cause?.code || '').replace(/^functions\//, ''));
        if (state.uncertain && !definitive) throw deletionError('ARCHIVE_PURGE_UNCERTAIN', state, true);
        state.uncertain = false;
        state.blocked = true;
        throw deletionError('ARCHIVE_DELETION_FAILED', state);
    } finally { state.inFlight = false; }
}

export async function deleteArchivedAccount(uid, account, options = {}) {
    const plan = prepareArchiveDeletion(uid, [account], options);
    try { return await executeArchiveDeletion(plan); }
    finally { releaseArchiveDeletion(plan); }
}

export async function emptyArchivedAccounts(uid, accounts, options = {}) {
    const plan = prepareArchiveDeletion(uid, accounts, options);
    try { return await executeArchiveDeletion(plan); }
    finally { releaseArchiveDeletion(plan); }
}
