import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {getBytes, ref as storageRef, uploadBytes as storageUpload} from 'firebase/storage';

// M8-ter — «modifiche intervenute dopo l'anteprima»: controllo di versione (CAS)
// osservato sul percorso **reale** end-to-end (client di produzione
// `prepareBackupRestore` + `executeBackupRestore` e callable reale
// `restoreBackupChunk`) su emulatori Firestore + Storage con dati sintetici.
//
// Diagnosi del comportamento attuale: nessuna correzione, nessuna politica.
const PROJECT_ID = 'codici-password-m8-stale';
// Ogni caso usa proprietario e percorsi distinti (lo svuotamento Storage fra un
// caso e l'altro non è affidabile sull'emulatore).
let OWNER, ACCOUNT_PATH, ATTACHMENT_PATH, OBJECT_PATH;
function useOwner(uid) {
    OWNER = uid;
    ACCOUNT_PATH = `users/${uid}/accounts/account-1`;
    ATTACHMENT_PATH = `${ACCOUNT_PATH}/attachments/att-1`;
    OBJECT_PATH = `${ACCOUNT_PATH}/attachments/allegato.pdf`;
}
useOwner('owner-m8t-stale');
const BYTES = Uint8Array.from([9, 9, 9]);
const MARKER = 'SYNTHETIC-M8T-PASSWORD';
const CONCURRENT = 'Scritto durante l’anteprima';
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

const indexSource = await read('../functions/index.js');
const restoreSlice = indexSource.slice(indexSource.indexOf('exports.restoreBackupChunk'),
    indexSource.indexOf('\nexports.', indexSource.indexOf('exports.restoreBackupChunk') + 1));
const adminApp = initializeApp({projectId: PROJECT_ID}, `m8t-stale-${process.pid}`);
const adminDb = getFirestore(adminApp);
const restoreChunk = new Function('exports', 'HttpsError', 'Timestamp', 'FieldValue', 'console',
    'buildRestorePreview', 'staleRestoreIndexes', 'decodeFirestoreValue', 'restoreChunkDecision',
    'safeRestoreAudit', 'validateRestoreChunk', 'createBackupRestoreBinding', 'verifyBackupRestoreReceipt', 'preserveRestoreAuthority',
    'onCall', 'getFirestore', `${restoreSlice}\nreturn exports.restoreBackupChunk;`)({}, HttpsError, Timestamp,
    FieldValue, {log() {}, warn() {}, error() {}}, restorePreview.buildRestorePreview, restorePreview.staleRestoreIndexes,
    restoreService.decodeFirestoreValue, restoreService.restoreChunkDecision, restoreService.safeRestoreAudit,
    restoreService.validateRestoreChunk, restoreReceipts.createBackupRestoreBinding,
    restoreReceipts.verifyBackupRestoreReceipt, requireFunctions('./backup-restore-authority.js').preserveRestoreAuthority,
    (_options, run) => run, () => adminDb);

// ── Export sintetico: profilo + N Account + un allegato ─────────────────────
function buildBackup(accountCount = 1) {
    const writes = [];
    const sink = {write: async value => { writes.push(value); }, close: async () => {}};
    const repositories = {};
    for (const name of ['listBackupCompanies', 'listBackupCompanyAccounts', 'listBackupCompanyAttachments',
        'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupProfileWidgets',
        'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) {
        repositories[name] = async () => [];
    }
    repositories.getBackupProfile = async () => ({nome: 'Sintetico'});
    repositories.listBackupPrivateAccounts = async () => Array.from({length: accountCount}, (_unused, index) => ({
        id: `account-${index + 1}`, nomeAccount: `Account M8-ter ${index + 1}`,
        password: MARKER, isArchived: true, revision: 1}));
    repositories.listBackupPrivateAttachments = async (_uid, accountId) => accountId !== 'account-1' ? []
        : [{id: 'att-1', name: 'Allegato.pdf', storagePath: OBJECT_PATH, type: 'application/pdf', size: BYTES.length}];
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

// ── Client reale: prepare + execute, con upload reale sull'emulatore ────────
function clientFixture() {
    const client = testEnv.authenticatedContext(OWNER);
    const storage = client.storage(), db = client.firestore();
    const uploads = [];
    const factory = new Function('auth', 'functions', 'storage', 'httpsCallable', 'onAuthStateChanged', 'ref',
        'uploadBytes', 'decryptBackupEntry', 'deriveBackupKey', 'parseBackupLine', 'chunkRestoreRecords',
        'describeRestoreRecords', 'restoreRecordKey', 'validateBackupFooter', 'validateRestoreStoragePath',
        'collectStoragePaths', 'crypto', 'TextDecoder', 'TextEncoder', 'console', 'File', 'Blob',
        `${importServiceSource}\nreturn {prepareBackupRestore, executeBackupRestore, releaseBackupRestore};`);
    const module = factory({currentUser: {uid: OWNER}}, {}, storage,
        (_functions, name) => async (data) => {
            assert.equal(name, 'restoreBackupChunk');
            return {data: await restoreChunk({auth: {uid: OWNER}, data})};
        },
        () => () => {}, storageRef,
        async (reference, bytes, options) => {
            uploads.push(reference.fullPath ?? String(reference));
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
const subcollection = async path => (await adminDb.collection(path).get()).docs.length;

// Legge i byte come farebbe il client: assente ⇒ `storage/object-not-found`.
async function readBytes(fixture, path) {
    try { return {present: true, bytes: new Uint8Array(await getBytes(storageRef(fixture.storage, path)))}; }
    catch (error) { return {present: false, code: error?.code}; }
}
const receipts = () => subcollection(`mutationResults/${OWNER}/operations`);
const audits = () => subcollection(`users/${OWNER}/auditEvents`);
const indexOf = (plan, scope) => plan.comparison.entries.find(entry => entry.scope === scope).index;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => { await testEnv.clearStorage(); await deleteApp(adminApp); testEnv?.cleanup(); });

async function backupFile(accountCount = 1) {
    const backup = buildBackup(accountCount);
    const result = await backup.module.exportOwnerBackup(OWNER);
    const file = new File([backup.text()], 'sintetico.cpbackup', {type: 'application/x-codici-password-backup'});
    return {file, recoveryKey: result.recoveryKey};
}

test('M8-ter: modifica dopo l’anteprima — il chunk è rifiutato, nessuna scrittura, upload o ricevuta', async () => {
    useOwner('owner-m8t-stale-1');
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual({...plan.comparison.counts}, {missing: 3, unchanged: 0, changed: 0});
    const selected = [indexOf(plan, 'private-account'), indexOf(plan, 'private-account-attachment')];

    // Modifica concorrente **dopo** l'anteprima e **prima** dell'applicazione.
    await adminDb.doc(ACCOUNT_PATH).set({nomeAccount: CONCURRENT});
    await assert.rejects(client.module.executeBackupRestore(plan, selected), error => {
        assert.equal(error.code, 'BACKUP_PREVIEW_STALE');
        assert.equal(error.progress.confirmedChunks, 0);
        assert.equal(error.progress.attemptedChunks, 1);
        assert.equal(error.progress.mayHaveApplied, false);
        return true;
    });

    // Rifiuto, non scrittura: il valore concorrente sopravvive e nulla è stato creato.
    assert.equal((await data(ACCOUNT_PATH)).nomeAccount, CONCURRENT);
    assert.equal(await exists(ATTACHMENT_PATH), false, 'il metadato dell’allegato non è stato scritto');
    assert.equal(client.uploads.length, 0, 'nessun upload, benché un allegato fosse stato selezionato');
    assert.deepEqual(await readBytes(client, OBJECT_PATH), {present: false, code: 'storage/object-not-found'});
    assert.equal(await receipts(), 0, 'nessuna ricevuta di applicazione');
    assert.equal(await audits(), 0, 'nessun evento di audit');

    // L'anteprima è invalidata: il piano non è più utilizzabile.
    await assert.rejects(client.module.executeBackupRestore(plan, selected), /BACKUP_PLAN_INVALID/);
});

test('M8-ter: controllo positivo — senza modifica concorrente il chunk è applicato e i byte caricati', async () => {
    useOwner('owner-m8t-stale-2');
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual({...plan.comparison.counts}, {missing: 3, unchanged: 0, changed: 0});
    const selected = [indexOf(plan, 'private-account'), indexOf(plan, 'private-account-attachment')];

    const result = await client.module.executeBackupRestore(plan, selected);
    assert.deepEqual({...result}, {recordCount: 2, attachmentCount: 1});
    assert.equal((await data(ACCOUNT_PATH)).nomeAccount, 'Account M8-ter 1');
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH);
    assert.deepEqual((await readBytes(client, OBJECT_PATH)).bytes, BYTES);
    assert.equal(client.uploads.length, 1);
    assert.equal(await receipts(), 1);
    assert.equal(await audits(), 1);
});

test('M8-ter: flusso a più blocchi — un blocco applicato e il successivo rifiutato (parzialità)', async () => {
    useOwner('owner-m8t-stale-3');
    const {file, recoveryKey} = await backupFile(401);
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual({...plan.comparison.counts}, {missing: 403, unchanged: 0, changed: 0});
    assert.equal(plan.chunks.length, 2, 'due blocchi');
    assert.equal(plan.chunks[0].length, 400);
    assert.equal(plan.chunks[1].length, 3);
    // Ordine reale dell'export: profilo, poi per ogni Account il suo record e i suoi allegati.
    const lastFirstChunk = plan.comparison.entries[399], firstSecondChunk = plan.comparison.entries[400];
    assert.equal(lastFirstChunk.scope, 'private-account');
    assert.equal(firstSecondChunk.scope, 'private-account');
    const appliedPath = `users/${OWNER}/accounts/${lastFirstChunk.id}`;
    const secondChunkPath = `users/${OWNER}/accounts/${firstSecondChunk.id}`;
    assert.equal(plan.chunks[0].some(record => record.scope === 'private-account-attachment'), true,
        'il metadato dell’allegato cade nel primo blocco');
    assert.equal(plan.chunks[1].some(record => record.scope === 'private-account-attachment'), false);

    // Modifica concorrente su un record del **secondo** blocco.
    await adminDb.doc(secondChunkPath).set({nomeAccount: CONCURRENT});
    await assert.rejects(client.module.executeBackupRestore(plan), error => {
        assert.equal(error.code, 'BACKUP_PREVIEW_STALE');
        assert.equal(error.progress.confirmedChunks, 1, 'il primo blocco risulta applicato');
        assert.equal(error.progress.attemptedChunks, 2);
        assert.equal(error.progress.mayHaveApplied, true);
        return true;
    });

    // Parzialità osservata: primo blocco scritto, secondo blocco e upload fermi.
    assert.equal((await data(`users/${OWNER}/accounts/account-1`)).nomeAccount, 'Account M8-ter 1',
        'il primo blocco è stato applicato');
    assert.equal(await exists(appliedPath), true, 'l’ultimo record del primo blocco è stato applicato');
    assert.equal((await data(secondChunkPath)).nomeAccount, CONCURRENT,
        'il valore concorrente sopravvive nel blocco rifiutato');
    // Il metadato dell'allegato è nel primo blocco: il rifiuto del secondo lascia un
    // **riferimento senza byte** creato dal controllo di versione stesso.
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH,
        'il metadato dell’allegato è stato applicato con il primo blocco');
    assert.equal(client.uploads.length, 0, 'nessun upload: la fase Storage non è mai iniziata');
    assert.deepEqual(await readBytes(client, OBJECT_PATH), {present: false, code: 'storage/object-not-found'});
    assert.equal(await receipts(), 1, 'una sola ricevuta: il blocco applicato');
    assert.equal(await audits(), 1);
});
