"use strict";
// DeepSeek A3 proposal, deterministic local clock and fake transport/Firestore.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const start = source.indexOf("exports.checkDeadlines = onSchedule(");
const end = source.indexOf("exports.onScadenzaCreated = onDocumentCreated(", start);
assert.ok(start >= 0 && end > start);
const NOW = new Date(2026, 8, 26, 12).getTime();
class Clock extends Date {
  constructor(...args) {super(...(args.length ? args : [NOW]));}
}
const days = offset => new Date(2026, 8, 26 + offset, 12).toISOString();
const record = (id, offset, patch = {}) => ({id, dueDate: days(offset), completed: false,
  recipients: [{email: "synthetic@example.invalid", sendEmail: true}], ...patch});
function harness(records = [], failure = "", now = NOW) {
  const calls = [], queries = [], errors = [];
  const ledgerFixture = require("./recipient-ledger-fixture")();
  let config;
  const db = {collection(name) {
    if (name === "recipientDeliveryLedger") return ledgerFixture.db.collection(name);
    assert.equal(name, "users");
    return {async get() {return {docs: [{id: "owner"}]};}, doc(uid) {
      assert.equal(uid, "owner");
      return {collection(collectionName) {
        assert.equal(collectionName, "scadenze");
        return {where(field, op, value) {
          queries.push([field, op, value]);
          return {async get() {return {docs: records.filter(s => s[field] === value)
            .map(s => ({id: s.id, data: () => s, ref: {id: s.id}}))};}};
        }};
      }};
    }};
  }};
  class ScenarioClock extends Clock {constructor(...args) {super(...(args.length ? args : [now]));}}
  const context = {recipientDeliveryLedger: require("../recipient-delivery-ledger"), deadlineCalendar: require("../deadline-calendar"), Date: ScenarioClock, exports: {}, admin: {firestore: () => db},
    onSchedule: (options, handler) => {config = options; return handler;},
    GMAIL_USER: {value: () => "synthetic@example.invalid"}, GMAIL_APP_PASSWORD: {value: () => "synthetic"},
    createTransporter: () => ({}), deadlineRecipients: s => s.recipients,
    sendDeadlinePush: async (_db, uid, id, _s, diff) => {
      calls.push(["push", id, diff]); assert.equal(uid, "owner");
      if (failure === "push") throw new Error("synthetic");
    },
    sendRecipientDeadlinePushes: async (_db, _uid, id, _s, diff) => {
      calls.push(["recipient", id, diff]);
      if (failure === "recipient") throw new Error("synthetic");
    },
    sendScadenzaEmail: async (_transport, _sender, s, diff) => {
      calls.push(["email", s.id, diff]);
      if (failure === "email") throw new Error("synthetic");
    },
    console: {log() {}, error: (...args) => errors.push(args.join(" "))}};
  vm.runInNewContext(source.slice(start, end), context);
  return {calls, queries, errors, config, run: context.exports.checkDeadlines};
}
test("scheduler skips expired, outside window, completed and missing-date records", async () => {
  const h = harness([record("expired", -1), record("early", 20), record("done", 0, {completed: true}),
    record("missing", 0, {dueDate: null})]);
  await h.run();
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.queries, [["completed", "==", false]]);
  assert.deepEqual(h.errors, []);
});
test("scheduler default window and custom window include eligible records", async () => {
  const h = harness([record("default", 14), record("custom", 20, {notif_days_before: 21})]);
  await h.run();
  assert.deepEqual(h.calls.filter(c => c[0] === "email"), [["email", "default", 14], ["email", "custom", 20]]);
});
test("scheduler delegates recipient cadence even with today's global marker; opt-out remains respected", async () => {
  const h = harness([record("today", 0, {lastNotifiedAt: days(0)}),
    record("recent", 3, {lastNotifiedAt: days(0)}),
    record("mature", 3, {lastNotifiedAt: days(-8)}), record("no-email", 3, {recipients: []})]);
  await h.run();
  assert.deepEqual(h.calls.filter(c => c[0] === "email").map(c => c[1]), ["today", "recent", "mature"]);
  assert.equal(h.calls.filter(c => c[0] === "push").length, 4);
});
test("scheduler isolates failures in each channel and continues other deadlines", async () => {
  for (const channel of ["push", "recipient", "email"]) {
    const h = harness([record("one", 1), record("two", 2)], channel);
    await h.run();
    assert.equal(h.calls.length, 6);
    assert.equal(h.errors.length, 2);
    assert.ok(h.calls.some(c => c[0] === "email" && c[1] === "two"));
  }
});
test("scheduler configuration retains Rome time, region and resource limits", () => {
  const {config} = harness();
  assert.equal(config.schedule, "0 9 * * *");
  assert.equal(config.timeZone, "Europe/Rome");
  assert.equal(config.region, "europe-west1");
  assert.equal(config.timeoutSeconds, 120);
  assert.equal(config.memory, "256MiB");
  assert.equal(config.secrets.length, 2);
});

test("scheduler uses Italian midnight and skips malformed dates without sending", async () => {
  const h = harness([record("today", 0, {dueDate: "2026-09-27"}),
    record("yesterday", 0, {dueDate: "2026-09-26"}),
    record("invalid", 0, {dueDate: "2026-02-30"})], "", Date.parse("2026-09-26T22:30:00Z"));
  await h.run();
  assert.deepEqual(h.calls, [["push", "today", 0], ["recipient", "today", 0], ["email", "today", 0]]);
});
test("scheduler counts autumn days and spring frequency as civil days", async () => {
  const autumn = harness([record("tomorrow", 0, {dueDate: "2026-10-26"})], "", Date.parse("2026-10-25T08:00:00Z"));
  await autumn.run();
  assert.deepEqual(autumn.calls, [["push", "tomorrow", 1], ["recipient", "tomorrow", 1], ["email", "tomorrow", 1]]);
  const spring = harness([record("mature", 0, {dueDate: "2026-04-02", lastNotifiedAt: "2026-03-23", notif_frequency: 7})], "", Date.parse("2026-03-30T07:00:00Z"));
  await spring.run();
  assert.ok(spring.calls.some(call => call[0] === "email"));
});
