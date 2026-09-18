import {validateProfileTextRequest, profileTextId, profileTextRevision, profileTextBasis} from './profile-text-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and
// App Check context. Never exported by production Functions in this increment.
export function createProfileTextHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!profileTextId(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateProfileTextRequest(data), {target, changes, expected, expectedRevision, operationId} = request;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const path = target.domain === 'private' ? `users/${uid}` : `users/${uid}/aziende/${target.companyId}`;
        const recordRef = db.doc(path), receiptRef = db.doc(`mutationResults/${uid}/operations/profile-text-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-text' || value.ownerId !== uid || value.digest !== digest ||
                    value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(recordRef);
            if (!snapshot.exists) fail('PROFILE_UNAVAILABLE');
            const record = snapshot.data(), revision = profileTextRevision(record);
            if (record.ownerId !== undefined && record.ownerId !== uid) fail('PROFILE_UNAVAILABLE');
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            for (const field of Object.keys(changes)) {
                if (await hash(profileTextBasis(record, field)) !== expected[field]) fail('FIELD_CONFLICT');
            }
            transaction.update(recordRef, {...changes, _profileTextRevision: revision + 1,
                _profileTextSchemaVersion: 1, _profileTextUpdatedAt: timestamp()});
            transaction.create(receiptRef, {kind: 'profile-text', ownerId: uid, digest, revision: revision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
