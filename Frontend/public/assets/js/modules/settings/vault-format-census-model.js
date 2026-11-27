// Censimento dei formati della Vault: classificazione e conteggi in sola lettura.
// Modulo puro: nessun import, nessun accesso a rete o storage. Le prove crittografiche
// arrivano iniettate e ciascuna usa un solo candidato. Il rapporto contiene soltanto
// conteggi: niente valori, niente chiavi, niente UID o ID dei record.

export const CENSUS_SCHEMA = 'vault-format-census/v1';

// Inventario per area, ricavato dai percorsi utente di firestore.rules.
// source: 'owner-backup' = enumerato da collectOwnerBackup; 'census' = letto dal censimento;
// 'not-covered' = dichiarato non censito, mai contato come zero.
export const CENSUS_AREAS = Object.freeze([
    {id: 'profile', source: 'owner-backup', scopes: ['profile']},
    {id: 'settings', source: 'owner-backup', scopes: ['settings']},
    {id: 'private-accounts', source: 'owner-backup', scopes: ['private-account']},
    {id: 'private-account-attachments', source: 'owner-backup', scopes: ['private-account-attachment']},
    {id: 'companies', source: 'owner-backup', scopes: ['company']},
    {id: 'company-accounts', source: 'owner-backup', scopes: ['company-account']},
    {id: 'company-account-attachments', source: 'owner-backup', scopes: ['company-account-attachment']},
    {id: 'deadlines', source: 'owner-backup', scopes: ['deadline']},
    {id: 'contacts', source: 'owner-backup', scopes: ['contact']},
    {id: 'profile-widgets', source: 'owner-backup', scopes: ['profile-widget']},
    {id: 'account-widgets', source: 'owner-backup', scopes: ['private-account-widget', 'company-account-widget']},
    {id: 'account-widget-profiles', source: 'owner-backup', scopes: ['account-widget-profile']},
    {id: 'shared-vault-data', source: 'owner-backup', scopes: ['shared-vault-data']},
    {id: 'shared-vault-links', source: 'owner-backup', scopes: ['shared-vault-data-link']},
    {id: 'profile-document-attachments', source: 'census', scopes: ['profile-document-attachment']},
    {id: 'sharing-identity', source: 'census', scopes: []},
    {id: 'received-deadlines', source: 'not-covered', reason: 'condivisioni ricevute: non enumerate da collectOwnerBackup'},
    {id: 'received-shares', source: 'not-covered', reason: 'dati condivisi da altri utenti: dipendono dalla sola identità di condivisione'},
    {id: 'company-other-collections', source: 'not-covered', reason: 'sottoraccolte aziendali diverse da accounts: non enumerate'},
    {id: 'operational-records', source: 'not-covered', reason: 'pushDevices, notificationDeliveries, deadlineNotifications, operationResults, auditEvents: record operativi'},
    {id: 'local-copies', source: 'not-covered', reason: 'copie locali (localStorage, IndexedDB, cache offline): fuori perimetro di questa fase'},
    {id: 'external-backups', source: 'not-covered', reason: 'file di backup e capsule fuori dal browser: non selezionati'}
]);

const SCOPE_TO_AREA = new Map(CENSUS_AREAS.flatMap(area => area.scopes?.map(scope => [scope, area.id]) || []));
const ATTACHMENT_SCOPES = new Set(['private-account-attachment', 'company-account-attachment', 'profile-document-attachment']);
const ARCHIVABLE_SCOPES = new Set(['private-account', 'company-account']);
// Sottoalberi tecnici non classificati come campi: hanno controlli dedicati.
const SKIPPED_KEYS = new Set(['encryption']);
const BASE64_CIPHER = /^[A-Za-z0-9+/]+={0,2}$/;
const FIELD_V2_PREFIX = 'CPFE2.';

export function parseKeyMaterial(vaultKeyMaterial) {
    const value = String(vaultKeyMaterial || '');
    if (!value) throw new Error('CENSUS_KEY_MATERIAL_REQUIRED');
    if (!value.startsWith('CPVK2:')) return {kind: 'raw', full: value, primary: value, legacy: null};
    let keyring;
    try {
        const binary = atob(value.slice(6));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        keyring = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    } catch (error) {
        throw new Error('CENSUS_KEYRING_INVALID');
    }
    if (typeof keyring?.primaryKey !== 'string' || !keyring.primaryKey) throw new Error('CENSUS_KEYRING_INVALID');
    const legacy = typeof keyring.legacyKey === 'string' && keyring.legacyKey ? keyring.legacyKey : null;
    return {kind: 'keyring', full: value, primary: keyring.primaryKey, legacy};
}

// Classificazione sintattica, allineata a isEncryptedValue di crypto-utils.
export function classifyFieldValue(value) {
    if (typeof value !== 'string' || value === '') return 'empty';
    if (value.startsWith(FIELD_V2_PREFIX)) return 'cpfe2';
    if (value.length >= 30 && BASE64_CIPHER.test(value)) return 'v1';
    return 'plain';
}

function emptyFieldCounters() {
    return {
        plain: 0, empty: 0,
        cpfe2: {primary: 0, legacy: 0, none: 0, malformed: 0},
        v1: {primary: 0, legacy: 0, none: 0, malformed: 0}
    };
}

function emptyAttachmentCounters() {
    return {
        total: 0, chunked: 0, bytesKnown: 0, bytesUnknown: 0,
        opensFull: 0, opensWithPrimaryAlone: 0, needsFullKeyring: 0, none: 0, invalid: 0
    };
}

function createAreaEntry(area) {
    if (area.source === 'not-covered') return {id: area.id, status: 'non-censita', reason: area.reason};
    return {
        id: area.id, status: 'censita', records: 0, archived: 0, read: 0, classified: 0, errors: 0, omitted: 0,
        fields: emptyFieldCounters(),
        ...(area.id.endsWith('attachments') ? {attachments: emptyAttachmentCounters()} : {})
    };
}

// Visita le foglie stringa del valore codificato da encodeFirestoreValue.
function collectStringLeaves(value, out) {
    if (typeof value === 'string') { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(item => collectStringLeaves(item, out)); return; }
    if (!value || typeof value !== 'object') return;
    if (typeof value.$type === 'string') return; // date, timestamp, bytes: non sono campi testuali
    for (const [key, child] of Object.entries(value)) {
        if (SKIPPED_KEYS.has(key)) continue;
        collectStringLeaves(child, out);
    }
}

async function probeAgainst(probe, value, keys) {
    // Candidati provati uno alla volta, in ordine esplicito: il primo che apre identifica la chiave.
    for (const [label, key] of keys) {
        if (!key) continue;
        const result = await probe(value, key);
        if (result === 'malformed') return 'malformed';
        if (result === 'opened') return label;
    }
    return 'none';
}

export function createCensusRunner({keyMaterial, probes, check = () => {}, onProgress = () => {}}) {
    if (!probes?.field || !probes?.attachment || !probes?.identity) throw new Error('CENSUS_PROBES_REQUIRED');
    const material = parseKeyMaterial(keyMaterial);
    const keys = [['primary', material.primary], ['legacy', material.legacy]];
    const areas = new Map(CENSUS_AREAS.map(area => [area.id, createAreaEntry(area)]));
    const anomalies = [];
    const unknownScopes = new Map();
    let processed = 0;
    let security = null;

    const noteAnomaly = (area, index, type) => { anomalies.push({area, index, type}); };

    async function classifyRecordFields(entry, data, index) {
        const leaves = [];
        collectStringLeaves(data, leaves);
        for (const leaf of leaves) {
            check();
            const kind = classifyFieldValue(leaf);
            entry.read++;
            if (kind === 'empty' || kind === 'plain') { entry.fields[kind]++; entry.classified++; continue; }
            const outcome = await probeAgainst(probes.field, leaf, keys);
            entry.fields[kind][outcome]++;
            entry.classified++;
            if (outcome === 'legacy') noteAnomaly(entry.id, index, `${kind}-legacy`);
            else if (outcome === 'none' && kind === 'cpfe2') noteAnomaly(entry.id, index, 'cpfe2-unopened');
            else if (outcome === 'malformed' && kind === 'cpfe2') noteAnomaly(entry.id, index, 'cpfe2-malformed');
        }
    }

    async function classifyAttachment(entry, encryption, size, index) {
        const counters = entry.attachments;
        counters.total++;
        if (Number.isFinite(size) && size >= 0) counters.bytesKnown += size; else counters.bytesUnknown++;
        if (!encryption || typeof encryption !== 'object') { counters.invalid++; noteAnomaly(entry.id, index, 'attachment-encryption-missing'); return; }
        if (encryption.chunked === true) counters.chunked++;
        check();
        const full = await probes.attachment(encryption, material.full);
        check();
        const primaryOnly = material.kind === 'raw' ? full : await probes.attachment(encryption, material.primary);
        if (full === 'invalid') { counters.invalid++; noteAnomaly(entry.id, index, 'attachment-encryption-invalid'); return; }
        if (full !== 'opened') { counters.none++; noteAnomaly(entry.id, index, 'attachment-unopened'); return; }
        counters.opensFull++;
        if (primaryOnly === 'opened') counters.opensWithPrimaryAlone++;
        else counters.needsFullKeyring++;
    }

    function addSecurity(value) {
        const envelope = value?.vaultKeyEnvelope;
        const verifier = value?.verifier;
        security = {
            envelopePresent: Boolean(envelope),
            envelopeVersion: Number.isInteger(envelope?.version) ? envelope.version : null,
            envelopeIterations: Number.isInteger(envelope?.iterations) ? envelope.iterations : null,
            keyOrigin: ['random', 'random-with-legacy-fallback'].includes(envelope?.keyOrigin) ? envelope.keyOrigin : (envelope ? 'other' : null),
            verifierPresent: Boolean(verifier),
            verifierIterations: Number.isInteger(verifier?.iterations) ? verifier.iterations : null,
            keyringKind: material.kind,
            legacyKeyPresent: Boolean(material.legacy)
        };
    }

    return {
        material: {kind: material.kind, legacyPresent: Boolean(material.legacy)},

        async addRecord(record) {
            check();
            const scope = record?.scope;
            const areaId = SCOPE_TO_AREA.get(scope);
            if (!areaId) { unknownScopes.set(String(scope), (unknownScopes.get(String(scope)) || 0) + 1); return; }
            const entry = areas.get(areaId);
            const index = entry.records++;
            const data = record.data && typeof record.data === 'object' ? record.data : {};
            if (ARCHIVABLE_SCOPES.has(scope) && data.isArchived === true) entry.archived++;
            try {
                if (scope === 'settings' && record.id === 'security') {
                    entry.omitted++; // busta e verificatore: solo metadati, mai provati come campi
                    addSecurity(data);
                } else {
                    await classifyRecordFields(entry, data, index);
                    if (ATTACHMENT_SCOPES.has(scope)) await classifyAttachment(entry, data.encryption, data.size, index);
                }
            } catch (error) {
                if (error?.code === 'CENSUS_CANCELLED' || error?.code === 'BACKUP_SESSION_INVALIDATED') throw error;
                entry.errors++;
                noteAnomaly(areaId, index, 'record-error');
            }
            processed++;
            onProgress({processed});
        },

        addSecurity,

        async addIdentity(identity) {
            check();
            const entry = areas.get('sharing-identity');
            if (!identity?.privateEnvelope) { entry.present = false; return; }
            entry.present = true;
            entry.records = 1;
            const full = await probes.identity(identity, material.full);
            check();
            const primaryOnly = material.kind === 'raw' ? full : await probes.identity(identity, material.primary);
            entry.opensFull = full === 'opened';
            entry.opensWithPrimaryAlone = primaryOnly === 'opened';
            if (!entry.opensFull) noteAnomaly('sharing-identity', 0, 'identity-unopened');
        },

        report({generatedAt = new Date().toISOString(), durationMs = null} = {}) {
            const list = [...areas.values()].map(entry => ({...entry}));
            return {
                schema: CENSUS_SCHEMA,
                generatedAt,
                durationMs,
                security,
                areas: list,
                unknownScopes: Object.fromEntries(unknownScopes),
                anomalies: anomalies.slice(),
                notes: [
                    'Solo conteggi: nessun valore, chiave, UID o ID dei record.',
                    'Gli indici delle anomalie valgono solo per questa esecuzione.',
                    'Le aree non censite non sono contate come zero.',
                    'v1.none può includere testo in chiaro con aspetto base64 (codici, identificativi): non indica da solo dati illeggibili.'
                ]
            };
        }
    };
}
