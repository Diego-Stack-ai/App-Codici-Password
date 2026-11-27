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
const BASE64_CIPHER = /^[A-Za-z0-9+/]+={0,2}$/;
const FIELD_V2_PREFIX = 'CPFE2.';
// Chiavi esatte dei metadati prodotti da attachment-security e chunked-attachment-security.
const ATTACHMENT_ENCRYPTION_KEYS = new Set(['version', 'cipher', 'keyWrap', 'wrapSalt', 'wrapIv', 'wrappedFileKey',
    'contentIv', 'originalType', 'originalSize', 'chunked', 'chunkVersion', 'chunkBinding', 'chunkSize', 'chunkCount']);

// Candidato singolo estratto dal keyring: un oggetto, mai una stringa, così un keyring
// passato per errore non viene scambiato per una chiave, anche quando la vecchia
// Master inizia letteralmente con «CPVK2:».
export function singleCandidate(value) {
    if (typeof value !== 'string' || !value) throw new Error('CENSUS_CANDIDATE_INVALID');
    return Object.freeze({kind: 'single-candidate', value});
}

export function parseKeyMaterial(vaultKeyMaterial) {
    const value = String(vaultKeyMaterial || '');
    if (!value) throw new Error('CENSUS_KEY_MATERIAL_REQUIRED');
    if (!value.startsWith('CPVK2:')) {
        return {kind: 'raw', full: value, primary: singleCandidate(value), primaryRaw: value, legacy: null};
    }
    let keyring;
    try {
        const binary = atob(value.slice(6));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        keyring = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    } catch (error) {
        throw new Error('CENSUS_KEYRING_INVALID');
    }
    if (typeof keyring?.primaryKey !== 'string' || !keyring.primaryKey) throw new Error('CENSUS_KEYRING_INVALID');
    const legacy = typeof keyring.legacyKey === 'string' && keyring.legacyKey ? singleCandidate(keyring.legacyKey) : null;
    return {kind: 'keyring', full: value, primary: singleCandidate(keyring.primaryKey), primaryRaw: keyring.primaryKey, legacy};
}

// Classificazione sintattica, allineata a isEncryptedValue di crypto-utils.
export function classifyFieldValue(value) {
    if (typeof value !== 'string' || value === '') return 'empty';
    if (value.startsWith(FIELD_V2_PREFIX)) return 'cpfe2';
    if (value.length >= 30 && BASE64_CIPHER.test(value)) return 'v1';
    return 'plain';
}

// Valori non testuali prodotti da encodeFirestoreValue: riconosciuti dalla forma esatta,
// non dal solo nome «$type».
export function isEncodedTypedValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort().join(',');
    if (value.$type === 'date') return keys === '$type,value' && typeof value.value === 'string' && !Number.isNaN(Date.parse(value.value));
    if (value.$type === 'timestamp') return keys === '$type,nanoseconds,seconds' && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds);
    if (value.$type === 'bytes') return keys === '$type,value' && Array.isArray(value.value) && value.value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255);
    return false;
}

// Metadati di cifratura di un allegato: solo al livello radice dei record allegato
// e solo con la forma di attachment-security (version 1, AES-GCM-256, chiave avvolta).
export function isAttachmentEncryptionMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.version !== 1 || value.cipher !== 'AES-GCM-256' || typeof value.wrappedFileKey !== 'string') return false;
    return Object.keys(value).every(key => ATTACHMENT_ENCRYPTION_KEYS.has(key));
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
        id: area.id, status: 'censita', records: 0, archived: 0, read: 0, classified: 0, errors: 0,
        omitted: {securityDocument: 0, attachmentEncryptionMetadata: 0, typedValues: 0},
        fields: emptyFieldCounters(),
        ...(area.id.endsWith('attachments') ? {attachments: emptyAttachmentCounters()} : {})
    };
}

// Visita le foglie stringa del valore codificato. Le omissioni sono contate, mai silenziose.
function collectStringLeaves(value, out, omitted) {
    if (typeof value === 'string') { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(item => collectStringLeaves(item, out, omitted)); return; }
    if (!value || typeof value !== 'object') return;
    if (isEncodedTypedValue(value)) { omitted.typedValues++; return; }
    for (const child of Object.values(value)) collectStringLeaves(child, out, omitted);
}

const isCancellation = error => error?.code === 'CENSUS_CANCELLED' || error?.code === 'BACKUP_SESSION_INVALIDATED';

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

    // Ogni prova parte solo con sessione valida e il suo esito vale solo se la sessione
    // è ancora valida al ritorno: altrimenti viene scartato e il censimento termina.
    async function guarded(run) {
        check();
        const result = await run();
        check();
        return result;
    }

    async function probeAgainst(value) {
        for (const [label, candidate] of keys) {
            if (!candidate) continue;
            const result = await guarded(() => probes.field(value, candidate));
            if (result === 'malformed') return 'malformed';
            if (result === 'opened') return label;
        }
        return 'none';
    }

    async function classifyRecordFields(entry, data, index, scope) {
        const leaves = [];
        let source = data;
        if (ATTACHMENT_SCOPES.has(scope) && isAttachmentEncryptionMetadata(data.encryption)) {
            const {encryption: _metadata, ...rest} = data;
            source = rest;
            entry.omitted.attachmentEncryptionMetadata++;
        }
        collectStringLeaves(source, leaves, entry.omitted);
        for (const leaf of leaves) {
            check();
            const kind = classifyFieldValue(leaf);
            if (kind === 'empty' || kind === 'plain') { entry.read++; entry.fields[kind]++; entry.classified++; continue; }
            const outcome = await probeAgainst(leaf);
            entry.read++;
            entry.fields[kind][outcome]++;
            entry.classified++;
            if (outcome === 'legacy') noteAnomaly(entry.id, index, `${kind}-legacy`);
            else if (outcome === 'none' && kind === 'cpfe2') noteAnomaly(entry.id, index, 'cpfe2-unopened');
            else if (outcome === 'malformed' && kind === 'cpfe2') noteAnomaly(entry.id, index, 'cpfe2-malformed');
        }
    }

    async function classifyAttachment(entry, encryption, size, index) {
        const counters = entry.attachments;
        if (!encryption || typeof encryption !== 'object') {
            counters.total++; counters.invalid++; tallySize(counters, size);
            noteAnomaly(entry.id, index, 'attachment-encryption-missing');
            return;
        }
        const full = await guarded(() => probes.attachment(encryption, material.full));
        const primaryAlone = material.kind === 'raw' ? full : await guarded(() => probes.attachment(encryption, material.primaryRaw));
        counters.total++;
        tallySize(counters, size);
        if (encryption.chunked === true) counters.chunked++;
        if (full === 'invalid') { counters.invalid++; noteAnomaly(entry.id, index, 'attachment-encryption-invalid'); return; }
        if (full !== 'opened') { counters.none++; noteAnomaly(entry.id, index, 'attachment-unopened'); return; }
        counters.opensFull++;
        if (primaryAlone === 'opened') counters.opensWithPrimaryAlone++;
        else counters.needsFullKeyring++;
    }

    function tallySize(counters, size) {
        if (Number.isFinite(size) && size >= 0) counters.bytesKnown += size; else counters.bytesUnknown++;
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
                    entry.omitted.securityDocument++; // busta e verificatore: solo metadati, mai provati come campi
                    addSecurity(data);
                } else {
                    await classifyRecordFields(entry, data, index, scope);
                    if (ATTACHMENT_SCOPES.has(scope)) await classifyAttachment(entry, data.encryption, data.size, index);
                }
            } catch (error) {
                if (isCancellation(error)) throw error;
                entry.errors++;
                noteAnomaly(areaId, index, 'record-error');
            }
            check();
            processed++;
            onProgress({processed});
        },

        addSecurity,

        async addIdentity(identity) {
            check();
            const entry = areas.get('sharing-identity');
            if (!identity?.privateEnvelope) { entry.present = false; return; }
            const full = await guarded(() => probes.identity(identity, material.full));
            const primaryAlone = material.kind === 'raw' ? full : await guarded(() => probes.identity(identity, material.primaryRaw));
            entry.present = true;
            entry.records = 1;
            entry.opensFull = full === 'opened';
            entry.opensWithPrimaryAlone = primaryAlone === 'opened';
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
                    'omitted elenca ciò che non è stato classificato come campo: documento di sicurezza, metadati di cifratura degli allegati, valori tipizzati (date, timestamp, byte).',
                    'v1.none può includere testo in chiaro con aspetto base64 (codici, identificativi): non indica da solo dati illeggibili.'
                ]
            };
        }
    };
}
