import {DOCUMENT_IMAGE_MAX_BYTES, DOCUMENT_IMAGE_MAX_STORED_BYTES} from './profile-document-attachments-contract.mjs';

// Laboratory only. Candidate Storage rules for the sealed document images: the
// path family of DS-002A, owner only, octet-stream with the `encrypted: 'v1'`
// marker, creation bounded to the image envelope (10 MiB plus the AEAD overhead)
// and no update on the attachment path itself. The candidate tightens the
// *global* upload rule of the current production file, because Storage rules
// grant access when any matching rule allows: a nested block alone cannot be
// stricter than the owner-generic one.
//
// Known limit, registered in the technical note: with this authorization model a
// signed-in owner can still place an object that is not a sealed image inside
// their own attachment subtree (for example an `image/jpeg` without the marker),
// because the owner-generic rule matches the same path. Closing it needs the
// owner-generic rule to be replaced by an explicit per-collection model, which is
// a deployment decision and is not taken here. The service does not trust the
// object in any case: an object whose digest and size do not match the record is
// never promoted, never overwritten and never deleted.
const BASE_MIME = `'^(image/(jpeg|png|gif|webp|heic|heif)|video/(mp4|quicktime|webm)|application/(pdf|msword|vnd\\\\.openxmlformats-officedocument\\\\.wordprocessingml\\\\.document|vnd\\\\.ms-excel|vnd\\\\.openxmlformats-officedocument\\\\.spreadsheetml\\\\.sheet)|text/plain|application/octet-stream)$'`;
const CANDIDATE_MIME = `'^(image/(jpeg|png|webp|heic|heif)|application/octet-stream)$'`;
const baseSize = newline => `request.resource.size <= 25 * 1024 * 1024 +${newline}          (request.resource.contentType == 'application/octet-stream' ? 1024 : 0)`;
const candidateSize = `request.resource.size <= ${DOCUMENT_IMAGE_MAX_BYTES} + ${DOCUMENT_IMAGE_MAX_STORED_BYTES - DOCUMENT_IMAGE_MAX_BYTES}`;
const attachmentBlock = newline => [
    '      // DS-002B candidate: sealed document images of the owner, never updated here.',
    '      match /profile-documents/{documentId}/attachments/{attachmentId} {',
    '        allow read, delete: if isOwner(userId);',
    '        allow create: if isOwner(userId) && isAllowedUpload();',
    '        allow update: if false;',
    '      }',
    ''
].join(newline);
export function withDocumentAttachmentStorageRules(original) {
    if (typeof original !== 'string') throw Error('RULES_BASE_CHANGED');
    if (original.includes(CANDIDATE_MIME)) throw Error('RULES_ALREADY_PATCHED');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const ownerBlock = `match /users/{userId}/{allPaths=**} {${newline}`;
    if (!original.includes(baseSize(newline)) || !original.includes(BASE_MIME) || !original.includes(ownerBlock)) {
        throw Error('RULES_BASE_CHANGED');
    }
    // Replacer functions: the candidate text contains `$'`, which a replacement
    // string would expand as a special pattern.
    const patched = original.replace(baseSize(newline), () => candidateSize).replace(BASE_MIME, () => CANDIDATE_MIME)
        .replace(ownerBlock, () => ownerBlock + attachmentBlock(newline));
    if (!patched.includes(candidateSize) || !patched.includes(CANDIDATE_MIME) ||
        !patched.includes('match /profile-documents/{documentId}/attachments/{attachmentId} {')) throw Error('RULES_BASE_CHANGED');
    return patched;
}
