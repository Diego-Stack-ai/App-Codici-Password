// Test-only closure of qrConfig, not of every legacy company write. Row-level
// QR flags and unrelated editors require their own later transition.
export function withCompanyQrSelectionCandidateRules(original) {
    if (typeof original !== 'string') throw Error('RULES_BASE_CHANGED');
    original = original.replaceAll('\r\n', '\n');
    const companyBlock = `    match /users/{userId}/aziende/{companyId} {
      allow read, create, update: if isOwner(userId);
      allow delete: if false;
      // Preserve existing descendant permissions, not a recursive grant on the
      // company document itself (recursive wildcards also match zero segments).
      match /{childCollection}/{childDocument}/{rest=**} {
        allow read, update, delete: if isOwner(userId);
        // Require the Company in the resulting atomic state. This also permits
        // a legitimate batch that creates Company and Account together.
        allow create: if isOwner(userId) && (childCollection != 'accounts' ||
          existsAfter(/databases/$(database)/documents/users/$(userId)/aziende/$(companyId)));
      }
    }`;
    // Replace the whole overlapping grant in the candidate only. Appending a
    // restrictive match cannot override an existing allow (Rules use OR).
    if (original.split(companyBlock).length !== 2 ||
        original.split("collection != 'aziende' &&").length !== 2 ||
        original.split("collection != 'contacts' &&").length !== 2 ||
        original.split('    match /users/{userId} {').length !== 2) throw Error('RULES_BASE_CHANGED');
    return original.replace(companyBlock, `    match /users/{userId}/aziende/{companyId} {
      allow read: if isOwner(userId);
      allow delete: if false;
      allow create: if isOwner(userId) && !request.resource.data.keys().hasAny(['qrConfig']);
      allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['qrConfig']);
      // Preserve the production child-document protections in the candidate.
      match /{childCollection}/{childDocument}/{rest=**} {
        allow read, update, delete: if isOwner(userId);
        allow create: if isOwner(userId) && (childCollection != 'accounts' ||
          existsAfter(/databases/$(database)/documents/users/$(userId)/aziende/$(companyId)));
      }
    }`);
}
