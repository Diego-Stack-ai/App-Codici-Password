import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {PROFILE_LINK_METADATA} from './profile-link-candidate-rules.mjs';
import {PROFILE_CONTACTS_METADATA, withProfileContactsCandidateRules} from './profile-contacts-candidate-rules.mjs';

// Laboratory only. Applying this to production would require the transition of the
// legacy profile writer (`profilo-sync.js`/`profilo-actions.js`), which rewrites
// `userAddresses` and its nested utilities directly from the client.
export const PROFILE_ADDRESSES_METADATA = Object.freeze(['_profileAddressesRevision', '_profileAddressesSchemaVersion',
    '_profileAddressesUpdatedAt']);
export function withPrivateAddressesCandidateRules(original) {
    const current = JSON.stringify([...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA,
        'contactEmails', 'contactPhones', 'documenti', 'userAddresses', ...PROFILE_CONTACTS_METADATA]);
    const closed = JSON.stringify([...PROFILE_TEXT_FIELDS.private, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA,
        'contactEmails', 'contactPhones', 'documenti', 'userAddresses', ...PROFILE_CONTACTS_METADATA,
        ...PROFILE_ADDRESSES_METADATA]);
    if (original.includes(closed)) throw Error('RULES_ALREADY_PATCHED');
    const rules = withProfileContactsCandidateRules(original);
    if (rules.split(current).length !== 3) throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(current, closed);
}
