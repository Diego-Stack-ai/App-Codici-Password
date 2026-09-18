import {prepareCompanyQrSelection, readCompanyQrSelection, normalizeCompanyQrExpectedConfig} from './company-qr-selection-contract.mjs';

// Candidate only, not exported by deployed Functions. The future callable must
// supply verified Auth/App Check context, never context taken from request data.
export function createCompanyQrSelectionHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!id(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const allowed = ['companyId', 'operationId', 'expectedConfig', 'selection'];
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== allowed.length ||
            Object.keys(data).some(key => !allowed.includes(key)) || !id(data.companyId) || !id(data.operationId)) fail('INVALID_ARGUMENT');
        const {companyId, operationId} = data;
        // Copy and validate all request data before the first asynchronous step.
        const selection = prepareCompanyQrSelection(data.selection);
        const expectedConfig = normalizeCompanyQrExpectedConfig(data.expectedConfig);
        const expectedRevision = readCompanyQrSelection(expectedConfig === null ? {} : {qrConfig: expectedConfig}).revision;
        const digest = await hash(JSON.stringify({uid, companyId, expectedConfig, selection}));
        const companyRef = db.doc(`users/${uid}/aziende/${companyId}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/qr-company-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'company-qr-selection' || value.digest !== digest || value.ownerId !== uid ||
                    value.companyId !== companyId || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(companyRef);
            if (!snapshot.exists) fail('COMPANY_UNAVAILABLE');
            const record = snapshot.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid)) fail('COMPANY_UNAVAILABLE');
            const current = readCompanyQrSelection(record);
            // Full config comparison also detects a legacy writer that does not
            // advance the revision. Map insertion order is irrelevant.
            if (JSON.stringify(current.expectedConfig) !== JSON.stringify(expectedConfig)) fail('REVISION_CONFLICT');
            const revision = current.revision + 1;
            transaction.update(companyRef, {qrConfig: {...selection, _qrRevision: revision, _qrSchemaVersion: 1}});
            transaction.create(receiptRef, {kind: 'company-qr-selection', ownerId: uid, companyId, digest,
                revision, createdAt: timestamp()});
            return {status: 'confirmed', revision};
        });
    };
}
