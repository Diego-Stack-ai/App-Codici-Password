import {DOCUMENT_ATTACHMENT_SCHEMA_VERSION, documentAttachmentId, documentAttachmentOperationDigest,
    documentAttachmentOperationId, documentAttachmentReceiptCollection, documentAttachmentReceiptPath,
    documentAttachmentRecordPath, documentImageStoragePath} from './profile-document-attachments-contract.mjs';
import {documentAttachmentCommandDigestInput, validateDocumentAttachmentDeleteCommand,
    validateDocumentAttachmentUploadCommand} from './prepare-profile-document-attachment.mjs';

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const KIND = 'profile-document-attachment';
const DELETE_KIND = 'profile-document-attachment-delete';
// Candidate service for the future callable (authorization and App Check are
// demanded here exactly as the other candidate services do). Firestore and
// Storage are never atomic together: each step is recorded in the receipt and
// every partial outcome is either resumable or compensable. Outcomes are
// `confirmed` (terminal, idempotent), `compensated` (terminal, no trace left) or
// `incomplete` (a receipt survives and `recover()` or a retry finishes it).
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
    const drop = async ({recordRef, receiptRef}) => {
        await db.runTransaction(async transaction => {
            const record = await transaction.get(recordRef);
            if (record.exists) transaction.delete(recordRef);
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) transaction.delete(receiptRef);
        });
    };
    const receiptOf = (value, {kind, uid, digest}) => {
        if (value.kind !== kind || value.ownerId !== uid || value.digest !== digest) fail('OPERATION_CONFLICT');
        return value.status;
    };
    return Object.freeze({
        async upload(input, trusted) {
            const uid = identity(trusted);
            if (typeof hash !== 'function' || typeof db?.runTransaction !== 'function' || typeof storage?.put !== 'function') {
                fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            }
            const command = validateDocumentAttachmentUploadCommand(input?.command);
            const {digest, payload} = input ?? {};
            if (!documentAttachmentOperationDigest(digest) ||
                !(payload && typeof payload.byteLength === 'number' && payload.byteLength > 0)) fail('DOCUMENT_ATTACHMENT_INVALID');
            if (command.ownerId !== uid) fail('OWNER_MISMATCH');
            // The digest is recomputed from the command: a caller cannot pair an
            // arbitrary receipt digest with a different command.
            if (await hash(documentAttachmentCommandDigestInput(command)) !== digest) fail('DOCUMENT_ATTACHMENT_INVALID');
            const {recordRef, receiptRef} = refsFor(command);
            const reserved = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                if (receipt.exists) return {state: receiptOf(receipt.data(), {kind: KIND, uid, digest})};
                const record = await transaction.get(recordRef);
                if (record.exists) fail('DOCUMENT_ATTACHMENT_EXISTS');
                transaction.create(recordRef, {ownerId: uid, documentId: command.documentId, storagePath: command.storagePath,
                    mimeType: command.mimeType, size: command.size, digest: command.digest, envelope: command.envelope,
                    status: 'reserved', schemaVersion: DOCUMENT_ATTACHMENT_SCHEMA_VERSION, createdAt: timestamp()});
                transaction.create(receiptRef, {kind: KIND, ownerId: uid, operationId: command.operationId,
                    documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
                    digest, status: 'reserved', createdAt: timestamp()});
                return {state: 'reserved'};
            });
            if (reserved.state === 'ready') return Object.freeze({status: 'confirmed', state: 'ready', attachmentId: command.attachmentId});
            if (reserved.state !== 'reserved') fail('OPERATION_CONFLICT');
            try {
                await storage.put(command.storagePath, payload, {metadata: command.storageMetadata});
            } catch {
                try {
                    await drop({recordRef, receiptRef});
                    return Object.freeze({status: 'compensated', code: 'OBJECT_WRITE_FAILED', attachmentId: command.attachmentId});
                } catch {
                    return Object.freeze({status: 'incomplete', code: 'COMPENSATION_FAILED', attachmentId: command.attachmentId});
                }
            }
            let finalized;
            try {
                finalized = await db.runTransaction(async transaction => {
                    const receipt = await transaction.get(receiptRef);
                    if (receipt.exists && receipt.data().status === 'ready') return {state: 'ready'};
                    const record = await transaction.get(recordRef);
                    // The object exists but nothing references it any more: orphan.
                    // The metadata document keeps exactly the contract allowlist:
                    // the state machine lives in the receipt, never in extra keys.
                    if (!record.exists) return {state: 'orphan'};
                    transaction.update(recordRef, {status: 'ready'});
                    if (receipt.exists) transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                    return {state: 'ready'};
                });
            } catch {
                return Object.freeze({status: 'incomplete', code: 'FINALIZE_FAILED', attachmentId: command.attachmentId});
            }
            if (finalized.state === 'orphan') {
                try {
                    await storage.remove(command.storagePath);
                    await drop({recordRef, receiptRef});
                    return Object.freeze({status: 'compensated', code: 'METADATA_MISSING', attachmentId: command.attachmentId});
                } catch {
                    return Object.freeze({status: 'incomplete', code: 'COMPENSATION_FAILED', attachmentId: command.attachmentId});
                }
            }
            return Object.freeze({status: 'confirmed', state: 'ready', attachmentId: command.attachmentId});
        },
        async remove(input, trusted) {
            const uid = identity(trusted);
            if (typeof hash !== 'function' || typeof db?.runTransaction !== 'function' || typeof storage?.remove !== 'function') {
                fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            }
            const command = validateDocumentAttachmentDeleteCommand(input?.command);
            const digest = input?.digest;
            if (!documentAttachmentOperationDigest(digest)) fail('DOCUMENT_ATTACHMENT_INVALID');
            if (command.ownerId !== uid) fail('OWNER_MISMATCH');
            if (await hash(documentAttachmentCommandDigestInput(command)) !== digest) fail('DOCUMENT_ATTACHMENT_INVALID');
            const {recordRef, receiptRef} = refsFor(command);
            const requested = await db.runTransaction(async transaction => {
                const receipt = await transaction.get(receiptRef);
                if (receipt.exists) return {state: receiptOf(receipt.data(), {kind: DELETE_KIND, uid, digest})};
                const record = await transaction.get(recordRef);
                if (!record.exists) fail('DOCUMENT_ATTACHMENT_MISSING');
                if (record.data().digest !== command.expectedDigest) fail('DOCUMENT_ATTACHMENT_CONFLICT');
                transaction.update(recordRef, {status: 'deleting'});
                transaction.create(receiptRef, {kind: DELETE_KIND, ownerId: uid, operationId: command.operationId,
                    documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
                    digest, expectedDigest: command.expectedDigest, status: 'deleting', createdAt: timestamp()});
                return {state: 'deleting'};
            });
            if (requested.state === 'removed') return Object.freeze({status: 'confirmed', state: 'removed', attachmentId: command.attachmentId});
            if (requested.state !== 'deleting') fail('OPERATION_CONFLICT');
            try {
                await storage.remove(command.storagePath);
            } catch {
                return Object.freeze({status: 'incomplete', code: 'OBJECT_REMOVE_FAILED', attachmentId: command.attachmentId});
            }
            try {
                await db.runTransaction(async transaction => {
                    const record = await transaction.get(recordRef);
                    if (record.exists) transaction.delete(recordRef);
                    const receipt = await transaction.get(receiptRef);
                    if (receipt.exists) transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                });
            } catch {
                return Object.freeze({status: 'incomplete', code: 'FINALIZE_FAILED', attachmentId: command.attachmentId});
            }
            return Object.freeze({status: 'confirmed', state: 'removed', attachmentId: command.attachmentId});
        },
        // Finishes pending receipts and compensates orphan objects. Idempotent:
        // running it twice changes nothing further.
        async recover(trusted) {
            const uid = identity(trusted);
            if (typeof db?.list !== 'function' || typeof db?.get !== 'function' || typeof db?.runTransaction !== 'function') {
                fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            }
            const receipts = await db.list(documentAttachmentReceiptCollection(uid));
            if (!Array.isArray(receipts)) fail('DOCUMENT_ATTACHMENT_UNAVAILABLE');
            let confirmed = 0, compensated = 0, incomplete = 0;
            for (const stored of receipts) {
                if (!stored || (stored.kind !== KIND && stored.kind !== DELETE_KIND) || stored.ownerId !== uid) continue;
                if (stored.status === 'ready' || stored.status === 'removed') continue;
                try {
                    if (!documentAttachmentId(stored.attachmentId) || !documentAttachmentId(stored.documentId) ||
                        !documentAttachmentOperationId(stored.operationId) ||
                        stored.storagePath !== documentImageStoragePath({uid, documentId: stored.documentId, attachmentId: stored.attachmentId})) {
                        incomplete++;
                        continue;
                    }
                    const recordRef = db.doc(documentAttachmentRecordPath({uid, attachmentId: stored.attachmentId}));
                    const receiptRef = db.doc(documentAttachmentReceiptPath({uid, operationId: stored.operationId}));
                    if (stored.kind === KIND && stored.status === 'reserved') {
                        if (!await storage.exists(stored.storagePath)) {
                            await drop({recordRef, receiptRef});
                            compensated++;
                            continue;
                        }
                        await db.runTransaction(async transaction => {
                            const record = await transaction.get(recordRef);
                            if (record.exists) transaction.update(recordRef, {status: 'ready'});
                            const receipt = await transaction.get(receiptRef);
                            if (receipt.exists) transaction.update(receiptRef, {status: 'ready', readyAt: timestamp()});
                        });
                        confirmed++;
                        continue;
                    }
                    if (stored.kind === DELETE_KIND && stored.status === 'deleting') {
                        await storage.remove(stored.storagePath);
                        await db.runTransaction(async transaction => {
                            const record = await transaction.get(recordRef);
                            if (record.exists) transaction.delete(recordRef);
                            const receipt = await transaction.get(receiptRef);
                            if (receipt.exists) transaction.update(receiptRef, {status: 'removed', removedAt: timestamp()});
                        });
                        confirmed++;
                        continue;
                    }
                    incomplete++;
                } catch {
                    incomplete++;
                }
            }
            return Object.freeze({status: 'recovered', confirmed, compensated, incomplete});
        }
    });
}
