import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, getDocsFromServer, limit, query, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch} from 'firebase/firestore';
import {getBytes, listAll, ref, uploadBytes} from 'firebase/storage';

// M7-T27 — Prove su **Emulator reali** dei due percorsi di hard-delete:
//   1. l'Azienda preservata dal blocco intermedio del client (`deleteCompany`);
//   2. l'Account aziendale eliminato dal **purge backend** (callable reale).
// Le verifiche finali leggono l'emulatore: documenti e sottocollezioni rimasti,
// riferimenti in altri documenti, oggetti Storage prima e dopo.
const PROJECT_ID = 'codici-password-company-hard-delete';
const OWNER = 'owner-delete';
const BYTES = Uint8Array.from([7, 8, 9]);
let testEnv;

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp, FieldValue} = requireFunctions('firebase-admin/firestore');
const {getStorage} = requireFunctions('firebase-admin/storage');
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const policy = requireFunctions('./archive-purge-service.js');
const receipts = requireFunctions('./archive-purge-receipt.js');
const purgeLock = requireFunctions('./archive-purge-global-lock.js');

process.env.STORAGE_EMULATOR_HOST ??= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;

const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const indexSource = await read('../functions/index.js');
const ownerGuardSlice = indexSource.slice(indexSource.indexOf('function requireMutationOwner('),
    indexSource.indexOf('exports.applyOfflineMutation'));
const purgeSlice = indexSource.slice(indexSource.indexOf('exports.purgeArchivedAccount'),
    indexSource.indexOf('exports.restoreBackupChunk'));

// Server: Admin SDK sugli emulatori, come il backend in produzione. Il bucket
// viene allineato a quello del client (`initializeTestEnvironment`) in `before`:
// Admin e client devono scrivere nello stesso bucket dell'emulatore.
const adminApp = initializeApp({projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com`},
    `company-delete-${process.pid}`);
const adminDb = getFirestore(adminApp);
let bucket = null;
const purgeFactory = new Function('exports', 'HttpsError', 'FieldValue', 'console', 'isArchivePurgeSuspended',
    'accountPath', 'isSafeAttachmentPath', 'purgeDecision', 'planProfileReferenceCleanup', 'validatePurgeCommand',
    'assertNoExternalAccountReferences',
    'createArchivePurgeBinding', 'verifyArchivePurgeReceipt', 'onCall', 'getFirestore', 'getStorage',
    'createGlobalPurgeLockBinding', 'globalPurgeLockRef', 'acquireGlobalPurgeLock',
    'assertGlobalPurgeLockHeld', 'releaseGlobalPurgeLock',
    `${ownerGuardSlice}\n${purgeSlice}\nreturn exports.purgeArchivedAccount;`);
const purge = purgeFactory({}, HttpsError, FieldValue, {log() {}, warn() {}, error() {}},
    () => false,
    policy.accountPath, policy.isSafeAttachmentPath, policy.purgeDecision, policy.planProfileReferenceCleanup,
    policy.validatePurgeCommand, policy.assertNoExternalAccountReferences,
    receipts.createArchivePurgeBinding, receipts.verifyArchivePurgeReceipt,
    (_options, run) => run, () => adminDb, () => ({bucket: () => bucket}),
    purgeLock.createGlobalPurgeLockBinding, purgeLock.globalPurgeLockRef, purgeLock.acquireGlobalPurgeLock,
    purgeLock.assertGlobalPurgeLockHeld, purgeLock.releaseGlobalPurgeLock);

// Client: stesso codice di produzione usato dall'app, con i veri SDK web.
async function deleteCompany(uid, companyId) {
    const source = strip(await read('../Frontend/public/assets/js/modules/azienda/company-list-service.js'));
    const db = testEnv.authenticatedContext(uid).firestore();
    const factory = new Function('db', 'auth', 'collection', 'getDocsFromServer', 'limit', 'query', 'doc', 'updateDoc',
        `${source}\nreturn {deleteCompany};`);
    return factory(db, {currentUser: {uid}}, collection, getDocsFromServer, limit, query, doc, () => {}).deleteCompany(uid, companyId);
}

const exists = async path => (await adminDb.doc(path).get()).exists;
const data = async path => (await adminDb.doc(path).get()).data();
const items = async prefix => (await listAll(ref(testEnv.authenticatedContext(OWNER).storage(), prefix)))
    .items.map(item => item.name).sort();

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
    const clientStorage = testEnv.authenticatedContext(OWNER).storage();
    // Il contesto di `@firebase/rules-unit-testing` usa come bucket il **project
    // id** (non `projectId.appspot.com`): Admin e client devono coincidere,
    // altrimenti le asserzioni leggono due bucket diversi.
    const bucketName = clientStorage.app?.options?.storageBucket || PROJECT_ID;
    bucket = getStorage(adminApp).bucket(bucketName);
});
beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
});
after(async () => { await testEnv.clearStorage(); await deleteApp(adminApp); testEnv?.cleanup(); });

async function seedObject(path) {
    await bucket.file(path).save(Buffer.from(BYTES), {resumable: false,
        metadata: {contentType: 'application/pdf'}});
}

async function seedCompany(companyId, accountId, {archived = false} = {}) {
    await adminDb.doc(`users/${OWNER}/aziende/${companyId}`).set({ragioneSociale: `Azienda ${companyId}`,
        emails: {pec: {linkedAccountId: accountId, linkedAccountCompanyId: companyId, email: 'synthetic@example.invalid'}}});
    await adminDb.doc(`users/${OWNER}/aziende/${companyId}/accounts/${accountId}`)
        .set({nomeAccount: `Account ${accountId}`, isArchived: archived, revision: 1});
    const objectPath = `users/${OWNER}/aziende/${companyId}/accounts/${accountId}/attachments/allegato.pdf`;
    await adminDb.doc(`users/${OWNER}/aziende/${companyId}/accounts/${accountId}/attachments/att-1`)
        .set({name: 'Allegato.pdf', storagePath: objectPath, type: 'application/pdf'});
    await seedObject(objectPath);
    return objectPath;
}

test('T-27 Rules: direct or batched company deletion cannot bypass the client guard', async () => {
    await seedCompany('company-a', 'account-a');
    const db = testEnv.authenticatedContext(OWNER).firestore();
    const parent = doc(db, `users/${OWNER}/aziende/company-a`);
    const child = doc(db, `users/${OWNER}/aziende/company-a/accounts/account-a`);
    await assertFails(deleteDoc(parent));
    const batch = writeBatch(db); batch.delete(child); batch.delete(parent);
    await assertFails(batch.commit());
    assert.equal(await exists(`users/${OWNER}/aziende/company-a`), true);
    assert.equal(await exists(`users/${OWNER}/aziende/company-a/accounts/account-a`), true);
    await adminDb.doc(`users/${OWNER}/aziende/empty`).set({ragioneSociale: 'Synthetic empty'});
    await assertFails(deleteDoc(doc(db, `users/${OWNER}/aziende/empty`)));
});

test('T-27 Rules: owner creation, edits and descendants remain allowed, other owners denied', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    const parent = doc(db, `users/${OWNER}/aziende/company-new`);
    await assertSucceeds(setDoc(parent, {ragioneSociale: 'Synthetic'}));
    await assertSucceeds(updateDoc(parent, {ragioneSociale: 'Changed synthetic'}));
    const path = `users/${OWNER}/aziende/company-new/accounts/account-new/attachments/file`;
    await assertSucceeds(setDoc(doc(db, path), {name: 'synthetic'}));
    await assertSucceeds(deleteDoc(doc(db, path)));
    const other = testEnv.authenticatedContext('other-owner').firestore();
    await assertFails(setDoc(doc(other, `users/${OWNER}/aziende/company-new`), {}));
    await assertFails(setDoc(doc(other, path), {}));
});

test('T-27 su emulatore: il blocco client preserva Azienda, Account, byte e riferimenti', async () => {
    const objectA = await seedCompany('company-a', 'acc-a');
    const objectB = await seedCompany('company-b', 'acc-b');
    const companyFormObject = `users/${OWNER}/aziende_allegati/modulo.pdf`;
    await seedObject(companyFormObject);
    await adminDb.doc(`users/${OWNER}`).set({contactEmails: [
        {linkedAccountId: 'acc-a', linkedAccountCompanyId: 'company-a', email: 'a@example.invalid'},
        {linkedAccountId: 'acc-b', linkedAccountCompanyId: 'company-b', email: 'b@example.invalid'}]});

    await assert.rejects(deleteCompany(OWNER, 'company-a'), {code: 'COMPANY_NOT_EMPTY'});

    // Nessuna eliminazione: il documento Azienda resta con i suoi figli.
    assert.equal(await exists(`users/${OWNER}/aziende/company-a`), true, 'il documento Azienda è preservato');
    // Sottocollezione Account e metadati restano associati al genitore presente.
    assert.equal(await exists(`users/${OWNER}/aziende/company-a/accounts/acc-a`), true,
        'l’Account aziendale resta associato alla sua Azienda');
    assert.equal(await exists(`users/${OWNER}/aziende/company-a/accounts/acc-a/attachments/att-1`), true,
        'i metadati dell’allegato restano');
    assert.deepEqual(await items(`users/${OWNER}/aziende/company-a/accounts/acc-a/attachments`), ['allegato.pdf'],
        'i byte dell’Account restano nello Storage');
    assert.deepEqual(new Uint8Array(await getBytes(ref(testEnv.authenticatedContext(OWNER).storage(), objectA))), BYTES);
    assert.deepEqual(await items(`users/${OWNER}/aziende_allegati`), ['modulo.pdf'],
        'gli allegati del form Azienda restano');
    // Riferimenti: restano e puntano a un’Azienda ancora presente.
    const profile = await data(`users/${OWNER}`);
    assert.deepEqual(profile.contactEmails.map(item => item.linkedAccountCompanyId), ['company-a', 'company-b'],
        'i riferimenti nel Profilo non vengono toccati');
    // L’altra Azienda resta intatta, byte compresi.
    assert.equal(await exists(`users/${OWNER}/aziende/company-b`), true);
    assert.equal(await exists(`users/${OWNER}/aziende/company-b/accounts/acc-b/attachments/att-1`), true);
    assert.deepEqual(new Uint8Array(await getBytes(ref(testEnv.authenticatedContext(OWNER).storage(), objectB))), BYTES,
        'l’altra Azienda non è toccata');
});

test('T-27 su emulatore: il purge dell’Account aziendale è ricorsivo e non tocca altri Account', async () => {
    const listed = await seedCompany('company-a', 'acc-a', {archived: true});
    const orphan = `users/${OWNER}/aziende/company-a/accounts/acc-a/attachments/mai-elencato.pdf`;
    await seedObject(orphan);
    // Stesso id Account in un'ALTRA Azienda, con il suo oggetto e il suo riferimento.
    const otherCompanyObject = await seedCompany('company-b', 'acc-a');
    await adminDb.doc(`users/${OWNER}`).set({contactEmails: [
        {linkedAccountId: 'acc-a', linkedAccountCompanyId: 'company-a', email: 'a@example.invalid'},
        {linkedAccountId: 'acc-a', linkedAccountCompanyId: 'company-b', email: 'b@example.invalid'}]});

    const command = {expectedOwnerUid: OWNER, accountId: 'acc-a', operationId: 'operation-1',
        context: 'company', companyId: 'company-a', expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
    assert.equal((await purge({auth: {uid: OWNER}, data: command})).status, 'purged');

    // Eliminato: documento, sottocollezione (ricorsiva) e byte elencati.
    assert.equal(await exists(`users/${OWNER}/aziende/company-a/accounts/acc-a`), false);
    assert.deepEqual((await adminDb.collection(`users/${OWNER}/aziende/company-a/accounts/acc-a/attachments`).get()).docs, []);
    assert.deepEqual(await items(`users/${OWNER}/aziende/company-a/accounts/acc-a/attachments`), ['mai-elencato.pdf'],
        'un oggetto non elencato nei metadati resta');
    // L'Account omonimo dell'altra Azienda è intatto, byte e metadati.
    assert.equal(await exists(`users/${OWNER}/aziende/company-b/accounts/acc-a`), true,
        'lo stesso id Account in un’altra Azienda non viene toccato');
    assert.deepEqual(new Uint8Array(await getBytes(ref(testEnv.authenticatedContext(OWNER).storage(), otherCompanyObject))), BYTES);
    // Riferimenti: ripulita solo la coppia esatta.
    const profile = await data(`users/${OWNER}`);
    assert.equal(profile.contactEmails[0].linkedAccountId, '', 'il riferimento alla coppia esatta è azzerato');
    assert.equal(profile.contactEmails[1].linkedAccountId, 'acc-a',
        'il riferimento dello stesso Account in un’altra Azienda resta');
    // Esito del purge: ricevuta e registro.
    assert.equal((await data(`mutationResults/${OWNER}/operations/operation-1`)).status, 'purged');
    const event = await data(`users/${OWNER}/auditEvents/operation-1`);
    assert.equal(event.action, 'account-purged');
    assert.equal(event.context, 'company');
    assert.ok(event.at instanceof Timestamp);
});
