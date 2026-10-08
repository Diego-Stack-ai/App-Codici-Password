import {ACCOUNT_STANDARD_FIELDS} from './account-standard-contract.mjs';
import {withAccountNoteCandidateRules} from './account-note-candidate-rules.mjs';
export const accountStandardCandidateRules = Object.freeze({
    clientWrites: false,
    backendPatchKeys: Object.freeze([...ACCOUNT_STANDARD_FIELDS, 'revision', 'schemaVersion', 'updatedAt']),
    ownerOnly: true,
    companyOwnershipRequired: true,
    maxUrlLength: 4096
});
export function withAccountStandardCandidateRules(original) {
    const rules = withAccountNoteCandidateRules(original);
    const fields = ['_profileLinkRevision', '_profileLinkSchemaVersion', '_profileLinkUpdatedAt',
        'linkedProfileField', 'linkedProfileFields', 'linkedCompanyProfileField', 'linkedCompanyProfileFields',
        'note', 'revision', 'schemaVersion', 'updatedAt'];
    const before = JSON.stringify(fields);
    if (rules.split(before).length !== 5) throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(before, JSON.stringify([...fields, ...ACCOUNT_STANDARD_FIELDS]));
}
