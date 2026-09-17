import {privateAddressBasis, privateAddressesRevision, privateAddressUid, privateAddressDeleteRefusal,
    validatePrivateAddressesRequest} from './private-addresses-contract.mjs';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and App
// Check context. Never exported by production Functions in this increment.
// The patch replaces `userAddresses` with a copy in which only the allowlisted
// fields of the touched rows changed: `utilities[]`, the Account references, the
// unknown keys and every other address stay byte for byte as they were.
export function createPrivateAddressesHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const rows = record => {
        const items = record.userAddresses === undefined ? [] : record.userAddresses;
        if (!Array.isArray(items) || items.length > 10000 ||
            items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) fail('PROFILE_ADDRESSES_SHAPE_INVALID');
        return [...items];
    };
    // The canonical private selection contract is the only authority on the QR
    // configuration: a value that cannot be resolved never degrades to "nothing
    // selected" and blocks every deletion (fail-closed).
    const qrSelection = (data, projection) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail('ADDRESSES_QR_UNVERIFIABLE');
        const config = {...data};
        if (config.id !== undefined && config.id !== 'qrCodeInclusions') fail('ADDRESSES_QR_UNVERIFIABLE');
        delete config.id;
        const revision = Object.hasOwn(config, '_qrRevision') ? config._qrRevision : 0;
        if (!Number.isSafeInteger(revision) || revision < 0 ||
            (Object.hasOwn(config, '_qrSchemaVersion') && config._qrSchemaVersion !== 1)) fail('ADDRESSES_QR_UNVERIFIABLE');
        delete config._qrRevision; delete config._qrSchemaVersion;
        try {
            return {config, selection: preparePrivateQrSelection(config, projection)};
        } catch {
            return fail('ADDRESSES_QR_UNVERIFIABLE');
        }
    };
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!privateAddressUid(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validatePrivateAddressesRequest(data), {expectedRevision, operations, operationId} = request;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const recordRef = db.doc(`users/${uid}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/profile-addresses-${operationId}`);
        const needsSelection = operations.some(operation => operation.kind === 'delete');
        const selectionRef = needsSelection ? db.doc(`users/${uid}/settings/qrCodeInclusions`) : null;
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-addresses' || value.ownerId !== uid || value.digest !== digest ||
                    value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(recordRef);
            if (!snapshot.exists) fail('PROFILE_UNAVAILABLE');
            const record = snapshot.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid)) fail('PROFILE_UNAVAILABLE');
            const revision = privateAddressesRevision(record);
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            const selectionSnapshot = selectionRef ? await transaction.get(selectionRef) : null;
            const stored = rows(record), addresses = [...stored];
            // An absent document is a verified empty selection; a present one must
            // resolve canonically before any deletion is considered. Read before
            // any write, as Firestore requires.
            const qr = needsSelection && selectionSnapshot?.exists ? qrSelection(selectionSnapshot.data(), {
                contactEmails: (Array.isArray(record.contactEmails) ? record.contactEmails : []).map(item => ({id: item?.id})),
                contactPhones: (Array.isArray(record.contactPhones) ? record.contactPhones : []).map(item => ({id: item?.id})),
                userAddresses: stored.map(item => ({id: item.id}))}) : null;
            for (const operation of operations) {
                if (operation.kind === 'create') {
                    if (addresses.some(item => item.id === operation.id)) fail('ADDRESSES_EXISTS');
                    const primary = operation.fields.isPrimary === true;
                    if (primary) addresses.forEach((item, at) => {addresses[at] = {...item, isPrimary: false};});
                    addresses.push({id: operation.id, ...operation.fields, isPrimary: primary, utilities: []});
                    continue;
                }
                const matches = addresses.filter(item => item.id === operation.id);
                if (matches.length !== 1) fail(matches.length ? 'ADDRESSES_AMBIGUOUS' : 'ADDRESSES_MISSING');
                const index = addresses.indexOf(matches[0]);
                // The conflict basis is the **committed** row: an earlier operation
                // of the same request may already have changed the working copy
                // (a new primary address clears the others), and that must not be
                // mistaken for a concurrent change.
                const original = stored.find(item => item.id === operation.id) ?? matches[0];
                if (await hash(privateAddressBasis(original)) !== operation.basis) fail('ADDRESSES_CONFLICT');
                if (operation.kind === 'update') {
                    if (operation.fields.isPrimary === true) {
                        addresses.forEach((item, at) => {if (at !== index) addresses[at] = {...item, isPrimary: false};});
                    }
                    addresses[index] = {...matches[0], ...operation.fields};
                    continue;
                }
                const refusal = privateAddressDeleteRefusal(original, {
                    qrIncluded: qr ? qr.selection.addresses.includes(operation.id) : false});
                if (refusal) fail(refusal);
                if (qr) {
                    // A legacy positional reference that the deletion would shift
                    // blocks the operation instead of silently changing meaning.
                    const references = qr.config.addresses;
                    const position = stored.indexOf(original);
                    if (Array.isArray(references) &&
                        references.some(reference => Number.isSafeInteger(reference) && reference > position)) fail('ADDRESSES_QR_INDEXED');
                }
                addresses.splice(index, 1);
            }
            transaction.update(recordRef, {userAddresses: addresses, _profileAddressesRevision: revision + 1,
                _profileAddressesSchemaVersion: 1, _profileAddressesUpdatedAt: timestamp()});
            transaction.create(receiptRef, {kind: 'profile-addresses', ownerId: uid, digest, revision: revision + 1,
                createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
