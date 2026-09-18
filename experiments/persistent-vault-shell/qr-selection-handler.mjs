import {preparePrivateQrSelection, PRIVATE_QR_SCALARS} from './qr-selection-contract.mjs';

// Candidate backend service; only a trusted callable adapter may supply auth/app.
// Not exported by deployed Functions. Admin transaction validates references,
// revision and receipt atomically; the client cannot author its own receipt.
export function createPrivateQrSelectionHandler({db, hash, timestamp}) {
    const fail = code => {throw new Error(code);};
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!id(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        if (!keys(data, ['selection', 'expectedRevision', 'operationId']) || !id(data.operationId) ||
            !Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER) fail('INVALID_ARGUMENT');
        // Wire requests must already use stable IDs. Index migration belongs to
        // the editor snapshot; accepting indexes here could select a moved row.
        if (!keys(data.selection, [...PRIVATE_QR_SCALARS, 'phones', 'emails', 'addresses'])) fail('INVALID_ARGUMENT');
        const selection = {};
        for (const key of PRIVATE_QR_SCALARS) {
            if (typeof data.selection[key] !== 'boolean') fail('INVALID_ARGUMENT');
            selection[key] = data.selection[key];
        }
        for (const key of ['phones', 'emails', 'addresses']) {
            const refs = data.selection[key];
            if (!Array.isArray(refs) || refs.length > 1000 || refs.some(ref => typeof ref !== 'string' || ref.length > 256 || !ref || /[\u0000-\u001f/]/.test(ref)) || new Set(refs).size !== refs.length) fail('INVALID_ARGUMENT');
            selection[key] = [...refs];
        }
        const {expectedRevision, operationId} = data;
        const digest = await hash(JSON.stringify({uid, expectedRevision, selection}));
        const settingRef = db.doc(`users/${uid}/settings/qrCodeInclusions`);
        const profileRef = db.doc(`users/${uid}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/qr-private-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'private-qr-selection' || value.digest !== digest || value.ownerId !== uid ||
                    value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const setting = await transaction.get(settingRef), profile = await transaction.get(profileRef);
            if (!profile.exists) fail('PROFILE_UNAVAILABLE');
            const record = profile.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid)) fail('PROFILE_UNAVAILABLE');
            const current = setting.exists ? setting.data() : {};
            if (!keys(current, [...PRIVATE_QR_SCALARS, 'phones', 'emails', 'addresses', '_qrRevision', '_qrSchemaVersion'])) fail('UNSUPPORTED_SETTING');
            const revision = Object.hasOwn(current, '_qrRevision') ? current._qrRevision : 0;
            if (!Number.isSafeInteger(revision) || revision < 0 || revision !== expectedRevision) fail('REVISION_CONFLICT');
            if (current._qrSchemaVersion !== undefined && current._qrSchemaVersion !== 1) fail('UNSUPPORTED_SETTING');
            const validated = preparePrivateQrSelection(selection, record);
            const next = revision + 1;
            transaction.set(settingRef, {...validated, _qrRevision: next, _qrSchemaVersion: 1});
            transaction.create(receiptRef, {kind: 'private-qr-selection', ownerId: uid, digest, revision: next, createdAt: timestamp()});
            return {status: 'confirmed', revision: next};
        });
    };
}
