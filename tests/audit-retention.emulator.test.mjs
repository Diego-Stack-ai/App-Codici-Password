import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

// M7-AUDIT-6 — Prove Emulator del job di retention del registro.
//
// Il banco esegue il **codice reale** del job (estratto da `functions/index.js`)
// contro Firestore Emulator, con dati sintetici, e verifica le proprietà che il
// piano approvato richiede: semantica dei due filtri, cursore e duplicati fra
// proprietari, sottocollezione orfana, percorso estraneo respinto, aggiornamento
// concorrente con precondizione e ripiego transazionale, budget per run e
// nessuna cancellazione fuori dal registro.
//
// Le classi e i helper provengono dal runtime Functions (`functions/`), così il
// banco usa la stessa versione dell'Admin SDK del job.
const PROJECT_ID = 'codici-password-audit-retention-test';
assert.match(String(process.env.FIRESTORE_EMULATOR_HOST || ''), /^127\.0\.0\.1:\d+$/,
    'il banco deve girare sull’emulatore: nessun dato reale');

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, Timestamp, FieldPath} = requireFunctions('firebase-admin/firestore');
const service = requireFunctions('./audit-retention-service.js');

const source = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
const start = source.indexOf('const AUDIT_RETENTION_PAGE_SIZE');
const end = source.indexOf('exports.purgeExpiredAuditEvents = onSchedule(');
assert.ok(start > 0 && end > start, 'la sezione del job deve essere estraibile da index.js');
const jobSource = source.slice(start, end);

// Il job viene montato con `new Function` — quindi **nello stesso realm**
// dell'Admin SDK: una transazione creata in un realm `vm` diverso non
// restituirebbe un `Promise` riconosciuto da `runTransaction`.
const silentConsole = {log() {}, warn() {}, error() {}};
const jobFactory = new Function('Timestamp', 'FieldPath', 'console', 'auditEventPath', 'classifyAuditEvent',
    'planAuditRetention', 'runAuditRetention', 'DEFAULT_BATCH_SIZE', 'MAX_EVENTS_PER_RUN',
    `${jobSource}\nreturn {collectExpiredAuditEvents, deleteAuditBatchWithConfirmation, runAuditRetentionJob};`);
const job = jobFactory(Timestamp, FieldPath, silentConsole, service.auditEventPath, service.classifyAuditEvent,
    service.planAuditRetention, service.runAuditRetention, service.DEFAULT_BATCH_SIZE, service.MAX_EVENTS_PER_RUN);

const app = initializeApp({projectId: PROJECT_ID}, `audit-retention-${process.pid}`);
const db = getFirestore(app);
const NOW = Date.parse('2026-09-21T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const COARSE_CUTOFF = Timestamp.fromMillis(NOW - 700 * DAY);
const OLD = Timestamp.fromMillis(NOW - 1000 * DAY);
const RECENT = Timestamp.fromMillis(NOW - 10 * DAY);
const eventPath = (uid, id) => `users/${uid}/auditEvents/${id}`;

async function seed(path, data) {
    await db.doc(path).set(data);
}

async function exists(path) {
    return (await db.doc(path).get()).exists;
}

async function clear() {
    await db.recursiveDelete(db.collection('users'));
    await db.recursiveDelete(db.collection('mutationResults'));
}

test.beforeEach(clear);
test.after(async () => {
    await clear();
    await deleteApp(app);
});

test('semantica dei filtri e policy: si cancellano solo gli eventi scaduti e databili', async () => {
    const uid = 'owner-a';
    await seed(eventPath(uid, 'scaduto'), {action: 'account-purged', at: OLD});
    await seed(eventPath(uid, 'futuro'), {action: 'account-purged', at: RECENT});
    // `at` stringa: non è un Timestamp, quindi non entra né nella query né nei lotti.
    await seed(eventPath(uid, 'at-stringa'), {action: 'account-purged', at: '2020-01-01T00:00:00.000Z'});
    await seed(eventPath(uid, 'at-malformato'), {action: 'account-purged', at: 42});
    await seed(eventPath(uid, 'senza-at'), {action: 'account-purged', createdAt: OLD});
    await seed(eventPath(uid, 'shared-vault-vecchio'), {action: 'shared-vault-create', createdAt: OLD});
    await seed(eventPath(uid, 'shared-vault-at-recente'), {action: 'shared-vault-create', createdAt: OLD, at: RECENT});
    await seed(eventPath(uid, 'widget-vecchio'), {action: 'account-widget-delete', createdAt: OLD});
    await seed(eventPath(uid, 'estraneo-created-at'), {action: 'backup-restore-chunk', createdAt: OLD});
    // Ricevute, cestino, account archiviato e indici di idempotenza: mai toccati.
    await seed(`users/${uid}/operationResults/op-1`, {createdAt: OLD});
    await seed(`users/${uid}/archiveOperations/a-1`, {createdAt: OLD});
    await seed(`users/${uid}/backupRestoreOperations/b-1`, {createdAt: OLD});
    await seed(`users/${uid}/syncRecords/s-1`, {createdAt: OLD});
    await seed(`users/${uid}/trash/r-1`, {deletedAt: OLD, purgeAfterMs: NOW - DAY});
    await seed(`users/${uid}/accounts/acc-1`, {isArchived: true, archivedAt: OLD, revision: 4});
    await seed(`mutationResults/${uid}/operations/m-1`, {appliedAt: OLD});

    const collected = await job.collectExpiredAuditEvents(db, COARSE_CUTOFF, {pageSize: 50});
    const collectedIds = collected.entries.map(entry => entry.id).sort();
    assert.equal(collectedIds.includes('at-stringa'), false, 'un `at` stringa non è selezionato dalla query');
    assert.equal(collectedIds.includes('at-malformato'), false, 'un `at` numerico non è selezionato dalla query');
    assert.equal(collectedIds.includes('scaduto'), true);
    // `senza-at` e `estraneo-created-at` **sono** scoperti dalla query su
    // `createdAt` (è il suo mestiere): è il classificatore a escluderli, e la
    // verifica atomica a non cancellarli.
    assert.equal(collectedIds.includes('senza-at'), true);

    const report = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.status, 'completed');
    assert.equal(report.deleted, 3, '`scaduto` più i due eventi legacy databili da `createdAt`');
    for (const id of ['scaduto', 'shared-vault-vecchio', 'widget-vecchio']) {
        assert.equal(await exists(eventPath(uid, id)), false, `${id} doveva essere cancellato`);
    }
    for (const id of ['futuro', 'at-stringa', 'at-malformato', 'senza-at', 'shared-vault-at-recente',
        'estraneo-created-at']) {
        assert.equal(await exists(eventPath(uid, id)), true, `${id} doveva restare`);
    }
    for (const path of [`users/${uid}/operationResults/op-1`, `users/${uid}/archiveOperations/a-1`,
        `users/${uid}/backupRestoreOperations/b-1`, `users/${uid}/syncRecords/s-1`, `users/${uid}/trash/r-1`,
        `users/${uid}/accounts/acc-1`, `mutationResults/${uid}/operations/m-1`]) {
        assert.equal(await exists(path), true, `${path} non doveva essere toccato`);
    }
    // Il filtro su `createdAt` non fa cancellare l'evento che ha un `at` recente.
    assert.equal(report.rejectedPaths, 0);
});

test('idempotenza: una seconda esecuzione non cancella nulla', async () => {
    const uid = 'owner-b';
    await seed(eventPath(uid, 'scaduto'), {action: 'trashed', at: OLD});
    const first = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(first.deleted, 1);
    const second = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(second.status, 'completed');
    assert.equal(second.deleted, 0);
    assert.equal(second.planned, 0);
});

test('sottocollezione orfana: trovata dalla query di gruppo e cancellata', async () => {
    // Nessun documento `users/orfano` esiste: solo la sottocollezione.
    await seed(eventPath('orfano', 'scaduto'), {action: 'account-purged', at: OLD});
    assert.equal(await exists('users/orfano'), false);
    const report = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.deleted, 1, 'l’evento orfano scaduto viene trovato e cancellato');
    assert.equal(await exists(eventPath('orfano', 'scaduto')), false);
});

test('percorso estraneo: scoperto dalla query di gruppo ma respinto, mai cancellato', async () => {
    const uid = 'owner-c';
    await seed(`users/${uid}/accounts/acc-1/auditEvents/estraneo`, {action: 'account-purged', at: OLD});
    await seed(eventPath(uid, 'regolare'), {action: 'account-purged', at: OLD});
    const report = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.rejectedPaths, 1, 'il percorso annidato altrove è respinto');
    assert.equal(await exists(`users/${uid}/accounts/acc-1/auditEvents/estraneo`), true,
        'nessuna cancellazione fuori dal registro');
    assert.equal(await exists(eventPath(uid, 'regolare')), false);
});

test('cursore e duplicati fra proprietari: paginazione piccola, nessun evento saltato', async () => {
    // Stesso id in due proprietari e stessa data: il cursore non è l’id nudo.
    for (const uid of ['owner-d', 'owner-e', 'owner-f']) {
        await seed(eventPath(uid, 'op-1'), {action: 'account-purged', at: OLD});
        await seed(eventPath(uid, 'op-2'), {action: 'account-purged', at: OLD});
    }
    const report = await job.runAuditRetentionJob(db, {now: NOW, pageSize: 2, batchSize: 2});
    assert.equal(report.status, 'completed');
    assert.equal(report.deleted, 6, 'sei eventi, nessuno saltato e nessuno contato due volte');
    for (const uid of ['owner-d', 'owner-e', 'owner-f']) {
        assert.equal(await exists(eventPath(uid, 'op-1')), false);
        assert.equal(await exists(eventPath(uid, 'op-2')), false);
    }
});

test('aggiornamento concorrente: la precondizione fallisce e il ripiego non cancella la versione nuova', async () => {
    const uid = 'owner-g';
    const path = eventPath(uid, 'in-corso');
    await seed(path, {action: 'account-purged', at: OLD});
    const {entries} = await job.collectExpiredAuditEvents(db, COARSE_CUTOFF, {pageSize: 50});
    const entry = entries.find(item => item.path === path);
    assert.ok(entry, 'l’evento è pianificabile');
    // Il documento cambia fra la lettura e la cancellazione.
    await seed(path, {action: 'account-purged', at: RECENT});
    const deleted = await job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: [entry.id], paths: [path]}, NOW, new Map([[path, entry.updateTime]]));
    assert.equal(deleted, 0, 'la versione cambiata non viene cancellata');
    assert.equal(await exists(path), true);
});

test('ripiego transazionale: cancella solo ciò che è ancora scaduto e non conta i documenti spariti', async () => {
    const uid = 'owner-h';
    const expiredPath = eventPath(uid, 'scaduto');
    const recentPath = eventPath(uid, 'aggiornato');
    const missingPath = eventPath(uid, 'sparito');
    await seed(expiredPath, {action: 'account-purged', at: OLD});
    await seed(recentPath, {action: 'account-purged', at: RECENT});
    // `updateTimes` vuota: si forza la via transazionale (nessuna precondizione).
    const deleted = await job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: ['scaduto', 'aggiornato', 'sparito'], paths: [expiredPath, recentPath, missingPath]},
        NOW, new Map());
    assert.equal(deleted, 1);
    assert.equal(await exists(expiredPath), false);
    assert.equal(await exists(recentPath), true, 'la versione non più scaduta resta');
    assert.equal(await exists(missingPath), false);
});

test('budget per run: il tetto di lotti interrompe senza falsi completamenti', async () => {
    const uid = 'owner-i';
    for (let index = 0; index < 4; index++) {
        await seed(eventPath(uid, `op-${index}`), {action: 'account-purged', at: OLD});
    }
    const limited = await job.runAuditRetentionJob(db, {now: NOW, batchSize: 1, maxBatches: 2});
    assert.equal(limited.status, 'interrupted');
    assert.equal(limited.deleted, 2, 'si ferma al tetto, con due eventi ancora presenti');
    assert.equal(await exists(eventPath(uid, 'op-0')), false);
    assert.equal(await exists(eventPath(uid, 'op-3')), true);
    const resumed = await job.runAuditRetentionJob(db, {now: NOW, batchSize: 1, maxBatches: 50});
    assert.equal(resumed.status, 'completed');
    assert.equal(resumed.deleted, 2, 'la ripresa completa il lavoro rimasto');
});

test('configurazione indici: gli override COLLECTION_GROUP per at e createdAt sono dichiarati', () => {
    const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));
    for (const fieldPath of ['at', 'createdAt']) {
        const override = indexes.fieldOverrides.find(entry =>
            entry.collectionGroup === 'auditEvents' && entry.fieldPath === fieldPath);
        assert.ok(override, `manca l’override per auditEvents.${fieldPath}`);
        const scopes = override.indexes.map(index => index.queryScope);
        assert.ok(scopes.includes('COLLECTION_GROUP'), `auditEvents.${fieldPath}: manca lo scope di gruppo`);
        assert.ok(scopes.includes('COLLECTION'), `auditEvents.${fieldPath}: manca lo scope di collezione`);
    }
    // Limite dichiarato: l’Emulator non applica gli indici, quindi questa prova
    // verifica la configurazione, non il comportamento di un progetto reale.
});
