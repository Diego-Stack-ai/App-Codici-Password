// A1b, contract first: the company contacts schema is separate from the private
// one and is never converted into it. This module only *reads* the canonical
// company record (validating its shape) and projects it into a view the future
// editor can consume: fixed slots are never removable (their semantics is
// emptying), repeatable `emails.extra` rows are only editable and removable when
// they carry a stable persisted id, and a row whose id was derived from its index
// by the UI is projected as blocked. Unknown fields, legacy passwords, QR flags
// and Account links are preserved by construction: nothing here rewrites the
// record.
export const COMPANY_CONTACT_EMAIL_SLOTS = Object.freeze(['pec', 'amministrazione', 'personale']);
export const COMPANY_CONTACT_PHONE_SLOTS = Object.freeze(['telefonoAzienda', 'faxAzienda', 'referenteCellulare']);
export const COMPANY_CONTACT_EXTRA = 'emails.extra';
export const COMPANY_CONTACT_REFUSALS = Object.freeze({
    SHAPE_INVALID: 'COMPANY_CONTACTS_SHAPE_INVALID',
    ID_MISSING: 'COMPANY_CONTACT_ID_MISSING',
    ID_DERIVED: 'COMPANY_CONTACT_ID_DERIVED'
});
// Same identity alphabet as the private contacts contract: no ':' or '/' can be
// smuggled into a path or an AAD string.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// An id the user interface synthesized from a list position is never an identity.
export const companyContactIndexDerivedId = value => typeof value === 'string' && /^extra-\d+$/.test(value);
export const companyContactId = value => {
    if (value === undefined || value === null || value === '') return null;
    if (companyContactIndexDerivedId(value)) return null;
    return ID_PATTERN.test(value) ? value : null;
};
export function assertCompanyRecord(value) {
    if (!object(value)) throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    if (value.emails != null && !object(value.emails)) throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    for (const slot of COMPANY_CONTACT_EMAIL_SLOTS) {
        if (value.emails?.[slot] != null && !object(value.emails[slot])) throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    }
    for (const list of [value.emails?.extra, value.altreSedi, value.allegati]) {
        if (list != null && (!Array.isArray(list) || list.some(item => !object(item)))) throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    }
    return value;
}
const link = item => (item?.linkedAccountId ? {linkedAccountId: item.linkedAccountId,
    ...(item.linkedAccountCompanyId ? {linkedAccountCompanyId: item.linkedAccountCompanyId} : {})} : null);
// The label the company schema already carries is preferred over an invented one.
const labelOf = (item, fallback) => typeof item?.tipo === 'string' && item.tipo ? item.tipo : fallback;
export function companyContactsView(record) {
    assertCompanyRecord(record);
    const rows = [];
    for (const slot of COMPANY_CONTACT_EMAIL_SLOTS) {
        const item = record.emails?.[slot] ?? {};
        // `aziendaEmail` is the legacy top-level fallback of the `pec` slot: it is
        // shown, never rewritten, and the row stays editable through its own slot.
        const value = typeof item.email === 'string' && item.email
            ? item.email
            : (slot === 'pec' && typeof record.aziendaEmail === 'string' ? record.aziendaEmail : '');
        rows.push(Object.freeze({kind: 'email-slot', id: slot, label: labelOf(item, slot), value,
            legacyFallback: !item.email && value !== '', editable: true, removable: false, blocked: null, link: link(item)}));
    }
    (record.emails?.extra ?? []).forEach((item, index) => {
        const id = companyContactId(item.id);
        const derived = item.id !== undefined && item.id !== null && item.id !== '' && companyContactIndexDerivedId(item.id);
        rows.push(Object.freeze({kind: 'email-extra', id, sourceIndex: index, label: labelOf(item, 'Email aggiuntiva'),
            value: typeof item.email === 'string' ? item.email : '', editable: id !== null, removable: id !== null,
            blocked: id !== null ? null : (derived ? COMPANY_CONTACT_REFUSALS.ID_DERIVED : COMPANY_CONTACT_REFUSALS.ID_MISSING),
            link: link(item)}));
    });
    for (const slot of COMPANY_CONTACT_PHONE_SLOTS) {
        const item = record[slot] ?? {};
        const linked = record.phoneAccountLinks?.[slot] ?? {};
        rows.push(Object.freeze({kind: 'phone-slot', id: slot, label: typeof item.label === 'string' && item.label ? item.label : slot,
            value: typeof item.number === 'string' && item.number ? item.number : (typeof item === 'string' ? item : ''),
            editable: true, removable: false, blocked: null, link: link(linked)}));
    }
    return Object.freeze(rows);
}
// A row is never removable when an Account link exists or the QR selection covers it.
export function companyContactRemovable(row, {qrIncluded = false} = {}) {
    if (!row || row.kind !== 'email-extra' || row.blocked) return false;
    if (row.link?.linkedAccountId) return false;
    return !qrIncluded;
}
// Emptying a fixed slot keeps the object and every field it already carried.
export function emptyCompanyContactSlot(record, {kind, id}) {
    assertCompanyRecord(record);
    if (kind === 'email-slot' && COMPANY_CONTACT_EMAIL_SLOTS.includes(id)) {
        const emails = {...(record.emails ?? {})};
        emails[id] = {...(emails[id] ?? {}), email: ''};
        return {...record, emails};
    }
    if (kind === 'phone-slot' && COMPANY_CONTACT_PHONE_SLOTS.includes(id)) {
        return {...record, [id]: {...record[id], number: ''}};
    }
    throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
}
