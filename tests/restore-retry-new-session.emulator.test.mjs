import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {getBytes, ref as storageRef, uploadBytes as storageUpload} from 'firebase/storage';

// M8-bis — «retry fra esecuzioni diverse»: che cosa succede se, dopo un ripristino
// **interrotto** (record applicati, primo upload fallito, piano bloccato), l'utente
// riapre lo **stesso** file in una **nuova** sessione di ripristino.
//
// Diagnosi del comportamento attuale, non una scelta di politica: nessun retry
// automatico, staging o compensazione. Percorso reale: `prepareBackupRestore` +
// `executeBackupRestore` (client di produzione) e callable reale
// `restoreBackupChunk`, su emulatori Firestore + Storage con dati sintetici.
const PROJECT_ID = 'codici-password-m8-retry';
// Ogni caso usa un proprietario e percorsi distinti: lo svuotamento Storage fra un
// caso e l'altro non è affidabile sull'emulatore.
let OWNER, ACCOUNT_PATH, ATTACHMENT_PATH, OBJECT_PATH;
function useOwner(uid) {
    OWNER = uid;
    ACCOUNT_PATH = `users/${uid}/accounts/account-1`;
    ATTACHMENT_PATH = `${ACCOUNT_PATH}/attachments/att-1`;
    OBJECT_PATH = `${ACCOUNT_PATH}/attachments/allegato.pdf`;
}
useOwner('owner-m8b-retry');
const BYTES = Uint8Array.from([7, 7, 7]);
const MARKER = 'SYNTHETIC-M8B-PASSWORD';
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
const adminApp = initializeApp({projectId: PROJECT_ID}, `m8b-retry-${process.pid}`);
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

// ── Export sintetico: profilo + Account con un allegato ──────────────────────
function buildBackup() {
    const writes = [];
    const sink = {write: async value => { writes.push(value); }, close: async () => {}};
    const repositories = {};
    for (const name of ['listBackupCompanies', 'listBackupCompanyAccounts', 'listBackupCompanyAttachments',
        'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupProfileWidgets',
        'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) {
        repositories[name] = async () => [];
    }
    repositories.getBackupProfile = async () => ({nome: 'Sintetico'});
    repositories.listBackupPrivateAccounts = async () => [{id: 'account-1', nomeAccount: 'Account M8-bis',
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

// Legge i byte come farebbe il client: assente ⇒ `storage/object-not-found`.
async function readBytes(fixture, path) {
    try { return {present: true, bytes: new Uint8Array(await getBytes(storageRef(fixture.storage, path)))}; }
    catch (error) { return {present: false, code: error?.code}; }
}

// Ricevute delle applicazioni: `mutationResults/{uid}/operations/{operationId}`
// (la modalità anteprima non ne scrive).
const receipts = async () => (await adminDb.collection('mutationResults').doc(OWNER).collection('operations').get())
    .docs.map(document => ({id: document.id, status: document.data().status, duplicate: document.data().duplicate}))
    .sort((left, right) => left.id.localeCompare(right.id));

const counts = plan => ({...plan.comparison.counts});
const statusOf = (plan, scope) => plan.comparison.entries.find(entry => entry.scope === scope);
const indexOf = (plan, scope) => statusOf(plan, scope).index;

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

// Sessione A: ripristino interrotto — record applicati, primo upload fallito, piano bloccato.
async function interruptedSession(file, recoveryKey) {
    const fixture = clientFixture({failUpload: true});
    const plan = await fixture.module.prepareBackupRestore(file, OWNER, recoveryKey);
    await assert.rejects(fixture.module.executeBackupRestore(plan),
        /BACKUP_STORAGE_RETRY_BLOCKED|BACKUP_RESTORE_INTERRUPTED/);
    assert.equal(await exists(ACCOUNT_PATH), true, 'l’Account è stato applicato prima dell’upload');
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH, 'il metadato dell’allegato cita il percorso');
    assert.equal((await readBytes(fixture, OBJECT_PATH)).present, false, 'i byte non esistono: riferimento senza byte');
    return {fixture, plan};
}

test('M8-bis: una nuova sessione classifica tutto «invariato» e non riprova nulla (difetto osservato)', async () => {
    useOwner('owner-m8b-retry-1');
    const {file, recoveryKey} = await backupFile();
    const {fixture: sessionA, plan: planA} = await interruptedSession(file, recoveryKey);
    assert.equal(sessionA.uploads.length, 1, 'la sessione interrotta ha tentato un caricamento');
    const appliedReceipts = await receipts();
    assert.equal(appliedReceipts.length, 1, 'la sessione interrotta ha lasciato una sola ricevuta di applicazione');
    assert.equal(appliedReceipts[0].status, 'applied');
    assert.equal(appliedReceipts[0].duplicate, false);

    // Nella stessa sessione il piano bloccato non è riprovabile, nemmeno con `retry`.
    await assert.rejects(sessionA.module.executeBackupRestore(planA, null, {retry: true}), /BACKUP_STORAGE_RETRY_BLOCKED/);
    assert.equal(sessionA.uploads.length, 1, 'nessun nuovo caricamento nella sessione bloccata');

    // Nuova sessione di ripristino, stesso file, stesso stato del Vault.
    const sessionB = clientFixture();
    const planB = await sessionB.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual(counts(planB), {missing: 0, unchanged: 3, changed: 0});
    assert.equal(planB.collisionCount, 3, 'tutti i record sono classificati come collisioni');
    assert.equal(statusOf(planB, 'private-account-attachment').status, 'unchanged',
        'anche l’allegato senza byte è classificato «invariato»');

    // Che cosa può essere selezionato o confermato: nulla.
    await assert.rejects(sessionB.module.executeBackupRestore(planB), /BACKUP_RESTORE_NOTHING_SELECTED/);
    await assert.rejects(sessionB.module.executeBackupRestore(planB, [0, 1, 2]), /BACKUP_RESTORE_NOTHING_SELECTED/);
    assert.equal(sessionB.uploads.length, 0, 'la nuova sessione non tenta alcun caricamento');

    // Stato finale: il riferimento resta senza byte e non nasce una nuova ricevuta.
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH);
    assert.deepEqual(await readBytes(sessionB, OBJECT_PATH), {present: false, code: 'storage/object-not-found'});
    assert.deepEqual(await receipts(), appliedReceipts, 'l’anteprima non persiste ricevute e non ne nascono altre');
});

test('M8-bis: controllo positivo — se un record è «mancante» la nuova sessione ripristina riferimento e byte', async () => {
    useOwner('owner-m8b-retry-2');
    const {file, recoveryKey} = await backupFile();
    await interruptedSession(file, recoveryKey);
    await adminDb.doc(ATTACHMENT_PATH).delete();

    const sessionB = clientFixture();
    const planB = await sessionB.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual(counts(planB), {missing: 1, unchanged: 2, changed: 0});
    const index = indexOf(planB, 'private-account-attachment');
    assert.equal(statusOf(planB, 'private-account-attachment').status, 'missing');

    const result = await sessionB.module.executeBackupRestore(planB, [index]);
    assert.deepEqual({...result}, {recordCount: 1, attachmentCount: 1});
    assert.equal(sessionB.uploads.length, 1, 'la nuova sessione carica i byte dell’allegato');
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH);
    assert.deepEqual((await readBytes(sessionB, OBJECT_PATH)).bytes, BYTES,
        'riferimento e byte tornano coerenti');

    // La ricevuta dell’applicazione interrotta **non** blocca la nuova sessione: due applicazioni distinte.
    const applied = await receipts();
    assert.equal(applied.length, 2);
    assert.equal(applied.every(receipt => receipt.status === 'applied' && receipt.duplicate === false), true);
    assert.notEqual(applied[0].id, applied[1].id, 'ogni esecuzione usa un proprio identificativo di operazione');
});

test('M8-bis: una nuova sessione che applica un record «modificato» non recupera i byte mancanti', async () => {
    useOwner('owner-m8b-retry-3');
    const {file, recoveryKey} = await backupFile();
    await interruptedSession(file, recoveryKey);
    await adminDb.doc(ACCOUNT_PATH).update({nomeAccount: 'Modificato dopo l’interruzione'});

    const sessionB = clientFixture();
    const planB = await sessionB.module.prepareBackupRestore(file, OWNER, recoveryKey);
    assert.deepEqual(counts(planB), {missing: 0, unchanged: 2, changed: 1});
    assert.equal(statusOf(planB, 'private-account').status, 'changed');
    assert.equal(statusOf(planB, 'private-account-attachment').status, 'unchanged');

    const result = await sessionB.module.executeBackupRestore(planB, [indexOf(planB, 'private-account')]);
    assert.deepEqual({...result}, {recordCount: 1, attachmentCount: 0});
    assert.equal(sessionB.uploads.length, 0, 'il percorso dell’allegato non è fra i record applicati');
    assert.equal((await data(ACCOUNT_PATH)).nomeAccount, 'Account M8-bis',
        'il record modificato è tornato alla versione del backup');

    // L’allegato resta un riferimento senza byte anche dopo un ripristino riuscito.
    assert.equal((await data(ATTACHMENT_PATH)).storagePath, OBJECT_PATH);
    assert.deepEqual(await readBytes(sessionB, OBJECT_PATH), {present: false, code: 'storage/object-not-found'});
});
