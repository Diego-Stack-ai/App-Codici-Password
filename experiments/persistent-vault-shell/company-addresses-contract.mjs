import {readCompanyQrSelection} from './company-qr-selection-contract.mjs';

// A2, company addresses only: the fixed legal seat (`indirizzoSede` and its
// siblings, top-level strings) and the repeatable `altreSedi[]`. Every field is
// stored in clear, the two slices are never converted into each other, and the
// legacy writer that synthesizes `sede-<index>` is never imitated.
export const COMPANY_ADDRESS_REFUSALS = Object.freeze({
    INVALID: 'COMPANY_ADDRESSES_INVALID',
    UNCHANGED: 'COMPANY_ADDRESSES_UNCHANGED',
    SHAPE: 'COMPANY_ADDRESSES_SHAPE_INVALID',
    ID_MISSING: 'COMPANY_ADDRESS_ID_MISSING',
    ID_DERIVED: 'COMPANY_ADDRESS_ID_DERIVED'
});
export const COMPANY_ADDRESS_METADATA = Object.freeze(['_companyAddressesRevision', '_companyAddressesSchemaVersion',
    '_companyAddressesUpdatedAt']);
// The fixed seat: one field family, never a list, never removable.
export const COMPANY_SEAT_FIELDS = Object.freeze([
    Object.freeze({key: 'tipoSedeLegale', maxLength: 120}),
    Object.freeze({key: 'indirizzoSede', maxLength: 320}),
    Object.freeze({key: 'civicoSede', maxLength: 20}),
    Object.freeze({key: 'capSede', maxLength: 10}),
    Object.freeze({key: 'cittaSede', maxLength: 120}),
    Object.freeze({key: 'provinciaSede', maxLength: 20})
]);
export const COMPANY_ADDRESS_FIELDS = Object.freeze([
    Object.freeze({key: 'tipo', maxLength: 120, format: 'plain'}),
    Object.freeze({key: 'indirizzo', maxLength: 320, format: 'plain'}),
    Object.freeze({key: 'civico', maxLength: 20, format: 'plain'}),
    Object.freeze({key: 'cap', maxLength: 10, format: 'plain'}),
    Object.freeze({key: 'citta', maxLength: 120, format: 'plain'}),
    Object.freeze({key: 'provincia', maxLength: 20, format: 'plain'}),
    Object.freeze({key: 'qr', format: 'boolean'})
]);
const fail = () => {throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);};
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const companyAddressesHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
// `sede-<uuid>` is a persisted identity; `sede-<index>` is what the legacy writer
// synthesizes from the position and is never accepted as one.
export const companyAddressCreatedId = value => typeof value === 'string' && /^sede-[A-Za-z0-9-]{1,110}$/.test(value) &&
    !/^sede-\d+$/.test(value);
export const companyAddressIndexDerivedId = value => typeof value === 'string' && /^sede-\d+$/.test(value);
export const companyAddressId = value => {
    if (value === undefined || value === null || value === '') return null;
    if (companyAddressIndexDerivedId(value)) return null;
    return ID_PATTERN.test(value) ? value : null;
};
export const companyAddressSpec = key => {
    const spec = COMPANY_ADDRESS_FIELDS.find(item => item.key === key);
    if (!spec) fail();
    return spec;
};
export function assertCompanyAddressRecord(value) {
    if (!object(value)) throw Error(COMPANY_ADDRESS_REFUSALS.SHAPE);
    const list = value.altreSedi;
    if (list != null && (!Array.isArray(list) || list.some(item => !object(item)))) throw Error(COMPANY_ADDRESS_REFUSALS.SHAPE);
    for (const spec of COMPANY_SEAT_FIELDS) {
        if (value[spec.key] != null && typeof value[spec.key] !== 'string') throw Error(COMPANY_ADDRESS_REFUSALS.SHAPE);
    }
    return value;
}
export function companyAddressFields(fields) {
    if (!object(fields)) fail();
    const keys = Object.keys(fields);
    if (!keys.length || keys.length > COMPANY_ADDRESS_FIELDS.length) fail();
    const result = {};
    for (const key of keys) {
        const spec = companyAddressSpec(key), value = fields[key];
        if (spec.format === 'boolean') {
            if (typeof value !== 'boolean') fail();
            result[key] = value;
            continue;
        }
        if (typeof value !== 'string' || value.length > spec.maxLength) fail();
        result[key] = value;
    }
    return Object.freeze(result);
}
export function companySeatFields(fields) {
    if (!object(fields)) fail();
    const keys = Object.keys(fields);
    if (!keys.length || keys.length > COMPANY_SEAT_FIELDS.length) fail();
    const result = {};
    for (const key of keys) {
        const spec = COMPANY_SEAT_FIELDS.find(item => item.key === key);
        if (!spec || typeof fields[key] !== 'string' || fields[key].length > spec.maxLength) fail();
        result[key] = fields[key];
    }
    return Object.freeze(result);
}
// Stable serialization of one stored value: the whole row (or the whole seat
// family) is the conflict basis, so a concurrent change to any field — including
// unknown legacy keys — is detected instead of being overwritten.
export function companyAddressBasis(value) {
    let count = 0;
    const copy = (item, depth = 0) => {
        if (++count > 20000 || depth > 12) fail();
        if (item === null || typeof item === 'boolean') return item;
        if (typeof item === 'string') {
            if (item.length > 100000) fail();
            return item;
        }
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (Array.isArray(item)) {
            if (item.length > 10000) fail();
            return item.map(child => copy(child, depth + 1));
        }
        if (!object(item)) fail();
        const result = Object.create(null);
        for (const key of Reflect.ownKeys(item).sort()) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
            result[key] = copy(descriptor.value, depth + 1);
        }
        return result;
    };
    const serialized = JSON.stringify(copy(value));
    if (serialized.length > 200000) fail();
    return serialized;
}
export function companyAddressesRevision(record) {
    if (!object(record) || record.isArchived) throw Error(COMPANY_ADDRESS_REFUSALS.SHAPE);
    const revision = Object.hasOwn(record, '_companyAddressesRevision') ? record._companyAddressesRevision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, '_companyAddressesSchemaVersion') && record._companyAddressesSchemaVersion !== 1)) {
        throw Error(COMPANY_ADDRESS_REFUSALS.SHAPE);
    }
    return revision;
}
// The seat family as one value: it is never removed, only rewritten field by field.
export const companySeatValue = record => Object.fromEntries(COMPANY_SEAT_FIELDS.map(spec => [spec.key, record[spec.key] ?? null]));
// The fixed seat is published unless `qrConfig.qrLegale` is explicitly false; a
// repeatable row is published unless its own `qr` is explicitly false. A
// configuration that does not resolve canonically, or a row flag that is not a
// boolean, makes the protection unverifiable and every deletion fails closed.
export function companyAddressQrState(record) {
    const unverified = Object.freeze({state: 'unverified', seat: null, extras: null});
    let base;
    try {
        base = readCompanyQrSelection(record);
    } catch {
        return unverified;
    }
    const items = record?.altreSedi;
    if (items != null && (!Array.isArray(items) || items.some(item => object(item) &&
        item.qr !== undefined && typeof item.qr !== 'boolean'))) return unverified;
    const seat = base.expectedConfig === null ? true : base.selection.qrLegale === true;
    const extras = (items ?? []).map(item => !object(item) || item.qr !== false);
    return Object.freeze({state: base.expectedConfig === null ? 'absent' : 'verified', seat, extras: Object.freeze(extras)});
}
export function companyAddressDeleteRefusal(item, {qrIncluded = true} = {}) {
    if (!object(item)) return COMPANY_ADDRESS_REFUSALS.ID_MISSING;
    const id = companyAddressId(item.id);
    if (id === null) {
        return companyAddressIndexDerivedId(item.id) ? COMPANY_ADDRESS_REFUSALS.ID_DERIVED : COMPANY_ADDRESS_REFUSALS.ID_MISSING;
    }
    return qrIncluded === true ? 'COMPANY_ADDRESS_QR_SELECTED' : null;
}
export const COMPANY_ADDRESS_OPERATION_KEYS = Object.freeze({
    seat: Object.freeze(['kind', 'basis', 'fields']),
    'address-create': Object.freeze(['kind', 'id', 'fields']),
    'address-update': Object.freeze(['kind', 'id', 'basis', 'fields']),
    'address-delete': Object.freeze(['kind', 'id', 'basis'])
});
export function companyAddressesTarget(value) {
    if (!object(value) || value.domain !== 'company' || Object.keys(value).length !== 2 ||
        !ID_PATTERN.test(value.companyId ?? '')) fail();
    return Object.freeze({domain: 'company', companyId: value.companyId});
}
export function validateCompanyAddressesRequest(data) {
    const allowed = ['target', 'expectedRevision', 'operations', 'operationId'];
    if (!object(data) || Object.keys(data).length !== allowed.length || Object.keys(data).some(key => !allowed.includes(key)) ||
        !ID_PATTERN.test(data.operationId ?? '') || !Number.isSafeInteger(data.expectedRevision) ||
        data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !Array.isArray(data.operations) || !data.operations.length || data.operations.length > 50) fail();
    const target = companyAddressesTarget(data.target), seen = new Set(), operations = [];
    let seatSeen = false;
    for (const raw of data.operations) {
        if (!object(raw) || typeof raw.kind !== 'string' || !Object.hasOwn(COMPANY_ADDRESS_OPERATION_KEYS, raw.kind)) fail();
        const keys = COMPANY_ADDRESS_OPERATION_KEYS[raw.kind];
        if (Object.keys(raw).length !== keys.length || Object.keys(raw).some(key => !keys.includes(key))) fail();
        // The fixed seat has no identity: it is a single family of top-level fields,
        // never addressable as a row and never more than one operation per request.
        if (raw.kind === 'seat') {
            if (seatSeen || !companyAddressesHash(raw.basis)) fail();
            seatSeen = true;
            operations.push(Object.freeze({kind: 'seat', basis: raw.basis, fields: companySeatFields(raw.fields)}));
            continue;
        }
        if (raw.kind === 'address-create' ? !companyAddressCreatedId(raw.id) : companyAddressId(raw.id) === null) fail();
        if (seen.has(raw.id)) fail();
        seen.add(raw.id);
        if (raw.kind === 'address-create') {
            operations.push(Object.freeze({kind: 'address-create', id: raw.id, fields: companyAddressFields(raw.fields)}));
            continue;
        }
        if (!companyAddressesHash(raw.basis)) fail();
        if (raw.kind === 'address-update') {
            operations.push(Object.freeze({kind: 'address-update', id: raw.id, basis: raw.basis,
                fields: companyAddressFields(raw.fields)}));
            continue;
        }
        operations.push(Object.freeze({kind: 'address-delete', id: raw.id, basis: raw.basis}));
    }
    return Object.freeze({target, expectedRevision: data.expectedRevision, operations: Object.freeze(operations),
        operationId: data.operationId});
}
