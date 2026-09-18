import {validateAccountStandardRequest, accountStandardBasis} from './account-standard-contract.mjs';
import {profileTextId, profileTextHash} from './profile-text-contract.mjs';

export function createAccountStandardHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!profileTextId(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateAccountStandardRequest(data), {account, patch, expectedFingerprint, expectedRevision, operationId} = request;
        if (request.expectedOwnerUid !== uid) fail('OWNER_MISMATCH');
        const digest = await hash(JSON.stringify({uid, ...request})); if (!profileTextHash(digest)) fail('HASH_INVALID');
        const parent = account.domain === 'company' ? `users/${uid}/aziende/${account.companyId}` : `users/${uid}`;
        const ref = db.doc(`${parent}/accounts/${account.id}`), receiptRef = db.doc(`mutationResults/${uid}/operations/account-standard-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const saved = receipt.data();
                if (saved.kind !== 'account-standard' || saved.ownerId !== uid || saved.digest !== digest || saved.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: saved.revision};
            }
            const snapshot = await transaction.get(ref); if (!snapshot.exists) fail('ACCOUNT_UNAVAILABLE');
            let company;
            if (account.domain === 'company') company = await transaction.get(db.doc(parent));
            if (account.domain === 'company') {
                const value = company.exists && company.data();
                if (!value || value.isArchived || (value.ownerId !== undefined && value.ownerId !== uid) ||
                    (value.id !== undefined && value.id !== account.companyId)) fail('COMPANY_UNAVAILABLE');
            }
            const basis = accountStandardBasis(snapshot.data(), uid, account);
            if (basis.revision !== expectedRevision) fail('REVISION_CONFLICT');
            if (await hash(basis.fingerprintInput) !== expectedFingerprint) fail('ACCOUNT_STANDARD_CONFLICT');
            transaction.update(ref, {...patch, revision: expectedRevision + 1, schemaVersion: 1, updatedAt: timestamp()});
            transaction.create(receiptRef, {kind: 'account-standard', ownerId: uid, digest, revision: expectedRevision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: expectedRevision + 1};
        });
    };
}
