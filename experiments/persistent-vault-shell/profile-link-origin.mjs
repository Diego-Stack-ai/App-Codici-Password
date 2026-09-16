import {profileLinkSource} from './profile-link-contract.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
const types = {contactEmails: 'email', contactPhones: 'phone', documenti: 'document', utilities: 'utility'};
export function createProfileLinkOriginResolver({domain = 'private', companyId, models}) {
    const required = domain === 'private' ? ['profileAccountItems', 'findProfileAccountItem'] : ['companyProfileContacts', 'findCompanyProfileContact'];
    if (!['private', 'company'].includes(domain) || required.some(key => typeof models?.[key] !== 'function')) throw Error('PROFILE_LINK_CONFIG');
    if (domain === 'company') profileLinkSource({domain, companyId, type: 'email', id: 'pec'});
    return ({raw, item, collection, parentAddressId}) => {
        if (!Object.hasOwn(types, collection)) return null;
        try {
            const source = profileLinkSource({domain, type: types[collection], id: item.id,
                ...(domain === 'company' ? {companyId} : {}), ...(collection === 'utilities' ? {parentAddressId} : {})});
            readProfileLinkContact(raw, source, models);
            return source;
        } catch {
            // Preserve consultation of unsupported legacy rows. Never generate
            // an ID or offer a mutation against an ambiguous normalized index.
            return null;
        }
    };
}
