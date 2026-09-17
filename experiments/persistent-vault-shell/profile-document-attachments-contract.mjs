// Candidate contract for the images of a private digital document. Pure: it
// imports nothing from Firebase, it never receives bytes, keys or original file
// names, and it is deliberately NOT the Account attachment v1 format (that one
// uses a constant AAD): here the AAD is contextual and the envelope carries its
// own type. Everything the client could forge is derived instead of accepted.
export const DOCUMENT_IMAGE_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
export const DOCUMENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
// The record carries the original size (`size`), the receipt carries the stored
// (encrypted) size (`objectSize`): an AEAD payload is longer than its plaintext,
// so the two are distinct values and only the second can be compared with what
// the transport reports about the object.
export const DOCUMENT_IMAGE_MAX_STORED_BYTES = DOCUMENT_IMAGE_MAX_BYTES + 4096;
export const DOCUMENT_IMAGE_MAX_PER_DOCUMENT = 10;
export const DOCUMENT_ATTACHMENT_SCHEMA_VERSION = 1;
export const DOCUMENT_ATTACHMENT_ENVELOPE_TYPE = 'profile-document-attachment-envelope';
export const DOCUMENT_ATTACHMENT_STATUSES = Object.freeze(['reserved', 'ready', 'deleting']);
export const DOCUMENT_ATTACHMENT_AAD_DOMAIN = 'CodiciPassword:profile-document-attachment:v1';
export const DOCUMENT_ATTACHMENT_KINDS = Object.freeze(['profile-document-attachment', 'profile-document-attachment-delete']);
// The object is uploaded as opaque bytes; the current production rule accepts
// 'application/octet-stream' only with this custom marker (storage.rules:18-20).
// Transport wiring is DS-002B; a different marker would need an authorized Rules
// change, which this increment does not perform.
export const DOCUMENT_ATTACHMENT_STORAGE_METADATA = Object.freeze({encrypted: 'v1'});
export const DOCUMENT_ATTACHMENT_CIPHER = 'AES-GCM-256';
export const DOCUMENT_ATTACHMENT_KEY_WRAP = 'HKDF-SHA256+A256GCM';
export const DOCUMENT_ATTACHMENT_REFUSALS = Object.freeze({
    DOCUMENT_ID_INVALID: 'DOCUMENT_ID_INVALID',
    DOCUMENT_ID_MISSING: 'DOCUMENT_ID_MISSING',
    DOCUMENT_ID_AMBIGUOUS: 'DOCUMENT_ID_AMBIGUOUS',
    ATTACHMENT_ID_INVALID: 'ATTACHMENT_ID_INVALID',
    ATTACHMENT_EXISTS: 'ATTACHMENT_EXISTS',
    ATTACHMENT_LIMIT_REACHED: 'ATTACHMENT_LIMIT_REACHED',
    ATTACHMENT_PAYLOAD_MISMATCH: 'ATTACHMENT_PAYLOAD_MISMATCH',
    ATTACHMENT_OBJECT_CONFLICT: 'ATTACHMENT_OBJECT_CONFLICT',
    DOCUMENT_COUNT_UNAVAILABLE: 'DOCUMENT_COUNT_UNAVAILABLE',
    DOCUMENT_NOT_PERSISTED: 'DOCUMENT_NOT_PERSISTED',
    MIME_NOT_ALLOWED: 'MIME_NOT_ALLOWED',
    SIZE_NOT_ALLOWED: 'SIZE_NOT_ALLOWED',
    METADATA_INVALID: 'METADATA_INVALID',
    OWNER_MISMATCH: 'OWNER_MISMATCH',
    PATH_MISMATCH: 'PATH_MISMATCH',
    OFFLINE_NOT_ALLOWED: 'OFFLINE_NOT_ALLOWED'
});
// No ':' and no '/': the canonical AAD string can never be forged by an id.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const METADATA_FIELDS = Object.freeze(['ownerId', 'documentId', 'storagePath', 'mimeType', 'size', 'digest',
    'envelope', 'status', 'schemaVersion', 'createdAt']);
const ENVELOPE_FIELDS = Object.freeze(['type', 'version', 'cipher', 'keyWrap', 'contentIv', 'wrapSalt', 'wrapIv', 'wrappedFileKey']);
export const documentAttachmentInvalid = () => {throw Error('DOCUMENT_ATTACHMENT_INVALID');};
export const documentAttachmentObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const documentAttachmentId = value => typeof value === 'string' && ID_PATTERN.test(value);
export const documentAttachmentMime = value => typeof value === 'string' && DOCUMENT_IMAGE_MIME_TYPES.includes(value);
export const documentAttachmentSize = value => Number.isSafeInteger(value) && value > 0 && value <= DOCUMENT_IMAGE_MAX_BYTES;
// Size of the stored ciphertext: a positive integer that cannot exceed the
// plaintext limit plus the AEAD overhead the contract tolerates.
export const documentAttachmentObjectSize = value => Number.isSafeInteger(value) && value > 0 &&
    value <= DOCUMENT_IMAGE_MAX_STORED_BYTES;
export const documentAttachmentDigest = value => typeof value === 'string' && DIGEST_PATTERN.test(value);
export const documentAttachmentBytes = value => Object.prototype.toString.call(value) === '[object Uint8Array]';
// Trusted binary copy: the boundary decides what is written, so whatever the
// caller does with its own buffer afterwards cannot change the stored object.
export const documentAttachmentPayloadCopy = value => {
    if (!documentAttachmentBytes(value) || !documentAttachmentSize(value.byteLength)) documentAttachmentInvalid();
    return Uint8Array.from(value);
};
export const documentAttachmentSha256 = async value => {
    if (!documentAttachmentBytes(value)) documentAttachmentInvalid();
    const digest = await crypto.subtle.digest('SHA-256', value);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
export const documentAttachmentBase64 = (value, minimum, maximum = 4096) => typeof value === 'string' &&
    value.length >= minimum && value.length <= maximum && value.length % 4 === 0 && BASE64_PATTERN.test(value);
export const documentAttachmentStatus = value => typeof value === 'string' && DOCUMENT_ATTACHMENT_STATUSES.includes(value);
export const documentAttachmentOperationId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const documentAttachmentOperationDigest = value => typeof value === 'string' && DIGEST_PATTERN.test(value);
export const documentAttachmentCollection = uid => {
    if (!documentAttachmentId(uid)) documentAttachmentInvalid();
    return `users/${uid}/profileDocumentAttachments`;
};
export const documentAttachmentRecordPath = ({uid, attachmentId}) => {
    if (!documentAttachmentId(uid) || !documentAttachmentId(attachmentId)) documentAttachmentInvalid();
    return `users/${uid}/profileDocumentAttachments/${attachmentId}`;
};
// The receipt document name is a pure function of the operation: the transport
// attaches it as `id` when it lists the collection, and it is validated instead
// of being trusted as an identity of its own.
export const documentAttachmentReceiptName = operationId => {
    if (!documentAttachmentOperationId(operationId)) documentAttachmentInvalid();
    return `profile-document-attachment-${operationId}`;
};
export const documentAttachmentReceiptPath = ({uid, operationId}) => {
    if (!documentAttachmentId(uid) || !documentAttachmentOperationId(operationId)) documentAttachmentInvalid();
    return `mutationResults/${uid}/operations/${documentAttachmentReceiptName(operationId)}`;
};
export const documentAttachmentReceiptCollection = uid => {
    if (!documentAttachmentId(uid)) documentAttachmentInvalid();
    return `mutationResults/${uid}/operations`;
};
// The only authority on the Storage path: callers never propose it, they receive
// it. A path that does not equal this derivation is refused, never repaired.
export function documentImageStoragePath({uid, documentId, attachmentId}) {
    if (!documentAttachmentId(uid) || !documentAttachmentId(documentId) || !documentAttachmentId(attachmentId)) documentAttachmentInvalid();
    return `users/${uid}/profile-documents/${documentId}/attachments/${attachmentId}`;
}
export function documentAttachmentAad({uid, documentId, attachmentId, storagePath}) {
    if (storagePath !== documentImageStoragePath({uid, documentId, attachmentId})) documentAttachmentInvalid();
    return `${DOCUMENT_ATTACHMENT_AAD_DOMAIN}:${uid}:${documentId}:${attachmentId}:${storagePath}`;
}
// The file key is only ever carried wrapped: a plaintext key field is not part of
// the allowlist, so it cannot be smuggled into a candidate envelope. The
// primitives are the ones already proven by the application; what changes is the
// binding: the AAD below is contextual, never the constant Account v1 marker.
export function documentAttachmentEnvelope(value) {
    if (!documentAttachmentObject(value) || Object.keys(value).length !== ENVELOPE_FIELDS.length ||
        Object.keys(value).some(key => !ENVELOPE_FIELDS.includes(key))) documentAttachmentInvalid();
    if (value.type !== DOCUMENT_ATTACHMENT_ENVELOPE_TYPE || value.version !== DOCUMENT_ATTACHMENT_SCHEMA_VERSION ||
        value.cipher !== DOCUMENT_ATTACHMENT_CIPHER || value.keyWrap !== DOCUMENT_ATTACHMENT_KEY_WRAP) documentAttachmentInvalid();
    if (!documentAttachmentBase64(value.contentIv, 16, 16) || !documentAttachmentBase64(value.wrapIv, 16, 16) ||
        !documentAttachmentBase64(value.wrapSalt, 44, 44) || !documentAttachmentBase64(value.wrappedFileKey, 44, 1024)) {
        documentAttachmentInvalid();
    }
    return Object.freeze({type: value.type, version: value.version, cipher: value.cipher, keyWrap: value.keyWrap,
        contentIv: value.contentIv, wrapSalt: value.wrapSalt, wrapIv: value.wrapIv, wrappedFileKey: value.wrappedFileKey});
}
// Two canonical envelopes are the same only when every one of their eight fields
// is: a record that describes a different envelope must never be promoted,
// overwritten or deleted as if it were the object the command produced.
export const documentAttachmentEnvelopeEquals = (left, right) => documentAttachmentObject(left) &&
    documentAttachmentObject(right) && ENVELOPE_FIELDS.every(field => left[field] === right[field]);
// Strict allowlist: no original name, no download URL and no byte field exists
// here, and an unknown key is a refusal rather than a silent pass-through. The
// transport `id` the repository attaches is validated against the path, never
// trusted as an identity of its own.
export function documentAttachmentMetadata(value, {uid} = {}) {
    if (!documentAttachmentObject(value) || Object.keys(value).some(key => !METADATA_FIELDS.includes(key) && key !== 'id')) {
        documentAttachmentInvalid();
    }
    const {ownerId, documentId, storagePath, mimeType, size, digest, envelope, status, schemaVersion, createdAt} = value;
    if (!documentAttachmentId(ownerId) || (uid !== undefined && ownerId !== uid)) documentAttachmentInvalid();
    if (!documentAttachmentId(documentId) || !documentAttachmentMime(mimeType) || !documentAttachmentSize(size) ||
        !documentAttachmentDigest(digest) || !documentAttachmentStatus(status) ||
        schemaVersion !== DOCUMENT_ATTACHMENT_SCHEMA_VERSION) documentAttachmentInvalid();
    if (createdAt !== undefined && createdAt === null) documentAttachmentInvalid();
    const attachmentId = documentAttachmentIdFromPath({uid: ownerId, storagePath, documentId});
    if (value.id !== undefined && value.id !== attachmentId) documentAttachmentInvalid();
    return Object.freeze({ownerId, documentId, storagePath, mimeType, size, digest,
        envelope: documentAttachmentEnvelope(envelope), status, schemaVersion,
        ...(createdAt === undefined ? {} : {createdAt}), attachmentId});
}
// Reads the attachment identity back out of the confined path instead of trusting
// a client-supplied id: a foreign or malformed path is a refusal.
export function documentAttachmentIdFromPath({uid, documentId, storagePath}) {
    if (typeof storagePath !== 'string' || !documentAttachmentId(documentId)) documentAttachmentInvalid();
    const prefix = `users/${uid}/profile-documents/${documentId}/attachments/`;
    if (!storagePath.startsWith(prefix)) documentAttachmentInvalid();
    const attachmentId = storagePath.slice(prefix.length);
    if (!documentAttachmentId(attachmentId) || attachmentId.includes('/')) documentAttachmentInvalid();
    if (storagePath !== documentImageStoragePath({uid, documentId, attachmentId})) documentAttachmentInvalid();
    return attachmentId;
}
// A document can own images only when it has one persisted, unique identifier.
// Rows without an id or with a duplicated id stay readable and are refused here.
export function documentAttachmentIdentity(documents, documentId) {
    if (!Array.isArray(documents) || documents.length > 10000 || documents.some(item => !documentAttachmentObject(item))) {
        return {allowed: false, code: DOCUMENT_ATTACHMENT_REFUSALS.METADATA_INVALID};
    }
    if (!documentAttachmentId(documentId)) return {allowed: false, code: DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_INVALID};
    const matches = documents.filter(item => item.id === documentId);
    if (matches.length === 0) return {allowed: false, code: DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_MISSING};
    if (matches.length > 1) return {allowed: false, code: DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS};
    return {allowed: true, document: Object.freeze({id: matches[0].id})};
}
// Counts only the attachments that are actually bound to this document, so an
// unrelated record can never consume the per-document budget.
export function documentAttachmentUsage(attachments, {uid, documentId}) {
    if (!Array.isArray(attachments) || attachments.length > 10000) return {count: 0, invalid: 0};
    let count = 0, invalid = 0;
    for (const record of attachments) {
        if (!documentAttachmentObject(record)) {invalid++; continue;}
        try {
            const metadata = documentAttachmentMetadata(record, {uid});
            if (metadata.documentId === documentId) count++;
        } catch {invalid++;}
    }
    return {count, invalid};
}
export function documentAttachmentLimitExceeded(attachments, {uid, documentId}) {
    return documentAttachmentUsage(attachments, {uid, documentId}).count >= DOCUMENT_IMAGE_MAX_PER_DOCUMENT;
}
// The receipt is the recovery authority: it decides whether an object may be
// promoted, overwritten or deleted. It is therefore validated canonically, with
// an exact per-kind allowlist, the path re-derived from owner/document/attachment,
// both digests, the recorded stored size and the timestamp that belongs to the
// state. A receipt that does not pass leaves the operation blocked: nothing is
// promoted and nothing is deleted because of it.
const RECEIPT_UPLOAD_KIND = 'profile-document-attachment';
const RECEIPT_DELETE_KIND = 'profile-document-attachment-delete';
const RECEIPT_TOLERATED_FIELDS = Object.freeze(['id']);
const RECEIPT_COMMON_FIELDS = Object.freeze(['kind', 'ownerId', 'operationId', 'documentId', 'attachmentId',
    'storagePath', 'digest', 'objectSize', 'status', 'createdAt']);
const RECEIPT_UPLOAD_FIELDS = Object.freeze([...RECEIPT_COMMON_FIELDS, 'objectDigest', 'readyAt']);
const RECEIPT_DELETE_FIELDS = Object.freeze([...RECEIPT_COMMON_FIELDS, 'expectedDigest', 'removedAt']);
const RECEIPT_UPLOAD_STATUSES = Object.freeze(['reserved', 'ready']);
const RECEIPT_DELETE_STATUSES = Object.freeze(['deleting', 'removed']);
function canonicalReceipt(value, {uid, kind, fields, objectField, stateField, stateStatus, statuses, expected}) {
    if (!documentAttachmentObject(value)) documentAttachmentInvalid();
    const keys = Object.keys(value);
    if (keys.some(key => !fields.includes(key) && !RECEIPT_TOLERATED_FIELDS.includes(key))) documentAttachmentInvalid();
    if (RECEIPT_COMMON_FIELDS.some(field => !keys.includes(field)) || !keys.includes(objectField)) documentAttachmentInvalid();
    const {ownerId, operationId, documentId, attachmentId, storagePath, digest, objectSize, status, createdAt} = value;
    if (value.kind !== kind || !documentAttachmentId(uid) || ownerId !== uid) documentAttachmentInvalid();
    if (!documentAttachmentId(documentId) || !documentAttachmentId(attachmentId) ||
        storagePath !== documentImageStoragePath({uid, documentId, attachmentId})) documentAttachmentInvalid();
    if (!documentAttachmentOperationId(operationId)) documentAttachmentInvalid();
    if (value.id !== undefined && value.id !== documentAttachmentReceiptName(operationId)) documentAttachmentInvalid();
    if (!documentAttachmentOperationDigest(digest) || !documentAttachmentOperationDigest(value[objectField])) documentAttachmentInvalid();
    if (!(objectSize === null || documentAttachmentObjectSize(objectSize))) documentAttachmentInvalid();
    if (createdAt === undefined || createdAt === null || !statuses.includes(status)) documentAttachmentInvalid();
    // The state timestamp exists exactly in the state that owns it.
    if (value[stateField] === undefined || value[stateField] === null) {
        if (status === stateStatus) documentAttachmentInvalid();
    } else if (status !== stateStatus) documentAttachmentInvalid();
    if (expected.operationId !== undefined && operationId !== expected.operationId) documentAttachmentInvalid();
    if (expected.documentId !== undefined && documentId !== expected.documentId) documentAttachmentInvalid();
    if (expected.attachmentId !== undefined && attachmentId !== expected.attachmentId) documentAttachmentInvalid();
    if (expected.storagePath !== undefined && storagePath !== expected.storagePath) documentAttachmentInvalid();
    if (expected.digest !== undefined && digest !== expected.digest) documentAttachmentInvalid();
    if (expected.objectDigest !== undefined && value[objectField] !== expected.objectDigest) documentAttachmentInvalid();
    if (expected.objectSize !== undefined && objectSize !== expected.objectSize) documentAttachmentInvalid();
    return Object.freeze({kind, ownerId, operationId, documentId, attachmentId, storagePath, digest,
        [objectField]: value[objectField], objectSize, status, createdAt,
        ...(value[stateField] === undefined ? {} : {[stateField]: value[stateField]})});
}
// Upload receipt: `objectDigest` is the SHA-256 of the stored ciphertext and
// `objectSize` its length (null only when the transport cannot report it).
export function documentAttachmentUploadReceipt(value, options = {}) {
    return canonicalReceipt(value, {uid: options.uid, kind: RECEIPT_UPLOAD_KIND, fields: RECEIPT_UPLOAD_FIELDS,
        objectField: 'objectDigest', stateField: 'readyAt', stateStatus: 'ready',
        statuses: options.statuses ?? RECEIPT_UPLOAD_STATUSES, expected: options});
}
// Delete receipt: `expectedDigest`/`objectSize` describe the object the operation
// is allowed to remove, so a replaced or resized object is never deleted.
export function documentAttachmentDeleteReceipt(value, options = {}) {
    return canonicalReceipt(value, {uid: options.uid, kind: RECEIPT_DELETE_KIND, fields: RECEIPT_DELETE_FIELDS,
        objectField: 'expectedDigest', stateField: 'removedAt', stateStatus: 'removed',
        statuses: options.statuses ?? RECEIPT_DELETE_STATUSES, expected: options});
}
