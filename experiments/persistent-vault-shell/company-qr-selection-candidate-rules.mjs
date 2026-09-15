// Test-only closure of qrConfig, not of every legacy company write. Row-level
// QR flags and unrelated editors require their own later transition.
export function withCompanyQrSelectionCandidateRules(original) {
    if (original.split("collection != 'contacts' &&").length !== 2 ||
        original.split('    match /users/{userId} {').length !== 2) throw Error('RULES_BASE_CHANGED');
    return original.replace("collection != 'contacts' &&", "collection != 'aziende' && collection != 'contacts' &&")
        .replace('    match /users/{userId} {', `    match /users/{userId}/aziende/{companyId} {
      allow read, delete: if isOwner(userId);
      allow create: if isOwner(userId) && !request.resource.data.keys().hasAny(['qrConfig']);
      allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['qrConfig']);
    }
    match /users/{userId}/aziende/{companyId}/{collection}/{document=**} {
      allow read, write: if isOwner(userId);
    }
    match /users/{userId} {`);
}
