import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {withProfileLinkCandidateRules, PROFILE_LINK_METADATA} from './profile-link-candidate-rules.mjs';

// Laboratory only. Deployment would require the legacy writer transition, an
// inventory of rows without a persisted ID and an approved migration.
const metadata = ['_profileContactsRevision', '_profileContactsSchemaVersion', '_profileContactsUpdatedAt'];
// Exported so a later slice (A2 addresses) can build on the exact list this layer
// produced instead of guessing it; the behaviour is unchanged.
export const PROFILE_CONTACTS_METADATA = Object.freeze([...metadata]);
const protectedFromClient = [...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA,
    'contactEmails', 'contactPhones', 'documenti', 'userAddresses'];
export function withProfileContactsCandidateRules(original) {
    const rules = withProfileLinkCandidateRules(original);
    const current = JSON.stringify(protectedFromClient);
    if (!rules.includes(current) || rules.includes(JSON.stringify([...protectedFromClient, ...metadata]))) throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(current, JSON.stringify([...protectedFromClient, ...metadata]));
}
