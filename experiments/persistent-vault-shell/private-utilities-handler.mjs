import {privateUtilityBasis, privateUtilityDeleteRefusal, privateUtilityParent, privateUtilitiesRevision,
    privateUtilityUid, validatePrivateUtilitiesRequest} from './private-utilities-contract.mjs';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and App
// Check context. Never exported by production Functions in this increment.
// Only the `utilities` array of the addressed parent is replaced: the address, the
// other utilities, the other addresses and every other profile field stay byte for
// byte as they were.
export function createPrivateUtilitiesHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    // The canonical private selection contract is the only authority on the QR
    // configuration: a value that cannot be resolved never degrades to "nothing
    // selected" and blocks every deletion (fail-closed).
    const qrSelection = (data, projection) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail('UTILITIES_QR_UNVERIFIABLE');
        const config = {...data};
        if (config.id !== undefined && config.id !== 'qrCodeInclusions') fail('UTILITIES_QR_UNVERIFIABLE');
        delete config.id;
        const revision = Object.hasOwn(config, '_qrRevision') ? config._qrRevision : 0;
        if (!Number.isSafeInteger(revision) || revision < 0 ||
            (Object.hasOwn(config, '_qrSchemaVersion') && config._qrSchemaVersion !== 1)) fail('UTILITIES_QR_UNVERIFIABLE');
        delete config._qrRevision; delete config._qrSchemaVersion;
        try {
            return {config, selection: preparePrivateQrSelection(config, projection)};
        } catch {
            return fail('UTILITIES_QR_UNVERIFIABLE');
        }
    };
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!privateUtilityUid(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validatePrivateUtilitiesRequest(data);
        const {parentAddressId, expectedRevision, operations, operationId} = request;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const recordRef = db.doc(`users/${uid}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/profile-utilities-${operationId}`);
        const needsSelection = operations.some(operation => operation.kind === 'delete');
        const selectionRef = needsSelection ? db.doc(`users/${uid}/settings/qrCodeInclusions`) : null;
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-utilities' || value.ownerId !== uid || value.digest !== digest ||
                    value.parentAddressId !== parentAddressId || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(recordRef);
            if (!snapshot.exists) fail('PROFILE_UNAVAILABLE');
            const record = snapshot.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid)) fail('PROFILE_UNAVAILABLE');
            const revision = privateUtilitiesRevision(record);
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            const selectionSnapshot = selectionRef ? await transaction.get(selectionRef) : null;
            // All reads happen before the first write, as Firestore requires.
            let parent, stored;
            try {
                ({parent, utilities: stored} = privateUtilityParent(record, parentAddressId));
            } catch (error) {
                return fail(error.message);
            }
            const utilities = [...stored];
            const qr = needsSelection && selectionSnapshot?.exists ? qrSelection(selectionSnapshot.data(), {
                contactEmails: (Array.isArray(record.contactEmails) ? record.contactEmails : []).map(item => ({id: item?.id})),
                contactPhones: (Array.isArray(record.contactPhones) ? record.contactPhones : []).map(item => ({id: item?.id})),
                userAddresses: (Array.isArray(record.userAddresses) ? record.userAddresses : []).map(item => ({id: item?.id}))}) : null;
            // The parent address itself decides whether its utilities are published:
            // the digital card includes an address, and its utilities with it.
            const qrIncluded = qr ? qr.selection.addresses.includes(parentAddressId) : false;
            for (const operation of operations) {
                if (operation.kind === 'create') {
                    if (utilities.some(item => item.id === operation.id)) fail('UTILITIES_EXISTS');
                    utilities.push({id: operation.id, ...operation.fields});
                    continue;
                }
                const matches = utilities.filter(item => item.id === operation.id);
                if (matches.length !== 1) fail(matches.length ? 'UTILITIES_AMBIGUOUS' : 'UTILITIES_MISSING');
                const index = utilities.indexOf(matches[0]);
                // The conflict basis is the committed row: a concurrent change to the
                // link, the value or an unknown legacy key is detected.
                const original = stored.find(item => item.id === operation.id) ?? matches[0];
                if (await hash(privateUtilityBasis(original)) !== operation.basis) fail('UTILITIES_CONFLICT');
                if (operation.kind === 'update') {
                    utilities[index] = {...matches[0], ...operation.fields};
                    continue;
                }
                const refusal = privateUtilityDeleteRefusal(original, {qrIncluded});
                if (refusal) fail(refusal);
                utilities.splice(index, 1);
            }
            const addresses = record.userAddresses.map(item => item.id === parentAddressId ? {...item, utilities} : item);
            transaction.update(recordRef, {userAddresses: addresses, _profileUtilitiesRevision: revision + 1,
                _profileUtilitiesSchemaVersion: 1, _profileUtilitiesUpdatedAt: timestamp()});
            transaction.create(receiptRef, {kind: 'profile-utilities', ownerId: uid, parentAddressId, digest,
                revision: revision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
