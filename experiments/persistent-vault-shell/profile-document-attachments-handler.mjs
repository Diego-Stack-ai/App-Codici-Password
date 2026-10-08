import {DOCUMENT_ATTACHMENT_SCHEMA_VERSION, DOCUMENT_ATTACHMENT_REFUSALS, DOCUMENT_ATTACHMENT_STORAGE_CHANGED,
    DOCUMENT_IMAGE_MAX_PER_DOCUMENT, documentAttachmentDeleteReceipt, documentAttachmentEnvelopeEquals,
    documentAttachmentMetadata, documentAttachmentObject, documentAttachmentObjectSize, documentAttachmentOperationDigest,
    documentAttachmentPayloadCopy, documentAttachmentReceiptCollection, documentAttachmentReceiptPath,
    documentAttachmentRecordPath, documentAttachmentSha256, documentAttachmentUploadReceipt}
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
//   storage: {probe(path) -> {exists, digest, size, generation},
//             putIfAbsent(path, bytes, options) -> 'created'|'exists',   // native ifGenerationMatch: 0
//             remove(path, {generation}) -> void}                        // native ifGenerationMatch: <generation>
// `generation` is the native version of the stored object: when the transport
// reports it, the removal is conditional on the version that was just verified and
// a changed object must be reported as DOCUMENT_ATTACHMENT_STORAGE_CHANGED.
//
// Firestore and Storage are never atomic together: each step is recorded in the
// receipt and every partial outcome is either resumable or compensable. Outcomes
// are `confirmed` (terminal, idempotent), `compensated` (terminal, no trace left)
// or `incomplete` (a receipt survives and `recover()` or a retry finishes it).
// Every transaction below performs all of its reads before its first write, as
// real Firestore requires; the unit fake refuses read-after-write so a
// regression cannot hide behind a permissive mock.
//
// DS-002A-R2: the receipt is the recovery authority, so it is validated
// canonically (exact fields, derived path, both digests, stored size, state
// timestamp) before any decision, and every finalization re-reads receipt and
// record in the same transaction that writes: a value changed after the
// reservation is never promoted, never overwritten and never deleted.
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
    // Canonical receipt reads. `null` means malformed or not the receipt this
    // operation expects: the caller blocks instead of continuing.
    const uploadStatus = (value, uid, expected) => {
        try {return documentAttachmentUploadReceipt(value, {uid, ...expected}).status;} catch {return null;}
    };
    const deleteStatus = (value, uid, expected) => {
        try {return documentAttachmentDeleteReceipt(value, {uid, ...expected}).status;} catch {return null;}
    };
    // The transport may or may not report the size of the stored object: when it
    // does, the value must be a canonical stored size, otherwise the object is not
    // verifiable at all.
    const reportedSize = descriptor => {
        if (descriptor?.size === undefined || descriptor?.size === null) return null;
        return documentAttachmentObjectSize(descriptor.size) ? descriptor.size : 'invalid';
    };
    // Ownership proof for a stored object: the digest recorded for this operation,
    // plus the stored size whenever both sides report one. A transport that does
    // not report a size proves ownership by digest alone (declared in the
    // technical note); a reported size that differs blocks promotion, overwrite
    // and deletion.
    const objectProof = (descriptor, {objectDigest, objectSize}) => {
        if (!documentAttachmentObject(descriptor) || descriptor.exists !== true || descriptor.digest !== objectDigest) return false;
        const size = reportedSize(descriptor);
        if (size === 'invalid') return false;
        if (size === null || objectSize === null || objectSize === undefined) return true;
        return size === objectSize;
    };
    // Conditional removal: the transport receives the native version observed
    // immediately before, so an object replaced in that window is never deleted. A
    // transport that has no generations simply receives `undefined`.
    const removeObject = async (descriptor, path, {code}) => {
        try {
            await storage.remove(path, {generation: descriptor?.generation});
            return null;
        } catch (error) {
            if (error?.code === DOCUMENT_ATTACHMENT_STORAGE_CHANGED || error?.message === DOCUMENT_ATTACHMENT_STORAGE_CHANGED) {
                return DOCUMENT_ATTACHMENT_STORAGE_CHANGED;
            }
            return code;
        }
    };
    // Whole-record coherence with a command: owner, document, derived attachment,
    // path, digest, status and — for an upload — the exact metadata the command
    // produced, envelope included.
    const recordCoherent = (value, command, {uid, status}) => {
        try {
            const metadata = documentAttachmentMetadata(value, {uid});
            const expected = command.kind === KIND ? command.digest : command.expectedDigest;
            if ((status !== undefined && metadata.status !== status) || metadata.ownerId !== command.ownerId ||
                metadata.documentId !== command.documentId ||
                metadata.attachmentId !== command.attachmentId || metadata.storagePath !== command.storagePath ||
                metadata.digest !== expected) return false;
            return command.kind !== KIND || (metadata.mimeType === command.mimeType && metadata.size === command.size &&
                documentAttachmentEnvelopeEquals(metadata.envelope, command.envelope));
        } catch {return false;}
    };
    // Same coherence, expressed against a receipt instead of a command: used by
    // `recover`, where the receipt is the only surviving authority.
    const recordBinds = (value, {uid, documentId, attachmentId, storagePath, digest, status}) => {
        try {
            const metadata = documentAttachmentMetadata(value, {uid});
            if (status !== undefined && metadata.status !== status) return false;
            return metadata.documentId === documentId && metadata.attachmentId === attachmentId &&
                metadata.storagePath === storagePath && metadata.digest === digest;
        } catch {return false;}
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
    // Compensation of a reservation, used when nothing was stored and when the
    // metadata disappeared. It never deletes what it cannot re-prove inside the
    // same transaction: the receipt must still be the canonical `reserved`
    // receipt of this operation, and the record must either be absent or be
    // canonically ours in `reserved` state.
    const withdrawReservation = async ({recordRef, receiptRef, uid, expectation, objectDigest}) => {
        try {
            const cleared = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                const record = await transaction.get(recordRef);
                if (!receipt.exists) return 'conflict';
                if (uploadStatus(receipt.data(), uid, {...expectation, statuses: ['reserved']}) === null) return 'conflict';
                if (record.exists) {
                    if (!recordBinds(record.data(), {uid, documentId: expectation.documentId,
                        attachmentId: expectation.attachmentId, storagePath: expectation.storagePath,
                        digest: objectDigest, status: 'reserved'})) return 'conflict';
                    transaction.delete(recordRef);
                }
                transaction.delete(receiptRef);
                return 'cleared';
            });
            return cleared;
        } catch {return 'failed';}
    };
    // Storage step, never assumed: after a failed conditional write the object is
    // probed again, because a failed call may still have created it.
    const ensureObject = async ({path, payload, metadata, proof}) => {
        let descriptor;
        try {descriptor = await storage.probe(path);} catch {return {stored: false, code: 'OBJECT_UNVERIFIABLE'};}
        if (descriptor?.exists) return objectProof(descriptor, proof) ? {stored: true} : {stored: false, code: 'OBJECT_CONFLICT'};
        try {
            await storage.putIfAbsent(path, payload, {metadata});
        } catch {
            try {descriptor = await storage.probe(path);} catch {return {stored: false, code: 'OBJECT_UNVERIFIABLE'};}
            if (!descriptor?.exists) return {stored: false, code: 'OBJECT_WRITE_FAILED'};
            return objectProof(descriptor, proof) ? {stored: true} : {stored: false, code: 'OBJECT_CONFLICT'};
        }
        try {descriptor = await storage.probe(path);} catch {return {stored: false, code: 'OBJECT_UNVERIFIABLE'};}
        return objectProof(descriptor, proof) ? {stored: true} : {stored: false, code: 'OBJECT_CONFLICT'};
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
            // The stored size is measured here, in the trusted boundary: the object
            // written below is exactly this buffer.
            const objectSize = payload.byteLength;
            const proof = {objectDigest: command.digest, objectSize};
            const expectation = {operationId: command.operationId, documentId: command.documentId,
                attachmentId: command.attachmentId, storagePath: command.storagePath, digest, ...proof};
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
                if (receipt.exists) {
                    const state = uploadStatus(receipt.data(), uid, expectation);
                    if (state === null) fail('OPERATION_CONFLICT');
                    return {state};
                }
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
                    digest, objectDigest: command.digest, objectSize, status: 'reserved', createdAt: timestamp()});
                return {state: 'reserved'};
            });
            if (reserved.state === 'ready') return confirmed('ready', command.attachmentId);
            if (reserved.state !== 'reserved') fail('OPERATION_CONFLICT');
            // Storage: never overwrite an object blindly. An object that is
            // already there is accepted only when it is exactly this one.
            const stored = await ensureObject({path: command.storagePath, payload, metadata: command.storageMetadata, proof});
            if (!stored.stored) {
                if (stored.code !== 'OBJECT_WRITE_FAILED') return incomplete(stored.code, command.attachmentId);
                const cleared = await withdrawReservation({recordRef, receiptRef, uid, expectation, objectDigest: command.digest});
                if (cleared === 'cleared') return compensated('OBJECT_WRITE_FAILED', command.attachmentId);
                return incomplete(cleared === 'failed' ? 'COMPENSATION_FAILED' : 'COMPENSATION_CONFLICT', command.attachmentId);
            }
            // Finalization: reads first, and both values are re-proved inside the
            // transaction that writes. A record or receipt changed after the
            // reservation promotes nothing.
            let finalized;
            try {
                finalized = await db.runTransaction(async transaction => {
                    const receipt = await transaction.get(receiptRef);
                    const record = await transaction.get(recordRef);
                    if (!receipt.exists) return {state: 'conflict'};
                    const state = uploadStatus(receipt.data(), uid, expectation);
                    if (state === null) return {state: 'conflict'};
                    if (state === 'ready') return {state: 'ready'};
                    if (!record.exists) return {state: 'orphan'};
                    if (!recordCoherent(record.data(), command, {uid, status: 'reserved'})) return {state: 'conflict'};
                    transaction.update(recordRef, {status: 'ready'});
                    transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                    return {state: 'ready'};
                });
            } catch {
                return incomplete('FINALIZE_FAILED', command.attachmentId);
            }
            if (finalized.state === 'conflict') return incomplete('FINALIZE_CONFLICT', command.attachmentId);
            if (finalized.state === 'orphan') {
                // The metadata disappeared after the reservation: the object is only
                // removed after a fresh digest/size proof, and the receipt is closed
                // only while the record is still absent inside the transaction.
                let current;
                try {current = await storage.probe(command.storagePath);} catch {return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);}
                if (!objectProof(current, proof)) return incomplete('OBJECT_CONFLICT', command.attachmentId);
                const removal = await removeObject(current, command.storagePath, {code: 'COMPENSATION_FAILED'});
                if (removal) return incomplete(removal, command.attachmentId);
                const cleared = await withdrawReservation({recordRef, receiptRef, uid, expectation, objectDigest: command.digest});
                if (cleared === 'cleared') return compensated('METADATA_MISSING', command.attachmentId);
                return incomplete(cleared === 'failed' ? 'COMPENSATION_FAILED' : 'COMPENSATION_CONFLICT', command.attachmentId);
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
            // The stored size observed before the reservation becomes part of the
            // receipt, so the object removed later must still match both values.
            let observed;
            try {observed = await storage.probe(command.storagePath);} catch {return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);}
            const objectSize = reportedSize(observed);
            if (objectSize === 'invalid') return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);
            // A retry cannot demand the size it happens to observe now (the object may
            // already be gone): the size recorded at reservation is the authority.
            const expectation = {operationId: command.operationId, documentId: command.documentId,
                attachmentId: command.attachmentId, storagePath: command.storagePath, digest,
                objectDigest: command.expectedDigest};
            // The whole authoritative record is validated, not only its digest.
            const requested = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                const record = await transaction.get(recordRef);
                if (receipt.exists) {
                    const state = deleteStatus(receipt.data(), uid, expectation);
                    if (state === null) fail('OPERATION_CONFLICT');
                    return {state, objectSize: receipt.data().objectSize};
                }
                if (!record.exists) fail('DOCUMENT_ATTACHMENT_MISSING');
                if (!recordCoherent(record.data(), command, {uid, status: undefined})) fail('DOCUMENT_ATTACHMENT_CONFLICT');
                transaction.update(recordRef, {status: 'deleting'});
                transaction.create(receiptRef, {kind: DELETE_KIND, ownerId: uid, operationId: command.operationId,
                    documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
                    digest, expectedDigest: command.expectedDigest, objectSize, status: 'deleting', createdAt: timestamp()});
                return {state: 'deleting', objectSize};
            });
            if (requested.state === 'removed') return confirmed('removed', command.attachmentId);
            if (requested.state !== 'deleting') fail('OPERATION_CONFLICT');
            const proof = {objectDigest: command.expectedDigest, objectSize: requested.objectSize};
            // The object is removed only on a fresh proof of digest and recorded size.
            let probe;
            try {
                probe = await storage.probe(command.storagePath);
            } catch {
                return incomplete('OBJECT_UNVERIFIABLE', command.attachmentId);
            }
            if (probe?.exists) {
                // An object whose bytes — or size — are not the ones this operation
                // recorded is never deleted: the operation stays pending instead.
                if (!objectProof(probe, proof)) {
                    return incomplete('OBJECT_CONFLICT', command.attachmentId);
                }
                const removal = await removeObject(probe, command.storagePath, {code: 'OBJECT_REMOVE_FAILED'});
                if (removal) return incomplete(removal, command.attachmentId);
            }
            // Finalization: receipt and record are re-read and re-proved in the same
            // transaction. A record replaced after the reservation is not deleted.
            let finalized;
            try {
                finalized = await db.runTransaction(async transaction => {
                    const receipt = await transaction.get(receiptRef);
                    const record = await transaction.get(recordRef);
                    if (!receipt.exists) return {state: 'conflict'};
                    const state = deleteStatus(receipt.data(), uid, {...expectation, objectSize: proof.objectSize});
                    if (state === null) return {state: 'conflict'};
                    if (state === 'removed') return {state: 'removed'};
                    if (record.exists && !recordCoherent(record.data(), command, {uid, status: 'deleting'})) {
                        return {state: 'conflict'};
                    }
                    if (record.exists) transaction.delete(recordRef);
                    transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                    return {state: 'removed'};
                });
            } catch {
                return incomplete('FINALIZE_FAILED', command.attachmentId);
            }
            if (finalized.state === 'conflict') return incomplete('FINALIZE_CONFLICT', command.attachmentId);
            return confirmed('removed', command.attachmentId);
        },
        // Finishes pending receipts and compensates orphan objects. The receipt is
        // validated canonically first (a malformed one blocks the operation without
        // touching Storage), the object is proved by digest — and by stored size
        // when the transport reports it — immediately before any removal, and every
        // write happens in a transaction that re-reads receipt and record and
        // re-proves that they are still the ones this operation reserved. A
        // concurrent change produces `incomplete`, never a destructive write.
        async recover(trusted) {
            const uid = identity(trusted);
            if (typeof db?.list !== 'function' || typeof db?.get !== 'function' || typeof db?.runTransaction !== 'function' ||
                typeof storage?.probe !== 'function' || typeof storage?.remove !== 'function') fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            const receipts = await db.list(documentAttachmentReceiptCollection(uid));
            if (!Array.isArray(receipts)) fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            let confirmedCount = 0, compensatedCount = 0, incompleteCount = 0;
            for (const stored of receipts) {
                if (!documentAttachmentObject(stored) || (stored.kind !== KIND && stored.kind !== DELETE_KIND) || stored.ownerId !== uid) continue;
                try {
                    const receipt = stored.kind === KIND
                        ? documentAttachmentUploadReceipt(stored, {uid})
                        : documentAttachmentDeleteReceipt(stored, {uid});
                    if (receipt.status === 'ready' || receipt.status === 'removed') continue;
                    const recordRef = db.doc(documentAttachmentRecordPath({uid, attachmentId: receipt.attachmentId}));
                    const receiptRef = db.doc(documentAttachmentReceiptPath({uid, operationId: receipt.operationId}));
                    const bind = {uid, documentId: receipt.documentId, attachmentId: receipt.attachmentId,
                        storagePath: receipt.storagePath};
                    const expectation = {operationId: receipt.operationId, documentId: receipt.documentId,
                        attachmentId: receipt.attachmentId, storagePath: receipt.storagePath, digest: receipt.digest,
                        objectDigest: receipt.kind === KIND ? receipt.objectDigest : receipt.expectedDigest,
                        objectSize: receipt.objectSize};
                    const objectDigest = expectation.objectDigest, objectSize = receipt.objectSize;
                    if (receipt.kind === KIND) {
                        let probe;
                        try {probe = await storage.probe(receipt.storagePath);} catch {incompleteCount++; continue;}
                        if (!probe?.exists) {
                            // Nothing is stored: withdraw the reservation, but only when
                            // receipt and record still prove it is ours.
                            const cleared = await withdrawReservation({recordRef, receiptRef, uid, expectation, objectDigest});
                            if (cleared === 'cleared') compensatedCount++; else incompleteCount++;
                            continue;
                        }
                        if (!objectProof(probe, {objectDigest, objectSize})) {incompleteCount++; continue;}
                        const promoted = await db.runTransaction(async transaction => {
                            const currentReceipt = await transaction.get(receiptRef);
                            const currentRecord = await transaction.get(recordRef);
                            if (!currentReceipt.exists || !currentRecord.exists) return 'conflict';
                            if (uploadStatus(currentReceipt.data(), uid, {...expectation, statuses: ['reserved']}) !== 'reserved') return 'conflict';
                            if (!recordBinds(currentRecord.data(), {...bind, digest: objectDigest, status: 'reserved'})) return 'conflict';
                            transaction.update(recordRef, {status: 'ready'});
                            transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                            return 'ready';
                        });
                        if (promoted === 'ready') confirmedCount++; else incompleteCount++;
                        continue;
                    }
                    // Deletion pending: a record that is already foreign blocks the
                    // object removal before it happens; the final transaction is the
                    // authority in any case.
                    const preRead = await db.get(recordRef);
                    if (preRead.exists && !recordBinds(preRead.data(), {...bind, digest: objectDigest, status: 'deleting'})) {
                        incompleteCount++;
                        continue;
                    }
                    let probe;
                    try {probe = await storage.probe(receipt.storagePath);} catch {incompleteCount++; continue;}
                    if (probe?.exists) {
                        if (!objectProof(probe, {objectDigest, objectSize})) {incompleteCount++; continue;}
                        const removal = await removeObject(probe, receipt.storagePath, {code: 'OBJECT_REMOVE_FAILED'});
                        if (removal) {incompleteCount++; continue;}
                    }
                    const closed = await db.runTransaction(async transaction => {
                        const currentReceipt = await transaction.get(receiptRef);
                        const currentRecord = await transaction.get(recordRef);
                        if (!currentReceipt.exists) return 'conflict';
                        const state = deleteStatus(currentReceipt.data(), uid, expectation);
                        if (state === null) return 'conflict';
                        if (state === 'removed') return 'removed';
                        if (currentRecord.exists && !recordBinds(currentRecord.data(), {...bind, digest: objectDigest, status: 'deleting'})) {
                            return 'conflict';
                        }
                        if (currentRecord.exists) transaction.delete(recordRef);
                        transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                        return 'removed';
                    });
                    if (closed === 'removed') confirmedCount++; else incompleteCount++;
                } catch {
                    incompleteCount++;
                }
            }
            return Object.freeze({status: 'recovered', confirmed: confirmedCount, compensated: compensatedCount, incomplete: incompleteCount});
        }
    });
}
