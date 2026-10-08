"use strict";
// COLLAUDO-07: DeepSeek proposal consolidated by Astra. Real function, no SMTP/SDK.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const start = source.lastIndexOf("// UTILITY", source.indexOf("async function sendScadenzaEmail("));
const end = source.indexOf("exports.checkDeadlines = onSchedule(", start);
assert.ok(start >= 0 && end > start);
function harness({fail = [], users = {}, lookupFailure = null, now = Date.parse("2026-09-26T22:30:00Z")} = {}) {
  const mails = [], updates = [], lookups = [], errors = [];
  class Clock extends Date {constructor(...args) {super(...(args.length ? args : [now]));} static now() {return now;}}
  const ledgerFixture = require("./recipient-ledger-fixture")();
  let current;
  const sandbox = {Date: Clock, recipientDeliveryLedger: require("../recipient-delivery-ledger"), deadlineCalendar: require("../deadline-calendar"), console: {log() {}, error: (...args) => errors.push(args.map(String).join(" "))},
    deadlineRecipients: s => s.recipients || [], receivedDeadlineId: () => "synthetic-share-id",
    admin: {auth: () => ({async getUserByEmail(email) {
      lookups.push(email);
      if (lookupFailure) throw lookupFailure;
      if (!users[email]) throw Object.assign(new Error("absent"), {code: "auth/user-not-found"});
      return users[email];
    }})}};
  vm.runInNewContext(source.slice(start, end), sandbox);
  const transporter = {async sendMail(mail) {
    if (fail.includes(mail.to)) throw Object.assign(new Error("synthetic delivery failure a@example.invalid"), {code: "secret-provider-code"});
    mails.push(mail);
  }};
  const doc = {id: "deadline", firestore: ledgerFixture.db, parent: {parent: {id: "owner"}},
    async get() {return {exists: true, data: () => current};}, async update(data) {updates.push(data);}};
  return {mails, updates, lookups, errors, sandbox,
    send: (overrides = {}, days = 3) => {
      current = {name: "Synthetic", type: "Renewal", dueDate: "2026-09-30",
        recipients: [{email: "a@example.invalid", sendEmail: true}], ...overrides};
      return sandbox.sendScadenzaEmail(transporter, "sender@example.invalid", current, days, doc);
    }};
}

test("email failures log only fixed diagnostics, not provider messages or codes", async () => {
  const h = harness({fail: ["a@example.invalid"]});
  await assert.rejects(h.send(), /Nessun destinatario/);
  assert.deepEqual(h.errors, ["[EMAIL RECIPIENT FAILED] EMAIL_DELIVERY_FAILED"]);
  const lookup = harness({lookupFailure: Object.assign(new Error("private-token"), {code: "private-code"})});
  await lookup.send({recipients: [{email: "a@example.invalid", sendEmail: true, sendPush: true}]});
  assert.deepEqual(lookup.errors, ["[EMAIL RECIPIENT LOOKUP FAILED] EMAIL_LOOKUP_FAILED"]);
  assert.equal(lookup.mails.length, 1);
  assert.equal(lookup.updates.length, 1);
});
test("email respects recipients and records delivery; no lookup without push/manage", async () => {
  const h = harness();
  assert.equal(await h.send({recipients: [{email: "a@example.invalid", sendEmail: true},
    {email: "b@example.invalid", sendEmail: false}]}), true);
  assert.equal(h.mails.length, 1);
  assert.equal(h.mails[0].to, "a@example.invalid");
  assert.match(h.mails[0].html, /Gentile <strong>Synthetic<\/strong>/);
  assert.match(h.mails[0].html, /Scade tra 3 giorni/);
  assert.equal(h.lookups.length, 0);
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].lastNotifiedAt, "2026-09-27");
  assert.match(h.mails[0].html, /30 settembre 2026/);
});
test("email without enabled recipients performs no delivery or update", async () => {
  const h = harness();
  assert.equal(await h.send({recipients: [{email: "a@example.invalid", sendEmail: false}]}), false);
  assert.equal(h.mails.length + h.updates.length + h.lookups.length, 0);
});

test("overlapping email calls reserve once for the same deadline", async () => {
  const h = harness();
  await Promise.all([h.send(), h.send()]);
  assert.equal(h.mails.length, 1);
  assert.equal(h.updates.length, 1);
});
test("email total failure does not advance; partial success retries only the failed recipient", async () => {
  const h = harness({fail: ["a@example.invalid"]});
  await assert.rejects(h.send(), /Nessun destinatario/);
  assert.equal(h.updates.length, 0);
  assert.equal(await h.send({recipients: [{email: "a@example.invalid", sendEmail: true},
    {email: "b@example.invalid", sendEmail: true}]}, 1), true);
  assert.equal(h.updates.length, 1);
  assert.match(h.mails[0].html, /Scade domani/);
  await assert.rejects(h.send({lastNotifiedAt: "2026-09-27", recipients: [
    {email: "a@example.invalid", sendEmail: true}, {email: "b@example.invalid", sendEmail: true}]}));
  assert.equal(h.mails.length, 1, "successful recipient is not resent while the failed one is retried");
});
test("email received link belongs only to external registered recipients", async () => {
  for (const uid of ["guest", "owner", null]) {
    const h = harness({users: uid ? {"a@example.invalid": {uid}} : {}});
    await h.send({recipients: [{email: "a@example.invalid", sendEmail: true, canManage: true}]});
    assert.equal(h.lookups.length, 1);
    assert.equal(h.mails[0].html.includes("?received=synthetic-share-id"), uid === "guest");
  }
});
test("each user-controlled email HTML value is escaped independently, subject unchanged", async () => {
  const payload = '<img src=x onerror="synthetic">&\'';
  for (const field of ["name", "templateText", "type", "notes", "veicolo_modello"]) {
    const h = harness();
    await h.send({[field]: payload});
    assert.equal(h.mails.length, 1);
    assert.equal(h.mails[0].html.includes("<img src=x"), false, field);
    assert.ok(h.mails[0].html.includes("&lt;img src=x onerror=&quot;synthetic&quot;&gt;&amp;&#39;"), field);
    if (field === "type") assert.ok(h.mails[0].subject.includes(payload));
  }
});
test("HTML encoder preserves plain strings and handles empty values", () => {
  const encode = harness().sandbox.escapeHtml;
  assert.equal(typeof encode, "function");
  assert.equal(encode('a&b<c>d"e\'f'), "a&amp;b&lt;c&gt;d&quot;e&#39;f");
  for (const value of [null, undefined, ""]) assert.equal(encode(value), "");
  assert.equal(encode("plain"), "plain");
});
