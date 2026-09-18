import {validateProfileLinkRequest, profileLinkRevision, assertProfileLinkAccount} from './profile-link-contract.mjs';
import {readProfileLinkContact, planProfileLink} from './profile-link-plan.mjs';

// Candidate only: source, old/new inverse references and receipt are one Admin
// transaction. No credential values are copied between profiles and Accounts.
export function createProfileLinkHandler({db, hash, timestamp, deleteField, models}) {
    const fail = code => {throw Error(code);};
    return async (input, trusted) => {
        const uid = trusted?.auth?.uid;
        if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateProfileLinkRequest(input), {source, expectedAccount, account, expectedRevision, operationId} = request;
        if (request.expectedOwnerUid !== uid) fail('OWNER_MISMATCH');
        const digest = await hash(JSON.stringify({uid, ...request}));
        const sourcePath = source.domain === 'company' ? `users/${uid}/aziende/${source.companyId}` : `users/${uid}`;
        const accountPath = selection => selection.domain === 'company' ? `users/${uid}/aziende/${selection.companyId}/accounts/${selection.id}` : `users/${uid}/accounts/${selection.id}`;
        const receiptRef = db.doc(`mutationResults/${uid}/operations/profile-link-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-link' || value.ownerId !== uid || value.digest !== digest || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const sourceRef = db.doc(sourcePath), sourceSnapshot = await transaction.get(sourceRef);
            if (!sourceSnapshot.exists) fail('PROFILE_UNAVAILABLE');
            const profile = sourceSnapshot.data(), revision = profileLinkRevision(profile);
            if ((profile.ownerId !== undefined && profile.ownerId !== uid) ||
                (source.domain === 'company' && profile.id !== undefined && profile.id !== source.companyId)) fail('OWNER_MISMATCH');
            const current = readProfileLinkContact(profile, source, models);
            if (revision !== expectedRevision || JSON.stringify(current.account) !== JSON.stringify(expectedAccount) ||
                await hash(current.fingerprintInput) !== request.expectedFingerprint) fail('LINK_CONFLICT');
            const oldRef = expectedAccount ? db.doc(accountPath(expectedAccount)) : null;
            const nextRef = account ? db.doc(accountPath(account)) : null;
            const oldSnapshot = oldRef ? await transaction.get(oldRef) : null, nextSnapshot = nextRef ? await transaction.get(nextRef) : null;
            const oldAccount = oldSnapshot?.exists ? oldSnapshot.data() : null, nextAccount = nextSnapshot?.exists ? nextSnapshot.data() : null;
            if (oldAccount) assertProfileLinkAccount(oldAccount, uid, expectedAccount);
            if (account) {
                if (!nextAccount) fail('ACCOUNT_UNAVAILABLE');
                assertProfileLinkAccount(nextAccount, uid, account, {destination: true});
                if (account.domain === 'company') {
                    const company = await transaction.get(db.doc(`users/${uid}/aziende/${account.companyId}`));
                    if (!company.exists || company.data().isArchived || (company.data().ownerId !== undefined && company.data().ownerId !== uid) ||
                        (company.data().id !== undefined && company.data().id !== account.companyId)) fail('COMPANY_UNAVAILABLE');
                }
            }
            const plan = planProfileLink({profile, source, account, oldAccount, nextAccount, models, deleteField});
            const referencePatch = (record, patch) => ({...patch,
                _profileLinkRevision: profileLinkRevision({...record, isArchived: false}) + 1,
                _profileLinkSchemaVersion: 1, _profileLinkUpdatedAt: timestamp()});
            // Validate metadata for every participant before staging writes.
            const oldPatch = plan.oldAccountPatch ? referencePatch(oldAccount, plan.oldAccountPatch) : null;
            const nextPatch = plan.nextAccountPatch ? referencePatch(nextAccount, plan.nextAccountPatch) : null;
            transaction.update(sourceRef, {...plan.sourcePatch, _profileLinkRevision: revision + 1,
                _profileLinkSchemaVersion: 1, _profileLinkUpdatedAt: timestamp()});
            if (oldPatch) transaction.update(oldRef, oldPatch);
            if (nextPatch) transaction.update(nextRef, nextPatch);
            transaction.create(receiptRef, {kind: 'profile-link', ownerId: uid, digest, revision: revision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
