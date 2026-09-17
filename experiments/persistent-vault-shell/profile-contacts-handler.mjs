import {contactBasis, contactRevision, profileContactsUid, validateProfileContactsRequest} from './profile-contacts-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and App
// Check context. Never exported by production Functions in this increment.
const QR_KEYS = Object.freeze({contactEmails: 'emails', contactPhones: 'phones'});
export function createProfileContactsHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const rows = (record, collection) => {
        const items = record[collection] === undefined ? [] : record[collection];
        if (!Array.isArray(items) || items.length > 10000 ||
            items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) fail('PROFILE_CONTACTS_UNAVAILABLE');
        return [...items];
    };
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!profileContactsUid(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateProfileContactsRequest(data), {expectedRevision, operations, operationId} = request;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const recordRef = db.doc(`users/${uid}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/profile-contacts-${operationId}`);
        const needsSelection = operations.some(operation => operation.kind === 'delete');
        const selectionRef = needsSelection ? db.doc(`users/${uid}/settings/qrCodeInclusions`) : null;
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'profile-contacts' || value.ownerId !== uid || value.digest !== digest ||
                    value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(recordRef);
            if (!snapshot.exists) fail('PROFILE_UNAVAILABLE');
            const record = snapshot.data(), revision = contactRevision(record);
            if (record.ownerId !== undefined && record.ownerId !== uid) fail('PROFILE_UNAVAILABLE');
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            const selectionSnapshot = selectionRef ? await transaction.get(selectionRef) : null;
            const selection = selectionSnapshot?.exists ? selectionSnapshot.data() : null;
            const references = collection => {
                if (!selection) return [];
                const value = selection[QR_KEYS[collection]];
                return Array.isArray(value) ? value : [];
            };
            const arrays = {contactEmails: rows(record, 'contactEmails'), contactPhones: rows(record, 'contactPhones')};
            const touched = new Set();
            for (const operation of operations) {
                const items = arrays[operation.collection];
                const matches = items.filter(item => item.id === operation.id);
                if (operation.kind === 'create') {
                    if (matches.length) fail('CONTACTS_EXISTS');
                    // A new row keeps the legacy shape and never becomes primary.
                    items.push({id: operation.id, ...operation.fields, isPrimary: false});
                    touched.add(operation.collection);
                    continue;
                }
                if (matches.length !== 1) fail(matches.length ? 'CONTACTS_AMBIGUOUS' : 'CONTACTS_MISSING');
                const index = items.indexOf(matches[0]);
                if (await hash(contactBasis(matches[0])) !== operation.basis) fail('CONTACTS_CONFLICT');
                if (operation.kind === 'update') {
                    items[index] = {...matches[0], ...operation.fields};
                    touched.add(operation.collection);
                    continue;
                }
                // Deletion requires an unlinked row and no QR reference: a linked
                // contact is unlinked first, and a positional reference cannot be
                // re-resolved after a shift, so it blocks the deletion as well.
                if ((typeof matches[0].linkedAccountId === 'string' && matches[0].linkedAccountId) ||
                    (typeof matches[0].linkedAccountCompanyId === 'string' && matches[0].linkedAccountCompanyId)) fail('CONTACTS_LINKED');
                const refs = references(operation.collection);
                if (refs.some(reference => typeof reference === 'string' && reference === operation.id)) fail('CONTACTS_QR_SELECTED');
                if (refs.some(reference => Number.isSafeInteger(reference))) fail('CONTACTS_QR_INDEXED');
                items.splice(index, 1);
                touched.add(operation.collection);
            }
            if (!touched.size) fail('PROFILE_CONTACTS_INVALID');
            const patch = {};
            for (const collection of touched) patch[collection] = arrays[collection];
            patch._profileContactsRevision = revision + 1;
            patch._profileContactsSchemaVersion = 1;
            patch._profileContactsUpdatedAt = timestamp();
            transaction.update(recordRef, patch);
            transaction.create(receiptRef, {kind: 'profile-contacts', ownerId: uid, digest, revision: revision + 1,
                createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
