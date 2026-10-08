import {PROFILE_TEXT_FIELDS, PROFILE_TEXT_METADATA} from './profile-text-contract.mjs';
import {PROFILE_LINK_METADATA} from './profile-link-candidate-rules.mjs';
import {COMPANY_CONTACT_FIELDS, COMPANY_CONTACT_METADATA, withCompanyContactsCandidateRules} from './company-contacts-candidate-rules.mjs';

// Laboratory only. Applying this to production would require the transition of the
// legacy company form (`ma_save.js`), which rewrites the legal seat and
// `altreSedi` (including the `sede-<index>` identity) directly from the client.
export const COMPANY_ADDRESSES_METADATA = Object.freeze(['_companyAddressesRevision', '_companyAddressesSchemaVersion',
    '_companyAddressesUpdatedAt']);
// The fixed legal seat and the repeatable rows, as they are stored.
export const COMPANY_ADDRESS_FIELDS = Object.freeze(['altreSedi', 'tipoSedeLegale', 'indirizzoSede', 'civicoSede',
    'capSede', 'cittaSede', 'provinciaSede']);
export function withCompanyAddressesCandidateRules(original) {
    const base = ['qrConfig', ...PROFILE_TEXT_FIELDS.company, ...PROFILE_TEXT_METADATA, ...PROFILE_LINK_METADATA,
        ...COMPANY_CONTACT_FIELDS, ...COMPANY_CONTACT_METADATA];
    const current = JSON.stringify(base);
    const closed = JSON.stringify([...base, ...COMPANY_ADDRESS_FIELDS, ...COMPANY_ADDRESSES_METADATA]);
    if (original.includes(closed)) throw Error('RULES_ALREADY_PATCHED');
    const rules = withCompanyContactsCandidateRules(original);
    if (rules.split(current).length !== 3) throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(current, closed);
}
