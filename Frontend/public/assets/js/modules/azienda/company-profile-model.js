const fixedEmailSlots = ['pec', 'amministrazione', 'personale'];
const phoneLabels = { telefonoAzienda: 'Telefono azienda', faxAzienda: 'Fax', referenteCellulare: 'Cellulare referente' };
export function companyProfileContacts(data) {
    const emails = fixedEmailSlots.map(slot => {
        const item = data.emails?.[slot] || {};
        return { ...item, id: slot, label: item.tipo || slot, address: item.email || (slot === 'pec' ? data.aziendaEmail : '') || '', password: item.password || (slot === 'pec' ? data.aziendaEmailPassword : '') || '', sourceSlot: slot };
    });
    (data.emails?.extra || []).forEach((item, index) => emails.push({ ...item, id: item.id || 'extra-' + index, sourceIndex: index, sourceSlot: 'extra', label: item.tipo || 'Email', address: item.email || '' }));
    const phones = Object.entries(phoneLabels).map(([id, label]) => ({id, label, number: data[id] || '', ...data.phoneAccountLinks?.[id]}));
    return { emails: emails.filter(e => e.address), phones: phones.filter(p => p.number) };
}
export function findCompanyProfileContact(data, type, id) {
    return companyProfileContacts(data)[type === 'email' ? 'emails' : 'phones'].find(c => c.id === id);
}
export function companyContactLinkPatch(data, contact, type, link) {
    if (type === 'phone') return { phoneAccountLinks: { ...data.phoneAccountLinks, [contact.id]: { ...data.phoneAccountLinks?.[contact.id], ...link } } };
    const emails = structuredClone(data.emails || {});
    if (contact.sourceSlot === 'extra') {
        emails.extra[contact.sourceIndex] = { ...emails.extra[contact.sourceIndex], id: contact.id, ...link };
    } else {
        emails[contact.sourceSlot] = { ...emails[contact.sourceSlot], email: contact.address, ...link };
    }
    // Le credenziali legacy restano intatte fino alla verifica e pulizia esplicita.
    return { emails };
}
export function companyProfileDraft(contact, sourceCompanyId, type, ownerUid, targetCompanyId = '') {
    return { profileContactId: contact.id, contactType: type, contactValue: contact.address || contact.number, sourceCompanyId, companyId: targetCompanyId, ownerUid };
}
