import {validateProfileAccountCreateRequest, minimalCreatedAccount} from './profile-account-create-contract.mjs';
import {profileLinkRevision} from './profile-link-contract.mjs';
import {readProfileLinkContact, planProfileLink} from './profile-link-plan.mjs';

export function createProfileAccountCreateHandler({db, hash, timestamp, deleteField, models}) {
    const fail = code => { throw Error(code); };
    return async (input, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!uid) fail('UNAUTHENTICATED'); if (!trusted?.app?.appId) fail('APP_CHECK_REQUIRED');
        const request = validateProfileAccountCreateRequest(input); if (request.expectedOwnerUid !== uid) fail('OWNER_MISMATCH');
        const digest = await hash(JSON.stringify({uid, ...request}));
        const accountId = `account-${(await hash(`${uid}:${request.operationId}`)).slice(0, 32)}`;
        const selection = request.scope.domain === 'private' ? {domain: 'private', id: accountId} : {domain: 'company', companyId: request.scope.companyId, id: accountId};
        const sourcePath = request.source.domain === 'company' ? `users/${uid}/aziende/${request.source.companyId}` : `users/${uid}`;
        const accountPath = selection.domain === 'private' ? `users/${uid}/accounts/${accountId}` : `users/${uid}/aziende/${selection.companyId}/accounts/${accountId}`;
        const receiptRef = db.doc(`mutationResults/${uid}/operations/profile-account-create-${request.operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-account-create' || value.ownerId !== uid ||
                    value.digest !== digest || value.accountId !== accountId ||
                    value.revision !== request.expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', account: selection, revision: value.revision};
            }
            const sourceRef = db.doc(sourcePath), sourceSnap = await transaction.get(sourceRef), accountRef = db.doc(accountPath);
            if (!sourceSnap.exists) fail('PROFILE_UNAVAILABLE');
            const profile = sourceSnap.data();
            if ((profile.ownerId !== undefined && profile.ownerId !== uid) ||
                (request.source.domain === 'company' && profile.id !== undefined && profile.id !== request.source.companyId)) fail('OWNER_MISMATCH');
            const current = readProfileLinkContact(profile, request.source, models);
            if (current.account || profileLinkRevision(profile) !== request.expectedRevision || await hash(current.fingerprintInput) !== request.expectedFingerprint) fail('LINK_CONFLICT');
            const accountSnap = await transaction.get(accountRef); if (accountSnap.exists) fail('ACCOUNT_EXISTS');
            let companySnap = null;
            if (selection.domain === 'company') companySnap = await transaction.get(db.doc(`users/${uid}/aziende/${selection.companyId}`));
            if (companySnap && (!companySnap.exists || companySnap.data().isArchived ||
                (companySnap.data().ownerId !== undefined && companySnap.data().ownerId !== uid) ||
                (companySnap.data().id !== undefined && companySnap.data().id !== selection.companyId))) fail('COMPANY_UNAVAILABLE');
            const legacy = typeof current.contact.password === 'string' && current.contact.password ? current.contact.password :
                typeof current.contact.passwordLegacy === 'string' && current.contact.passwordLegacy ? current.contact.passwordLegacy : '';
            if (request.transferLegacyPassword && legacy !== request.expectedLegacyPassword) fail('LEGACY_PASSWORD_CHANGED');
            const now = timestamp(), account = minimalCreatedAccount({uid, accountId, request, timestamp: now});
            const plan = planProfileLink({profile, source: request.source, account: selection, oldAccount: null, nextAccount: account, models, deleteField});
            let sourcePatch = plan.sourcePatch;
            if (request.transferLegacyPassword) {
                if (request.source.domain === 'company') {
                    // Edit the stored slot, not the normalized contact projection.
                    // Keep the link already prepared by the atomic plan.
                    const slot = profile.emails?.[request.source.id];
                    if (slot?.password === legacy) {
                        const emails = structuredClone(sourcePatch.emails);
                        delete emails[request.source.id].password;
                        sourcePatch = {...sourcePatch, emails};
                    } else if (request.source.id === 'pec' && !slot?.password && profile.aziendaEmailPassword === legacy) {
                        sourcePatch = {...sourcePatch, aziendaEmailPassword: deleteField()};
                    } else fail('LEGACY_PASSWORD_CHANGED');
                } else {
                    const cleaned = {...current.contact, linkedAccountId: accountId,
                        linkedAccountCompanyId: selection.companyId || ''};
                    // Firestore does not allow delete sentinels inside arrays.
                    const key = cleaned.password ? 'password' : 'passwordLegacy';
                    if (cleaned[key] !== legacy) fail('LEGACY_PASSWORD_CHANGED');
                    delete cleaned[key];
                    sourcePatch = models.patchProfileAccountItem(profile,
                        {contactType: request.source.type, profileContactId: request.source.id, parentAddressId: request.source.parentAddressId}, cleaned);
                }
            }
            transaction.create(accountRef, {...account, ...plan.nextAccountPatch, _profileLinkRevision: 1, _profileLinkSchemaVersion: 1, _profileLinkUpdatedAt: now});
            transaction.update(sourceRef, {...sourcePatch, _profileLinkRevision: request.expectedRevision + 1, _profileLinkSchemaVersion: 1, _profileLinkUpdatedAt: now});
            transaction.create(receiptRef, {kind: 'profile-account-create', ownerId: uid, digest, accountId, revision: request.expectedRevision + 1, createdAt: now});
            return {status: 'confirmed', account: selection, revision: request.expectedRevision + 1};
        });
    };
}
