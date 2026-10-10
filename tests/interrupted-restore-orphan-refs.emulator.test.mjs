import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {getBytes, ref as storageRef, uploadBytes as storageUpload} from 'firebase/storage';

// M8 — Riferimenti ad allegati dopo un **ripristino interrotto**.
//
// Gate aperto in `docs/regole/BACKUP.md`: «dimostrare assenza di riferimenti
// orfani e confronto finale su copia non produttiva».
//
// Percorso reale: `executeBackupRestore` (client) applica i **record a blocchi
// prima degli upload** e carica gli allegati nella fase `storage`. Qui si
// interrompe **dopo** la scrittura del riferimento dell'allegato e **prima** del
// suo upload, poi si confrontano i riferimenti Firestore con gli oggetti Storage.
const PROJECT_ID = 'codici-password-m8-orphan-refs';
const OWNER = 'owner-m8';
const BYTES = Uint8Array.from([5, 5, 5]);
const OBJECT_PATH = `users/${OWNER}/accounts/account-1/attachments/allegato.pdf`;
const MARKER = 'SYNTHETIC-M8-PASSWORD';
let testEnv;

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cryptoApi = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-crypto.js'));
const importModel = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-import-model.js'));
const exportModel = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-model.js'));
const exportBuffer = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-buffer.js'));
const exportServiceSource = (await read('../Frontend/public/assets/js/modules/settings/backup-export-service.js'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const importServiceSource = (await read('../Frontend/public/assets/js/modules/settings/backup-import-service.js'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp, FieldValue} = requireFunctions('firebase-admin/firestore');
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const restoreService = requireFunctions('./backup-restore-service.js');
const restoreReceipts = requireFunctions('./backup-restore-receipt.js');
const restorePreview = requireFunctions('./backup-restore-preview.js');
const purgeLock = requireFunctions('./archive-purge-global-lock.js');

const indexSource = await read('../functions/index.js');
const restoreSlice = indexSource.slice(indexSource.indexOf('exports.restoreBackupChunk'),
    indexSource.indexOf('\nexports.', indexSource.indexOf('exports.restoreBackupChunk') + 1));
const adminApp = initializeApp({projectId: PROJECT_ID}, `m8-orphans-${process.pid}`);
const adminDb = getFirestore(adminApp);
const restoreChunk = new Function('exports', 'HttpsError', 'Timestamp', 'FieldValue', 'console',
    'buildRestorePreview', 'staleRestoreIndexes', 'decodeFirestoreValue', 'restoreChunkDecision',
    'safeRestoreAudit', 'validateRestoreChunk', 'createBackupRestoreBinding', 'verifyBackupRestoreReceipt', 'preserveRestoreAuthority',
    'assertTransactionGlobalPurgeUnlocked', 'onCall', 'getFirestore', `${restoreSlice}\nreturn exports.restoreBackupChunk;`)({}, HttpsError, Timestamp,
    FieldValue, {log() {}, warn() {}, error() {}}, restorePreview.buildRestorePreview, restorePreview.staleRestoreIndexes,
    restoreService.decodeFirestoreValue, restoreService.restoreChunkDecision, restoreService.safeRestoreAudit,
    restoreService.validateRestoreChunk, restoreReceipts.createBackupRestoreBinding,
    restoreReceipts.verifyBackupRestoreReceipt, requireFunctions('./backup-restore-authority.js').preserveRestoreAuthority,
    purgeLock.assertTransactionGlobalPurgeUnlocked, (_options, run) => run, () => adminDb);

// ── Export sintetico: profilo + Account con un allegato ──────────────────────
function buildBackup() {
    const writes = [];
    const sink = {write: async value => { writes.push(value); }, close: async () => {}};
    const repositories = {};
    for (const name of ['listBackupCompanies', 'listBackupCompanyAccounts', 'listBackupCompanyAttachments',
        'listBackupAccountWidgetProfiles', 'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupProfileWidgets',
        'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) {
        repositories[name] = async () => [];
    }
    repositories.getBackupProfile = async () => ({nome: 'Sintetico'});
    repositories.listBackupPrivateAccounts = async () => [{id: 'account-1', nomeAccount: 'Account M8',
        password: MARKER, isArchived: true, revision: 1}];
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

// ── Client reale: prepare + execute, con upload sostituibile ─────────────────
function clientFixture({failUpload = false} = {}) {
    const client = testEnv.authenticatedContext(OWNER);
    const storage = client.storage(), db = client.firestore();
    const uploads = [];
    const factory = new Function('auth', 'functions', 'storage', 'httpsCallable', 'onAuthStateChanged', 'ref',
        'getBytes', 'uploadBytes', 'decryptBackupEntry', 'deriveBackupKey', 'parseBackupLine', 'chunkRestoreRecords',
        'describeRestoreRecords', 'restoreRecordKey', 'validateBackupFooter', 'validateRestoreStoragePath',
        'collectStoragePaths', 'crypto', 'TextDecoder', 'TextEncoder', 'console', 'File', 'Blob',
        `${importServiceSource}\nreturn {prepareBackupRestore, executeBackupRestore, releaseBackupRestore};`);
    const module = factory({currentUser: {uid: OWNER}}, {}, storage,
        (_functions, name) => async (data) => {
            assert.equal(name, 'restoreBackupChunk');
            return {data: await restoreChunk({auth: {uid: OWNER}, data})};
        },
        () => () => {}, storageRef, getBytes,
        async (reference, bytes, options) => {
            uploads.push(reference.fullPath ?? String(reference));
            if (failUpload) throw new Error('SIMULATED_STORAGE_FAILURE');
            return storageUpload(reference, bytes, options);
        },
        cryptoApi.decryptBackupEntry, cryptoApi.deriveBackupKey, cryptoApi.parseBackupLine,
        importModel.chunkRestoreRecords, importModel.describeRestoreRecords, importModel.restoreRecordKey,
        importModel.validateBackupFooter, importModel.validateRestoreStoragePath, exportModel.collectStoragePaths,
        crypto, TextDecoder, TextEncoder, {warn() {}, log() {}, error() {}}, File, Blob);
    return {module, db, storage, uploads};
}

const exists = async path => (await adminDb.doc(path).get()).exists;
const data = async path => (await adminDb.doc(path).get()).data();

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => { await testEnv.clearStorage(); await deleteApp(adminApp); testEnv?.cleanup(); });

async function backupFile() {
    const backup = buildBackup();
    const result = await backup.module.exportOwnerBackup(OWNER);
    const file = new File([backup.text()], 'sintetico.cpbackup', {type: 'application/x-codici-password-backup'});
    return {file, recoveryKey: result.recoveryKey};
}

test('M8 su emulatore: upload fallito dopo i record lascia il riferimento senza byte (difetto osservato)', async () => {
    const {file, recoveryKey} = await backupFile();
    const f = clientFixture({failUpload: true});
    const plan = await f.module.prepareBackupRestore(file, OWNER, recoveryKey);
    await assert.rejects(f.module.executeBackupRestore(plan), /BACKUP_STORAGE_UNCERTAIN/);

    // I record sono stati applicati: il metadato dell'allegato **cita** un percorso…
    assert.equal(await exists(`users/${OWNER}/accounts/account-1`), true, 'l’Account è stato scritto');
    assert.equal(await exists(`users/${OWNER}/accounts/account-1/attachments/att-1`), true,
        'il metadato dell’allegato è stato scritto');
    assert.equal((await data(`users/${OWNER}/accounts/account-1/attachments/att-1`)).storagePath, OBJECT_PATH);
    // …ma l'oggetto Storage **non esiste**: riferimento senza byte.
    assert.equal(f.uploads.length, 1, 'il caricamento è stato tentato una volta');
    let missing = null;
    try { await getBytes(storageRef(f.storage, OBJECT_PATH)); } catch (error) { missing = error; }
    assert.equal(missing?.code, 'storage/object-not-found',
        'i byte non esistono: il riferimento Firestore resta orfano');
});

test('M8 su emulatore: controllo positivo, con upload riuscito riferimento e byte coincidono', async () => {
    const {file, recoveryKey} = await backupFile();
    const f = clientFixture();
    const plan = await f.module.prepareBackupRestore(file, OWNER, recoveryKey);
    await f.module.executeBackupRestore(plan);
    assert.equal(f.uploads.length, 1, 'il caricamento è stato eseguito una volta');
    const record = await data(`users/${OWNER}/accounts/account-1/attachments/att-1`);
    assert.equal(record.storagePath, OBJECT_PATH);
    assert.deepEqual(new Uint8Array(await getBytes(storageRef(f.storage, OBJECT_PATH))), BYTES,
        'con il caricamento riuscito il riferimento ha i suoi byte');
});
