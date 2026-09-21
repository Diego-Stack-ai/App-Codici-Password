"use strict";

// M7-AUDIT-6 — Prove del job di retention sui punti che la revisione ha
// contestato: il conteggio delle cancellazioni non deve dipendere dai
// rieseguimenti della transazione, e la conferma atomica deve restare corretta.
// Il banco esegue il **codice reale** di `functions/index.js` con un Firestore
// finto, quindi non tocca né dati reali né l'emulatore.

const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const service = require("../audit-retention-service");

const source = readFileSync(require.resolve("../index"), "utf8");
const start = source.indexOf("const AUDIT_RETENTION_PAGE_SIZE");
const end = source.indexOf("exports.purgeExpiredAuditEvents = onSchedule(");
assert.ok(start > 0 && end > start, "la sezione del job deve essere estraibile da index.js");

// Stesso realm del modulo di servizio: nessun problema di Promise fra realm.
const silentConsole = {log() {}, warn() {}, error() {}};
const jobFactory = new Function("Timestamp", "FieldPath", "console", "auditEventPath", "classifyAuditEvent",
    "planAuditRetention", "runAuditRetention", "DEFAULT_BATCH_SIZE", "MAX_EVENTS_PER_RUN",
    `${source.slice(start, end)}\nreturn {collectExpiredAuditEvents, deleteAuditBatchWithConfirmation, runAuditRetentionJob};`);
const job = jobFactory(
    {fromMillis: ms => ({seconds: Math.floor(ms / 1000), nanoseconds: 0})},
    {documentId: () => "__name__"},
    silentConsole,
    service.auditEventPath, service.classifyAuditEvent, service.planAuditRetention, service.runAuditRetention,
    service.DEFAULT_BATCH_SIZE, service.MAX_EVENTS_PER_RUN
);

const OLD = Date.parse("2023-01-01T00:00:00.000Z");
const RECENT = Date.parse("2026-06-01T00:00:00.000Z");
const NOW = Date.parse("2026-09-21T00:00:00.000Z");
const seconds = ms => ({seconds: Math.floor(ms / 1000), nanoseconds: 0});

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
