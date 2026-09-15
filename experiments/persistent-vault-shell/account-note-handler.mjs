import {validateAccountNoteRequest, accountNoteBasis} from './account-note-contract.mjs';
import {profileTextId, profileTextHash} from './profile-text-contract.mjs';

// Laboratory candidate. The callable must supply verified Auth/App Check.
// Online-only note patch; no expansion of the M6 full-record offline writer.
export function createAccountNoteHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!profileTextId(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateAccountNoteRequest(data), {account, note, expectedFingerprint, expectedRevision, operationId} = request;
        if (request.expectedOwnerUid !== uid) fail('OWNER_MISMATCH');
        const digest = await hash(JSON.stringify({uid, ...request})); if (!profileTextHash(digest)) fail('HASH_INVALID');
        const parent = account.domain === 'company' ? `users/${uid}/aziende/${account.companyId}` : `users/${uid}`;
        const ref = db.doc(`${parent}/accounts/${account.id}`), receiptRef = db.doc(`mutationResults/${uid}/operations/account-note-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'account-note' || value.ownerId !== uid || value.digest !== digest || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(ref); if (!snapshot.exists) fail('ACCOUNT_UNAVAILABLE');
            const record = snapshot.data(), basis = accountNoteBasis(record, uid, account);
            if (account.domain === 'company') {
                const company = await transaction.get(db.doc(parent)), value = company.exists && company.data();
                if (!value || value.isArchived || (value.ownerId !== undefined && value.ownerId !== uid) ||
                    (value.id !== undefined && value.id !== account.companyId)) fail('COMPANY_UNAVAILABLE');
            }
            if (basis.revision !== expectedRevision) fail('REVISION_CONFLICT');
            if (await hash(basis.value) !== expectedFingerprint) fail('NOTE_CONFLICT');
            transaction.update(ref, {note, revision: expectedRevision + 1, schemaVersion: 1, updatedAt: timestamp()});
            transaction.create(receiptRef, {kind: 'account-note', ownerId: uid, digest, revision: expectedRevision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: expectedRevision + 1};
        });
    };
}
