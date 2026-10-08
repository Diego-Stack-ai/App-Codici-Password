import {withPrivateDocumentsCandidateRules} from './private-documents-candidate-rules.mjs';
import {withCompanyAddressesCandidateRules} from './company-addresses-candidate-rules.mjs';
import {withAccountStandardCandidateRules} from './account-standard-candidate-rules.mjs';

// Laboratory only: union generated deny-lists, never combine allow-lists.
// All other source text must be byte-identical across branches.
export function unionCandidateDenyLists(outputs) {
    if (!Array.isArray(outputs) || outputs.length < 2) throw Error('RULES_UNION_INPUT');
    const parsed = outputs.map(source => {
        if (typeof source !== 'string' || source.includes('__CANDIDATE_DENY_')) throw Error('RULES_UNION_INPUT');
        const lists = [];
        const skeleton = source.replace(/hasAny\((\["[^\n]*?\])\)/g, (whole, json, offset) => {
            const prefix = source.slice(0, offset);
            const create = /(?:^|\n) +allow create: if isOwner\(userId\) && !request\.resource\.data\.keys\(\)\.$/;
            const update = /(?:^|\n) +allow update: if isOwner\(userId\) && !request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.$/;
            if ((!create.test(prefix) && !update.test(prefix)) || !/^;\r?\n/.test(source.slice(offset + whole.length)))
                throw Error('RULES_UNION_CONTEXT');
            const fields = JSON.parse(json);
            if (!Array.isArray(fields) || fields.length === 0 || fields.some(field => typeof field !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)))
                throw Error('RULES_UNION_FIELDS');
            lists.push(fields);
            return `hasAny(__CANDIDATE_DENY_${lists.length - 1}__)`;
        });
        if (lists.length !== 8) throw Error('RULES_UNION_COUNT');
        return {skeleton, lists};
    });
    if (parsed.some(item => item.skeleton !== parsed[0].skeleton)) throw Error('RULES_UNION_STRUCTURE');
    return parsed[0].skeleton.replace(/__CANDIDATE_DENY_(\d+)__/g, (_, index) =>
        JSON.stringify([...new Set(parsed.flatMap(item => item.lists[Number(index)]))].sort()));
}

export function withIntegratedAccountCandidateRules(original) {
    return unionCandidateDenyLists([
        withPrivateDocumentsCandidateRules(original),
        withCompanyAddressesCandidateRules(original),
        withAccountStandardCandidateRules(original)
    ]);
}
