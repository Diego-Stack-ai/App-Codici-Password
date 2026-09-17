import {withPrivateAddressesCandidateRules} from './private-addresses-candidate-rules.mjs';
export const PROFILE_UTILITIES_METADATA=Object.freeze(['_profileUtilitiesRevision','_profileUtilitiesSchemaVersion','_profileUtilitiesUpdatedAt']);
// Laboratory transform only: the callable owns userAddresses and utility metadata.
export function withPrivateUtilitiesCandidateRules(original){const rules=withPrivateAddressesCandidateRules(original);
    const needle='"_profileAddressesUpdatedAt"';if(!rules.includes(needle)||rules.includes('"_profileUtilitiesRevision"'))throw Error('RULES_BASE_CHANGED');
    return rules.replaceAll(needle,`${needle},"_profileUtilitiesRevision","_profileUtilitiesSchemaVersion","_profileUtilitiesUpdatedAt"`);}
