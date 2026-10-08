// Fixed company QR flags only. Row-level email/address flags are deliberately
// outside this mutation; no personal/company values belong in its payload.
export const COMPANY_QR_SCALARS = Object.freeze(['ragioneSociale', 'partitaIva', 'codiceSDI', 'numeroCCIAA',
    'dataIscrizione', 'referenteNome', 'referenteCognome', 'referenteTitolo', 'referenteCellulare',
    'telefonoAzienda', 'aziendaEmail', 'adminEmail', 'persEmail', 'qrLegale']);
const optIn = new Set(['telefonoAzienda', 'adminEmail', 'persEmail']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = () => {throw Error('COMPANY_QR_SELECTION_INVALID');};

export function prepareCompanyQrSelection(input) {
    if (!object(input) || Object.keys(input).length !== COMPANY_QR_SCALARS.length ||
        Object.keys(input).some(key => !COMPANY_QR_SCALARS.includes(key))) fail();
    const result = {};
    for (const key of COMPANY_QR_SCALARS) {
        if (typeof input[key] !== 'boolean') fail();
        result[key] = input[key];
    }
    return Object.freeze(result);
}

// Canonical, selection-only snapshot for compare-and-set, including explicit
// absence. Missing configuration must never silently become sharing consent.
export function readCompanyQrSelection(record) {
    if (!object(record) || record.isArchived) fail();
    const exists = Object.hasOwn(record, 'qrConfig');
    const config = exists ? record.qrConfig : {};
    if (!object(config) || Object.keys(config).some(key =>
        ![...COMPANY_QR_SCALARS, '_qrRevision', '_qrSchemaVersion'].includes(key))) fail();
    const revision = config._qrRevision ?? 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(config, '_qrRevision') && config._qrRevision == null) ||
        (Object.hasOwn(config, '_qrSchemaVersion') && config._qrSchemaVersion !== 1)) fail();
    const selection = {}, stored = {};
    for (const key of [...COMPANY_QR_SCALARS, '_qrRevision', '_qrSchemaVersion']) {
        if (Object.hasOwn(config, key)) stored[key] = config[key];
    }
    for (const key of COMPANY_QR_SCALARS) {
        if (Object.hasOwn(config, key) && typeof config[key] !== 'boolean') fail();
        selection[key] = exists ? (config[key] ?? !optIn.has(key)) : false;
    }
    return Object.freeze({selection: Object.freeze(selection), revision,
        expectedConfig: exists ? Object.freeze(stored) : null});
}

export function normalizeCompanyQrExpectedConfig(value) {
    return readCompanyQrSelection(value === null ? {} : {qrConfig: value}).expectedConfig;
}
