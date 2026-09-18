import {COMPANY_CONTACT_EMAIL_SLOTS, COMPANY_CONTACT_MUTATION_REFUSALS, COMPANY_CONTACT_PHONE_SLOTS,
    assertCompanyRecord, companyContactBasis, companyContactCipher, companyContactEmptyRefusal,
    companyContactExtraDeleteRefusal, companyContactExtraId, companyContactMutationField, companyContactQrState,
    companyContactsRevision, validateCompanyContactsRequest} from './company-contacts-contract.mjs';

// The session crypto performs every encryption, and it does so only where the
// company schema already stores ciphertext: `password` is the only field the real
// writer encrypts (`ma_save.js`), while `tipo`, `email`, `note` and the telephone
// slots stay in clear. An unchanged value is never sent, so nothing is
// re-encrypted; a field stored in a legacy cipher form keeps that form.
// Company contacts remain an online-only write.
const emptied = operation => operation.kind === 'email-extra-delete' ||
    (operation.kind === 'email-slot' && operation.fields.email === '') ||
    (operation.kind === 'phone-slot' && operation.value === '');
export async function prepareCompanyContacts({context, getUser, source, record, snapshot, draft, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check();
    if (source?.domain !== 'company' || typeof source.companyId !== 'string') throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    if (record.ownerId !== undefined && record.ownerId !== uid) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    if (record.id !== undefined && record.id !== source.companyId) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    assertCompanyRecord(record);
    const revision = companyContactsRevision(record);
    if (snapshot !== undefined && snapshot !== null && typeof snapshot.get !== 'function') {
        throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    }
    const staged = value => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        return value;
    };
    const slots = staged(draft?.slots), creates = staged(draft?.creates), updates = staged(draft?.updates), deletes = staged(draft?.deletes);
    const extraRows = record.emails?.extra === undefined ? [] : record.emails.extra;
    const storedSlot = operation => operation.kind === 'email-slot'
        ? (record.emails?.[operation.id] ?? null) : (record[operation.id] ?? null);
    // Only fields the user actually changed travel: the stored bytes stay bytes.
    const mapFields = async (kind, fields, stored) => {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            const spec = companyContactMutationField(kind, key);
            if (spec.format === 'boolean') {
                if (stored?.fields?.[key] === value) continue;
                result[key] = value;
                continue;
            }
            if (typeof value !== 'string' || value.length > spec.maxLength) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            if (stored?.fields?.[key] === value) continue;
            const form = stored?.forms?.[key] ?? spec.format;
            if (form === 'cipher' || spec.format === 'cipher') {
                if (value === '') {
                    result[key] = '';
                    continue;
                }
                check();
                const ciphertext = await context.encrypt(value);
                check();
                if (!companyContactCipher(ciphertext) || ciphertext === value) throw Error('ENCRYPTION_FAILED');
                result[key] = ciphertext;
                continue;
            }
            result[key] = value;
        }
        return result;
    };
    const operations = [];
    for (const value of slots) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        const {kind, id} = value;
        if (kind !== 'email-slot' && kind !== 'phone-slot') throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        if (!(kind === 'email-slot' ? COMPANY_CONTACT_EMAIL_SLOTS : COMPANY_CONTACT_PHONE_SLOTS).includes(id)) {
            throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        }
        const basis = await hash(companyContactBasis(storedSlot({kind, id})));
        if (kind === 'phone-slot') {
            if (typeof value.value !== 'string' || value.value.length > 120) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            const stored = record[id] ?? null;
            const current = typeof stored === 'string' ? stored : '';
            if (current === value.value) continue;
            operations.push({kind, id, basis, value: value.value});
            continue;
        }
        const fields = await mapFields('email-slot', value.fields, snapshot?.get(`email-slot:${id}`) ?? null);
        if (!Object.keys(fields).length) continue;
        operations.push({kind, id, basis, fields});
    }
    for (const value of creates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        if (!companyContactExtraId(value.id)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        if (extraRows.some(item => item?.id === value.id)) throw Error('COMPANY_CHANGED');
        operations.push({kind: 'email-extra-create', id: value.id, fields: await mapFields('email-extra', value.fields, null)});
    }
    for (const value of updates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        const matches = extraRows.filter(item => item?.id === value.id);
        if (matches.length !== 1) throw Error('COMPANY_CHANGED');
        const fields = await mapFields('email-extra', value.fields, snapshot?.get(`email-extra:${value.id}`) ?? null);
        if (!Object.keys(fields).length) continue;
        operations.push({kind: 'email-extra-update', id: value.id, basis: await hash(companyContactBasis(matches[0])), fields});
    }
    for (const value of deletes) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
        const matches = extraRows.filter(item => item?.id === value.id);
        if (matches.length !== 1) throw Error('COMPANY_CHANGED');
        operations.push({kind: 'email-extra-delete', id: value.id, basis: await hash(companyContactBasis(matches[0]))});
    }
    if (!operations.length) throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.UNCHANGED);
    // Emptying a fixed slot and deleting a repeatable row depend on the digital
    // card selection: a configuration that cannot be resolved canonically blocks
    // them here as well as in the service, so the editor never promises a
    // protection it cannot verify. Consultation and plain edits stay available.
    const protectedOperations = operations.filter(emptied);
    if (protectedOperations.length) {
        const qr = companyContactQrState(record);
        if (qr.state === 'unverified') throw Error('COMPANY_CONTACTS_QR_UNVERIFIABLE');
        for (const operation of protectedOperations) {
            const refusal = operation.kind === 'email-extra-delete'
                ? companyContactExtraDeleteRefusal(extraRows.find(item => item?.id === operation.id), {
                    qrIncluded: qr.extras?.[extraRows.findIndex(item => item?.id === operation.id)] === true})
                : companyContactEmptyRefusal(record, {kind: operation.kind, id: operation.id,
                    qrIncluded: qr.slots?.[operation.id] === true});
            if (refusal) throw Error(refusal);
        }
    }
    check();
    return validateCompanyContactsRequest({target: {domain: 'company', companyId: source.companyId},
        expectedRevision: revision, operations, operationId});
}
