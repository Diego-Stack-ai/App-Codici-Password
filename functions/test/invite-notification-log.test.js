"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("un errore di notifica non espone l'invito o il messaggio del provider nei log", async () => {
  const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
  const start = source.indexOf("exports.onInviteCreated = onDocumentCreated(");
  const end = source.indexOf("// ─────────────────────────────────────────────", start);
  assert.ok(start >= 0 && end > start);

  const logs = [];
  const inviteId = "account_email_personale_example_invalid";
  const providerError = "provider refused email.personale@example.invalid";
  const sandbox = {
    exports: {},
    onDocumentCreated: (_options, handler) => handler,
    GMAIL_USER: {value: () => "sender@example.invalid"},
    GMAIL_APP_PASSWORD: {value: () => "synthetic"},
    normalizeEmail: value => value,
    createTransporter: () => ({sendMail: async () => { throw new Error(providerError); }}),
    console: {error: (...args) => logs.push(args.map(String).join(" "))},
    Promise
  };
  vm.runInNewContext(source.slice(start, end), sandbox, {filename: "index.js:onInviteCreated"});
  await sandbox.exports.onInviteCreated({
    params: {inviteId},
    data: {data: () => ({status: "pending", recipientEmail: "email.personale@example.invalid", notifyEmail: true})}
  });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /INVITE NOTIFICATION FAILED.*DELIVERY_FAILED/);
  assert.ok(!logs[0].includes(inviteId));
  assert.ok(!logs[0].includes(providerError));
  assert.ok(!logs[0].includes("email.personale@example.invalid"));
});
