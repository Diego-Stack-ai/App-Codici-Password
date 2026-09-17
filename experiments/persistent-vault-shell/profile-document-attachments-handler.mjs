import {DOCUMENT_ATTACHMENT_SCHEMA_VERSION, DOCUMENT_ATTACHMENT_REFUSALS, DOCUMENT_IMAGE_MAX_PER_DOCUMENT,
    documentAttachmentId, documentAttachmentMetadata, documentAttachmentObject, documentAttachmentOperationDigest,
    documentAttachmentOperationId, documentAttachmentPayloadCopy, documentAttachmentReceiptCollection,
    documentAttachmentReceiptPath, documentAttachmentRecordPath, documentAttachmentSha256, documentImageStoragePath}
    from './profile-document-attachments-contract.mjs';
import {documentAttachmentCommandDigestInput, validateDocumentAttachmentDeleteCommand,
    validateDocumentAttachmentUploadCommand} from './prepare-profile-document-attachment.mjs';

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const KIND = 'profile-document-attachment';
const DELETE_KIND = 'profile-document-attachment-delete';
// Candidate service for the future callable (authorization and App Check are
// demanded here exactly as the other candidate services do).
//
// Candidate transport contract, implemented by the emulator test and required
// from DS-002B:
//   db:      {doc(path), get(ref), list(collectionPath), attachmentsFor({uid, documentId}), runTransaction(run)}
//   tx:      {get(ref), listAttachments(query), create, update, delete}   // read-only before any write
//   storage: {probe(path) -> {exists, digest, size}, putIfAbsent(path, bytes, options) -> 'created'|'exists', remove(path)}
//
// Firestore and Storage are never atomic together: each step is recorded in the
// receipt and every partial outcome is either resumable or compensable. Outcomes
// are `confirmed` (terminal, idempotent), `compensated` (terminal, no trace left)
// or `incomplete` (a receipt survives and `recover()` or a retry finishes it).
// Every transaction below performs all of its reads before its first write, as
// real Firestore requires; the unit fake refuses read-after-write so a
// regression cannot hide behind a permissive mock.
export function createProfileDocumentAttachmentHandler({db, storage, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const identity = trusted => {
        const uid = trusted?.auth?.uid;
        if (typeof uid !== 'string' || !UID_PATTERN.test(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        return uid;
    };
    const refsFor = command => ({recordRef: db.doc(command.recordPath),
        receiptRef: db.doc(documentAttachmentReceiptPath({uid: command.ownerId, operationId: command.operationId}))});
    const confirmed = (state, attachmentId) => Object.freeze({status: 'confirmed', state, attachmentId});
    const compensated = (code, attachmentId) => Object.freeze({status: 'compensated', code, attachmentId});
    const incomplete = (code, attachmentId) => Object.freeze({status: 'incomplete', code, attachmentId});
    // Reads before writes, always.
    const drop = async ({recordRef, receiptRef}) => {
        await db.runTransaction(async transaction => {
            const record = await transaction.get(recordRef);
            const receipt = await transaction.get(receiptRef);
            if (record.exists) transaction.delete(recordRef);
            if (receipt.exists) transaction.delete(receiptRef);
        });
    };
    const receiptOf = (value, {kind, uid, digest}) => {
        if (!documentAttachmentObject(value) || value.kind !== kind || value.ownerId !== uid || value.digest !== digest) {
            fail('OPERATION_CONFLICT');
        }
        return value.status;
    };
    // The authoritative profile decides which documents may own images: the
    // document must be persisted exactly once, with its own identifier.
    const assertPersistedDocument = (profile, {uid, documentId}) => {
        if (!documentAttachmentObject(profile)) fail('PROFILE_UNAVAILABLE');
        if (profile.ownerId !== undefined && profile.ownerId !== uid) fail('OWNER_MISMATCH');
        const documents = profile.documenti;
        if (!Array.isArray(documents) || documents.length > 10000 || documents.some(item => !documentAttachmentObject(item))) {
            fail(DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_NOT_PERSISTED);
        }
        const matches = documents.filter(item => item.id === documentId);
        if (matches.length !== 1) {
            fail(matches.length > 1 ? DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS : DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_NOT_PERSISTED);
        }
    };
    // Only records that canonically bind to this owner and document consume the
    // per-document budget; the list comes from a transactional server read.
    const boundCount = (records, {uid, documentId}) => {
        if (!Array.isArray(records)) fail(DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_COUNT_UNAVAILABLE);
        let count = 0;
        for (const record of records) {
            if (!documentAttachmentObject(record)) continue;
            try {
                if (documentAttachmentMetadata(record, {uid}).documentId === documentId) count++;
            } catch { /* a malformed row can neither consume nor widen the budget */ }
        }
        return count;
    };
    const canonicalRecord = (record, {uid}) => {
        try {
            return documentAttachmentMetadata(record, {uid});
        } catch {
            return fail('DOCUMENT_ATTACHMENT_INVALID');
        }
    };
    return Object.freeze({
        async upload(input, trusted) {
            const uid = identity(trusted);
            if (typeof hash !== 'function' || typeof db?.runTransaction !== 'function' ||
                typeof db?.attachmentsFor !== 'function' || typeof storage?.probe !== 'function' ||
                typeof storage?.putIfAbsent !== 'function') fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            const command = validateDocumentAttachmentUploadCommand(input?.command);
            const {digest} = input ?? {};
            if (!documentAttachmentOperationDigest(digest) || input?.payload === undefined) fail('DOCUMENT_ATTACHMENT_INVALID');
            if (command.ownerId !== uid) fail('OWNER_MISMATCH');
            // The digest is recomputed from the command, then from the received
            // bytes: a caller cannot pair a receipt with another command, and the
            // stored object is the one the metadata describes.
            if (await hash(documentAttachmentCommandDigestInput(command)) !== digest) fail('DOCUMENT_ATTACHMENT_INVALID');
            let payload;
            try {
                payload = documentAttachmentPayloadCopy(input.payload);
            } catch {
                return fail(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_PAYLOAD_MISMATCH);
            }
            if (await documentAttachmentSha256(payload) !== command.digest) {
                return fail(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_PAYLOAD_MISMATCH);
            }
            const {recordRef, receiptRef} = refsFor(command);
            const siblings = db.attachmentsFor({uid, documentId: command.documentId});
            // Reservation: receipt, profile, siblings and record are all read
            // before the first write, and the limit is decided in the same
            // transaction that creates the reservation.
            const reserved = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                const profile = await transaction.get(db.doc(`users/${uid}`));
                const current = await transaction.listAttachments(siblings);
                const record = await transaction.get(recordRef);
                if (receipt.exists) return {state: receiptOf(receipt.data(), {kind: KIND, uid, digest})};
                assertPersistedDocument(profile.exists ? profile.data() : null, {uid, documentId: command.documentId});
                if (record.exists) fail('DOCUMENT_ATTACHMENT_EXISTS');
                if (boundCount(current, {uid, documentId: command.documentId}) >= DOCUMENT_IMAGE_MAX_PER_DOCUMENT) {
                    fail(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_LIMIT_REACHED);
                }
                transaction.create(recordRef, {ownerId: uid, documentId: command.documentId, storagePath: command.storagePath,
                    mimeType: command.mimeType, size: command.size, digest: command.digest, envelope: command.envelope,
                    status: 'reserved', schemaVersion: DOCUMENT_ATTACHMENT_SCHEMA_VERSION, createdAt: timestamp()});
                transaction.create(receiptRef, {kind: KIND, ownerId: uid, operationId: command.operationId,
                    documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
                    digest, objectDigest: command.digest, status: 'reserved', createdAt: timestamp()});
                return {state: 'reserved'};
            });
            if (reserved.state === 'ready') return confirmed('ready', command.attachmentId);
            if (reserved.state !== 'reserved') fail('OPERATION_CONFLICT');
            // Storage: never overwrite an object blindly. An object that is
            // already there is accepted only when it is exactly this one.
            let existing;
            try {
                existing = await storage.probe(command.storagePath);
            } catch {
                return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);
            }
            if (existing?.exists) {
                if (existing.digest !== command.digest) return incomplete('OBJECT_CONFLICT', command.attachmentId);
            } else {
                try {
                    await storage.putIfAbsent(command.storagePath, payload, {metadata: command.storageMetadata});
                } catch {
                    try {
                        await drop({recordRef, receiptRef});
                        return compensated('OBJECT_WRITE_FAILED', command.attachmentId);
                    } catch {
                        return incomplete('COMPENSATION_FAILED', command.attachmentId);
                    }
                }
                let stored;
                try {
                    stored = await storage.probe(command.storagePath);
                } catch {
                    return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);
                }
                if (stored?.digest !== command.digest) return incomplete('OBJECT_CONFLICT', command.attachmentId);
            }
            // Finalization: reads first. The metadata document keeps exactly the
            // contract allowlist; the state machine lives in the receipt.
            let finalized;
            try {
                finalized = await db.runTransaction(async transaction => {
                    const receipt = await transaction.get(receiptRef);
                    const record = await transaction.get(recordRef);
                    if (receipt.exists && receipt.data().status === 'ready') return {state: 'ready'};
                    if (!record.exists) return {state: 'orphan'};
                    transaction.update(recordRef, {status: 'ready'});
                    if (receipt.exists) transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                    return {state: 'ready'};
                });
            } catch {
                return incomplete('FINALIZE_FAILED', command.attachmentId);
            }
            if (finalized.state === 'orphan') {
                // The digest check above proved this object is the one this
                // operation wrote, so removing it cannot touch a foreign object.
                try {
                    await storage.remove(command.storagePath);
                    await drop({recordRef, receiptRef});
                    return compensated('METADATA_MISSING', command.attachmentId);
                } catch {
                    return incomplete('COMPENSATION_FAILED', command.attachmentId);
                }
            }
            return confirmed('ready', command.attachmentId);
        },
        async remove(input, trusted) {
            const uid = identity(trusted);
            if (typeof hash !== 'function' || typeof db?.runTransaction !== 'function' || typeof storage?.probe !== 'function' ||
                typeof storage?.remove !== 'function') fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            const command = validateDocumentAttachmentDeleteCommand(input?.command);
            const digest = input?.digest;
            if (!documentAttachmentOperationDigest(digest)) fail('DOCUMENT_ATTACHMENT_INVALID');
            if (command.ownerId !== uid) fail('OWNER_MISMATCH');
            if (await hash(documentAttachmentCommandDigestInput(command)) !== digest) fail('DOCUMENT_ATTACHMENT_INVALID');
            const {recordRef, receiptRef} = refsFor(command);
            // The whole authoritative record is validated, not only its digest.
            const requested = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                const record = await transaction.get(recordRef);
                if (receipt.exists) return {state: receiptOf(receipt.data(), {kind: DELETE_KIND, uid, digest})};
                if (!record.exists) fail('DOCUMENT_ATTACHMENT_MISSING');
                const metadata = canonicalRecord(record.data(), {uid});
                if (metadata.ownerId !== uid || metadata.documentId !== command.documentId ||
                    metadata.attachmentId !== command.attachmentId || metadata.storagePath !== command.storagePath ||
                    metadata.digest !== command.expectedDigest) fail('DOCUMENT_ATTACHMENT_CONFLICT');
                transaction.update(recordRef, {status: 'deleting'});
                transaction.create(receiptRef, {kind: DELETE_KIND, ownerId: uid, operationId: command.operationId,
                    documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
                    digest, expectedDigest: command.expectedDigest, status: 'deleting', createdAt: timestamp()});
                return {state: 'deleting'};
            });
            if (requested.state === 'removed') return confirmed('removed', command.attachmentId);
            if (requested.state !== 'deleting') fail('OPERATION_CONFLICT');
            let probe;
            try {
                probe = await storage.probe(command.storagePath);
            } catch {
                return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);
            }
            if (probe?.exists) {
                // An object whose bytes are not the ones this record describes is
                // never deleted: the operation stays pending instead.
                if (probe.digest !== command.expectedDigest) return incomplete('OBJECT_CONFLICT', command.attachmentId);
                try {
                    await storage.remove(command.storagePath);
                } catch {
                    return incomplete('OBJECT_REMOVE_FAILED', command.attachmentId);
                }
            }
            try {
                await db.runTransaction(async transaction => {
                    const record = await transaction.get(recordRef);
                    const receipt = await transaction.get(receiptRef);
                    if (record.exists) transaction.delete(recordRef);
                    if (receipt.exists) transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                });
            } catch {
                return incomplete('FINALIZE_FAILED', command.attachmentId);
            }
            return confirmed('removed', command.attachmentId);
        },
        // Finishes pending receipts and compensates orphan objects. Promotion and
        // deletion require the object to be proven ours by digest and coherent
        // with the receipt/metadata; anything unproven stays blocked. Idempotent.
        async recover(trusted) {
            const uid = identity(trusted);
            if (typeof db?.list !== 'function' || typeof db?.get !== 'function' || typeof db?.runTransaction !== 'function' ||
                typeof storage?.probe !== 'function' || typeof storage?.remove !== 'function') fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            const receipts = await db.list(documentAttachmentReceiptCollection(uid));
            if (!Array.isArray(receipts)) fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            let confirmedCount = 0, compensatedCount = 0, incompleteCount = 0;
            for (const stored of receipts) {
                if (!documentAttachmentObject(stored) || (stored.kind !== KIND && stored.kind !== DELETE_KIND) || stored.ownerId !== uid) continue;
                if (stored.status === 'ready' || stored.status === 'removed') continue;
                try {
                    if (!documentAttachmentId(stored.attachmentId) || !documentAttachmentId(stored.documentId) ||
                        !documentAttachmentOperationId(stored.operationId) ||
                        (stored.kind === KIND && !documentAttachmentOperationDigest(stored.objectDigest)) ||
                        (stored.kind === DELETE_KIND && !documentAttachmentOperationDigest(stored.expectedDigest)) ||
                        stored.storagePath !== documentImageStoragePath({uid, documentId: stored.documentId, attachmentId: stored.attachmentId})) {
                        incompleteCount++;
                        continue;
                    }
                    // The object digest proves which bytes belong to this
                    // operation; `stored.digest` is the operation digest.
                    const objectDigest = stored.kind === KIND ? stored.objectDigest : stored.expectedDigest;
                    const recordRef = db.doc(documentAttachmentRecordPath({uid, attachmentId: stored.attachmentId}));
                    const receiptRef = db.doc(documentAttachmentReceiptPath({uid, operationId: stored.operationId}));
                    const record = await db.get(recordRef);
                    const metadata = record.exists ? canonicalRecord(record.data(), {uid}) : null;
                    const bound = metadata !== null && metadata.documentId === stored.documentId &&
                        metadata.attachmentId === stored.attachmentId && metadata.storagePath === stored.storagePath;
                    if (stored.kind === KIND && stored.status === 'reserved') {
                        const probe = await storage.probe(stored.storagePath);
                        if (!probe?.exists) {
                            // Nothing is stored: withdraw the reservation, but only
                            // when the record (if any) is ours and coherent.
                            if (record.exists && !(bound && metadata.digest === objectDigest)) {incompleteCount++; continue;}
                            await drop({recordRef, receiptRef});
                            compensatedCount++;
                            continue;
                        }
                        // Promotion requires the stored bytes to be the ones this
                        // operation wrote, plus a coherent canonical record.
                        if (probe.digest !== objectDigest || !(bound && metadata.digest === objectDigest)) {incompleteCount++; continue;}
                        await db.runTransaction(async transaction => {
                            const current = await transaction.get(recordRef);
                            const receipt = await transaction.get(receiptRef);
                            if (current.exists) transaction.update(recordRef, {status: 'ready'});
                            if (receipt.exists) transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                        });
                        confirmedCount++;
                        continue;
                    }
                    if (stored.kind === DELETE_KIND && stored.status === 'deleting') {
                        if (record.exists && !(bound && metadata.digest === objectDigest)) {incompleteCount++; continue;}
                        const probe = await storage.probe(stored.storagePath);
                        if (probe?.exists) {
                            if (probe.digest !== objectDigest) {incompleteCount++; continue;}
                            await storage.remove(stored.storagePath);
                        }
                        await db.runTransaction(async transaction => {
                            const current = await transaction.get(recordRef);
                            const receipt = await transaction.get(receiptRef);
                            if (current.exists) transaction.delete(recordRef);
                            if (receipt.exists) transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                        });
                        confirmedCount++;
                        continue;
                    }
                    incompleteCount++;
                } catch {
                    incompleteCount++;
                }
            }
            return Object.freeze({status: 'recovered', confirmed: confirmedCount, compensated: compensatedCount, incomplete: incompleteCount});
        }
    });
}
