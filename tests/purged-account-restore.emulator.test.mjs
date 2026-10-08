import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {getBytes, listAll, ref, uploadBytes} from 'firebase/storage';

// M7-T21 — Ripristino di un `.cpbackup` che contiene un Account **poi purgato**.
//
// Percorso reale: export reale (`backup-export-service.js` + crypto reale),
// **purge reale** (callable Admin) e **ripristino reale** (callable
// `restoreBackupChunk`, con anteprima e apply come fa il client), più il passo di
// caricamento degli allegati che il client esegue. Dati sintetici.
//
// Distinzione richiesta: la **possibilità tecnica** del ripristino è misurata
// qui; la **scelta di prodotto** sul significato del purge resta a Diego (D5).
const PROJECT_ID = 'codici-password-purged-account-restore';
const OWNER = 'owner-restore';
const OTHER = 'other-owner';
const BYTES = Uint8Array.from([9, 8, 7]);
const OBJECT_PATH = `users/${OWNER}/accounts/account-1/attachments/allegato.pdf`;
const MARKERS = {password: 'SYNTHETIC-ACCOUNT-PASSWORD', note: 'SYNTHETIC-NOTE'};
let testEnv;

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp, FieldValue} = requireFunctions('firebase-admin/firestore');
const {getStorage} = requireFunctions('firebase-admin/storage');
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const policy = requireFunctions('./archive-purge-service.js');
const purgeReceipts = requireFunctions('./archive-purge-receipt.js');
const restoreService = requireFunctions('./backup-restore-service.js');
const restoreReceipts = requireFunctions('./backup-restore-receipt.js');
const restorePreview = requireFunctions('./backup-restore-preview.js');

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cryptoApi = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-crypto.js'));
const exportModel = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-model.js'));
const exportBuffer = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-buffer.js'));
const importModel = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-import-model.js'));
const exportServiceSource = (await read('../Frontend/public/assets/js/modules/settings/backup-export-service.js'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

const indexSource = await read('../functions/index.js');
const slice = (startMarker, nextMarker) => indexSource.slice(indexSource.indexOf(startMarker),
    indexSource.indexOf(nextMarker, indexSource.indexOf(startMarker) + 1));
const ownerGuardSlice = slice('function requireMutationOwner(', 'exports.applyOfflineMutation');
const purgeSlice = slice('exports.purgeArchivedAccount', 'exports.restoreBackupChunk');
const restoreSlice = slice('exports.restoreBackupChunk', '\nexports.');
assert.ok(purgeSlice.length > 0 && restoreSlice.length > 0, 'le due callable devono essere estraibili');

process.env.STORAGE_EMULATOR_HOST ??= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;
const adminApp = initializeApp({projectId: PROJECT_ID, storageBucket: PROJECT_ID}, `purged-restore-${process.pid}`);
const adminDb = getFirestore(adminApp);
const bucket = getStorage(adminApp).bucket(PROJECT_ID);
let afterPurgeDelete;
const purgeStore = {
    collection: (...args) => adminDb.collection(...args),
    doc: (...args) => adminDb.doc(...args),
    runTransaction: (...args) => adminDb.runTransaction(...args),
    recursiveDelete: async reference => {
        await adminDb.recursiveDelete(reference);
        await afterPurgeDelete?.(reference);
    }
};

const purge = new Function('exports', 'HttpsError', 'FieldValue', 'console',
    'accountPath', 'isSafeAttachmentPath', 'purgeDecision', 'planProfileReferenceCleanup', 'validatePurgeCommand',
    'createArchivePurgeBinding', 'verifyArchivePurgeReceipt', 'onCall', 'getFirestore', 'getStorage',
    `${ownerGuardSlice}\n${purgeSlice}\nreturn exports.purgeArchivedAccount;`)({}, HttpsError, FieldValue,
    {log() {}, warn() {}, error() {}}, policy.accountPath, policy.isSafeAttachmentPath, policy.purgeDecision,
    policy.planProfileReferenceCleanup, policy.validatePurgeCommand, purgeReceipts.createArchivePurgeBinding,
    purgeReceipts.verifyArchivePurgeReceipt, (_options, run) => run, () => purgeStore, () => ({bucket: () => bucket}));

const restoreChunk = new Function('exports', 'HttpsError', 'Timestamp', 'FieldValue', 'console',
    'buildRestorePreview', 'staleRestoreIndexes', 'decodeFirestoreValue', 'restoreChunkDecision',
    'safeRestoreAudit', 'validateRestoreChunk', 'createBackupRestoreBinding', 'verifyBackupRestoreReceipt', 'preserveRestoreAuthority',
    'onCall', 'getFirestore',
    `${restoreSlice}\nreturn exports.restoreBackupChunk;`)({}, HttpsError, Timestamp, FieldValue,
    {log() {}, warn() {}, error() {}}, restorePreview.buildRestorePreview, restorePreview.staleRestoreIndexes,
    restoreService.decodeFirestoreValue, restoreService.restoreChunkDecision, restoreService.safeRestoreAudit,
    restoreService.validateRestoreChunk, restoreReceipts.createBackupRestoreBinding,
    restoreReceipts.verifyBackupRestoreReceipt, requireFunctions('./backup-restore-authority.js').preserveRestoreAuthority,
    (_options, run) => run, () => adminDb);

// ── Seed sintetico: profilo, Account archiviato con allegato, Azienda collegata ──
async function seed() {
    await adminDb.doc(`users/${OWNER}`).set({nome: 'Sintetico',
        contactEmails: [{linkedAccountId: 'account-1', linkedAccountCompanyId: '', email: 'a@example.invalid'}]});
    await adminDb.doc(`users/${OWNER}/accounts/account-1`).set({nomeAccount: 'Account sintetico',
        username: 'synthetic-user', password: MARKERS.password, note: MARKERS.note, isArchived: true, revision: 1});
    await adminDb.doc(`users/${OWNER}/accounts/account-1/attachments/att-1`)
        .set({name: 'Allegato.pdf', storagePath: OBJECT_PATH, type: 'application/pdf', size: BYTES.length});
    await bucket.file(OBJECT_PATH).save(Buffer.from(BYTES), {resumable: false,
        metadata: {contentType: 'application/pdf'}});
    await adminDb.doc(`users/${OWNER}/aziende/company-1`).set({ragioneSociale: 'Azienda sintetica',
        emails: {pec: {linkedAccountId: 'account-1', linkedAccountCompanyId: ''}}});
}

// ── Export reale con sorgenti che rispecchiano il seed ────────────────────────
function buildBackup() {
    const writes = [];
    const sink = {write: async value => { writes.push(value); }, close: async () => {}};
    const repositories = {};
    for (const name of ['listBackupCompanyAccounts', 'listBackupCompanyAttachments',
        'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupProfileWidgets',
        'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) {
        repositories[name] = async () => [];
    }
    // L'Azienda entra nel backup: è lì che vive il secondo riferimento all'Account.
    repositories.listBackupCompanies = async () => [{id: 'company-1', ragioneSociale: 'Azienda sintetica',
        emails: {pec: {linkedAccountId: 'account-1', linkedAccountCompanyId: ''}}}];
    repositories.getBackupProfile = async () => ({nome: 'Sintetico',
        contactEmails: [{linkedAccountId: 'account-1', linkedAccountCompanyId: '', email: 'a@example.invalid'}]});
    repositories.listBackupPrivateAccounts = async () => [{id: 'account-1', nomeAccount: 'Account sintetico',
        username: 'synthetic-user', password: MARKERS.password, note: MARKERS.note, isArchived: true, revision: 1}];
    repositories.listBackupPrivateAttachments = async () => [{id: 'att-1', name: 'Allegato.pdf',
        storagePath: OBJECT_PATH, type: 'application/pdf', size: BYTES.length}];
    // Each SDK read owns its buffer; export may wipe it without altering the seed.
    repositories.getBytes = async () => BYTES.slice();
    const names = Object.keys(repositories);
    const factory = new Function(...names, 'auth', 'navigator', 'window', 'onAuthStateChanged', 'addEventListener',
        'removeEventListener', 'createBackupExportBuffer', 'createBackupRecordBuffer', 'generateRecoveryKey',
        'createBackupHeader', 'deriveBackupKey', 'encryptBackupEntry', 'serializeBackupLine',
        'createProfileDescriptorFromData', 'createRecordDescriptorFromData', 'attachmentRecordScope',
        'collectStoragePaths', 'ref', 'storage', 'btoa', 'console',
        `${exportServiceSource}\nreturn {exportOwnerBackup};`);
    const module = factory(...names.map(name => repositories[name]),
        {currentUser: {uid: OWNER}}, {onLine: true},
        {showSaveFilePicker: async () => ({createWritable: async () => sink})}, () => () => {}, () => {}, () => {},
        exportBuffer.createBackupExportBuffer, exportBuffer.createBackupRecordBuffer, cryptoApi.generateRecoveryKey,
        cryptoApi.createBackupHeader, cryptoApi.deriveBackupKey, cryptoApi.encryptBackupEntry,
        cryptoApi.serializeBackupLine, exportModel.createProfileDescriptorFromData,
        exportModel.createRecordDescriptorFromData, exportModel.attachmentRecordScope, exportModel.collectStoragePaths,
        (_storage, path) => path, {}, value => Buffer.from(value, 'binary').toString('base64'), {warn() {}, log() {}});
    return {module, text: () => writes.join('')};
}

// ── Ripristino reale: anteprima per le versioni, poi apply (come il client) ────
async function applyBackup({owner = OWNER, expectedOwnerUid = OWNER} = {}) {
    const lines = backupText.trimEnd().split('\n');
    const header = cryptoApi.parseBackupLine(lines[0]);
    const envelopes = lines.slice(1).map(cryptoApi.parseBackupLine);
    const key = await cryptoApi.deriveBackupKey(header, recoveryKey, owner);
    const {entries} = await cryptoApi.verifyBackupChain({header, key, envelopes});
    const records = entries.filter(entry => entry.kind === 'record');
    const attachments = entries.filter(entry => entry.kind === 'attachment');
    const chunks = importModel.chunkRestoreRecords(records);
    const results = [];
    for (let index = 0; index < chunks.length; index += 1) {
        const preview = await restoreChunk({auth: {uid: owner}, data: {
            expectedOwnerUid, operationId: `restore:${header.backupId}:preview:${index}`, backupId: header.backupId,
            chunkIndex: index, chunkCount: chunks.length, mode: 'preview', records: chunks[index]}});
        const versions = preview.entries;
        const applied = await restoreChunk({auth: {uid: owner}, data: {
            expectedOwnerUid, operationId: `restore:${header.backupId}:execution:${index}`, backupId: header.backupId,
            chunkIndex: index, chunkCount: chunks.length, mode: 'apply', overwriteExisting: true,
            confirmation: 'RESTORE_SELECTED_OVERWRITE',
            records: chunks[index].map((record, local) => ({...record, expectedVersion: versions[local].expectedVersion}))}});
        results.push(applied);
    }
    // Il client carica i byte degli allegati al percorso finale del file.
    for (const attachment of attachments) {
        await uploadBytes(ref(testEnv.authenticatedContext(owner).storage(), attachment.storagePath),
            Uint8Array.from(Buffer.from(attachment.content, 'base64')),
            {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}});
    }
    return {results, records, attachments, header};
}

let backupText = '', recoveryKey = '';
const exists = async path => (await adminDb.doc(path).get()).exists;
const data = async path => (await adminDb.doc(path).get()).data();
const command = {expectedOwnerUid: OWNER, accountId: 'account-1', operationId: 'purge:1',
    context: 'private', expectedRevision: 1, confirmation: 'DELETE_FOREVER'};

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => {
    afterPurgeDelete = undefined;
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
});
after(async () => { await testEnv.clearStorage(); await deleteApp(adminApp); testEnv?.cleanup(); });

async function exportThenPurge() {
    await seed();
    const backup = buildBackup();
    const result = await backup.module.exportOwnerBackup(OWNER);
    backupText = backup.text();
    recoveryKey = result.recoveryKey;
    const purged = await purge({auth: {uid: OWNER}, data: command});
    assert.equal(purged.status, 'purged');
    return purged;
}

test('purge preflight preserves Account, attachment bytes and references when cleanup is malformed', async () => {
    await seed();
    await adminDb.doc(`users/${OWNER}/aziende/company-1`).update({emails: []});
    await assert.rejects(purge({auth: {uid: OWNER}, data: command}), error => error.code === 'failed-precondition');
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), true);
    assert.equal(await exists(`users/${OWNER}/accounts/account-1/attachments/att-1`), true);
    assert.deepEqual(new Uint8Array((await bucket.file(OBJECT_PATH).download())[0]), BYTES);
    assert.equal((await data(`users/${OWNER}`)).contactEmails[0].linkedAccountId, 'account-1');
    assert.equal(await exists(`mutationResults/${OWNER}/operations/purge:1`), false);
    assert.equal(await exists(`users/${OWNER}/auditEvents/purge:1`), false);
});

test('injected Account recreation after delete prevents final reference cleanup in real Firestore', async () => {
    await seed();
    const restored = {nomeAccount: 'Synthetic recreated', isArchived: false, revision: 2};
    afterPurgeDelete = reference => reference.set(restored);
    await assert.rejects(purge({auth: {uid: OWNER}, data: command}),
        error => error.details?.reason === 'ARCHIVE_PURGE_ACCOUNT_RECREATED');
    assert.deepEqual(await data(`users/${OWNER}/accounts/account-1`), restored);
    assert.equal((await data(`users/${OWNER}`)).contactEmails[0].linkedAccountId, 'account-1');
    assert.equal((await data(`users/${OWNER}/aziende/company-1`)).emails.pec.linkedAccountId, 'account-1');
    assert.equal((await data(`mutationResults/${OWNER}/operations/purge:1`)).status, 'processing');
    assert.equal(await exists(`users/${OWNER}/auditEvents/purge:1`), false);
});

test('T-21 su emulatore: il ripristino ricrea l’Account purgato con allegati e riferimenti', async () => {
    await exportThenPurge();

    // Dopo il purge: documento, metadati e byte elencati sono spariti; il Profilo è ripulito.
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), false);
    assert.equal((await bucket.file(OBJECT_PATH).exists())[0], false);
    assert.equal((await data(`users/${OWNER}`)).contactEmails[0].linkedAccountId, '', 'il riferimento è stato ripulito');
    assert.equal((await data(`users/${OWNER}/aziende/company-1`)).emails.pec.linkedAccountId, '');

    const {results} = await applyBackup();

    // Il ripristino ricrea tutto ciò che il backup conteneva.
    assert.equal(results.every(result => result.status === 'applied'), true, 'tutti i chunk applicati');
    const restored = await data(`users/${OWNER}/accounts/account-1`);
    assert.equal(restored.nomeAccount, 'Account sintetico', 'l’Account è ricreato');
    assert.equal(restored.password, MARKERS.password,
        'il valore memorizzato torna identico: il backup conserva la forma scritta dal client (qui un marcatore sintetico, non un ciphertext reale)');
    assert.equal(restored.note, MARKERS.note, 'anche le note tornano identiche');
    assert.equal(restored.isArchived, true, 'torna **archiviato** come nel backup (quindi nel Cestino, non fra gli attivi)');
    assert.equal(restored.revision, 1);
    assert.equal(await exists(`users/${OWNER}/accounts/account-1/attachments/att-1`), true,
        'i metadati dell’allegato sono ricreati');
    assert.deepEqual(new Uint8Array(await getBytes(ref(testEnv.authenticatedContext(OWNER).storage(), OBJECT_PATH))),
        BYTES, 'i byte dell’allegato sono ripristinati');
    assert.equal((await data(`users/${OWNER}`)).contactEmails[0].linkedAccountId, 'account-1',
        'il riferimento nel Profilo torna al valore del backup: la pulizia del purge è annullata');
    assert.equal((await data(`users/${OWNER}/aziende/company-1`)).emails.pec.linkedAccountId, 'account-1');

    // Ricevute e registro: il purge resta `purged`, il ripristino si registra a parte.
    assert.equal((await data(`mutationResults/${OWNER}/operations/purge:1`)).status, 'purged');
    const restoreReceipts2 = (await adminDb.collection(`mutationResults/${OWNER}/operations`)
        .where('status', '==', 'applied').get()).docs.map(doc => doc.id);
    assert.equal(restoreReceipts2.some(id => id.startsWith('restore:')), true, 'la ricevuta del ripristino è scritta');
    assert.equal(await exists(`users/${OWNER}/auditEvents/purge:1`), true);
    const audits = (await adminDb.collection(`users/${OWNER}/auditEvents`).get()).docs.map(doc => doc.id);
    assert.equal(audits.some(id => id.startsWith('restore:')), true, 'anche il ripristino ha il suo evento');
});

test('T-21 su emulatore: la ricevuta di purge sopravvive e blocca una ripetizione con lo stesso id', async () => {
    await exportThenPurge();
    await applyBackup();
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), true, 'l’Account esiste di nuovo');

    // Stesso operationId: la ricevuta dice `purged` e il purge non riparte.
    const again = await purge({auth: {uid: OWNER}, data: command});
    assert.equal(again.duplicate, true, 'la ricevuta di esito rende la ripetizione un duplicato');
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), true,
        'l’Account ricreato resta: il purge con lo stesso id non lo elimina');
    // Nuovo operationId: il purge funziona di nuovo (l’Account è archiviato).
    const fresh = await purge({auth: {uid: OWNER}, data: {...command, operationId: 'purge:2'}});
    assert.equal(fresh.status, 'purged');
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), false, 'con un id nuovo l’Account viene eliminato');
});

test('T-21 su emulatore: il backup prodotto non è importabile sotto un proprietario diverso', async () => {
    await seed();
    const backup = buildBackup();
    const result = await backup.module.exportOwnerBackup(OWNER);
    backupText = backup.text();
    recoveryKey = result.recoveryKey;

    // (1) Il **file prodotto** non si apre nemmeno: il primo passo del flusso di
    // import del client è la derivazione della chiave dall'intestazione, e
    // l'intestazione è vincolata al proprietario.
    const header = cryptoApi.parseBackupLine(backupText.trimEnd().split('\n')[0]);
    await assert.rejects(cryptoApi.deriveBackupKey(header, recoveryKey, OTHER), /FORMAT/);
    assert.equal(typeof await cryptoApi.deriveBackupKey(header, recoveryKey, OWNER), 'object',
        'con il proprietario corretto la chiave si deriva');

    // (2) Anche la callable rifiuta una richiesta con `expectedOwnerUid` diverso
    // dall'utente autenticato, prima di qualunque scrittura.
    await assert.rejects(restoreChunk({auth: {uid: OTHER}, data: {expectedOwnerUid: OWNER,
        operationId: 'restore:cross:0', backupId: header.backupId, chunkIndex: 0, chunkCount: 1, mode: 'apply',
        confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: 'account-1',
            data: {nomeAccount: 'Intruso'}, expectedVersion: {exists: false}}]}}),
    error => error.details?.reason === 'BACKUP_OWNER_MISMATCH');
    assert.equal(await exists(`users/${OTHER}/accounts/account-1`), false, 'nessuna scrittura sotto l’altro proprietario');

    // (3) Con l'utente coerente i percorsi sono **derivati** dall'UID autenticato:
    // il contenuto di un backup finisce sempre sotto chi lo importa.
    const applied = await restoreChunk({auth: {uid: OTHER}, data: {expectedOwnerUid: OTHER,
        operationId: 'restore:own:0', backupId: header.backupId, chunkIndex: 0, chunkCount: 1, mode: 'apply',
        confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: 'account-1',
            data: {nomeAccount: 'Sintetico altrui'}, expectedVersion: {exists: false}}]}});
    assert.equal(applied.status, 'applied');
    assert.equal(await exists(`users/${OTHER}/accounts/account-1`), true, 'il record finisce sotto chi lo importa');
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), true, 'l’Account del proprietario originale non è toccato');
    // Un record con id non valido (tentativo di uscire dal prefisso) è rifiutato.
    await assert.rejects(restoreChunk({auth: {uid: OTHER}, data: {expectedOwnerUid: OTHER,
        operationId: 'restore:escape:0', backupId: header.backupId, chunkIndex: 0, chunkCount: 1, mode: 'apply',
        confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: '../owner-restore',
            data: {nomeAccount: 'Fuga'}, expectedVersion: {exists: false}}]}}));
});
