import {COMPANY_ADDRESS_REFUSALS, COMPANY_SEAT_FIELDS, companyAddressDeleteRefusal, companyAddressId,
    companyAddressIndexDerivedId, companyAddressQrState, companyAddressesRevision} from './company-addresses-contract.mjs';
import {prepareCompanyAddresses} from './prepare-company-addresses.mjs';

const LABELS = Object.freeze({tipo: 'Tipo', indirizzo: 'Indirizzo', civico: 'Civico', cap: 'CAP', citta: 'Città',
    provincia: 'Provincia', qr: 'Includi nella tessera digitale'});
const SEAT_LABELS = Object.freeze({tipoSedeLegale: 'Tipo sede', indirizzoSede: 'Indirizzo', civicoSede: 'Civico',
    capSede: 'CAP', cittaSede: 'Città', provinciaSede: 'Provincia'});
const KEYS = Object.freeze(['tipo', 'indirizzo', 'civico', 'cap', 'citta', 'provincia']);
const MAX = Object.freeze({tipo: 120, indirizzo: 320, civico: 20, cap: 10, citta: 120, provincia: 20});
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// The company slice: a fixed legal seat that is edited field by field and never
// removed, plus `altreSedi` rows whose identity must be persisted — the legacy form
// rewrites `sede-<index>`, which is reported and never targeted.
export function createCompanyAddressesEditorSource({context, getUser, source, hash, createId,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    if (typeof createId !== 'function') throw Error(COMPANY_ADDRESS_REFUSALS.INVALID);
    const uid = context.user?.uid, companyId = source?.companyId;
    let disposed = false, loaded = null;
    const fail = code => {throw Error(code);};
    const dispose = () => {disposed = true; loaded = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail('VIEW_DISPOSED');}
        context.assertUnlocked();
        if (source?.domain !== 'company' || source.companyId !== companyId || typeof companyId !== 'string' ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) fail('COMPANY_UNAVAILABLE');
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        const record = await source.read(uid, confirmed);
        if (!object(record) || record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid) ||
            (record.id !== undefined && record.id !== companyId)) fail('COMPANY_UNAVAILABLE');
        try {
            companyAddressesRevision(record);
        } catch {
            fail('COMPANY_UNAVAILABLE');
        }
        return record;
    };
    const signature = record => JSON.stringify([record.altreSedi ?? null, COMPANY_SEAT_FIELDS.map(spec => record[spec.key] ?? null),
        record.qrConfig ?? null, record._companyAddressesRevision ?? 0]);
    return Object.freeze({dispose,
        createId() {
            const value = createId('sede');
            if (typeof value !== 'string' || !/^sede-[A-Za-z0-9-]{1,110}$/.test(value) || companyAddressIndexDerivedId(value)) {
                fail(COMPANY_ADDRESS_REFUSALS.INVALID);
            }
            return value;
        },
        async load() {
            loaded = null;
            const initial = await read(isOnline()); check();
            const revision = companyAddressesRevision(initial), current = signature(initial);
            const items = initial.altreSedi === undefined ? [] : initial.altreSedi;
            if (!Array.isArray(items) || items.length > 10000 || items.some(item => !object(item))) fail(COMPANY_ADDRESS_REFUSALS.SHAPE);
            const qr = companyAddressQrState(initial), unverified = qr.state === 'unverified';
            const rows = [], snapshot = new Map();
            items.forEach((item, index) => {
                const id = companyAddressId(item.id), derived = companyAddressIndexDerivedId(item.id);
                const fields = [];
                for (const key of KEYS) {
                    const value = item[key] ?? '';
                    if (typeof value !== 'string' || value.length > MAX[key]) fail('COMPANY_ADDRESS_VALUE_INVALID');
                    fields.push(Object.freeze({key, label: LABELS[key], value, maxLength: MAX[key]}));
                }
                fields.push(Object.freeze({key: 'qr', label: LABELS.qr, type: 'boolean', value: item.qr === true}));
                const deleteRefusal = id === null ? (derived ? COMPANY_ADDRESS_REFUSALS.ID_DERIVED : COMPANY_ADDRESS_REFUSALS.ID_MISSING)
                    : (unverified ? 'COMPANY_ADDRESSES_QR_UNVERIFIABLE'
                        : companyAddressDeleteRefusal(item, {qrIncluded: qr.extras?.[index] === true}));
                rows.push(Object.freeze({id, label: item.tipo || 'Sede aggiuntiva', fields: Object.freeze(fields),
                    editable: id !== null, blocked: id === null ? (derived ? COMPANY_ADDRESS_REFUSALS.ID_DERIVED
                        : COMPANY_ADDRESS_REFUSALS.ID_MISSING) : null, deleteRefusal}));
                if (id !== null) {
                    const original = {};
                    for (const key of KEYS) original[key] = item[key] ?? '';
                    original.qr = item.qr === true;
                    snapshot.set(id, {fields: original});
                }
            });
            const confirmed = await read(isOnline()); check();
            if (signature(confirmed) !== current) fail('COMPANY_CHANGED');
            loaded = {revision, signature: current, snapshot};
            const seat = {label: 'Sede legale', fields: Object.freeze(COMPANY_SEAT_FIELDS.map(spec => Object.freeze({key: spec.key,
                label: SEAT_LABELS[spec.key], value: initial[spec.key] ?? '', maxLength: spec.maxLength})))};
            const templates = [...KEYS.map(key => Object.freeze({key, label: LABELS[key], value: '', maxLength: MAX[key]})),
                Object.freeze({key: 'qr', label: LABELS.qr, type: 'boolean', value: false})];
            return Object.freeze({revision, canSave: isOnline(), seat, addLabel: 'Aggiungi sede', newLabel: 'Nuova sede',
                qrState: qr.state, rows: Object.freeze(rows), templates: Object.freeze(templates)});
        },
        async prepare(draft, operationId) {
            check();
            if (!loaded || !isOnline()) fail('COMPANY_SAVE_UNAVAILABLE');
            const current = await read(true); check();
            if (signature(current) !== loaded.signature) fail('COMPANY_CHANGED');
            const request = await prepareCompanyAddresses({context, getUser, source, record: current, snapshot: loaded.snapshot,
                draft, operationId, hash});
            check();
            return request;
        }});
}
