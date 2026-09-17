import {DOCUMENT_ATTACHMENT_REFUSALS, DOCUMENT_ATTACHMENT_SCHEMA_VERSION, DOCUMENT_ATTACHMENT_STORAGE_METADATA,
    documentAttachmentBytes, documentAttachmentDigest, documentAttachmentEnvelope, documentAttachmentId,
    documentAttachmentIdentity, documentAttachmentLimitExceeded, documentAttachmentMetadata, documentAttachmentMime,
    documentAttachmentObject, documentAttachmentOperationId, documentAttachmentRecordPath, documentAttachmentSize,
    documentAttachmentInvalid, documentImageStoragePath} from './profile-document-attachments-contract.mjs';

const refuse = code => Object.freeze({status: 'refused', code});
const ATTACHMENT_ID_PREFIX = 'attachment-';
// Canonical input of the command digest: identity, limits and the wrapped
// envelope only. The payload is never part of it, so no byte can reach a receipt.
export function documentAttachmentCommandDigestInput(command) {
    if (!documentAttachmentObject(command)) documentAttachmentInvalid();
    return JSON.stringify({kind: command.kind, schemaVersion: command.schemaVersion, ownerId: command.ownerId,
        documentId: command.documentId, attachmentId: command.attachmentId, storagePath: command.storagePath,
        mimeType: command.mimeType ?? null, size: command.size ?? null, digest: command.digest ?? null,
        envelope: command.envelope ?? null, expectedDigest: command.expectedDigest ?? null});
}
// The attachment identity is minted by this boundary, not proposed by the client.
export const defaultCreateDocumentAttachmentId = () => `${ATTACHMENT_ID_PREFIX}${crypto.randomUUID()}`;
export function createDocumentAttachmentId(value) {
    const attachmentId = value === undefined ? defaultCreateDocumentAttachmentId() : value;
    if (!documentAttachmentId(attachmentId) || !attachmentId.startsWith(ATTACHMENT_ID_PREFIX)) {
        throw Error(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_ID_INVALID);
    }
    return attachmentId;
}
async function guard({context, getUser, operationId}) {
    const uid = context.user?.uid;
    if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
    context.assertUnlocked();
    if (!documentAttachmentOperationId(operationId)) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    return uid;
}
// Immutable upload plan. The caller receives the persistible command and, apart
// and explicitly transient, the ciphertext payload to hand to the transport.
export async function planProfileDocumentAttachmentUpload({context, getUser, capability, documents, attachments,
    documentId, bytes, mimeType, operationId, hash, createAttachmentId = defaultCreateDocumentAttachmentId,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = await guard({context, getUser, operationId});
    if (typeof hash !== 'function' || !capability || typeof capability.sealImage !== 'function') throw Error('DOCUMENT_ATTACHMENT_INVALID');
    if (!isOnline()) return refuse(DOCUMENT_ATTACHMENT_REFUSALS.OFFLINE_NOT_ALLOWED);
    const identity = documentAttachmentIdentity(documents, documentId);
    if (!identity.allowed) return refuse(identity.code);
    if (!documentAttachmentMime(mimeType)) return refuse(DOCUMENT_ATTACHMENT_REFUSALS.MIME_NOT_ALLOWED);
    if (!documentAttachmentBytes(bytes) || !documentAttachmentSize(bytes.byteLength)) return refuse(DOCUMENT_ATTACHMENT_REFUSALS.SIZE_NOT_ALLOWED);
    if (documentAttachmentLimitExceeded(attachments, {uid, documentId})) return refuse(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_LIMIT_REACHED);
    const attachmentId = createDocumentAttachmentId(createAttachmentId());
    if (Array.isArray(attachments) && attachments.some(record => record?.id === attachmentId)) {
        return refuse(DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_EXISTS);
    }
    const sealed = await capability.sealImage({bytes, documentId, attachmentId});
    const command = Object.freeze({kind: 'profile-document-attachment', schemaVersion: DOCUMENT_ATTACHMENT_SCHEMA_VERSION,
        operationId, ownerId: uid, documentId, attachmentId, storagePath: sealed.storagePath,
        recordPath: documentAttachmentRecordPath({uid, attachmentId}), mimeType, size: sealed.size, digest: sealed.digest,
        envelope: sealed.envelope, storageMetadata: DOCUMENT_ATTACHMENT_STORAGE_METADATA, status: 'reserved'});
    const digest = await hash(documentAttachmentCommandDigestInput(command));
    if (typeof digest !== 'string' || digest.length < 32) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    return Object.freeze({status: 'prepared', command, digest, payload: sealed.payload});
}
// Deletion plan: the metadata is validated (owner, document, derived path) before
// any command exists, so a foreign or malformed record can never be targeted.
export async function planProfileDocumentAttachmentDelete({context, getUser, documents, attachment, operationId, hash}) {
    const uid = await guard({context, getUser, operationId});
    if (typeof hash !== 'function' || !documentAttachmentObject(attachment)) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    const metadata = documentAttachmentMetadata(attachment, {uid});
    const identity = documentAttachmentIdentity(documents, metadata.documentId);
    if (!identity.allowed) return refuse(identity.code);
    const command = Object.freeze({kind: 'profile-document-attachment-delete', schemaVersion: DOCUMENT_ATTACHMENT_SCHEMA_VERSION,
        operationId, ownerId: uid, documentId: metadata.documentId, attachmentId: metadata.attachmentId,
        storagePath: metadata.storagePath, recordPath: documentAttachmentRecordPath({uid, attachmentId: metadata.attachmentId}),
        expectedDigest: metadata.digest, status: 'deleting'});
    const digest = await hash(documentAttachmentCommandDigestInput(command));
    if (typeof digest !== 'string' || digest.length < 32) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    return Object.freeze({status: 'prepared', command, digest, payload: null});
}
export function documentAttachmentPlanMatches(command, metadata, {uid} = {}) {
    if (!documentAttachmentObject(command) || !documentAttachmentObject(metadata)) return false;
    try {
        const validated = documentAttachmentMetadata(metadata, {uid});
        return command.ownerId === validated.ownerId && command.documentId === validated.documentId &&
            command.attachmentId === validated.attachmentId && command.storagePath === validated.storagePath &&
            command.expectedDigest === validated.digest &&
            command.storagePath === documentImageStoragePath({uid: command.ownerId, documentId: command.documentId, attachmentId: command.attachmentId}) &&
            documentAttachmentDigest(command.expectedDigest);
    } catch {return false;}
}
const UPLOAD_COMMAND_FIELDS = Object.freeze(['kind', 'schemaVersion', 'operationId', 'ownerId', 'documentId', 'attachmentId',
    'storagePath', 'recordPath', 'mimeType', 'size', 'digest', 'envelope', 'storageMetadata', 'status']);
const DELETE_COMMAND_FIELDS = Object.freeze(['kind', 'schemaVersion', 'operationId', 'ownerId', 'documentId', 'attachmentId',
    'storagePath', 'recordPath', 'expectedDigest', 'status']);
// Commands are re-validated where they are consumed: nothing is trusted because a
// planning function produced it earlier in the same process.
export function validateDocumentAttachmentUploadCommand(value) {
    if (!documentAttachmentObject(value) || Object.keys(value).length !== UPLOAD_COMMAND_FIELDS.length ||
        Object.keys(value).some(key => !UPLOAD_COMMAND_FIELDS.includes(key))) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    const {kind, schemaVersion, operationId, ownerId, documentId, attachmentId, storagePath, recordPath, mimeType, size,
        digest, envelope, storageMetadata, status} = value;
    if (kind !== 'profile-document-attachment' || schemaVersion !== DOCUMENT_ATTACHMENT_SCHEMA_VERSION || status !== 'reserved' ||
        !documentAttachmentOperationId(operationId) || !documentAttachmentId(ownerId) || !documentAttachmentId(documentId) ||
        !documentAttachmentId(attachmentId) || !documentAttachmentMime(mimeType) || !documentAttachmentSize(size) ||
        !documentAttachmentDigest(digest) || storagePath !== documentImageStoragePath({uid: ownerId, documentId, attachmentId}) ||
        recordPath !== documentAttachmentRecordPath({uid: ownerId, attachmentId}) ||
        !documentAttachmentObject(storageMetadata) || Object.keys(storageMetadata).length !== 1 ||
        storageMetadata.encrypted !== DOCUMENT_ATTACHMENT_STORAGE_METADATA.encrypted) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    return Object.freeze({kind, schemaVersion, operationId, ownerId, documentId, attachmentId, storagePath, recordPath,
        mimeType, size, digest, envelope: documentAttachmentEnvelope(envelope),
        storageMetadata: DOCUMENT_ATTACHMENT_STORAGE_METADATA, status});
}
export function validateDocumentAttachmentDeleteCommand(value) {
    if (!documentAttachmentObject(value) || Object.keys(value).length !== DELETE_COMMAND_FIELDS.length ||
        Object.keys(value).some(key => !DELETE_COMMAND_FIELDS.includes(key))) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    const {kind, schemaVersion, operationId, ownerId, documentId, attachmentId, storagePath, recordPath, expectedDigest, status} = value;
    if (kind !== 'profile-document-attachment-delete' || schemaVersion !== DOCUMENT_ATTACHMENT_SCHEMA_VERSION || status !== 'deleting' ||
        !documentAttachmentOperationId(operationId) || !documentAttachmentId(ownerId) || !documentAttachmentId(documentId) ||
        !documentAttachmentId(attachmentId) || !documentAttachmentDigest(expectedDigest) ||
        storagePath !== documentImageStoragePath({uid: ownerId, documentId, attachmentId}) ||
        recordPath !== documentAttachmentRecordPath({uid: ownerId, attachmentId})) throw Error('DOCUMENT_ATTACHMENT_INVALID');
    return Object.freeze({kind, schemaVersion, operationId, ownerId, documentId, attachmentId, storagePath, recordPath,
        expectedDigest, status});
}
