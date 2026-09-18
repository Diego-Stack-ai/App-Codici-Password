import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {withProfileTextCandidateRules} from './profile-text-candidate-rules.mjs';
export const PROFILE_LINK_METADATA = Object.freeze(['_profileLinkRevision', '_profileLinkSchemaVersion', '_profileLinkUpdatedAt']);
export function withProfileLinkCandidateRules(original) {
    let rules = withProfileTextCandidateRules(original);
    const oldPrivate = JSON.stringify([...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA]);
    const oldCompany = JSON.stringify(['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA]);
    if (rules.split(oldPrivate).length !== 3 || rules.split(oldCompany).length !== 3 ||
        rules.split("collection != 'contacts' &&").length !== 2 ||
        rules.split('    match /users/{userId}/aziende/{companyId}/{collection}/{document=**} {\n      allow read, write: if isOwner(userId);').length !== 2) throw Error('RULES_BASE_CHANGED');
    rules = rules.replaceAll(oldPrivate, JSON.stringify([...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA,
        'contactEmails', 'contactPhones', 'documenti', 'userAddresses']))
        .replaceAll(oldCompany, JSON.stringify(['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA, 'emails', 'phoneAccountLinks']))
        .replace("collection != 'contacts' &&", "collection != 'accounts' && collection != 'contacts' &&")
        .replace('    match /users/{userId}/aziende/{companyId}/{collection}/{document=**} {\n      allow read, write: if isOwner(userId);',
            "    match /users/{userId}/aziende/{companyId}/{collection}/{document=**} {\n      allow read, write: if isOwner(userId) && collection != 'accounts';");
    const protectedFields = JSON.stringify([...PROFILE_LINK_METADATA, 'linkedProfileField', 'linkedProfileFields', 'linkedCompanyProfileField', 'linkedCompanyProfileFields']);
    const accountRule = path => `    match ${path} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId) && !request.resource.data.keys().hasAny(${protectedFields});
      allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(${protectedFields});
      allow delete: if false;
    }
    match ${path}/{collection}/{document=**} {
      allow read, write: if isOwner(userId);
    }
`;
    return rules.replace('    match /users/{userId} {', accountRule('/users/{userId}/accounts/{accountId}') +
        accountRule('/users/{userId}/aziende/{companyId}/accounts/{accountId}') + '    match /users/{userId} {');
}
