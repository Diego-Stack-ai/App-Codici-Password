// Laboratory only: only the attested service writes attachment objects.
// Exclude the reserved family from the generic owner grant: overlapping
// Storage matches are OR-ed, so an inner deny cannot protect these objects.
// Other namespaces retain the original MIME and size policy unchanged.
export function withDocumentAttachmentStorageRules(original) {
    if (typeof original !== 'string') throw Error('RULES_BASE_CHANGED');
    if (original.includes('R12_SERVER_ONLY_ATTACHMENTS')) throw Error('RULES_ALREADY_PATCHED');
    original = original.replaceAll('\r\n', '\n');
    const newline = '\n';
    const ownerBlock = [
        '    match /users/{userId}/{namespace}/{allPaths=**} {',
        "      allow read, delete: if isOwner(userId) && namespace != 'restoreObjects';",
        "      allow create, update: if isOwner(userId) && namespace != 'restoreObjects' && isAllowedUpload();",
        '    }'
    ].join(newline);
    if (original.split(ownerBlock).length !== 2) throw Error('RULES_BASE_CHANGED');
    return original.replace(ownerBlock, () => [
        '    // R12_SERVER_ONLY_ATTACHMENTS: no direct client object mutations.',
        '    match /users/{userId}/{namespace}/{allPaths=**} {',
        "      allow read: if isOwner(userId) && namespace != 'restoreObjects';",
        "      allow delete: if isOwner(userId) && namespace != 'restoreObjects' && namespace != 'profile-documents';",
        "      allow create, update: if isOwner(userId) && namespace != 'restoreObjects' && namespace != 'profile-documents' && isAllowedUpload();",
        '    }'
    ].join(newline));
}
