import {withPrivateUtilitiesCandidateRules} from './private-utilities-candidate-rules.mjs';
// Laboratory transform only: documenti and its mutation metadata are callable-owned.
export function withPrivateDocumentsCandidateRules(original){const rules=withPrivateUtilitiesCandidateRules(original),needle='"_profileUtilitiesUpdatedAt"';if(!rules.includes(needle)||rules.includes('"_profileDocumentsRevision"'))throw Error('RULES_BASE_CHANGED');return rules.replaceAll(needle,`${needle},"_profileDocumentsRevision","_profileDocumentsSchemaVersion","_profileDocumentsUpdatedAt"`);}
