import {assertCompanyAddressRecord, companyAddressBasis, companyAddressCreatedId, companyAddressId,
    companyAddressDeleteRefusal, companyAddressQrState, companyAddressesRevision, companySeatValue,
    validateCompanyAddressesRequest} from './company-addresses-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and App
// Check context. Never exported by production Functions in this increment.
// The patch touches only the fixed seat fields that changed and the `altreSedi`
// list: `qrConfig`, the company contacts, the accounts and every unknown key of
// the company document stay byte for byte as they were.
export function createCompanyAddressesHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!id(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateCompanyAddressesRequest(data), {expectedRevision, operations, operationId} = request;
        const companyId = request.target.companyId;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const companyRef = db.doc(`users/${uid}/aziende/${companyId}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/company-addresses-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'company-addresses' || value.ownerId !== uid || value.companyId !== companyId ||
                    value.digest !== digest || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(companyRef);
            if (!snapshot.exists) fail('COMPANY_UNAVAILABLE');
            const record = snapshot.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid) ||
                (record.id !== undefined && record.id !== companyId)) fail('COMPANY_UNAVAILABLE');
            try {
                assertCompanyAddressRecord(record);
            } catch {
                fail('COMPANY_ADDRESSES_UNAVAILABLE');
            }
            const revision = companyAddressesRevision(record);
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            const qr = companyAddressQrState(record);
            if (operations.some(operation => operation.kind === 'address-delete') && qr.state === 'unverified') {
                fail('COMPANY_ADDRESSES_QR_UNVERIFIABLE');
            }
            const stored = record.altreSedi === undefined ? [] : [...record.altreSedi];
            const addresses = [...stored];
            const seatPatch = {};
            let touchedSeat = false, touchedRows = false;
            for (const operation of operations) {
                if (operation.kind === 'seat') {
                    if (await hash(companyAddressBasis(companySeatValue(record))) !== operation.basis) fail('COMPANY_ADDRESSES_CONFLICT');
                    Object.assign(seatPatch, operation.fields);
                    touchedSeat = true;
                    continue;
                }
                if (operation.kind === 'address-create') {
                    if (!companyAddressCreatedId(operation.id) || companyAddressId(operation.id) === null) fail('COMPANY_ADDRESSES_INVALID');
                    if (addresses.some(item => item.id === operation.id)) fail('COMPANY_ADDRESSES_EXISTS');
                    // A new row starts unpublished, exactly as the legacy form does.
                    addresses.push({id: operation.id, ...operation.fields, qr: operation.fields.qr === true});
                    touchedRows = true;
                    continue;
                }
                const matches = addresses.filter(item => item.id === operation.id);
                if (matches.length !== 1) fail(matches.length ? 'COMPANY_ADDRESSES_AMBIGUOUS' : 'COMPANY_ADDRESSES_MISSING');
                const index = addresses.indexOf(matches[0]);
                if (await hash(companyAddressBasis(matches[0])) !== operation.basis) fail('COMPANY_ADDRESSES_CONFLICT');
                if (operation.kind === 'address-update') {
                    addresses[index] = {...matches[0], ...operation.fields};
                    touchedRows = true;
                    continue;
                }
                const refusal = companyAddressDeleteRefusal(matches[0], {qrIncluded: qr.extras?.[index] === true});
                if (refusal) fail(refusal);
                addresses.splice(index, 1);
                touchedRows = true;
            }
            if (!touchedSeat && !touchedRows) fail('COMPANY_ADDRESSES_INVALID');
            const patch = {...seatPatch};
            if (touchedRows) patch.altreSedi = addresses;
            patch._companyAddressesRevision = revision + 1;
            patch._companyAddressesSchemaVersion = 1;
            patch._companyAddressesUpdatedAt = timestamp();
            transaction.update(companyRef, patch);
            transaction.create(receiptRef, {kind: 'company-addresses', ownerId: uid, companyId, digest,
                revision: revision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
