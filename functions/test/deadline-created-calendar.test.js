"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const start = source.indexOf("exports.onScadenzaCreated = onDocumentCreated(");
const end = source.indexOf("exports.onScadenzaUpdated = onDocumentUpdated(", start);
assert.ok(start >= 0 && end > start);
test("creation trigger observes Italian midnight and rejects invalid/expired dates", async () => {
  for (const [dueDate, expected] of [["2026-09-27", 0], ["2026-09-28", 1], ["2026-09-26", null], ["2026-02-30", null]]) {
    const calls = [];
    class Clock extends Date {constructor(...args) {super(...(args.length ? args : ["2026-09-26T22:30:00Z"]));}}
    const context = {Date: Clock, deadlineCalendar: require("../deadline-calendar"), exports: {},
      onDocumentCreated: (_config, handler) => handler, admin: {firestore: () => ({})},
      syncReceivedDeadlines: async () => {}, console: {log() {}, error() {}},
      GMAIL_USER: {value: () => "synthetic"}, GMAIL_APP_PASSWORD: {value: () => "synthetic"},
      createTransporter: () => ({}), deadlineRecipients: () => [{sendEmail: true}],
      sendDeadlinePush: async (_db, _uid, _id, _s, days, options) => {calls.push(["push", days]); assert.equal(options.forceImmediate, true);},
      sendRecipientDeadlinePushes: async (_db, _uid, _id, _s, days) => calls.push(["recipient", days]),
      sendScadenzaEmail: async (_t, _u, _s, days) => calls.push(["email", days])};
    vm.runInNewContext(source.slice(start, end), context);
    await context.exports.onScadenzaCreated({params: {uid: "owner", scadenzaId: "synthetic"}, data: {data: () => ({dueDate}), ref: {}}});
    assert.deepEqual(calls, expected === null ? [] : [["push", expected], ["recipient", expected], ["email", expected]]);
  }
});

test("manual push test selects the current Italian day, then next day after midnight", async () => {
  const a = source.indexOf("exports.sendDeadlinePushTest = onCall(");
  const b = source.indexOf("function validFutureIsoDate(", a);
  assert.ok(a >= 0 && b > a);
  for (const [instant, expected] of [["2026-09-26T21:30:00Z", "today"], ["2026-09-26T22:30:00Z", "tomorrow"]]) {
    class Clock extends Date {constructor(...args) {super(...(args.length ? args : [instant]));} static now() {return Date.parse(instant);}}
    const sent = [];
    const device = {enabled: true, notificationScope: "deadlines", token: "synthetic"};
    const rows = [{id: "today", data: () => ({dueDate: "2026-09-26"})}, {id: "tomorrow", data: () => ({dueDate: "2026-09-27"})}];
    const ref = {doc: () => ref, collection: () => ref, get: async () => ({exists: true, data: () => device}),
      set: async () => {}, where: () => ({get: async () => ({docs: rows})})};
    const firestore = () => ref;
    firestore.FieldValue = {serverTimestamp: () => "synthetic"};
    const context = {Date: Clock, deadlineCalendar: require("../deadline-calendar"), exports: {},
      onCall: (_config, handler) => handler, HttpsError: Error, console: {error() {}},
      admin: {firestore, messaging: () => ({send: async payload => sent.push(payload)})},
      pushText: (_data, days) => ({title: "Synthetic", body: String(days)})};
    vm.runInNewContext(source.slice(a, b), context);
    await context.exports.sendDeadlinePushTest({auth: {uid: "owner"}, data: {deviceId: "11111111-1111-1111-1111-111111111111"}});
    assert.equal(sent.length, 1);
    assert.equal(sent[0].data.deadlineId, expected);
    assert.equal(sent[0].data.body, "0");
  }
});
