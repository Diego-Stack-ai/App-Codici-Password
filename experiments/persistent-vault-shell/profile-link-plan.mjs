import {profileLinkSource, currentProfileLink, profileLinkFingerprintInput, profileLinkRevision} from './profile-link-contract.mjs';
const fail = () => {throw Error('PROFILE_LINK_SOURCE_UNSUPPORTED');};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const list = value => {if (value === undefined) return []; if (!Array.isArray(value) || value.length > 10000 || value.some(item => !object(item))) fail(); return value;};
function privateEntries(profile, models) {
    for (const key of ['contactEmails', 'contactPhones', 'documenti']) list(profile[key]);
    for (const address of list(profile.userAddresses)) list(address.utilities);
    const entries = models.profileAccountItems(profile), seen = new Set();
    for (const entry of entries) if (currentProfileLink(entry.item)) {
        if (!id(entry.item.id) || (entry.type === 'utility' && !id(entry.parentAddressId))) fail();
        const key = JSON.stringify([entry.type, entry.parentAddressId || '', entry.item.id]);
        if (seen.has(key)) fail(); seen.add(key);
    }
    return entries;
}
export function readProfileLinkContact(profile, requestedSource, models) {
    const source = profileLinkSource(requestedSource); profileLinkRevision(profile);
    let contact;
    if (source.domain === 'private') {
        if (source.type === 'utility' && list(profile.userAddresses).filter(address => address.id === source.parentAddressId).length !== 1) fail();
        const entries = privateEntries(profile, models).filter(entry => entry.type === source.type && entry.item.id === source.id &&
            (source.type !== 'utility' || entry.parentAddressId === source.parentAddressId));
        if (entries.length !== 1) fail();
        contact = models.findProfileAccountItem(profile, {contactType: source.type, profileContactId: source.id, parentAddressId: source.parentAddressId});
        if (contact !== entries[0].item) fail();
    } else {
        if (profile.emails !== undefined) {if (!object(profile.emails)) fail(); profileLinkFingerprintInput(profile.emails); list(profile.emails.extra);}
        if (profile.phoneAccountLinks !== undefined) {
            if (!object(profile.phoneAccountLinks)) fail();
            for (const slot of ['telefonoAzienda', 'faxAzienda', 'referenteCellulare']) if (profile.phoneAccountLinks[slot] !== undefined) {
                const link = profile.phoneAccountLinks[slot];
                if (!object(link) || Object.keys(link).some(key => !['linkedAccountId', 'linkedAccountCompanyId'].includes(key))) fail();
            }
        }
        const entries = models.companyProfileContacts(profile)[source.type === 'email' ? 'emails' : 'phones'].filter(item => item.id === source.id);
        if (entries.length !== 1) fail();
        contact = models.findCompanyProfileContact(profile, source.type, source.id);
        if (!contact || contact.id !== source.id) fail();
        if (source.type === 'email' && contact.sourceSlot !== source.id) fail();
        if (source.type === 'phone' && (typeof profile[source.id] !== 'string' || !profile[source.id] || contact.number !== profile[source.id])) fail();
    }
    // Normalized company contacts add stable slot IDs and labels. Hash exactly
    // that canonical projection on both sides; private contacts use stored IDs.
    const fingerprintInput = profileLinkFingerprintInput(contact);
    return {contact, fingerprintInput, account: currentProfileLink(contact)};
}
function validateBacklinks(account, company) {
    const plural = company ? 'linkedCompanyProfileFields' : 'linkedProfileFields';
    const singular = company ? 'linkedCompanyProfileField' : 'linkedProfileField';
    const refs = [...list(account[plural] ?? undefined), ...(account[singular] == null ? [] : [account[singular]])];
    for (const item of refs) {
        if (!object(item) || !id(item.id) || !['email', 'phone', ...company ? [] : ['document', 'utility']].includes(item.type)) fail();
        const fields = company ? ['companyId', 'type', 'id'] : item.type === 'utility' ? ['parentAddressId', 'type', 'id'] : ['type', 'id'];
        if (Object.keys(item).length !== fields.length || Object.keys(item).some(key => !fields.includes(key)) ||
            (company && !id(item.companyId)) || (item.type === 'utility' && !id(item.parentAddressId))) fail();
    }
}

// Uses the canonical pure models, injected by the trusted bootstrap/test. This
// computes patches only; caller must read and commit all documents atomically.
export function planProfileLink({profile, source, account, oldAccount, nextAccount, models, deleteField}) {
    const {contact, account: previous} = readProfileLinkContact(profile, source, models);
    const link = {linkedAccountId: account?.id || '', linkedAccountCompanyId: account?.companyId || ''};
    const draft = {contactType: source.type, profileContactId: source.id, parentAddressId: source.parentAddressId};
    const company = source.domain === 'company';
    const patch = company ? models.companyContactLinkPatch(profile, contact, source.type, link)
        : models.patchProfileAccountItem(profile, draft, {...contact, ...link});
    const updated = {...profile, ...patch}, reference = {companyId: source.companyId, type: source.type, id: source.id};
    const backlinks = (record, selection, remove) => {
        validateBacklinks(record, company);
        const refs = company ? models.companyAccountReferences(record, reference, remove)
            : models.profileAccountReferences(updated, selection.id, selection.companyId || '');
        return company ? {linkedCompanyProfileFields: refs, linkedCompanyProfileField: refs[0] || deleteField()}
            : {linkedProfileFields: refs, linkedProfileField: refs[0] || deleteField()};
    };
    return {sourcePatch: patch, oldAccountPatch: oldAccount && previous ? backlinks(oldAccount, previous, true) : null,
        nextAccountPatch: nextAccount && account ? backlinks(nextAccount, account, false) : null};
}
