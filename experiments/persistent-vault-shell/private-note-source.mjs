import {assertPrivateAccountReferenceScope, assertPrivateAccountWriteScope} from '../../functions/private-account-write-scope.js';

// Reuse the backend's pure scope policy. Readers must return server snapshots;
// a cache hit or truncated company list is never proof of absent references.
export function createPrivateNoteSourceReader({getUser, readAccount, readProfile, readCompanies}) {
    if (![getUser, readAccount, readProfile, readCompanies].every(fn => typeof fn === 'function')) throw new Error('NOTE_SOURCE_CONFIG');
    return async ({uid, recordId, signal}) => {
        const check = () => {
            if (!uid || !signal || signal.aborted || getUser()?.uid !== uid) throw new Error('NOTE_SOURCE_INACTIVE');
        };
        check();
        if (typeof recordId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(recordId)) throw new Error('NOTE_SOURCE_SCOPE');
        const args = {uid, recordId, signal};
        const [account, profile, companies] = await Promise.all([readAccount(args), readProfile(args), readCompanies(args)]);
        check();
        const data = snapshot => {
            if (!snapshot || snapshot.metadata?.fromCache !== false || snapshot.metadata?.hasPendingWrites !== false || !snapshot.exists()) throw new Error('NOTE_SOURCE_UNVERIFIED');
            return snapshot.data();
        };
        if (account?.id !== recordId || profile?.id !== uid || companies?.metadata?.fromCache !== false ||
            companies.metadata.hasPendingWrites !== false || !Array.isArray(companies.docs) || companies.docs.length > 200) throw new Error('NOTE_SOURCE_UNVERIFIED');
        const record = data(account), personal = data(profile), companyRecords = companies.docs.map(data);
        assertPrivateAccountWriteScope({uid, record});
        assertPrivateAccountReferenceScope({recordId, record, profile: personal, companies: companyRecords});
        // The trusted SDK reader fixes the owner path. Supply reader metadata
        // for legacy documents without ownerId; conflicting owners were denied.
        check();
        return {source: {...record, id: recordId, ownerId: uid}, hasProfileLink: false};
    };
}
