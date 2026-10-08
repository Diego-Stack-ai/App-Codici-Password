import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {withProfileLinkCandidateRules, PROFILE_LINK_METADATA} from './profile-link-candidate-rules.mjs';

// Laboratory only. Applying this to production would require the transition of
// every legacy company writer: the company form (`ma_save.js`) and the link
// writer currently edit these fields directly from the client, and the legacy
// `aziendaEmail`/`aziendaEmailPassword` fallbacks are still read by the
// application. Nothing here is deployed.
export const COMPANY_CONTACT_METADATA = Object.freeze(['_companyContactsRevision', '_companyContactsSchemaVersion',
    '_companyContactsUpdatedAt']);
// The company contact slice of `users/{userId}/aziende/{companyId}`: the e-mail
// map (fixed slots, repeatable rows and their unknown legacy keys), the
// telephone slots, the Account link map and the legacy top-level fallbacks.
export const COMPANY_CONTACT_FIELDS = Object.freeze(['emails', 'phoneAccountLinks', 'aziendaEmail',
    'aziendaEmailPassword', 'telefonoAzienda', 'faxAzienda', 'referenteCellulare']);
export function withCompanyContactsCandidateRules(original) {
    const closed = JSON.stringify(['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA,
        ...PROFILE_LINK_METADATA, ...COMPANY_CONTACT_FIELDS, ...COMPANY_CONTACT_METADATA]);
    if (original.includes(closed)) throw Error('RULES_ALREADY_PATCHED');
    const rules = withProfileLinkCandidateRules(original);
    const current = JSON.stringify(['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA,
        ...PROFILE_LINK_METADATA, 'emails', 'phoneAccountLinks']);
    if (rules.split(current).length !== 3) throw Error('RULES_BASE_CHANGED');
    if (rules.includes(closed)) throw Error('RULES_ALREADY_PATCHED');
    return rules.replaceAll(current, closed);
}
