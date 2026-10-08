"use strict";

// M7-AUDIT-6 — Prove mirate della policy di retention del registro.
// Il modulo è puro: qui si verifica il contratto (data efficace, finestra di 24
// mesi di calendario, classificazione, confinamento dei percorsi, piano,
// esecuzione), senza Firebase e senza alcun dato reale.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    CREATED_AT_ONLY_ACTIONS, MAX_BATCH_SIZE, MAX_EVENTS_PER_RUN, RETENTION_MONTHS,
    auditEventPath, auditExpiry, auditTimestamp, classifyAuditEvent, effectiveAuditDate,
    isCreatedAtOnlyAction, planAuditRetention, runAuditRetention
} = require("../audit-retention-service");

const NOW = Date.parse("2026-09-21T00:00:00.000Z");
const RECENT = new Date("2026-06-01T00:00:00.000Z");
const OLD = new Date("2023-01-01T00:00:00.000Z");
const EXACTLY_24_MONTHS = new Date("2024-09-21T00:00:00.000Z");

function codeOf(run) {
    try {
        run();
        return null;
    } catch (error) {
        return error.code || error.message;
    }
}

test("il timestamp è databile solo nelle forme Firestore, mai da stringhe o numeri", () => {
    assert.equal(auditTimestamp(new Date("2024-01-01T00:00:00.000Z")), Date.parse("2024-01-01T00:00:00.000Z"));
    assert.equal(auditTimestamp({seconds: 1704067200, nanoseconds: 0}), Date.parse("2024-01-01T00:00:00.000Z"));
    assert.equal(auditTimestamp({seconds: 1704067200}), Date.parse("2024-01-01T00:00:00.000Z"));
    assert.equal(auditTimestamp({toDate: () => new Date("2024-01-01T00:00:00.000Z")}),
        Date.parse("2024-01-01T00:00:00.000Z"));
    for (const value of ["2024-01-01T00:00:00.000Z", 1704067200, null, {}, NaN, true, undefined]) {
        assert.equal(auditTimestamp(value), null, `valore non databile: ${String(value)}`);
    }
    // Nanosecondi e secondi fuori intervallo sono malformati, non date stimate.
    assert.equal(auditTimestamp({seconds: 1, nanoseconds: 1_000_000_000}), null);
    assert.equal(auditTimestamp({seconds: 1, nanoseconds: -1}), null);
    assert.equal(auditTimestamp({seconds: 1, nanoseconds: 1.5}), null);
    assert.equal(auditTimestamp({seconds: -1}), null);
    assert.equal(auditTimestamp({seconds: 1e15}), null);
});

test("data efficace: `at` prevale, `createdAt` solo per le due famiglie senza `at`", () => {
    assert.deepEqual(effectiveAuditDate({at: RECENT}), {at: RECENT.getTime(), field: "at"});
    assert.deepEqual(effectiveAuditDate({createdAt: OLD, action: "shared-vault-create"}),
        {at: OLD.getTime(), field: "createdAt"});
    assert.deepEqual(effectiveAuditDate({createdAt: OLD, action: "account-widget-delete"}),
        {at: OLD.getTime(), field: "createdAt"});
    assert.deepEqual([...CREATED_AT_ONLY_ACTIONS], ["shared-vault-", "account-widget-"]);
    assert.equal(isCreatedAtOnlyAction("shared-vault-link"), true);
    assert.equal(isCreatedAtOnlyAction("account-widget-update"), true);
    assert.equal(isCreatedAtOnlyAction("account-purged"), false);
    assert.equal(isCreatedAtOnlyAction(undefined), false);
});

test("un `at` presente ma non databile NON viene aggirato da un ripiego implicito", () => {
    // Vincolo di revisione (M7-AUDIT-6P): conservativo, l'evento resta inverificabile.
    const cases = [
        {at: "2024-01-01T00:00:00.000Z", createdAt: OLD, action: "shared-vault-create"},
        {at: null, createdAt: OLD, action: "shared-vault-create"},
        {at: {seconds: 1.5}, createdAt: OLD, action: "account-widget-update"},
        {at: 42, createdAt: OLD, action: "shared-vault-create"}
    ];
    for (const event of cases) {
        assert.equal(effectiveAuditDate(event), null, JSON.stringify(event));
        assert.equal(classifyAuditEvent(event, NOW), "unverifiable");
    }
});

test("gli eventi di altre famiglie con solo `createdAt` restano non verificabili", () => {
    for (const action of ["account-purged", "trashed", "restored", "backup-restore-chunk",
        "invite-created", "account-archived", undefined]) {
        const event = {createdAt: OLD, action};
        assert.equal(effectiveAuditDate(event), null, String(action));
        assert.equal(classifyAuditEvent(event, NOW), "unverifiable", String(action));
    }
});

test("`createdAt` vecchio con `at` recente resta conservato: la data efficace è `at`", () => {
    // Caso obbligatorio della revisione: la query su `createdAt` lo scopre, ma il
    // classificatore non lo cancella.
    const event = {at: RECENT, createdAt: OLD, action: "shared-vault-create"};
    assert.deepEqual(effectiveAuditDate(event), {at: RECENT.getTime(), field: "at"});
    assert.equal(classifyAuditEvent(event, NOW), "retained");
    const plan = planAuditRetention({uid: "owner", events: [{id: "op-1", ...event}], now: NOW});
    assert.deepEqual(plan.expired, []);
    assert.deepEqual(plan.retained, ["op-1"]);
});

test("la finestra è di 24 mesi di calendario, con giorno limitato nei mesi corti", () => {
    assert.equal(RETENTION_MONTHS, 24);
    assert.equal(auditExpiry(Date.parse("2024-02-29T00:00:00.000Z")), Date.parse("2026-02-28T00:00:00.000Z"));
    assert.equal(auditExpiry(Date.parse("2024-03-31T00:00:00.000Z")), Date.parse("2026-03-31T00:00:00.000Z"));
    assert.equal(auditExpiry(Date.parse("2025-08-31T12:30:00.000Z")), Date.parse("2027-08-31T12:30:00.000Z"));
});

test("evento dentro la finestra conservato, al confine e oltre cancellabile", () => {
    assert.equal(classifyAuditEvent({at: RECENT}, NOW), "retained");
    assert.equal(classifyAuditEvent({at: EXACTLY_24_MONTHS}, NOW), "expired");
    assert.equal(classifyAuditEvent({at: OLD}, NOW), "expired");
    const justInside = new Date(Date.parse("2024-09-21T00:00:00.001Z"));
    assert.equal(classifyAuditEvent({at: justInside}, NOW), "retained");
});

test("il percorso è confinato al registro di audit", () => {
    assert.equal(auditEventPath("owner", "op-1"), "users/owner/auditEvents/op-1");
    for (const [uid, id] of [["", "a"], ["a/b", "x"], ["owner", ""], ["owner", "a/b"], ["owner", "x".repeat(201)]]) {
        assert.notEqual(codeOf(() => auditEventPath(uid, id)), null, `${uid}/${id}`);
    }
});

test("il piano ordina dal più vecchio con spareggio sull'id e separa i tre esiti", () => {
    const events = [
        {id: "b", at: new Date("2023-05-01T00:00:00.000Z")},
        {id: "a", at: new Date("2023-05-01T00:00:00.000Z")},
        {id: "vecchissimo", at: new Date("2021-01-01T00:00:00.000Z")},
        {id: "dentro", at: RECENT},
        {id: "senza-data"},
        {id: "corrotto", at: "ieri"}
    ];
    const plan = planAuditRetention({uid: "owner", events, now: NOW, batchSize: 2});
    assert.deepEqual(plan.batches.map(batch => batch.ids),
        [["vecchissimo", "a"], ["b"]]);
    assert.deepEqual(plan.expired, ["vecchissimo", "a", "b"]);
    assert.deepEqual(plan.retained, ["dentro"]);
    assert.deepEqual(plan.unverifiable, ["senza-data", "corrotto"]);
    assert.ok(plan.batches.every(batch => batch.paths.every(path => path.startsWith("users/owner/auditEvents/"))));
});

test("configurazione non valida, input fuori misura e UID incoerente sono rifiutati", () => {
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NaN})), "AUDIT_RETENTION_CLOCK_INVALID");
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NOW, batchSize: 0})),
        "AUDIT_RETENTION_BATCH_INVALID");
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NOW, batchSize: MAX_BATCH_SIZE + 1})),
        "AUDIT_RETENTION_BATCH_INVALID");
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NOW, events: "no"})),
        "AUDIT_RETENTION_INPUT_INVALID");
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NOW,
        events: Array.from({length: MAX_EVENTS_PER_RUN + 1}, (_, index) => ({id: `e${index}`}))})),
    "AUDIT_RETENTION_INPUT_INVALID");
    assert.equal(codeOf(() => planAuditRetention({uid: "owner", now: NOW,
        events: [{id: "a", uid: "altro", at: OLD}]})), "AUDIT_RETENTION_UID_MISMATCH");
});

test("l'esecutore cancella i lotti in ordine e dichiara il completamento", async () => {
    const plan = planAuditRetention({uid: "owner", now: NOW, batchSize: 2,
        events: [{id: "a", at: OLD}, {id: "b", at: OLD}, {id: "c", at: OLD}]});
    const calls = [];
    const report = await runAuditRetention({plan, deleteBatch: async batch => { calls.push(batch.ids); }});
    assert.deepEqual(calls, [["a", "b"], ["c"]]);
    assert.deepEqual({...report}, {status: "completed", completed: 2, total: 2});
});

test("errore parziale: nessun falso completamento e ripresa idempotente", async () => {
    const events = [{id: "a", at: OLD}, {id: "b", at: OLD}, {id: "c", at: OLD}];
    const plan = planAuditRetention({uid: "owner", now: NOW, batchSize: 1, events});
    let calls = 0;
    const first = await runAuditRetention({plan, deleteBatch: async () => {
        calls++;
        if (calls === 2) { const error = new Error("boom"); error.code = "FIRESTORE_UNAVAILABLE"; throw error; }
    }});
    assert.equal(first.status, "partial");
    assert.equal(first.completed, 1);
    assert.equal(first.failedBatch, 1);
    assert.equal(first.code, "FIRESTORE_UNAVAILABLE");
    // Ripresa: il piano si ricalcola dagli eventi rimasti e non riparte da zero.
    const remaining = planAuditRetention({uid: "owner", now: NOW, batchSize: 1,
        events: events.slice(1)});
    const callsAfter = [];
    const second = await runAuditRetention({plan: remaining, deleteBatch: async batch => { callsAfter.push(batch.ids); }});
    assert.equal(second.status, "completed");
    assert.deepEqual(callsAfter, [["b"], ["c"]]);
});

test("interruzione per sessione chiusa e rifiuto dei piani arbitrari prima di ogni cancellazione", async () => {
    const plan = planAuditRetention({uid: "owner", now: NOW, batchSize: 1, events: [{id: "a", at: OLD}]});
    let calls = 0;
    const interrupted = await runAuditRetention({plan, isActive: () => false,
        deleteBatch: async () => { calls++; }});
    assert.deepEqual({...interrupted}, {status: "interrupted", completed: 0, total: 1});
    assert.equal(calls, 0, "nessuna cancellazione quando la sessione non è attiva");

    const spy = async () => { calls++; };
    for (const hostile of [
        {uid: "owner", batches: [{index: 0, ids: ["a"], paths: ["users/altro/auditEvents/a"]}]},
        {uid: "owner", batches: [{index: 0, ids: ["a/b"], paths: ["users/owner/auditEvents/a/b"]}]},
        {uid: "../altro", batches: [{index: 0, ids: ["a"], paths: ["users/../altro/auditEvents/a"]}]},
        {uid: "owner", batches: [{index: 0, ids: ["a", "b"], paths: ["users/owner/auditEvents/a"]}]}
    ]) {
        await assert.rejects(runAuditRetention({plan: hostile, deleteBatch: spy}), /AUDIT_RETENTION_/);
    }
    // Una ricevuta non può mai essere pianificata: il percorso atteso è solo il registro.
    assert.equal(codeOf(() => auditEventPath("owner", "operations/op-1")), "AUDIT_RETENTION_ID_INVALID");
    assert.equal(calls, 0, "nessuna cancellazione da un piano rifiutato");
});
