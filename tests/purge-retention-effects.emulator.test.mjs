import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

// M7-T13 — Che cosa resta e che cosa viene eliminato quando un Account
// archiviato è **purgato**, e che cosa la retention dei 24 mesi tocca davvero.
//
// Il banco esegue il **codice reale** di due percorsi di produzione su emulatori
// reali: la callable `purgeArchivedAccount` (estratto da `functions/index.js` con
// lo stesso metodo dei test di `functions/`) e il job `purgeExpiredAuditEvents`.
// Storage e Firestore sono quelli veri degli emulatori, con l'Admin SDK del
// runtime Functions: nessun magazzino simulato.
//
// Il censimento (§2, §3.4, §4.5 di `docs/M7_RETENTION_CENSIMENTO.md`) qui passa
// da lettura del codice a comportamento esercitato.
const PROJECT_ID = 'codici-password-purge-retention-test';
assert.match(String(process.env.FIRESTORE_EMULATOR_HOST || ''), /^127\.0\.0\.1:\d+$/,
    'il banco deve girare sull’emulatore: nessun dato reale');
// L'Admin SDK legge STORAGE_EMULATOR_HOST; la CLI Firebase esporta lo stesso
// endpoint come FIREBASE_STORAGE_EMULATOR_HOST.
process.env.STORAGE_EMULATOR_HOST ??= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp, FieldPath, FieldValue} = requireFunctions('firebase-admin/firestore');
const {getStorage} = requireFunctions('firebase-admin/storage');
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const policy = requireFunctions('./archive-purge-service.js');
const receipts = requireFunctions('./archive-purge-receipt.js');
const service = requireFunctions('./audit-retention-service.js');

const source = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
const ownerGuardSlice = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const purgeSlice = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));
const jobStart = source.indexOf('const AUDIT_RETENTION_PAGE_SIZE');
const jobEnd = source.indexOf('exports.purgeExpiredAuditEvents = onSchedule(');
assert.ok(purgeSlice.length > 0 && jobStart > 0 && jobEnd > jobStart, 'le sezioni devono essere estraibili da index.js');

const app = initializeApp({projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com`},
    `purge-retention-${process.pid}`);
const db = getFirestore(app);
const bucket = getStorage(app).bucket(`${PROJECT_ID}.appspot.com`);

// Il purge viene montato con `new Function`, quindi **nello stesso realm**
// dell'Admin SDK; `onCall` esegue direttamente il corpo della callable.
const purgeFactory = new Function('exports', 'HttpsError', 'FieldValue', 'Timestamp', 'console',
    'accountPath', 'isSafeAttachmentPath', 'purgeDecision', 'planProfileReferenceCleanup', 'validatePurgeCommand',
    'createArchivePurgeBinding', 'verifyArchivePurgeReceipt', 'onCall', 'getFirestore', 'getStorage',
    `${ownerGuardSlice}\n${purgeSlice}\nreturn exports.purgeArchivedAccount;`);
const purge = purgeFactory({}, HttpsError, FieldValue, Timestamp, {log() {}, warn() {}, error() {}},
    policy.accountPath, policy.isSafeAttachmentPath, policy.purgeDecision, policy.planProfileReferenceCleanup,
    policy.validatePurgeCommand, receipts.createArchivePurgeBinding, receipts.verifyArchivePurgeReceipt,
    (_options, run) => run, () => db, () => ({bucket: () => bucket}));

const silentConsole = {log() {}, warn() {}, error() {}};
const jobFactory = new Function('Timestamp', 'FieldPath', 'FieldValue', 'console', 'auditEventPath', 'classifyAuditEvent',
    'planAuditRetention', 'runAuditRetention', 'DEFAULT_BATCH_SIZE', 'MAX_EVENTS_PER_RUN',
    `${source.slice(jobStart, jobEnd)}\nreturn {collectExpiredAuditEvents, deleteAuditBatchWithConfirmation, runAuditRetentionJob};`);
const job = jobFactory(Timestamp, FieldPath, FieldValue, silentConsole, service.auditEventPath, service.classifyAuditEvent,
    service.planAuditRetention, service.runAuditRetention, service.DEFAULT_BATCH_SIZE, service.MAX_EVENTS_PER_RUN);

const NOW = Date.parse('2026-09-21T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const OLD = Timestamp.fromMillis(NOW - 1000 * DAY);
const RECENT = Timestamp.fromMillis(NOW - 10 * DAY);
const OWNER = 'owner-purge';
const ACCOUNT = 'account-1';
const COMPANY = 'company-1';
const OPERATION = 'operation-1';
const ACCOUNT_PATH = `users/${OWNER}/accounts/${ACCOUNT}`;
const LISTED_OBJECT = `${ACCOUNT_PATH}/attachments/listed.bin`;
const ORPHAN_OBJECT = `${ACCOUNT_PATH}/attachments/never-listed.bin`;
const COMMAND = {expectedOwnerUid: OWNER, accountId: ACCOUNT, operationId: OPERATION, context: 'private',
    expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
const receiptPath = `mutationResults/${OWNER}/operations/${OPERATION}`;
// La ricevuta legacy vive nello stesso `operationId` del comando: è quella che
// il purge legge per decidere se una cancellazione precedente è verificabile.
const legacyReceiptPath = `users/${OWNER}/archiveOperations/${OPERATION}`;
const auditPath = `users/${OWNER}/auditEvents/${OPERATION}`;
// Percorsi che **il purge** non deve toccare: collezioni sorelle, cestino
// legacy, ricevute e registro (compreso l'evento di audit precedente).
const SURVIVORS = [
    `users/${OWNER}/trash/trashed-record`,
    `users/${OWNER}/operationResults/operation-1`,
    `users/${OWNER}/accountWidgets/widget-1`,
    `users/${OWNER}/sharedVaultData/shared-1`,
    `users/${OWNER}/sharedVaultLinks/link-1`,
    legacyReceiptPath,
    `users/${OWNER}/auditEvents/previous-event`
];
// Percorsi fuori dal registro: la retention dei 24 mesi non può raggiungerli.
const NON_AUDIT_PATHS = SURVIVORS.filter(path => !path.includes('/auditEvents/'));

const exists = async path => (await db.doc(path).get()).exists;
const data = async path => (await db.doc(path).get()).data();

async function seedAll() {
    await db.doc(`users/${OWNER}`).set({
        contactEmails: [{linkedAccountId: ACCOUNT, linkedAccountCompanyId: '', note: 'synthetic'}],
        userAddresses: [{utilities: [{linkedAccountId: ACCOUNT, linkedAccountCompanyId: '', note: 'synthetic'}]}]
    });
    await db.doc(`users/${OWNER}/aziende/${COMPANY}`).set({
        emails: {pec: {linkedAccountId: ACCOUNT, linkedAccountCompanyId: '', email: 'synthetic@example.invalid'}},
        phoneAccountLinks: {telefonoAzienda: {linkedAccountId: ACCOUNT, linkedAccountCompanyId: ''}}
    });
    await db.doc(ACCOUNT_PATH).set({isArchived: true, revision: 1});
    await db.doc(`${ACCOUNT_PATH}/attachments/att-1`).set({storagePath: LISTED_OBJECT, name: 'listed.bin'});
    await bucket.file(LISTED_OBJECT).save(Buffer.from([1, 2, 3]), {resumable: false,
        metadata: {contentType: 'application/octet-stream', metadata: {encrypted: 'v1'}}});
    await bucket.file(ORPHAN_OBJECT).save(Buffer.from([9, 9, 9]), {resumable: false,
        metadata: {contentType: 'application/octet-stream', metadata: {encrypted: 'v1'}}});
    await db.doc(`users/${OWNER}/trash/trashed-record`).set({deletedAt: OLD, purgeAfterMs: NOW - DAY, payload: 'synthetic'});
    await db.doc(legacyReceiptPath).set({status: 'processing', accountId: 'unrelated-account', context: 'private'});
    await db.doc(`users/${OWNER}/operationResults/operation-1`).set({createdAt: OLD});
    await db.doc(`users/${OWNER}/accountWidgets/widget-1`).set({title: 'synthetic'});
    await db.doc(`users/${OWNER}/sharedVaultData/shared-1`).set({ownerId: OWNER});
    await db.doc(`users/${OWNER}/sharedVaultLinks/link-1`).set({recordId: 'shared-1'});
    await db.doc(`users/${OWNER}/auditEvents/previous-event`).set({action: 'trashed', actorUid: OWNER, at: OLD});
    // Una ricevuta di idempotenza **fidata** in `processing`: è il caso di ripresa.
    // Serve anche a mostrare che una ricevuta legacy presente non viene cancellata
    // ma solo scavalcata (se fosse sola, il purge si fermerebbe: caso sotto).
    await db.doc(receiptPath).set({...receipts.createArchivePurgeBinding({
        uid: OWNER, command: policy.validatePurgeCommand(COMMAND)}), status: 'processing'});
}

async function clear() {
    await db.recursiveDelete(db.collection('users'));
    await db.recursiveDelete(db.collection('mutationResults'));
    await db.recursiveDelete(db.collection('auditRetentionState'));
    for (const path of [LISTED_OBJECT, ORPHAN_OBJECT]) {
        await bucket.file(path).delete({ignoreNotFound: true});
    }
}

test.beforeEach(async () => { await clear(); await seedAll(); });
test.after(async () => { await clear(); await deleteApp(app); });

test('T-13: dopo il purge restano cestino, ricevute e registro; spariscono Account e byte elencati', async () => {
    const result = await purge({auth: {uid: OWNER}, data: COMMAND});
    assert.equal(result.status, 'purged');

    // Eliminato: il documento Account con il suo sottoalbero di metadati.
    assert.equal(await exists(ACCOUNT_PATH), false, 'il documento Account è stato eliminato');
    assert.deepEqual((await db.collection(`${ACCOUNT_PATH}/attachments`).get()).docs, [],
        'i metadati degli allegati seguono il documento Account');
    // Eliminato: solo l'oggetto elencato nei metadati.
    assert.equal((await bucket.file(LISTED_OBJECT).exists())[0], false, 'i byte elencati sono spariti');
    // Resta: un oggetto dello stesso prefisso mai elencato nei metadati (T-09/D4).
    assert.equal((await bucket.file(ORPHAN_OBJECT).exists())[0], true,
        'un oggetto non elencato non è raggiungibile dal purge');

    // Restano, invariati: cestino legacy, collezioni sorelle, ricevuta legacy,
    // evento di audit precedente.
    for (const path of SURVIVORS) {
        assert.equal(await exists(path), true, `${path} non doveva essere toccato`);
    }
    assert.equal((await data(`users/${OWNER}/trash/trashed-record`)).purgeAfterMs, NOW - DAY,
        'il cestino conserva la sua scadenza dichiarata, che nessun processo applica');
    assert.equal((await data(legacyReceiptPath)).accountId, 'unrelated-account',
        'la ricevuta legacy non viene cancellata né riscritta');

    // La ricevuta di idempotenza non viene cancellata: cambia stato in `purged`
    // ed è la prova di esito che rende la ripetizione sicura.
    assert.equal((await data(receiptPath)).status, 'purged');

    // Il registro: l'evento del purge è scritto con i campi censiti, e convive
    // con l'evento precedente.
    const event = await data(auditPath);
    assert.equal(event.action, 'account-purged');
    assert.equal(event.actorUid, OWNER);
    assert.equal(event.accountId, ACCOUNT);
    assert.equal(event.context, 'private');
    assert.ok(event.at instanceof Timestamp, 'l’evento porta un `at` Timestamp del server');

    // Pulizia dei riferimenti: Profilo e azienda perdono il collegamento esatto.
    const profile = await data(`users/${OWNER}`);
    assert.equal(profile.contactEmails[0].linkedAccountId, '');
    assert.equal(profile.contactEmails[0].linkedAccountCompanyId, '');
    assert.equal(profile.contactEmails[0].note, 'synthetic', 'gli altri campi del contatto restano');
    assert.equal(profile.userAddresses[0].utilities[0].linkedAccountId, '');
    const company = await data(`users/${OWNER}/aziende/${COMPANY}`);
    assert.equal(company.emails.pec.linkedAccountId, '');
    assert.equal(company.emails.pec.email, 'synthetic@example.invalid');
    assert.equal(company.phoneAccountLinks.telefonoAzienda.linkedAccountId, '');

    // Ripetizione: il purge non ripercorre il ramo distruttivo e non tocca più nulla.
    const again = await purge({auth: {uid: OWNER}, data: COMMAND});
    assert.equal(again.duplicate, true);
    assert.equal((await bucket.file(ORPHAN_OBJECT).exists())[0], true);
    for (const path of SURVIVORS) {
        assert.equal(await exists(path), true, `${path} doveva restare anche dopo la ripetizione`);
    }
});

test('T-13: una ricevuta legacy sola ferma il purge e lascia tutto al suo posto', async () => {
    const blocked = 'owner-legacy';
    await db.doc(`users/${blocked}`).set({});
    await db.doc(`users/${blocked}/accounts/${ACCOUNT}`).set({isArchived: true, revision: 1});
    await db.doc(`users/${blocked}/archiveOperations/${OPERATION}`).set({status: 'processing'});
    await db.doc(`users/${blocked}/trash/trashed-record`).set({deletedAt: OLD, purgeAfterMs: NOW - DAY});
    await db.doc(`users/${blocked}/auditEvents/previous-event`).set({action: 'trashed', at: OLD});

    await assert.rejects(purge({auth: {uid: blocked}, data: {...COMMAND, expectedOwnerUid: blocked}}),
        error => error.details?.reason === 'LEGACY_ARCHIVE_RESULT_UNVERIFIED');
    assert.equal(await exists(`users/${blocked}/accounts/${ACCOUNT}`), true, 'nessuna cancellazione');
    assert.equal(await exists(`users/${blocked}/trash/trashed-record`), true, 'cestino intatto');
    assert.equal(await exists(`users/${blocked}/auditEvents/previous-event`), true, 'registro intatto');
    assert.equal(await exists(`users/${blocked}/auditEvents/${OPERATION}`), false,
        'un purge rifiutato non scrive l’evento');
});

test('T-13: la retention dei 24 mesi tocca il solo registro, anche per l’evento del purge', async () => {
    const result = await purge({auth: {uid: OWNER}, data: COMMAND});
    assert.equal(result.status, 'purged');
    // Un evento di purge **vecchio** e uno recente, più i documenti delle altre
    // famiglie già presenti.
    await db.doc(`users/${OWNER}/auditEvents/old-purged`).set({action: 'account-purged', actorUid: OWNER,
        accountId: 'old-account', context: 'private', at: OLD});
    await db.doc(`users/${OWNER}/auditEvents/recent-purged`).set({action: 'account-purged', actorUid: OWNER,
        accountId: 'recent-account', context: 'private', at: RECENT});
    await db.doc(`users/${OWNER}/trash/old-trash`).set({deletedAt: OLD, purgeAfterMs: NOW - DAY});

    const report = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.status, 'completed');
    // L'evidenza del purge è un evento di audit come gli altri: scade con la
    // finestra di 24 mesi decisa per il registro.
    assert.equal(await exists(`users/${OWNER}/auditEvents/old-purged`), false,
        'l’evento di purge oltre i 24 mesi viene rimosso dal registro');
    assert.equal(await exists(`users/${OWNER}/auditEvents/recent-purged`), true);
    assert.equal(await exists(auditPath), true, 'l’evento del purge appena scritto è recente');
    // Anche l'evento precedente del registro è un evento di audit: se è più
    // vecchio di 24 mesi, la retention lo rimuove come qualunque altro.
    assert.equal(await exists(`users/${OWNER}/auditEvents/previous-event`), false,
        'un evento di audit oltre la finestra viene rimosso dal registro');
    // Nessuna delle altre famiglie è raggiunta dal job.
    for (const path of [...NON_AUDIT_PATHS, `users/${OWNER}/trash/old-trash`, `users/${OWNER}/aziende/${COMPANY}`]) {
        assert.equal(await exists(path), true, `${path} non è di competenza della retention del registro`);
    }
    assert.equal(await exists(receiptPath), true, 'la ricevuta di idempotenza resta senza scadenza automatica');
});
