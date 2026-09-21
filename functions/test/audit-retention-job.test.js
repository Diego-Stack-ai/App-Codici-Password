"use strict";

// M7-AUDIT-6 — Prove del job di retention sui punti contestati dalla revisione:
// il conteggio non deve dipendere dai rieseguimenti della transazione, la
// conferma atomica deve restare corretta, un errore di pianificazione non può
// chiudere il run come «completed». Il banco esegue il **codice reale** di
// `functions/index.js` con un Firestore finto: nessun dato reale, nessun
// emulatore.

const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const service = require("../audit-retention-service");

const source = readFileSync(require.resolve("../index"), "utf8");
const start = source.indexOf("const AUDIT_RETENTION_PAGE_SIZE");
const end = source.indexOf("exports.purgeExpiredAuditEvents = onSchedule(");
assert.ok(start > 0 && end > start, "la sezione del job deve essere estraibile da index.js");
const jobSource = source.slice(start, end);

const OLD = Date.parse("2023-01-01T00:00:00.000Z");
const RECENT = Date.parse("2026-06-01T00:00:00.000Z");
const NOW = Date.parse("2026-09-21T00:00:00.000Z");
const seconds = ms => ({seconds: Math.floor(ms / 1000), nanoseconds: 0});
const silentConsole = {log() {}, warn() {}, error() {}};

// Stesso realm del modulo di servizio: nessun problema di Promise fra realm.
function makeJob(overrides = {}) {
    const injected = {
        auditEventPath: service.auditEventPath,
        classifyAuditEvent: service.classifyAuditEvent,
        planAuditRetention: service.planAuditRetention,
        runAuditRetention: service.runAuditRetention,
        ...overrides
    };
    const factory = new Function("Timestamp", "FieldPath", "FieldValue", "console", "auditEventPath",
        "classifyAuditEvent", "planAuditRetention", "runAuditRetention", "DEFAULT_BATCH_SIZE", "MAX_EVENTS_PER_RUN",
        `${jobSource}\nreturn {collectExpiredAuditEvents, deleteAuditBatchWithConfirmation, runAuditRetentionJob};`);
    return factory(
        {fromMillis: ms => ({seconds: Math.floor(ms / 1000), nanoseconds: 0})},
        {documentId: () => "__name__"},
        {serverTimestamp: () => ({__serverTimestamp: true})},
        silentConsole,
        injected.auditEventPath, injected.classifyAuditEvent, injected.planAuditRetention,
        injected.runAuditRetention, service.DEFAULT_BATCH_SIZE, service.MAX_EVENTS_PER_RUN
    );
}

const job = makeJob();

// Firestore finto con una sola pagina per campo: serve a esercitare la
// pianificazione e il salvataggio dei cursori senza un database reale.
function queryDb(entries, state = {}) {
    const snapshots = entries.map(entry => ({
        ref: {path: entry.path, id: entry.path.split("/").at(-1),
            parent: {parent: {id: entry.path.split("/")[1]}}},
        data: () => entry.data,
        updateTime: {seconds: 1, nanoseconds: 0}
    }));
    const query = {
        where: () => query, orderBy: () => query, limit: () => query, startAfter: () => query,
        get: async () => ({empty: snapshots.length === 0, size: snapshots.length, docs: snapshots})
    };
    return {
        collectionGroup: () => query,
        doc: path => ({
            path,
            get: async () => ({exists: false}),
            set: async patch => { state.saved = patch; }
        }),
        // Via rapida della cancellazione: il batch finto committa sempre.
        batch: () => ({delete() {}, commit: async () => {}}),
        runTransaction: async () => { throw new Error("non deve essere raggiunta"); },
        state
    };
}

function snapshot(ref, data) {
    return {exists: true, ref, data: () => data};
}

test("il conteggio è quello del tentativo che committa, non la somma dei rieseguimenti", async () => {
    const paths = ["users/owner/auditEvents/a", "users/owner/auditEvents/b"];
    let attempts = 0;
    const db = {
        doc: path => ({path}),
        // Nessuna `updateTime`: si passa subito alla via transazionale.
        batch: () => ({delete() {}, commit: async () => { throw new Error("non usata"); }}),
        runTransaction: async callback => {
            let last;
            // Firestore può rieseguire il callback: il banco lo esegue due volte.
            for (let attempt = 0; attempt < 2; attempt++) {
                attempts++;
                last = await callback({
                    getAll: async (...references) => references.map(reference =>
                        snapshot(reference, {action: "account-purged", at: seconds(OLD)})),
                    delete() {}
                });
            }
            return last;
        }
    };
    const deleted = await job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: ["a", "b"], paths}, NOW, new Map());
    assert.equal(attempts, 2, "il callback è stato rieseguito");
    assert.equal(deleted, 2, "conta i documenti cancellati dal tentativo che committa, non 4");
});

test("conferma con precondizione: nessuna transazione quando la versione è quella letta", async () => {
    const paths = ["users/owner/auditEvents/a"];
    let commits = 0, transactions = 0;
    const db = {
        doc: path => ({path}),
        batch: () => ({
            delete() { commits++; },
            commit: async () => {}
        }),
        runTransaction: async () => { transactions++; return []; }
    };
    const deleted = await job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: ["a"], paths}, NOW, new Map([[paths[0], {seconds: 1, nanoseconds: 0}]]));
    assert.equal(deleted, 1);
    assert.equal(commits, 1);
    assert.equal(transactions, 0, "la via rapida basta quando la precondizione regge");
});

test("precondizione fallita: il ripiego riclassifica e non conta i documenti non più scaduti", async () => {
    const paths = ["users/owner/auditEvents/scaduto", "users/owner/auditEvents/aggiornato", "users/owner/auditEvents/sparito"];
    const data = {
        [paths[0]]: {action: "account-purged", at: seconds(OLD)},
        [paths[1]]: {action: "account-purged", at: seconds(RECENT)}
    };
    let fallbacks = 0;
    const db = {
        doc: path => ({path}),
        batch: () => ({delete() {}, commit: async () => { const error = new Error("FAILED_PRECONDITION"); error.code = 9; throw error; }}),
        runTransaction: async callback => {
            fallbacks++;
            const deleted = [];
            await callback({
                getAll: async (...references) => references.map(reference => ({
                    exists: data[reference.path] !== undefined,
                    ref: reference,
                    data: () => data[reference.path]
                })),
                delete: reference => deleted.push(reference.path)
            });
            return deleted;
        }
    };
    const updateTimes = new Map([[paths[0], {seconds: 1, nanoseconds: 0}]]);
    const deleted = await job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: ["scaduto", "aggiornato", "sparito"], paths}, NOW, updateTimes);
    assert.equal(fallbacks, 1, "una sola transazione di ripiego");
    assert.equal(deleted, 1, "solo l'evento ancora scaduto è una cancellazione");
});

test("errore non di precondizione: non viene inghiottito e non diventa un falso conteggio", async () => {
    const paths = ["users/owner/auditEvents/a"];
    const db = {
        doc: path => ({path}),
        batch: () => ({delete() {}, commit: async () => { const error = new Error("UNAVAILABLE"); error.code = 14; throw error; }}),
        runTransaction: async () => { throw new Error("non deve essere raggiunta"); }
    };
    await assert.rejects(job.deleteAuditBatchWithConfirmation(db,
        {index: 0, ids: ["a"], paths}, NOW, new Map([[paths[0], {seconds: 1, nanoseconds: 0}]])),
    /UNAVAILABLE/);
});

test("errore di pianificazione: il run è parziale e i cursori non avanzano", async () => {
    const path = "users/owner/auditEvents/op-1";
    const db = queryDb([{path, data: {action: "account-purged", at: seconds(OLD)}}]);
    const failing = makeJob({planAuditRetention: () => {
        const error = new Error("AUDIT_RETENTION_INPUT_INVALID");
        error.code = "AUDIT_RETENTION_INPUT_INVALID";
        throw error;
    }});
    const report = await failing.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.planErrors, 1);
    assert.equal(report.status, "partial", "documenti letti ma non valutati: mai «completed»");
    assert.equal(report.cursorsSaved, false, "una finestra non gestita non fa avanzare i cursori");
    assert.equal(db.state.saved, undefined, "nessuna scrittura di stato");
});

test("finestra gestita: i cursori vengono salvati e il run è completo", async () => {
    const path = "users/owner/auditEvents/op-1";
    const db = queryDb([{path, data: {action: "account-purged", at: seconds(OLD)}}]);
    const report = await job.runAuditRetentionJob(db, {now: NOW});
    assert.equal(report.status, "completed");
    assert.equal(report.cursorsSaved, true);
    assert.deepEqual(Object.keys(db.state.saved.cursors).sort(), ["at", "createdAt"]);
    // La query è esaurita: i cursori tornano null e il giro successivo riparte
    // dall'inizio, così nessun evento può restare fuori per sempre.
    assert.equal(db.state.saved.cursors.at, null);
    assert.equal(db.state.saved.cursors.createdAt, null);
});
