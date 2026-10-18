"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const enabledStart = source.indexOf("function deadlineDeliveryEnabled(");
const schedulerStart = source.indexOf("exports.checkDeadlines = onSchedule(", enabledStart);
const updateStart = source.indexOf("exports.onScadenzaUpdated = onDocumentUpdated(", schedulerStart);
const updateEnd = source.indexOf("exports.onScadenzaDeleted = onDocumentDeleted(", updateStart);
assert.ok(enabledStart >= 0 && schedulerStart > enabledStart && updateStart > schedulerStart && updateEnd > updateStart);
const updateCode = source.slice(enabledStart, schedulerStart) + source.slice(updateStart, updateEnd);

function harness({before, after, now = "2026-10-18T14:00:00Z"}) {
  const calls = [];
  let triggerConfig;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return Date.parse(now); }
  }
  const db = {
    collection(name) {
      assert.equal(name, "users");
      return {doc(uid) {
        assert.equal(uid, "owner");
        return {collection(collectionName) {
          assert.equal(collectionName, "deadlineNotifications");
          return {where(field, operator, value) {
            assert.deepEqual([field, operator, value], ["deadlineId", "==", "deadline"]);
            return {get: async () => ({docs: []})};
          }};
        }};
      }};
    },
    batch() {
      return {
        set() { calls.push("resolve"); },
        update(_ref, patch) {
          calls.push(["reset", Object.keys(patch).sort()]);
        },
        async commit() { calls.push("commit"); }
      };
    }
  };
  const firestore = () => db;
  firestore.FieldValue = {
    delete: () => "deleted",
    serverTimestamp: () => "timestamp"
  };
  const context = {
    Date: Clock,
    deadlineCalendar: require("../deadline-calendar"),
    exports: {},
    onDocumentUpdated: (config, handler) => {
      triggerConfig = config;
      return handler;
    },
    admin: {firestore},
    syncReceivedDeadlines: async () => calls.push("sync"),
    console: {log() {}, error(...args) { calls.push(["error", args.map(String).join(" ")]); }},
    GMAIL_USER: {value: () => "sender@example.invalid"},
    GMAIL_APP_PASSWORD: {value: () => "synthetic-secret"},
    createTransporter: () => ({synthetic: true}),
    deadlineRecipients: data => data.recipients || [],
    sendDeadlinePush: async (_db, uid, id, data, days, options) => {
      assert.deepEqual([uid, id, days, options.forceImmediate], ["owner", "deadline", 12, true]);
      assert.equal(data.lastPushNotifiedAt, null);
      calls.push("push");
    },
    sendRecipientDeadlinePushes: async (_db, uid, id, data, days, options) => {
      assert.deepEqual([uid, id, days, options.forceImmediate], ["owner", "deadline", 12, true]);
      assert.equal(data.lastRecipientPushNotifiedAt, null);
      calls.push("recipient-push");
    },
    sendScadenzaEmail: async (_transporter, sender, data, days) => {
      assert.deepEqual([sender, days], ["sender@example.invalid", 12]);
      assert.equal(data.lastNotifiedAt, null);
      calls.push("email");
    }
  };
  vm.runInNewContext(updateCode, context);
  const ref = {};
  return {
    calls,
    config: () => triggerConfig,
    run: () => context.exports.onScadenzaUpdated({
      params: {uid: "owner", scadenzaId: "deadline"},
      data: {
        before: {data: () => before},
        after: {data: () => after, ref}
      }
    })
  };
}

test("date update inside the notice window sends email and push immediately", async () => {
  const recipients = [{email: "recipient@example.invalid", sendEmail: true, sendPush: true}];
  const scenario = harness({
    before: {dueDate: "2026-10-31", completed: false, recipients},
    after: {
      dueDate: "2026-10-30",
      completed: false,
      notif_days_before: 112,
      notif_frequency: 14,
      notificationsEnabled: true,
      recipients,
      lastPushNotifiedAt: "2026-10-01",
      lastRecipientPushNotifiedAt: "2026-10-01",
      lastNotifiedAt: "2026-10-01"
    }
  });

  await scenario.run();

  assert.ok(scenario.config().secrets, "the update trigger must receive mail secrets");
  assert.ok(scenario.calls.includes("commit"), "legacy delivery markers must be reset first");
  assert.deepEqual(scenario.calls.slice(-3), ["push", "recipient-push", "email"]);
});

test("date update outside the notice window resets state without delivering", async () => {
  const scenario = harness({
    before: {dueDate: "2026-10-31", completed: false},
    after: {
      dueDate: "2027-10-30",
      completed: false,
      notif_days_before: 112,
      notificationsEnabled: true,
      recipients: [{email: "recipient@example.invalid", sendEmail: true, sendPush: true}]
    }
  });

  await scenario.run();

  assert.ok(scenario.calls.includes("commit"));
  assert.equal(scenario.calls.includes("push"), false);
  assert.equal(scenario.calls.includes("recipient-push"), false);
  assert.equal(scenario.calls.includes("email"), false);
});

