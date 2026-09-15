import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {withCompanyQrSelectionCandidateRules} from './company-qr-selection-candidate-rules.mjs';

// Laboratory only. Deployment requires transition of every legacy writer that
// currently edits these fields. Unrelated legacy permissions are not certified.
export function withProfileTextCandidateRules(original) {
    let rules = withCompanyQrSelectionCandidateRules(original);
    const root = '    match /users/{userId} {\n      allow read, write: if isOwner(userId);\n    }';
    rules = rules.replaceAll('\r\n', '\n');
    if (rules.split(root).length !== 2 || rules.split("hasAny(['qrConfig'])").length !== 3) throw Error('RULES_BASE_CHANGED');
    const companyProtected = JSON.stringify(['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA]);
    const privateProtected = JSON.stringify([...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA]);
    const companyDelete = '    match /users/{userId}/aziende/{companyId} {\n      allow read, delete: if isOwner(userId);';
    if (rules.split(companyDelete).length !== 2) throw Error('RULES_BASE_CHANGED');
    return rules.replace(companyDelete, '    match /users/{userId}/aziende/{companyId} {\n      allow read: if isOwner(userId);\n      allow delete: if false;')
        .replaceAll("hasAny(['qrConfig'])", `hasAny(${companyProtected})`).replace(root,
        `    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId) && !request.resource.data.keys().hasAny(${privateProtected});
      allow update: if isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(${privateProtected});
      allow delete: if false;
    }`);
}
