import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {getBytes, ref as storageRef, uploadBytes as storageUpload} from 'firebase/storage';

// M8-quater — «collisioni multiple» con **selezione e conferma** del ripristino,
// osservate sul percorso **reale** end-to-end (client di produzione
// `prepareBackupRestore` + `executeBackupRestore` e callable reale
// `restoreBackupChunk`) su emulatori Firestore + Storage con dati sintetici.
//
// Diagnosi del comportamento attuale: nessuna correzione, nessuna politica.
const PROJECT_ID = 'codici-password-m8-collisions';
// Ogni caso usa proprietario e percorsi distinti (lo svuotamento Storage fra un
// caso e l'altro non è affidabile sull'emulatore).
let OWNER, ACCOUNT_PATH, ATTACHMENT_PATH, OBJECT_PATH, OBJECT2_PATH;
function useOwner(uid) {
    OWNER = uid;
    ACCOUNT_PATH = `users/${uid}/accounts/account-1`;
    ATTACHMENT_PATH = `${ACCOUNT_PATH}/attachments/att-1`;
    OBJECT_PATH = `${ACCOUNT_PATH}/attachments/allegato.pdf`;
    OBJECT2_PATH = `users/${uid}/accounts/account-2/attachments/allegato-2.pdf`;
}
useOwner('owner-m8q-collisions');
const BYTES = Uint8Array.from([11, 11, 11]);
const MARKER = 'SYNTHETIC-M8Q-PASSWORD';
const OUTSIDE = 'Modificata fuori dal backup';
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
const adminApp = initializeApp({projectId: PROJECT_ID}, `m8q-collisions-${process.pid}`);
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

// ── Export sintetico: profilo + tre Account + l'allegato del primo ──────────
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
    repositories.listBackupPrivateAccounts = async () => [1, 2, 3].map(index => ({
        id: `account-${index}`, nomeAccount: `Account M8-quater ${index}`,
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
            return storageUpload(reference, bytes, options);
        },
        cryptoApi.decryptBackupEntry, cryptoApi.deriveBackupKey, cryptoApi.parseBackupLine,
        importModel.chunkRestoreRecords, importModel.describeRestoreRecords, importModel.restoreRecordKey,
        importModel.validateBackupFooter, importModel.validateRestoreStoragePath, exportModel.collectStoragePaths,
        crypto, TextDecoder, TextEncoder, {warn() {}, log() {}, error() {}}, File, Blob);
    return {module, db, storage, uploads};
}

const accountPath = index => `users/${OWNER}/accounts/account-${index}`;
const exists = async path => (await adminDb.doc(path).get()).exists;
const data = async path => (await adminDb.doc(path).get()).data();
const stamp = async path => (await adminDb.doc(path).get()).updateTime.toMillis();
const subcollection = async path => (await adminDb.collection(path).get()).docs.length;

async function readBytes(fixture, path) {
    try { return {present: true, bytes: new Uint8Array(await getBytes(storageRef(fixture.storage, path)))}; }
    catch (error) { return {present: false, code: error?.code}; }
}
const receipts = () => subcollection(`mutationResults/${OWNER}/operations`);
const audits = () => subcollection(`users/${OWNER}/auditEvents`);
const indexOf = (plan, scope, id) => plan.comparison.entries
    .find(entry => entry.scope === scope && (!id || entry.id === id)).index;

// Stato di partenza: due destinazioni **modificate** rispetto al backup e una **invariata**.
async function seedExisting() {
    for (const index of [1, 2]) {
        await adminDb.doc(accountPath(index)).set({
            nomeAccount: `${OUTSIDE} ${index}`, password: MARKER, isArchived: true, revision: 1});
    }
    await adminDb.doc(accountPath(3)).set({
        nomeAccount: 'Account M8-quater 3', password: MARKER, isArchived: true, revision: 1});
}

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

test('M8-quater: anteprima con più collisioni — senza selezione il ripristino è rifiutato', async () => {
    useOwner('owner-m8q-collisions-1');
    await seedExisting();
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual({...plan.comparison.counts}, {missing: 2, unchanged: 1, changed: 2});
    assert.equal(plan.collisionCount, 3);
    assert.equal(plan.chunks.length, 1, 'la selezione osservata sta in un solo blocco');
    assert.equal(indexOf(plan, 'private-account', 'account-1') !== indexOf(plan, 'private-account', 'account-2'), true);
    await assert.rejects(client.module.executeBackupRestore(plan), /BACKUP_COLLISIONS/);
    assert.equal(client.uploads.length, 0);
    assert.equal(await receipts(), 0);
    assert.equal(await audits(), 0);
});

test('M8-quater: selezionato un solo modificato — gli altri record restano intatti', async () => {
    useOwner('owner-m8q-collisions-2');
    await seedExisting();
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    const untouchedStamp = await stamp(accountPath(3));

    const result = await client.module.executeBackupRestore(plan, [indexOf(plan, 'private-account', 'account-1')]);
    assert.deepEqual({...result}, {recordCount: 1, attachmentCount: 0});

    // Il selezionato torna alla versione del backup…
    assert.equal((await data(accountPath(1))).nomeAccount, 'Account M8-quater 1');
    // …l'altro modificato e l'invariato restano come erano.
    assert.equal((await data(accountPath(2))).nomeAccount, `${OUTSIDE} 2`);
    assert.equal((await data(accountPath(3))).nomeAccount, 'Account M8-quater 3');
    assert.equal(await stamp(accountPath(3)), untouchedStamp, 'il record invariato non è stato riscritto');

    // Allegati coerenti con la selezione: il metadato non era selezionato.
    assert.equal(await exists(ATTACHMENT_PATH), false);
    assert.equal(client.uploads.length, 0, 'nessun upload senza il metadato dell’allegato fra i selezionati');
    assert.deepEqual(await readBytes(client, OBJECT_PATH), {present: false, code: 'storage/object-not-found'});
    assert.equal(await receipts(), 1, 'una ricevuta per il blocco applicato');
    assert.equal(await audits(), 1);
});

test('M8-quater: selezione del modificato con il suo allegato — byte coerenti e altri record intatti', async () => {
    useOwner('owner-m8q-collisions-3');
    await seedExisting();
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    const untouchedStamp = await stamp(accountPath(3));

    const result = await client.module.executeBackupRestore(plan, [
        indexOf(plan, 'private-account', 'account-1'),
        indexOf(plan, 'private-account-attachment', 'att-1')
    ]);
    assert.deepEqual({...result}, {recordCount: 2, attachmentCount: 1});

    assert.equal((await data(accountPath(1))).nomeAccount, 'Account M8-quater 1');
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH);
    assert.deepEqual((await readBytes(client, OBJECT_PATH)).bytes, BYTES);
    assert.equal(client.uploads.length, 1);
    assert.equal((await data(accountPath(2))).nomeAccount, `${OUTSIDE} 2`);
    assert.equal(await stamp(accountPath(3)), untouchedStamp);
    assert.deepEqual(await readBytes(client, OBJECT2_PATH), {present: false, code: 'storage/object-not-found'},
        'nessun byte caricato per un Account non selezionato');
    assert.equal(await receipts(), 1);
    assert.equal(await audits(), 1);
});

test('M8-quater: un selezionato cambia ancora prima dell’applicazione — rifiuto del blocco', async () => {
    useOwner('owner-m8q-collisions-4');
    await seedExisting();
    const {file, recoveryKey} = await backupFile();
    const client = clientFixture();
    const plan = await client.module.prepareBackupRestore(file, OWNER, recoveryKey);
    const selection = [indexOf(plan, 'private-account', 'account-1'),
        indexOf(plan, 'private-account-attachment', 'att-1')];
    const untouchedStamp = await stamp(accountPath(3));

    // Il record selezionato cambia **dopo** l'anteprima e **prima** dell'applicazione.
    await adminDb.doc(accountPath(1)).update({nomeAccount: 'Cambiata di nuovo'});
    await assert.rejects(client.module.executeBackupRestore(plan, selection), error => {
        assert.equal(error.code, 'BACKUP_PREVIEW_STALE');
        assert.equal(error.progress.confirmedChunks, 0);
        assert.equal(error.progress.mayHaveApplied, false);
        return true;
    });

    assert.equal((await data(accountPath(1))).nomeAccount, 'Cambiata di nuovo', 'il valore concorrente sopravvive');
    assert.equal((await data(accountPath(2))).nomeAccount, `${OUTSIDE} 2`);
    assert.equal(await stamp(accountPath(3)), untouchedStamp);
    assert.equal(await exists(ATTACHMENT_PATH), false);
    assert.equal(client.uploads.length, 0);
    assert.equal(await receipts(), 0);
    assert.equal(await audits(), 0);
    await assert.rejects(client.module.executeBackupRestore(plan, selection), /BACKUP_PLAN_INVALID/);
});
