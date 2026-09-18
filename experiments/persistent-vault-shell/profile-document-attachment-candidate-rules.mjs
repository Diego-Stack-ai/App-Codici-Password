// Laboratory only. Candidate Firestore rules for the document image boundary of
// DS-002A/DS-002B: the records and the receipts are written only by the attested
// service (Admin SDK / callable, which bypasses these rules) and are readable only
// by their owner. The per-document limits (JPEG/PNG/WebP/HEIC/HEIF, 10 MiB, ten
// images) are decided by the candidate service, which is the only writer: denying
// every direct client write is what makes those limits binding.
//
// The transform is CRLF aware: it is anchored on the production file as it is
// checked out, and it refuses to patch anything it does not recognise.
const GENERIC_LINE = "collection != 'sharedVaultLinks';";
const PATCHED_GENERIC_LINE = "collection != 'sharedVaultLinks' && collection != 'profileDocumentAttachments';";
const records = newline => [
    '',
    '    // DS-002B candidate: image records written only by the attested service.',
    '    match /users/{userId}/profileDocumentAttachments/{attachmentId} {',
    '      allow read: if isOwner(userId);',
    '      allow write: if false;',
    '    }',
    ''
].join(newline);
export function withDocumentAttachmentCandidateRules(original) {
    if (typeof original !== 'string') throw Error('RULES_BASE_CHANGED');
    if (original.includes(PATCHED_GENERIC_LINE)) throw Error('RULES_ALREADY_PATCHED');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    // The receipts namespace must already deny direct writes, and the generic owner
    // collection rule must be the one this candidate narrows: without both, the
    // service could not be made the only writer.
    const anchor = ['match /mutationResults/{userId}/operations/{operationId} {', '      allow read: if isOwner(userId);',
        '      allow write: if false;', '    }', ''].join(newline);
    if (!original.includes(GENERIC_LINE) || !original.includes(anchor)) throw Error('RULES_BASE_CHANGED');
    const patched = original.replace(GENERIC_LINE, PATCHED_GENERIC_LINE).replace(anchor, anchor + records(newline));
    if (!patched.includes(PATCHED_GENERIC_LINE) ||
        !patched.includes('match /users/{userId}/profileDocumentAttachments/{attachmentId} {')) throw Error('RULES_BASE_CHANGED');
    return patched;
}
