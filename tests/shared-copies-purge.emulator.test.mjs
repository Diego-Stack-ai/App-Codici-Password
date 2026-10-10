import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc} from 'firebase/firestore';

// M7-T08 — Che cosa succede alle **copie condivise** e agli **inviti** quando un
// Account archiviato viene purgato: misura del comportamento attuale.
//
// Il banco esegue il **purge reale** (callable estratta da `functions/index.js`,
// Admin SDK sugli emulatori) su un Account con `accountWidgets`,
// `sharedVaultData`, `sharedVaultLinks` e un invito collegato, e poi misura:
//   1. per ciascun tipo: documento **rimasto**, **aggiornato** o **rimosso**;
//   2. se il contenuto è ancora **leggibile dal destinatario** secondo le Rules
//      di produzione (verificate con i contesti client dell'emulatore).
// Le Scadenze condivise seguono un **altro percorso** e sono misurate a parte.
const PROJECT_ID = 'codici-password-shared-copies-purge';
const OWNER = 'owner-shared';
const RECIPIENT_EMAIL = 'recipient@example.invalid';
const RECIPIENT = 'recipient-uid';
const BYTES = Uint8Array.from([1, 2, 3]);
let testEnv;

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, FieldValue} = requireFunctions('firebase-admin/firestore');
const {getStorage} = requireFunctions('firebase-admin/storage');
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const policy = requireFunctions('./archive-purge-service.js');
const receipts = requireFunctions('./archive-purge-receipt.js');
const purgeLock = requireFunctions('./archive-purge-global-lock.js');

process.env.STORAGE_EMULATOR_HOST ??= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;

const indexSource = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
const ownerGuardSlice = indexSource.slice(indexSource.indexOf('function requireMutationOwner('),
    indexSource.indexOf('exports.applyOfflineMutation'));
const purgeSlice = indexSource.slice(indexSource.indexOf('exports.purgeArchivedAccount'),
    indexSource.indexOf('exports.restoreBackupChunk'));

const adminApp = initializeApp({projectId: PROJECT_ID, storageBucket: PROJECT_ID}, `shared-copies-${process.pid}`);
const adminDb = getFirestore(adminApp);
const bucket = getStorage(adminApp).bucket(PROJECT_ID);

const purge = new Function('exports', 'HttpsError', 'FieldValue', 'console', 'isArchivePurgeSuspended',
    'accountPath', 'isSafeAttachmentPath', 'purgeDecision', 'planProfileReferenceCleanup', 'validatePurgeCommand',
    'assertNoExternalAccountReferences',
    'createArchivePurgeBinding', 'verifyArchivePurgeReceipt', 'onCall', 'getFirestore', 'getStorage',
    'createGlobalPurgeLockBinding', 'globalPurgeLockRef', 'acquireGlobalPurgeLock',
    'assertGlobalPurgeLockHeld', 'releaseGlobalPurgeLock',
    `${ownerGuardSlice}\n${purgeSlice}\nreturn exports.purgeArchivedAccount;`)({}, HttpsError, FieldValue,
    {log() {}, warn() {}, error() {}}, () => false, policy.accountPath, policy.isSafeAttachmentPath, policy.purgeDecision,
    policy.planProfileReferenceCleanup, policy.validatePurgeCommand,
    // Historical characterization only: the live endpoint is suspended and its
    // external-reference interlock is covered by dedicated security tests.
    () => {}, receipts.createArchivePurgeBinding,
    receipts.verifyArchivePurgeReceipt, (_options, run) => run, () => adminDb, () => ({bucket: () => bucket}),
    purgeLock.createGlobalPurgeLockBinding, purgeLock.globalPurgeLockRef, purgeLock.acquireGlobalPurgeLock,
    purgeLock.assertGlobalPurgeLockHeld, purgeLock.releaseGlobalPurgeLock);

const ACCOUNT_PATH = `users/${OWNER}/accounts/acc-1`;
const WIDGET_PATH = `users/${OWNER}/accountWidgets/widget-1`;
const SHARED_DATA_PATH = `users/${OWNER}/sharedVaultData/shared-1`;
const SHARED_LINK_PATH = `users/${OWNER}/sharedVaultLinks/link-1`;
const INVITE_PATH = 'invites/invite-1';
const DEADLINE_PATH = `users/${OWNER}/scadenze/deadline-1`;
const RECEIVED_PATH = `users/${RECIPIENT}/receivedDeadlines/share-1`;
const SHARE_INDEX_PATH = 'deadlineShares/owner-shared_deadline-1';
const LISTED_OBJECT = `${ACCOUNT_PATH}/attachments/a.pdf`;

const command = {expectedOwnerUid: OWNER, accountId: 'acc-1', operationId: 'operation-1',
    context: 'private', expectedRevision: 1, confirmation: 'DELETE_FOREVER'};

async function seed() {
    await adminDb.doc(`users/${OWNER}`).set({contactEmails: [{linkedAccountId: 'acc-1', linkedAccountCompanyId: ''}]});
    await adminDb.doc(`users/${OWNER}/accounts/acc-1`).set({nomeAccount: 'Account condiviso', isArchived: true,
        revision: 1, sharedWith: {[RECIPIENT_EMAIL]: {status: 'suspended'}}, sharedWithUids: [], sharingCycle: 2});
    await adminDb.doc(`${ACCOUNT_PATH}/attachments/att-1`).set({name: 'Allegato.pdf', storagePath: LISTED_OBJECT});
    await bucket.file(LISTED_OBJECT).save(Buffer.from(BYTES), {resumable: false,
        metadata: {contentType: 'application/pdf'}});

    // Copie lato proprietario: widget, dati condivisi e collegamento.
    await adminDb.doc(WIDGET_PATH).set({ownerId: OWNER, accountId: 'acc-1', kind: 'embedded', context: 'private',
        fields: [{label: 'Utente', value: 'synthetic'}], schemaVersion: 1});
    await adminDb.doc(SHARED_DATA_PATH).set({ownerId: OWNER, accountId: 'acc-1', schemaVersion: 2,
        payload: 'synthetic-shared-payload'});
    await adminDb.doc(SHARED_LINK_PATH).set({ownerId: OWNER, sharedDataId: 'shared-1',
        recipientEmail: RECIPIENT_EMAIL, createdAt: FieldValue.serverTimestamp()});

    // Invito collegato all'Account, nello stato deciso all'archiviazione.
    await adminDb.doc(INVITE_PATH).set({inviteId: 'invite-1', ownerId: OWNER, senderId: OWNER,
        senderEmail: 'owner@example.invalid', recipientEmail: RECIPIENT_EMAIL, accountId: 'acc-1',
        accountName: 'Account condiviso', type: 'private-account', status: 'accepted', cycle: 1,
        sharingState: 'suspended', suspendedAt: FieldValue.serverTimestamp()});

    // Scadenza condivisa: percorso diverso (indice backend + copia del destinatario).
    await adminDb.doc(DEADLINE_PATH).set({uid: OWNER, name: 'Scadenza condivisa',
        recipients: [{email: RECIPIENT_EMAIL}]});
    await adminDb.doc(SHARE_INDEX_PATH).set({ownerUid: OWNER, deadlineId: 'deadline-1',
        recipientUid: RECIPIENT, recipientEmail: RECIPIENT_EMAIL});
    await adminDb.doc(RECEIVED_PATH).set({ownerUid: OWNER, deadlineId: 'deadline-1', name: 'Scadenza condivisa',
        recipients: [{email: RECIPIENT_EMAIL}]});
}

const raw = async path => JSON.stringify((await adminDb.doc(path).get()).data() ?? null);
const has = async path => (await adminDb.doc(path).get()).exists;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => { await testEnv.clearStorage(); await deleteApp(adminApp); testEnv?.cleanup(); });

test('T-08 su emulatore: il purge rimuove Account, copie applicative e inviti', async () => {
    await seed();
    const watched = [WIDGET_PATH, SHARED_DATA_PATH, SHARED_LINK_PATH, INVITE_PATH, DEADLINE_PATH,
        RECEIVED_PATH, SHARE_INDEX_PATH];
    const before = Object.fromEntries(await Promise.all(watched.map(async path => [path, await raw(path)])));

    assert.equal((await purge({auth: {uid: OWNER}, data: command})).status, 'purged');

    // Rimosso: documento Account e sottocollezione (con i byte elencati).
    assert.equal(await has(ACCOUNT_PATH), false, 'l’Account è eliminato');
    assert.equal((await bucket.file(LISTED_OBJECT).exists())[0], false, 'i byte elencati sono eliminati');
    for (const path of [WIDGET_PATH, SHARED_DATA_PATH, SHARED_LINK_PATH, INVITE_PATH]) {
        assert.equal(await has(path), false, `${path} doveva essere rimosso`);
    }
    for (const path of [DEADLINE_PATH, RECEIVED_PATH, SHARE_INDEX_PATH]) {
        assert.equal(await has(path), true, `${path} è autonomo dall’Account e deve restare`);
        assert.equal(await raw(path), before[path]);
    }
    assert.equal((await adminDb.doc(`mutationResults/${OWNER}/operations/operation-1`).get()).data().status, 'purged');
});

test('T-08 su emulatore: al destinatario non resta leggibile l’invito dell’Account purgato', async () => {
    await seed();
    const recipient = testEnv.authenticatedContext(RECIPIENT, {email: RECIPIENT_EMAIL}).firestore();
    const stranger = testEnv.authenticatedContext('stranger-uid', {email: 'stranger@example.invalid'}).firestore();
    const owner = testEnv.authenticatedContext(OWNER, {email: 'owner@example.invalid'}).firestore();

    // Prima del purge, con l'Account archiviato, il destinatario non legge l'Account.
    await assertFails(getDoc(doc(recipient, ACCOUNT_PATH)));
    // Secondo livello della regola: anche un Account archiviato che conserva il
    // destinatario fra gli UID ammessi (forma legacy/parziale) resta illeggibile
    // proprio per `isArchived`, non solo perché l'elenco è vuoto.
    const legacyPath = `users/${OWNER}/accounts/acc-legacy`;
    await adminDb.doc(legacyPath).set({nomeAccount: 'Legacy', isArchived: true, sharedWithUids: [RECIPIENT]});
    await assertFails(getDoc(doc(recipient, legacyPath)));

    assert.equal((await purge({auth: {uid: OWNER}, data: command})).status, 'purged');

    // Copie applicative e invito sono stati eliminati.
    for (const path of [WIDGET_PATH, SHARED_DATA_PATH, SHARED_LINK_PATH]) {
        const missing = await assertSucceeds(getDoc(doc(owner, path)));
        assert.equal(missing.exists(), false);
    }
    await assertFails(getDoc(doc(recipient, INVITE_PATH)));
    await assertFails(getDoc(doc(stranger, INVITE_PATH)));
    // L'Account purgato non esiste più: il proprietario può leggerne l'assenza
    // (la lettura è consentita, il documento no), il destinatario no.
    const missing = await assertSucceeds(getDoc(doc(owner, ACCOUNT_PATH)));
    assert.equal(missing.exists(), false, 'l’Account purgato non esiste più');
    await assertFails(getDoc(doc(recipient, ACCOUNT_PATH)));
    // Scadenza condivisa: la copia del destinatario resta sua e leggibile.
    await assertSucceeds(getDoc(doc(recipient, RECEIVED_PATH)));
    await assertFails(getDoc(doc(owner, RECEIVED_PATH)));
    // Indice backend della condivisione Scadenze: chiuso a tutti i client.
    await assertFails(getDoc(doc(owner, SHARE_INDEX_PATH)));
    await assertFails(getDoc(doc(recipient, SHARE_INDEX_PATH)));
});
