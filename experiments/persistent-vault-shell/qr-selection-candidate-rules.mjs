// Test/laboratory overlay only. Closing this writer in production requires the
// legacy editor transition; never silently replace the production rules file.
export function withQrSelectionCandidateRules(original) {
    if (original.split("collection != 'contacts' &&").length !== 2 || original.split('    match /users/{userId} {').length !== 2) throw Error('RULES_BASE_CHANGED');
    return original.replace("collection != 'contacts' &&", "collection != 'settings' && collection != 'contacts' &&")
        .replace('    match /users/{userId} {', `    match /users/{userId}/settings/{settingId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && settingId != 'qrCodeInclusions';
    }
    match /users/{userId} {`);
}
