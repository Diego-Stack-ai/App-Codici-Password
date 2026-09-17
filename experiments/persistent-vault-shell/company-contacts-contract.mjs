import {readCompanyQrSelection} from './company-qr-selection-contract.mjs';

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
        // The real company schema stores each phone slot as a plain string
        // (`ma_save.js` writes `telefonoAzienda: value.trim()`), so spreading it
        // would turn "0110" into {0:'0',1:'1',…} and destroy the record. Only an
        // object-shaped legacy slot is emptied field by field; a string stays a
        // string. Regression covered by `company-contacts-contract.test.mjs`.
        const current = record[id];
        return {...record, [id]: object(current) ? {...current, number: ''} : ''};
    }
    throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
}

// ─── A1b mutation contract ────────────────────────────────────────────────────
// The company slice writes the company schema and nothing else: no conversion to
// the private contacts format, no identity derived from a position, no
// destructive normalization. `password` is the only field the real writer
// encrypts (`ma_save.js`); `tipo`, `email`, `note` and the phone slots are stored
// in clear, so the editor preserves the *stored form* of every field instead of
// inventing a new classification.

export const COMPANY_CONTACT_MUTATION_REFUSALS = Object.freeze({
    INVALID: 'COMPANY_CONTACTS_INVALID',
    UNCHANGED: 'COMPANY_CONTACTS_UNCHANGED'
});
// Same cipher alphabet the private contract accepts: a stored ciphertext is
// recognised by shape, never re-encrypted and never rewritten by accident.
export const companyContactCipher = value => typeof value === 'string' && (value === '' ||
    (value.length >= 60 && value.length <= 100000 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)));
export const COMPANY_CONTACT_MUTATION_FIELDS = Object.freeze({
    'email-slot': Object.freeze([
        Object.freeze({key: 'tipo', maxLength: 120, format: 'plain'}),
        Object.freeze({key: 'email', maxLength: 320, format: 'plain'}),
        Object.freeze({key: 'note', maxLength: 20000, format: 'plain'}),
        Object.freeze({key: 'password', maxLength: 1000, format: 'cipher', secret: true})
    ]),
    'email-extra': Object.freeze([
        Object.freeze({key: 'tipo', maxLength: 120, format: 'plain'}),
        Object.freeze({key: 'email', maxLength: 320, format: 'plain'}),
        Object.freeze({key: 'note', maxLength: 20000, format: 'plain'}),
        Object.freeze({key: 'password', maxLength: 1000, format: 'cipher', secret: true}),
        Object.freeze({key: 'qr', format: 'boolean'})
    ])
});
// The company record is never converted: the private arrays are a different
// slice and their identifiers must not be usable here.
const COMPANY_EXTRA_PREFIX = 'company-email-';
export const companyContactExtraId = value => typeof value === 'string' &&
    new RegExp(`^${COMPANY_EXTRA_PREFIX}[A-Za-z0-9_-]{1,110}$`).test(value);
export const companyContactMutationField = (kind, key) => {
    if (!Object.hasOwn(COMPANY_CONTACT_MUTATION_FIELDS, kind)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    const spec = COMPANY_CONTACT_MUTATION_FIELDS[kind].find(item => item.key === key);
    if (!spec) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    return spec;
};
// Stable serialization of one stored contact value (object, string or explicit
// `null` for an absent slot). The whole value is the conflict basis, so a
// concurrent change to any field — links, QR flags, unknown legacy keys — is
// detected instead of being overwritten.
export function companyContactBasis(value) {
    let count = 0;
    const copy = (item, depth = 0) => {
        if (++count > 20000 || depth > 12) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        if (item === null || typeof item === 'boolean') return item;
        if (typeof item === 'string') {
            if (item.length > 100000) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            return item;
        }
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (Array.isArray(item)) {
            if (item.length > 10000) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            return item.map(child => copy(child, depth + 1));
        }
        if (!object(item)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(item).sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            }
            result[key] = copy(descriptor.value, depth + 1);
        }
        return result;
    };
    const serialized = JSON.stringify(copy(value));
    if (serialized.length > 200000) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    return serialized;
}
// Revisioni separate da quelle private e da quelle del testo/della selezione:
// una scrittura legacy che non le incrementa resta comunque rilevata dal
// confronto dell'impronta della singola riga.
export function companyContactsRevision(record) {
    if (!object(record) || record.isArchived) throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    const revision = Object.hasOwn(record, '_companyContactsRevision') ? record._companyContactsRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_companyContactsSchemaVersion') && record._companyContactsSchemaVersion !== 1)) {
        throw Error(COMPANY_CONTACT_REFUSALS.SHAPE_INVALID);
    }
    return revision;
}
// Which fixed QR flag publishes each contact slot on the digital card
// (`company-vcard.js`). `faxAzienda` has no flag at all (`null`), so it is never
// protected by the card selection; every other slot is.
export const COMPANY_CONTACT_QR_SCALARS = Object.freeze({pec: 'aziendaEmail', amministrazione: 'adminEmail',
    personale: 'persEmail', telefonoAzienda: 'telefonoAzienda', faxAzienda: null, referenteCellulare: 'referenteCellulare'});
// New fields and telephone numbers require an explicit opt-in; the older ones are
// published unless the user switched them off (`company-vcard.js`).
const COMPANY_QR_OPT_IN = new Set(['telefonoAzienda', 'adminEmail', 'persEmail']);
// Three outcomes, never a silent "nothing is selected". The scalar flags are
// validated by the canonical company QR contract; a configuration that does not
// resolve canonically, or a repeatable row whose `qr` flag is not a boolean, is
// reported as `unverified` and the caller must fail closed. An absent
// configuration is *not* unverified: the digital card treats it with its own
// defaults (`company-vcard.js`), which are reproduced here.
export function companyContactQrState(record) {
    const unverified = Object.freeze({state: 'unverified', slots: null, extras: null});
    let base;
    try {
        base = readCompanyQrSelection(record);
    } catch {
        return unverified;
    }
    const items = record?.emails?.extra;
    if (items != null && (!Array.isArray(items) || items.some(item => object(item) &&
        item.qr !== undefined && typeof item.qr !== 'boolean'))) return unverified;
    const absent = base.expectedConfig === null;
    const slots = {};
    for (const [slot, scalar] of Object.entries(COMPANY_CONTACT_QR_SCALARS)) {
        slots[slot] = scalar === null ? false : (absent ? !COMPANY_QR_OPT_IN.has(scalar) : base.selection[scalar] === true);
    }
    const extras = (items ?? []).map(item => !object(item) || item.qr !== false);
    return Object.freeze({state: absent ? 'absent' : 'verified', slots: Object.freeze(slots), extras: Object.freeze(extras)});
}
export const companyContactSlotKind = value => value === 'email-slot' || value === 'phone-slot';
export const companyContactSlotExists = (kind, id) => kind === 'email-slot' ? COMPANY_CONTACT_EMAIL_SLOTS.includes(id)
    : kind === 'phone-slot' && COMPANY_CONTACT_PHONE_SLOTS.includes(id);
// The Account link of a fixed slot: for e-mails it lives in the slot object, for
// telephones in `phoneAccountLinks`, exactly as the legacy model writes it.
const linkedToAccount = item => Boolean(item) && ((typeof item.linkedAccountId === 'string' && item.linkedAccountId) ||
    (typeof item.linkedAccountCompanyId === 'string' && item.linkedAccountCompanyId));
export function companyContactSlotLink(record, {kind, id}) {
    if (kind === 'email-slot') return linkedToAccount(record?.emails?.[id]) ? link(record.emails[id]) ?? {} : null;
    if (kind === 'phone-slot') {
        const item = object(record?.phoneAccountLinks?.[id]) ? record.phoneAccountLinks[id] : null;
        return linkedToAccount(item) ? link(item) ?? {} : null;
    }
    return null;
}
// Emptying a fixed slot is the only way to remove that contact from the company
// profile, so the deletion protections apply to it: a slot linked to an Account
// or already published on the digital card cannot be emptied. A `pec` slot whose
// visible value comes from the legacy `aziendaEmail` fallback cannot be emptied
// either, because the fallback would simply reappear: that needs a separate,
// explicit migration. Returns the refusal code, or `null` when emptying is safe.
export function companyContactEmptyRefusal(record, {kind, id, qrIncluded = false} = {}) {
    if (!companyContactSlotKind(kind) || !companyContactSlotExists(kind, id)) return COMPANY_CONTACT_MUTATION_REFUSALS.INVALID;
    if (companyContactSlotLink(record, {kind, id})) return 'COMPANY_CONTACTS_LINKED';
    if (qrIncluded === true) return 'COMPANY_CONTACTS_QR_SELECTED';
    if (kind === 'email-slot' && id === 'pec') {
        const stored = record?.emails?.pec?.email;
        if ((typeof stored !== 'string' || stored === '') && !!record?.aziendaEmail) return 'COMPANY_CONTACTS_LEGACY_FALLBACK';
    }
    return null;
}
// A repeatable row can be deleted only with a stable persisted id, without an
// Account link and when the digital card does not publish it.
export function companyContactExtraDeleteRefusal(item, {qrIncluded = true} = {}) {
    if (!object(item)) return COMPANY_CONTACT_REFUSALS.ID_MISSING;
    const id = companyContactId(item.id);
    if (id === null) {
        return typeof item.id === 'string' && companyContactIndexDerivedId(item.id)
            ? COMPANY_CONTACT_REFUSALS.ID_DERIVED : COMPANY_CONTACT_REFUSALS.ID_MISSING;
    }
    if (linkedToAccount(item)) return 'COMPANY_CONTACTS_LINKED';
    return qrIncluded === true ? 'COMPANY_CONTACTS_QR_SELECTED' : null;
}const OPERATION_KEYS = Object.freeze({
    'email-slot': Object.freeze(['kind', 'id', 'basis', 'fields']),
    'phone-slot': Object.freeze(['kind', 'id', 'basis', 'value']),
    'email-extra-create': Object.freeze(['kind', 'id', 'fields']),
    'email-extra-update': Object.freeze(['kind', 'id', 'basis', 'fields']),
    'email-extra-delete': Object.freeze(['kind', 'id', 'basis'])
});
const COMPANY_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const companyContactsHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function companyContactsTarget(value) {
    if (!object(value) || value.domain !== 'company' || Object.keys(value).length !== 2 ||
        !COMPANY_ID_PATTERN.test(value.companyId ?? '')) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    return Object.freeze({domain: 'company', companyId: value.companyId});
}
export function companyContactMutationFields(kind, fields) {
    if (!object(fields)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    const specs = COMPANY_CONTACT_MUTATION_FIELDS[kind], keys = Object.keys(fields);
    if (!specs || !keys.length || keys.length > specs.length) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    const result = {};
    for (const key of keys) {
        const spec = companyContactMutationField(kind, key), value = fields[key];
        if (spec.format === 'boolean') {
            if (typeof value !== 'boolean') throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            result[key] = value;
            continue;
        }
        if (typeof value !== 'string' || value.length > 100000) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        // A field stored in clear may hold legacy ciphertext; the limit is then
        // the cipher one, exactly as the private contract does.
        if (value.length > spec.maxLength && !(spec.format === 'plain' && companyContactCipher(value))) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        if (spec.format === 'cipher' && !companyContactCipher(value)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        result[key] = value;
    }
    return Object.freeze(result);
}
export function validateCompanyContactsRequest(data) {
    const allowed = ['target', 'expectedRevision', 'operations', 'operationId'];
    if (!object(data) || Object.keys(data).length !== allowed.length || Object.keys(data).some(key => !allowed.includes(key)) ||
        !COMPANY_ID_PATTERN.test(data.operationId ?? '') || !Number.isSafeInteger(data.expectedRevision) ||
        data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !Array.isArray(data.operations) || !data.operations.length || data.operations.length > 50) {
        throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    }
    const target = companyContactsTarget(data.target), seen = new Set(), operations = [];
    for (const raw of data.operations) {
        if (!object(raw) || typeof raw.kind !== 'string' || !Object.hasOwn(OPERATION_KEYS, raw.kind)) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        const keys = OPERATION_KEYS[raw.kind];
        if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        const extra = raw.kind.startsWith('email-extra');
        if (raw.kind === 'email-extra-create' ? !companyContactExtraId(raw.id) : !companyContactId(raw.id)) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        if (companyContactSlotKind(raw.kind) && !companyContactSlotExists(raw.kind, raw.id)) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        const identity = `${extra ? 'email-extra' : raw.kind}:${raw.id}`;
        if (seen.has(identity)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        seen.add(identity);
        if (raw.kind === 'email-extra-create') {
            operations.push(Object.freeze({kind: raw.kind, id: raw.id, fields: companyContactMutationFields('email-extra', raw.fields)}));
            continue;
        }
        if (!companyContactsHash(raw.basis)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        if (raw.kind === 'email-slot') {
            operations.push(Object.freeze({kind: raw.kind, id: raw.id, basis: raw.basis, fields: companyContactMutationFields('email-slot', raw.fields)}));
            continue;
        }
        if (raw.kind === 'phone-slot') {
            if (typeof raw.value !== 'string' || raw.value.length > 120) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            operations.push(Object.freeze({kind: raw.kind, id: raw.id, basis: raw.basis, value: raw.value}));
            continue;
        }
        if (raw.kind === 'email-extra-update') {
            operations.push(Object.freeze({kind: raw.kind, id: raw.id, basis: raw.basis, fields: companyContactMutationFields('email-extra', raw.fields)}));
            continue;
        }
        operations.push(Object.freeze({kind: raw.kind, id: raw.id, basis: raw.basis}));
    }
    return Object.freeze({target, expectedRevision: data.expectedRevision, operations: Object.freeze(operations),
        operationId: data.operationId});
}
