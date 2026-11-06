"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("un errore di notifica non espone l'invito o il messaggio del provider nei log", async () => {
  const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
  const start = source.indexOf("exports.onInviteCreated = onDocumentWritten(");
  const end = source.indexOf("// ─────────────────────────────────────────────", start);
  assert.ok(start >= 0 && end > start);

  const logs = [];
  const inviteId = "account_email_personale_example_invalid";
  const providerError = "provider refused email.personale@example.invalid";
  const sandbox = {
    exports: {},
    onDocumentWritten: (_options, handler) => handler,
    GMAIL_USER: {value: () => "sender@example.invalid"},
    GMAIL_APP_PASSWORD: {value: () => "synthetic"},
    admin: {firestore: () => ({}), auth: () => ({})},
    inviteNotificationGuard: {isNotificationTransition: () => true, deliver: async ({channel, send}) => {
      if (channel !== "email") return {status: "ineligible"};
      return send({recipientEmail: "email.personale@example.invalid", accountName: "Synthetic"});
    }},
    normalizeEmail: value => value,
    createTransporter: () => ({sendMail: async () => { throw new Error(providerError); }}),
    console: {error: (...args) => logs.push(args.map(String).join(" "))},
    Promise
  };
  vm.runInNewContext(source.slice(start, end), sandbox, {filename: "index.js:onInviteCreated"});
  await sandbox.exports.onInviteCreated({
    params: {inviteId},
    data: {
      before: {exists: false},
      after: {exists: true, data: () => ({status: "pending", recipientEmail: "email.personale@example.invalid", notifyEmail: true})}
    }
  });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /INVITE NOTIFICATION FAILED.*DELIVERY_FAILED/);
  assert.ok(!logs[0].includes(inviteId));
  assert.ok(!logs[0].includes(providerError));
  assert.ok(!logs[0].includes("email.personale@example.invalid"));
});

test('invitation notification trigger preserves retry for fenced participants instead of swallowing deferral', async () => {
  const source = fs.readFileSync(require.resolve('../index.js'), 'utf8');
  const start = source.indexOf('exports.onInviteCreated = onDocumentWritten(');
  const end = source.indexOf('// ─────────────────────────────────────────────', start);
  let config, calls = 0;
  const sandbox = {exports: {}, GMAIL_USER: {}, GMAIL_APP_PASSWORD: {}, onDocumentWritten: (options, handler) => {config = options; return handler;},
    admin: {firestore: () => ({}), auth: () => ({getUserByEmail() {throw Error('NOT_CALLED_IN_TRIGGER_FIXTURE');}})},
    inviteNotificationGuard: {isNotificationTransition: () => true, deliver: async ({auth}) => {
      assert.equal(typeof auth.getUserByEmail, 'function'); calls++;
      throw Object.assign(Error('RECOVERY_FENCE_ACTIVE'), {code: 'RECOVERY_FENCE_ACTIVE'});
    }}, console: {error() {throw Error('DEFERRAL_MUST_PROPAGATE');}}, Promise};
  vm.runInNewContext(source.slice(start, end), sandbox);
  await assert.rejects(sandbox.exports.onInviteCreated({params: {inviteId: 'fixture'},
    data: {before: {exists: false}, after: {exists: true, data: () => ({status: 'pending'})}}}), /RECOVERY_FENCE_ACTIVE/);
  assert.equal(config.retry, true); assert.equal(calls, 2);
});
