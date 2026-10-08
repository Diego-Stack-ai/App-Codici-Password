import {withProfileLinkCandidateRules} from './profile-link-candidate-rules.mjs';

// Test overlay only. Legacy direct writers must transition before activation.
export function withAccountNoteCandidateRules(original) {
    const rules = withProfileLinkCandidateRules(original);
    const fields = ['_profileLinkRevision', '_profileLinkSchemaVersion', '_profileLinkUpdatedAt',
        'linkedProfileField', 'linkedProfileFields', 'linkedCompanyProfileField', 'linkedCompanyProfileFields'];
    const before = JSON.stringify(fields);
    if (rules.split(before).length !== 5) throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(before, JSON.stringify([...fields, 'note', 'revision', 'schemaVersion', 'updatedAt']));
}
