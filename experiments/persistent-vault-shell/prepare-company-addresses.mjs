import {COMPANY_ADDRESS_REFUSALS, COMPANY_ADDRESS_FIELDS, COMPANY_SEAT_FIELDS, assertCompanyAddressRecord,
    companyAddressBasis, companyAddressCreatedId, companyAddressDeleteRefusal, companyAddressQrState,
    companyAddressesRevision, companySeatValue, validateCompanyAddressesRequest} from './company-addresses-contract.mjs';

// Every company address field is stored in clear, so the preparation only maps the
// fields the user changed, diffs the fixed seat against the committed record,
// refuses any operation on a row whose identity is not persisted and never lets an
// unknown key, `qrConfig` or another company field enter a command.
export async function prepareCompanyAddresses({context, getUser, source, record, snapshot, draft, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check();
    if (source?.domain !== 'company' || typeof source.companyId !== 'string') throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
    if (record.ownerId !== undefined && record.ownerId !== uid) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
    if (record.id !== undefined && record.id !== source.companyId) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
    assertCompanyAddressRecord(record);
    const revision = companyAddressesRevision(record);
    const staged = value => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.length > 50) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        return value;
    };
    const creates = staged(draft?.creates), updates = staged(draft?.updates), deletes = staged(draft?.deletes);
    const rows = record.altreSedi === undefined ? [] : record.altreSedi;
    const mapFields = (fields, stored) => {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            const spec = COMPANY_ADDRESS_FIELDS.find(item => item.key === key);
            if (!spec) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
            if (spec.format === 'boolean') {
                if (stored?.fields?.[key] === value) continue;
                result[key] = value;
                continue;
            }
            if (typeof value !== 'string' || value.length > spec.maxLength) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
            if (stored?.fields?.[key] === value) continue;
            result[key] = value;
        }
        return result;
    };
    const operations = [];
    if (draft?.seat !== undefined) {
        if (!draft.seat || typeof draft.seat !== 'object' || Array.isArray(draft.seat)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        const fields = {};
        for (const [key, value] of Object.entries(draft.seat.fields ?? {})) {
            const spec = COMPANY_SEAT_FIELDS.find(item => item.key === key);
            if (!spec || typeof value !== 'string' || value.length > spec.maxLength) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
            if ((record[key] ?? '') === value) continue;
            fields[key] = value;
        }
        if (Object.keys(fields).length) {
            operations.push({kind: 'seat', basis: await hash(companyAddressBasis(companySeatValue(record))), fields});
        }
    }
    for (const value of creates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        if (!companyAddressCreatedId(value.id)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        if (rows.some(item => item.id === value.id)) throw Error('COMPANY_CHANGED');
        const fields = mapFields(value.fields, null);
        if (!Object.keys(fields).length) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        operations.push({kind: 'address-create', id: value.id, fields});
    }
    for (const value of updates) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        const matches = rows.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('COMPANY_CHANGED');
        const fields = mapFields(value.fields, snapshot?.get(value.id) ?? null);
        if (!Object.keys(fields).length) continue;
        operations.push({kind: 'address-update', id: value.id, basis: await hash(companyAddressBasis(matches[0])), fields});
    }
    // Deletion depends on the digital-card selection: an unresolvable configuration
    // blocks it here as well as in the service, so the editor never promises a
    // protection it cannot verify.
    const qr = deletes.length ? companyAddressQrState(record) : null;
    if (deletes.length && qr.state === 'unverified') throw Error('COMPANY_ADDRESSES_QR_UNVERIFIABLE');
    for (const value of deletes) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
        const matches = rows.filter(item => item.id === value.id);
        if (matches.length !== 1) throw Error('COMPANY_CHANGED');
        const refusal = companyAddressDeleteRefusal(matches[0], {qrIncluded: qr.extras?.[rows.indexOf(matches[0])] === true});
        if (refusal) throw Error(refusal);
        operations.push({kind: 'address-delete', id: value.id, basis: await hash(companyAddressBasis(matches[0]))});
    }
    if (!operations.length) throw Error(COMPANY_ADDRESS_REFUSALS.UNCHANGED);
    check();
    return validateCompanyAddressesRequest({target: {domain: 'company', companyId: source.companyId},
        expectedRevision: revision, operations, operationId});
}
