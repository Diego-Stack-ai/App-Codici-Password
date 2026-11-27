import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../Frontend/public/assets/js/modules/${path}`, import.meta.url), 'utf8');
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const withoutImports = source => source.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');

const cryptoUtils = await asModule(await read('core/crypto-utils.js'));
const attachmentSecurity = await asModule(withoutImports(await read('shared/attachment-security.js')));
const sharingIdentity = await asModule(await read('core/sharing-identity.js'));
const model = await asModule(await read('settings/vault-format-census-model.js'));
const {probeFieldKey} = await asModule(await read('settings/vault-format-census-probe.js'));

const {encrypt, decrypt, createVaultKeyring, generateVaultKey, getLastCryptoError} = cryptoUtils;
const {createCensusRunner, classifyFieldValue, parseKeyMaterial, singleCandidate, CENSUS_AREAS} = model;
const one = singleCandidate;

// Dati sintetici: nessuna password o chiave reale.
const PRIMARY = generateVaultKey();
const LEGACY = 'Sintetica-Master-Vecchia-2026!';
const KEYRING = createVaultKeyring(PRIMARY, LEGACY);
const UID = 'synthetic-uid-0001';

const b64 = bytes => Buffer.from(bytes).toString('base64');

// Scrittore v1 di prova (formato storico: PBKDF2 100.000, salt‖iv‖ciphertext).
async function encryptV1(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC').trim()), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'},
        material, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(text)));
    return b64(Buffer.concat([salt, iv, ct]));
}

async function attachmentEncryption(keyMaterial) {
    const fileKey = crypto.getRandomValues(new Uint8Array(32));
    const wrap = await attachmentSecurity.wrapAttachmentFileKey(fileKey, keyMaterial);
    return {version: 1, cipher: 'AES-GCM-256', ...wrap, contentIv: b64(crypto.getRandomValues(new Uint8Array(12))),
        originalType: 'application/pdf', originalSize: 1200};
}

const realProbes = {
    field: (value, key) => probeFieldKey(value, key),
    async attachment(encryption, key) {
        try { (await attachmentSecurity.unwrapAttachmentFileKey(encryption, key)).fill(0); return 'opened'; }
        catch (error) { return error?.message === 'ATTACHMENT_ENCRYPTION_INVALID' ? 'invalid' : 'closed'; }
    },
    async identity(identity, key) {
        try { await sharingIdentity.openSharingIdentity({...identity, uid: UID, vaultKeyMaterial: key}); return 'opened'; }
        catch { return 'closed'; }
    }
};

test('classificazione sintattica allineata a isEncryptedValue', () => {
    assert.equal(classifyFieldValue(''), 'empty');
    assert.equal(classifyFieldValue(null), 'empty');
    assert.equal(classifyFieldValue('Mario'), 'plain');
    assert.equal(classifyFieldValue('CPFE2.qualcosa'), 'cpfe2');
    assert.equal(classifyFieldValue('A'.repeat(29)), 'plain');
    assert.equal(classifyFieldValue('A'.repeat(32)), 'v1');
    assert.equal(cryptoUtils.isEncryptedValue('A'.repeat(32)), true);
});

test('il materiale viene separato in primaria e legacy senza fallback', () => {
    const raw = parseKeyMaterial(PRIMARY);
    assert.equal(raw.kind, 'raw');
    assert.deepEqual(raw.primary, {kind: 'single-candidate', value: PRIMARY});
    assert.equal(raw.legacy, null);
    const parsed = parseKeyMaterial(KEYRING);
    assert.equal(parsed.kind, 'keyring');
    assert.equal(parsed.full, KEYRING);
    assert.equal(parsed.primary.value, PRIMARY);
    assert.equal(parsed.legacy.value, LEGACY);
    assert.throws(() => parseKeyMaterial('CPVK2:@@@'), /CENSUS_KEYRING_INVALID/);
    assert.throws(() => parseKeyMaterial(''), /CENSUS_KEY_MATERIAL_REQUIRED/);
});

test('probeFieldKey prova un solo candidato, senza log né stato globale', async () => {
    const cpfe2 = await encrypt('valore sintetico', PRIMARY);
    const v1Legacy = await encryptV1('valore storico', LEGACY);
    const logs = [];
    const original = {error: console.error, warn: console.warn, log: console.log};
    console.error = console.warn = console.log = (...args) => logs.push(args);
    const before = getLastCryptoError();
    try {
        assert.equal(await probeFieldKey(cpfe2, one(PRIMARY)), 'opened');
        assert.equal(await probeFieldKey(cpfe2, one(LEGACY)), 'closed');
        assert.equal(await probeFieldKey(v1Legacy, one(LEGACY)), 'opened');
        assert.equal(await probeFieldKey(v1Legacy, one(PRIMARY)), 'closed');
        assert.equal(await probeFieldKey('CPFE2.non-base64!', one(PRIMARY)), 'malformed');
        assert.equal(await probeFieldKey('A'.repeat(32), one(PRIMARY)), 'malformed');
        // Le stringhe sono sempre rifiutate: un keyring passato per errore non diventa una chiave.
        await assert.rejects(() => probeFieldKey(cpfe2, KEYRING), /PROBE_SINGLE_KEY_REQUIRED/);
        await assert.rejects(() => probeFieldKey(cpfe2, PRIMARY), /PROBE_SINGLE_KEY_REQUIRED/);
    } finally {
        Object.assign(console, original);
    }
    assert.deepEqual(logs, []);
    assert.equal(getLastCryptoError(), before);
    // Il decrypt pubblico con il keyring continua invece ad aprire entrambi i formati.
    assert.equal(await decrypt(v1Legacy, KEYRING), 'valore storico');
});

test('probeFieldKey apre esattamente ciò che decrypt apre con lo stesso singolo candidato', async () => {
    const values = [
        await encrypt('uno', PRIMARY), await encrypt('due', LEGACY),
        await encryptV1('tre', PRIMARY), await encryptV1('quattro', LEGACY),
        'CPFE2.' + Buffer.from('{"version":2}').toString('base64'), 'Q'.repeat(44), 'Q'.repeat(60)
    ];
    const original = console.error;
    console.error = () => {};
    try {
        for (const value of values) {
            for (const key of [PRIMARY, LEGACY]) {
                const result = await decrypt(value, key);
                const decryptOpens = result !== '--ERRORE--' && result !== value;
                assert.equal(await probeFieldKey(value, one(key)) === 'opened', decryptOpens);
            }
        }
    } finally {
        console.error = original;
    }
});

test('censimento di un vault legacy: formati, chiavi, archiviati, allegati e identità', async () => {
    const secretPlain = 'testo-segreto-sintetico';
    const records = [
        {kind: 'record', scope: 'profile', id: UID, data: {nome: await encrypt(secretPlain, PRIMARY), cognome: '', citta: 'Padova'}},
        {kind: 'record', scope: 'settings', id: 'security', data: {
            vaultKeyEnvelope: {version: 2, iterations: 600000, keyOrigin: 'random-with-legacy-fallback', wrappedKey: 'B'.repeat(64)},
            verifier: {version: 2, iterations: 600000, ciphertext: 'C'.repeat(64)}}},
        {kind: 'record', scope: 'private-account', id: 'acc-1', data: {password: await encryptV1(secretPlain, LEGACY), note: {testo: await encrypt('n', PRIMARY)}}},
        {kind: 'record', scope: 'private-account', id: 'acc-2', data: {isArchived: true, password: await encryptV1('x', PRIMARY), creato: {$type: 'timestamp', seconds: 1, nanoseconds: 0}}},
        {kind: 'record', scope: 'private-account-attachment', id: 'att-1', data: {size: 1200, encryption: await attachmentEncryption(KEYRING)}},
        {kind: 'record', scope: 'private-account-attachment', id: 'att-2', data: {encryption: {version: 9}}},
        {kind: 'record', scope: 'company-account', id: 'cacc-1', data: {pin: await encrypt('1234', LEGACY)}},
        {kind: 'record', scope: 'misterioso', id: 'x', data: {}}
    ];
    const identity = await sharingIdentity.createSharingIdentity({uid: UID, vaultKeyMaterial: KEYRING});
    const progress = [];
    const runner = createCensusRunner({keyMaterial: KEYRING, probes: realProbes, onProgress: p => progress.push(p.processed)});
    for (const record of records) await runner.addRecord(record);
    await runner.addIdentity(identity);
    const report = runner.report({generatedAt: '2026-11-27T00:00:00.000Z', durationMs: 1});
    const area = id => report.areas.find(entry => entry.id === id);

    assert.equal(report.schema, 'vault-format-census/v1');
    assert.deepEqual(report.security, {envelopePresent: true, envelopeVersion: 2, envelopeIterations: 600000,
        keyOrigin: 'random-with-legacy-fallback', verifierPresent: true, verifierIterations: 600000,
        keyringKind: 'keyring', legacyKeyPresent: true});
    assert.equal(area('settings').omitted.securityDocument, 1);
    assert.equal(area('settings').read, 0, 'busta e verificatore non vengono provati come campi');

    assert.deepEqual(area('profile').fields.cpfe2, {primary: 1, legacy: 0, none: 0, malformed: 0});
    assert.equal(area('profile').fields.plain, 1);
    assert.equal(area('profile').fields.empty, 1);

    const accounts = area('private-accounts');
    assert.equal(accounts.records, 2);
    assert.equal(accounts.archived, 1);
    assert.deepEqual(accounts.fields.v1, {primary: 1, legacy: 1, none: 0, malformed: 0});
    assert.equal(accounts.fields.cpfe2.primary, 1, 'campi annidati inclusi');
    assert.deepEqual(area('company-accounts').fields.cpfe2, {primary: 0, legacy: 1, none: 0, malformed: 0});

    const attachments = area('private-account-attachments').attachments;
    assert.equal(attachments.total, 2);
    assert.equal(attachments.opensFull, 1);
    assert.equal(attachments.needsFullKeyring, 1, 'la chiave di avvolgimento dipende dall\'intero keyring');
    assert.equal(attachments.opensWithPrimaryAlone, 0);
    assert.equal(attachments.invalid, 1);
    assert.equal(attachments.bytesKnown, 1200);
    assert.equal(attachments.bytesUnknown, 1);
    assert.equal(area('private-account-attachments').fields.v1.none, 0, 'i metadati encryption non sono campi');
    assert.equal(area('private-account-attachments').omitted.attachmentEncryptionMetadata, 1);
    assert.equal(accounts.omitted.typedValues, 1, 'il timestamp è un\'omissione esplicita');

    const sharing = area('sharing-identity');
    assert.equal(sharing.opensFull, true);
    assert.equal(sharing.opensWithPrimaryAlone, false);

    assert.deepEqual(report.unknownScopes, {misterioso: 1});
    assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7]);
    const types = report.anomalies.map(item => item.type).sort();
    assert.deepEqual(types, ['attachment-encryption-invalid', 'cpfe2-legacy', 'v1-legacy']);
    for (const item of report.anomalies) assert.deepEqual(Object.keys(item).sort(), ['area', 'index', 'type']);

    const serialized = JSON.stringify(report);
    for (const forbidden of [secretPlain, PRIMARY, LEGACY, UID, 'acc-1', 'att-1', 'cacc-1', '1234']) {
        assert.equal(serialized.includes(forbidden), false, `il rapporto non deve contenere ${forbidden}`);
    }
});

test('vault nuovo: allegati e identità aperti dalla sola chiave primaria', async () => {
    const runner = createCensusRunner({keyMaterial: PRIMARY, probes: realProbes});
    await runner.addRecord({kind: 'record', scope: 'company-account-attachment', id: 'a', data: {size: 10, encryption: await attachmentEncryption(PRIMARY)}});
    await runner.addIdentity(await sharingIdentity.createSharingIdentity({uid: UID, vaultKeyMaterial: PRIMARY}));
    const report = runner.report();
    const attachments = report.areas.find(entry => entry.id === 'company-account-attachments').attachments;
    assert.equal(attachments.opensWithPrimaryAlone, 1);
    assert.equal(attachments.needsFullKeyring, 0);
    assert.equal(report.areas.find(entry => entry.id === 'sharing-identity').opensWithPrimaryAlone, true);
    assert.deepEqual(report.anomalies, []);
});

test('le aree non coperte sono dichiarate, mai contate come zero', () => {
    const report = createCensusRunner({keyMaterial: PRIMARY, probes: realProbes}).report();
    const notCovered = report.areas.filter(entry => entry.status === 'non-censita');
    assert.deepEqual(notCovered.map(entry => entry.id).sort(),
        CENSUS_AREAS.filter(area => area.source === 'not-covered').map(area => area.id).sort());
    for (const entry of notCovered) {
        assert.equal(typeof entry.reason, 'string');
        assert.equal('records' in entry, false);
        assert.equal('fields' in entry, false);
    }
});

test('l\'annullamento interrompe il censimento e non diventa un errore di record', async () => {
    let calls = 0;
    const check = () => { if (++calls > 3) throw Object.assign(new Error('CENSUS_CANCELLED'), {code: 'CENSUS_CANCELLED'}); };
    const runner = createCensusRunner({keyMaterial: PRIMARY, probes: realProbes, check});
    await assert.rejects(async () => {
        for (let i = 0; i < 10; i++) {
            await runner.addRecord({kind: 'record', scope: 'contact', id: `c${i}`, data: {a: 'x', b: 'y'}});
        }
    }, /CENSUS_CANCELLED/);
    assert.equal(runner.report().areas.find(entry => entry.id === 'contacts').errors, 0);
});

test('un errore inatteso conta come errore dell\'area senza fermare il censimento', async () => {
    const probes = {...realProbes, field: async () => { throw new Error('boom'); }};
    const runner = createCensusRunner({keyMaterial: PRIMARY, probes});
    await runner.addRecord({kind: 'record', scope: 'deadline', id: 'd', data: {x: 'A'.repeat(40)}});
    await runner.addRecord({kind: 'record', scope: 'deadline', id: 'e', data: {x: 'chiaro'}});
    const entry = runner.report().areas.find(item => item.id === 'deadlines');
    assert.equal(entry.errors, 1);
    assert.equal(entry.records, 2);
    assert.equal(entry.fields.plain, 1);
});

// Servizio: import sostituiti da dipendenze sintetiche, nessuna rete.
async function loadService(context) {
    const source = withoutImports(await read('settings/vault-format-census-service.js')).replace(/^export /gm, '');
    const sandbox = vm.createContext({...context, Object, Error, Date, Promise, globalThis: context.target});
    vm.runInContext(`${source}\nthis.api = {createCensusSession, runVaultFormatCensus, createCensusProbes};`, sandbox);
    return sandbox.api;
}

function serviceContext() {
    const target = new EventTarget();
    const observers = new Set();
    const authRef = {currentUser: {uid: UID}};
    return {
        target, authRef, observers,
        context: {
            target, auth: authRef,
            onAuthStateChanged: (_auth, fn) => { observers.add(fn); return () => observers.delete(fn); },
            createCensusRunner, probeFieldKey,
            unwrapAttachmentFileKey: attachmentSecurity.unwrapAttachmentFileKey,
            openSharingIdentity: sharingIdentity.openSharingIdentity,
            collectOwnerBackup: async () => { throw new Error('non usato'); },
            listBackupProfileDocumentAttachments: async () => [],
            getBackupSharingPublicIdentity: async () => null,
            getBackupSharingPrivateIdentity: async () => null
        }
    };
}

test('la sessione si invalida con blocco Vault, uscita pagina, abort e cambio utente', async () => {
    for (const trigger of ['lock', 'pagehide', 'abort', 'auth', 'logout']) {
        const env = serviceContext();
        const api = await loadService(env.context);
        const controller = new AbortController();
        const session = api.createCensusSession(UID, {signal: controller.signal, authRef: env.authRef,
            observeAuth: env.context.onAuthStateChanged, target: env.target});
        session.check();
        if (trigger === 'lock') env.target.dispatchEvent(new Event('vault-session-locked'));
        if (trigger === 'pagehide') env.target.dispatchEvent(new Event('pagehide'));
        if (trigger === 'abort') controller.abort();
        if (trigger === 'auth') env.observers.forEach(fn => fn({uid: 'altro-utente'}));
        if (trigger === 'logout') env.authRef.currentUser = null;
        assert.throws(() => session.check(), /CENSUS_CANCELLED/, trigger);
    }
});

test('il servizio censisce record, allegati del profilo e identità senza scrivere', async () => {
    const env = serviceContext();
    const writes = [];
    const identity = await sharingIdentity.createSharingIdentity({uid: UID, vaultKeyMaterial: PRIMARY});
    Object.assign(env.context, {
        collectOwnerBackup: async (uid, options) => {
            assert.equal(uid, UID);
            assert.equal(typeof options.isActive, 'undefined');
            return {records: [{kind: 'record', scope: 'contact', id: 'c1', data: {email: await encrypt('a@b.c', PRIMARY)}}], storagePaths: []};
        },
        listBackupProfileDocumentAttachments: async () => [{id: 'p1', size: 5, encryption: await attachmentEncryption(PRIMARY)}],
        getBackupSharingPublicIdentity: async () => identity.publicIdentity,
        getBackupSharingPrivateIdentity: async () => identity.privateEnvelope,
        setDoc: () => writes.push('setDoc'), updateDoc: () => writes.push('updateDoc')
    });
    const api = await loadService(env.context);
    const report = await api.runVaultFormatCensus(UID, PRIMARY, {authRef: env.authRef,
        observeAuth: env.context.onAuthStateChanged, target: env.target});
    assert.equal(report.areas.find(entry => entry.id === 'contacts').fields.cpfe2.primary, 1);
    assert.equal(report.areas.find(entry => entry.id === 'profile-document-attachments').attachments.opensFull, 1);
    assert.equal(report.areas.find(entry => entry.id === 'sharing-identity').opensFull, true);
    assert.deepEqual(writes, []);
    assert.equal(env.observers.size, 0, 'osservatore auth rimosso a fine esecuzione');
});

test('l\'invalidazione della raccolta diventa CENSUS_CANCELLED', async () => {
    const env = serviceContext();
    env.context.collectOwnerBackup = async () => {
        throw Object.assign(new Error('BACKUP_SESSION_INVALIDATED'), {code: 'BACKUP_SESSION_INVALIDATED'});
    };
    const api = await loadService(env.context);
    await assert.rejects(() => api.runVaultFormatCensus(UID, PRIMARY, {authRef: env.authRef,
        observeAuth: env.context.onAuthStateChanged, target: env.target}), /CENSUS_CANCELLED/);
});

test('vecchia Master che inizia con «CPVK2:»: lettore normale e censimento concordano', async () => {
    const prefixedLegacy = 'CPVK2:Sintetica-Master-Storica!';
    const keyring = createVaultKeyring(PRIMARY, prefixedLegacy);
    const value = await encryptV1('storico sintetico', prefixedLegacy);
    assert.equal(await decrypt(value, keyring), 'storico sintetico');
    assert.equal(parseKeyMaterial(keyring).legacy.value, prefixedLegacy);
    assert.equal(await probeFieldKey(value, one(prefixedLegacy)), 'opened');
    await assert.rejects(() => probeFieldKey(value, prefixedLegacy), /PROBE_SINGLE_KEY_REQUIRED/);
    const runner = createCensusRunner({keyMaterial: keyring, probes: realProbes});
    await runner.addRecord({kind: 'record', scope: 'contact', id: 'c', data: {nota: value}});
    const entry = runner.report().areas.find(item => item.id === 'contacts');
    assert.deepEqual(entry.fields.v1, {primary: 0, legacy: 1, none: 0, malformed: 0});
});

test('copertura: sottoalberi legittimi chiamati $type o encryption sono classificati', async () => {
    const cipher = await encrypt('annidato', PRIMARY);
    const runner = createCensusRunner({keyMaterial: PRIMARY, probes: realProbes});
    await runner.addRecord({kind: 'record', scope: 'contact', id: 'c', data: {
        etichetta: {$type: 'nota-utente', testo: cipher},
        encryption: {preferenza: cipher},
        falsaData: {$type: 'date', value: 'non è una data'},
        creato: {$type: 'timestamp', seconds: 1, nanoseconds: 2},
        quando: {$type: 'date', value: '2026-11-27T00:00:00.000Z'},
        firma: {$type: 'bytes', value: [1, 2, 3]}
    }});
    await runner.addRecord({kind: 'record', scope: 'private-account-attachment', id: 'a', data: {
        size: 3, encryption: {...await attachmentEncryption(PRIMARY), campoSconosciuto: cipher}
    }});
    const report = runner.report();
    const contacts = report.areas.find(item => item.id === 'contacts');
    assert.equal(contacts.fields.cpfe2.primary, 2, '$type e encryption non fanno saltare i campi utente');
    assert.equal(contacts.omitted.typedValues, 3, 'solo date, timestamp e byte con forma esatta');
    assert.equal(contacts.omitted.attachmentEncryptionMetadata, 0);
    const attachments = report.areas.find(item => item.id === 'private-account-attachments');
    assert.equal(attachments.omitted.attachmentEncryptionMetadata, 0, 'metadati con chiavi inattese non vengono omessi');
    assert.equal(attachments.fields.cpfe2.primary, 1);
    assert.ok(attachments.fields.v1.none + attachments.fields.v1.malformed >= 1, 'la chiave avvolta resta visibile nei conteggi');
});

function invalidatingProbes(stage) {
    const state = {valid: true, progress: 0};
    const flip = async result => { state.valid = false; return result; };
    const probes = {
        field: (value, key) => stage === 'field' ? flip('opened') : realProbes.field(value, key),
        attachment: (encryption, key) => stage === 'attachment' ? flip('opened') : realProbes.attachment(encryption, key),
        identity: (identity, key) => stage === 'identity' ? flip('opened') : realProbes.identity(identity, key)
    };
    const check = () => { if (!state.valid) throw Object.assign(new Error('CENSUS_CANCELLED'), {code: 'CENSUS_CANCELLED'}); };
    return {state, probes, check};
}

test('una prova già avviata quando la sessione si invalida viene scartata', async () => {
    for (const stage of ['field', 'attachment', 'identity']) {
        const {state, probes, check} = invalidatingProbes(stage);
        const runner = createCensusRunner({keyMaterial: KEYRING, probes, check, onProgress: () => state.progress++});
        const run = async () => {
            if (stage === 'identity') {
                await runner.addIdentity(await sharingIdentity.createSharingIdentity({uid: UID, vaultKeyMaterial: KEYRING}));
            } else {
                await runner.addRecord({kind: 'record', scope: 'private-account-attachment', id: 'a', data: {
                    nota: stage === 'field' ? await encrypt('x', PRIMARY) : 'chiaro',
                    size: 1, encryption: await attachmentEncryption(KEYRING)}});
            }
        };
        await assert.rejects(run, /CENSUS_CANCELLED/, stage);
        state.valid = true;
        const report = runner.report();
        const attachments = report.areas.find(item => item.id === 'private-account-attachments');
        assert.equal(attachments.fields.cpfe2.primary, 0, `${stage}: esito scartato`);
        assert.equal(attachments.attachments.total, 0, `${stage}: allegato non contato`);
        assert.equal(attachments.attachments.opensFull, 0);
        assert.equal(attachments.errors, 0);
        assert.equal(report.areas.find(item => item.id === 'sharing-identity').opensFull, undefined);
        assert.equal(state.progress, 0, `${stage}: nessuna notifica di avanzamento`);
    }
});

test('servizio: blocco, uscita pagina, abort, logout e cambio utente durante una prova', async () => {
    for (const trigger of ['lock', 'pagehide', 'abort', 'logout', 'auth']) {
        const env = serviceContext();
        const controller = new AbortController();
        let started = false;
        const fire = () => {
            if (trigger === 'lock') env.target.dispatchEvent(new Event('vault-session-locked'));
            if (trigger === 'pagehide') env.target.dispatchEvent(new Event('pagehide'));
            if (trigger === 'abort') controller.abort();
            if (trigger === 'logout') env.authRef.currentUser = null;
            if (trigger === 'auth') { env.authRef.currentUser = {uid: 'altro-utente'}; env.observers.forEach(fn => fn({uid: 'altro-utente'})); }
        };
        Object.assign(env.context, {
            collectOwnerBackup: async () => ({records: [
                {kind: 'record', scope: 'contact', id: 'c1', data: {a: await encrypt('x', PRIMARY)}},
                {kind: 'record', scope: 'contact', id: 'c2', data: {a: await encrypt('y', PRIMARY)}}
            ], storagePaths: []}),
            probeFieldKey: async () => { started = true; fire(); return 'opened'; }
        });
        const api = await loadService(env.context);
        const progress = [];
        await assert.rejects(() => api.runVaultFormatCensus(UID, PRIMARY, {signal: controller.signal, authRef: env.authRef,
            observeAuth: env.context.onAuthStateChanged, target: env.target, onProgress: p => progress.push(p)}),
            /CENSUS_CANCELLED/, trigger);
        assert.equal(started, true, trigger);
        assert.deepEqual(progress, [], `${trigger}: nessun avanzamento dopo l'invalidazione`);
        assert.equal(env.observers.size, 0, `${trigger}: osservatore rimosso`);
    }
});

test('servizio: invalidazione nell\'ultimo onProgress, nessuna lettura successiva', async () => {
    for (const stage of ['records', 'profile-attachments']) {
        const env = serviceContext();
        const calls = {profileAttachments: 0, identity: 0};
        Object.assign(env.context, {
            collectOwnerBackup: async () => ({records: [
                {kind: 'record', scope: 'contact', id: 'c1', data: {a: 'chiaro'}},
                {kind: 'record', scope: 'contact', id: 'c2', data: {a: 'chiaro'}}
            ], storagePaths: []}),
            listBackupProfileDocumentAttachments: async () => {
                calls.profileAttachments++;
                return [{id: 'p1', nota: 'chiaro'}];
            },
            getBackupSharingPublicIdentity: async () => { calls.identity++; return null; },
            getBackupSharingPrivateIdentity: async () => { calls.identity++; return null; }
        });
        const api = await loadService(env.context);
        const lastProcessed = stage === 'records' ? 2 : 3;
        const onProgress = ({processed}) => {
            if (processed === lastProcessed) env.target.dispatchEvent(new Event('vault-session-locked'));
        };
        await assert.rejects(() => api.runVaultFormatCensus(UID, PRIMARY, {authRef: env.authRef,
            observeAuth: env.context.onAuthStateChanged, target: env.target, onProgress}), /CENSUS_CANCELLED/, stage);
        assert.equal(calls.profileAttachments, stage === 'records' ? 0 : 1, `${stage}: letture allegati profilo`);
        assert.equal(calls.identity, 0, `${stage}: nessuna lettura dell'identità`);
        assert.equal(env.observers.size, 0);
    }
});
