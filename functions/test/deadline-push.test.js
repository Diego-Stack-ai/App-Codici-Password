"use strict";
// DeepSeek A1 proposal, consolidated: real handlers; in-memory SDK, no network.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
function section(a, b) {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
const code = section("function sanitizeEmail(", "async function resolveRecipientUsers(") +
  section("function shouldSendPush(", "exports.sendDeadlinePushTest = onCall(");
const NOW = new Date(2026, 8, 26, 12).getTime();
class Clock extends Date {
  constructor(...args) {super(...(args.length ? args : [NOW]));}
  static now() {return NOW;}
}
const plain = value => JSON.parse(JSON.stringify(value));
const notification = "users/owner/deadlineNotifications/dl_20260930_after_initial";
const delivery = notification.replace("deadlineNotifications", "notificationDeliveries") + "_device";
const devicePath = "users/owner/pushDevices/device";
const active = {enabled: true, token: "synthetic", notificationScopes: ["deadlines"]};
function harness({devices = {[devicePath]: active}, initial = {}, failure, shared = new Map(), users = {}, now = NOW} = {}) {
  const records = new Map(Object.entries(initial)), sent = [], updates = [], writes = [];
  const ledger = require("../recipient-delivery-ledger");
  const ledgerFixture = require("./recipient-ledger-fixture")();
  const ref = path => ({path, id: path.split("/").pop(), collection: name => collection(`${path}/${name}`),
    async get() {return {exists: records.has(path) || Boolean(devices[path]), data: () => records.get(path) || devices[path]};},
    set(value, options) {
      records.set(path, {...(options?.merge ? records.get(path) : {}), ...value});
      writes.push(path);
      return Promise.resolve();
    },
    async update(value) {updates.push({path, value}); records.set(path, {...records.get(path), ...value});}
  });
  const collection = path => path === ledger.COLLECTION ? ledgerFixture.db.collection(path) : ({doc: id => ref(`${path}/${id}`),
    async get() {assert.equal(path, "users"); return {docs: [{id: "owner"}]};},
    where(field, op, value) {
    assert.equal(op, "==");
    return {async get() {return {docs: (path.endsWith("/scadenze") ? Array.from(records) : Object.entries(devices).map(([key, data]) => [key, {...data, ...records.get(key)}]))
      .filter(([key, data]) => key.startsWith(path + "/") && data[field] === value)
      .map(([key, data]) => ({id: key.split("/").pop(), data: () => data, ref: ref(key)}))};}};
  }});
  let transactionTail = Promise.resolve();
  const db = {collection, runTransaction(fn) {
    const next = transactionTail.then(() => fn({get: item => item.get(),
      set: (item, value, options) => item.set(value, options), delete: item => item.delete()}));
    transactionTail = next.catch(() => {});
    return next;
  }};
  class ScenarioClock extends Clock {
    constructor(...args) {super(...(args.length ? args : [now]));}
    static now() {return now;}
  }
  const context = {recipientDeliveryLedger: ledger, deadlineCalendar: require("../deadline-calendar"), Date: ScenarioClock, crypto, console: {log() {}, error() {}},
    syncReceivedDeadlines: async () => shared,
    admin: {firestore: {FieldValue: {serverTimestamp: () => "synthetic-time", increment: n => ({increment: n})}},
      messaging: () => ({async send(payload) {
        sent.push(payload);
        const error = typeof failure === "function" ? await failure(payload) : failure;
        if (error) throw error;
      }}),
      auth: () => ({async getUserByEmail(email) {
        if (!users[email]) throw Object.assign(new Error("absent"), {code: "auth/user-not-found"});
        return users[email];
      }})}};
  vm.runInNewContext(code, context);
  const recipientSender = context.sendRecipientDeadlinePushes;
  context.sendRecipientDeadlinePushes = (database, uid, id, deadline, ...args) => {
    const path = `users/${uid}/scadenze/${id}`;
    if (!records.get(path)?.dueDate) records.set(path, {...deadline, ...records.get(path)});
    return recipientSender(database, uid, id, deadline, ...args);
  };
  const record = {dueDate: "2026-09-30", type: "Synthetic"};
  return {context, db, records, sent, updates, writes, setNow: value => {now = value;},
    run: (patch = {}, days = 4) => context.sendDeadlinePush(db, "owner", "dl", {...record, ...patch}, days)};
}
test("push helper filters scopes/tokens and normalizes/deduplicates recipients", async () => {
  const h = harness({devices: {[devicePath]: active,
    "users/owner/pushDevices/off": {...active, enabled: false},
    "users/owner/pushDevices/no-token": {...active, token: ""},
    "users/owner/pushDevices/sharing": {...active, notificationScopes: ["sharing"]}}});
  const devices = await h.context.activePushDevices(h.db, "owner");
  assert.deepEqual(Array.from(devices, d => d.id), ["device"]);
  const recipients = h.context.deadlineRecipients({recipients: [
    {email: " A@example.invalid ", sendEmail: false},
    {email: "a@example.invalid", sendPush: true, canManage: true}, {email: "invalid"}]});
  assert.deepEqual(plain(recipients), [{email: "a@example.invalid", displayName: "",
    sendEmail: true, sendPush: true, canManage: true}]);
  assert.equal(h.context.deadlineRecipients({email1: "legacy@example.invalid"})[0].sendEmail, true);
  assert.match(h.context.pushText({}, 0).body, /Scade oggi/);
});

test("real scheduler and recipient sender retry next day, respect cadence and stop after expiry", async () => {
  const deadlinePath = "users/owner/scadenze/dl";
  let recovered = false;
  const h = harness({now: Date.parse("2026-09-26T07:00:00Z"),
    initial: {[deadlinePath]: {dueDate: "2026-09-30", completed: false, notif_frequency: 7,
      lastRecipientPushNotifiedAt: "2026-09-18", recipients: [{email: "a@example.invalid", sendPush: true, sendEmail: false}]}},
    devices: {"users/guest/pushDevices/device": active}, users: {"a@example.invalid": {uid: "guest"}},
    shared: new Map([["guest", {}]]), failure: () => recovered ? null : Object.assign(new Error("synthetic"), {code: "messaging/server-unavailable"})});
  const firestore = () => h.db;
  firestore.FieldValue = h.context.admin.firestore.FieldValue;
  h.context.admin.firestore = firestore;
  Object.assign(h.context, {exports: {}, onSchedule: (_config, handler) => handler,
    GMAIL_USER: {value: () => "synthetic"}, GMAIL_APP_PASSWORD: {value: () => "synthetic"},
    createTransporter: () => ({}), sendDeadlinePush: async () => {},
    sendScadenzaEmail: async () => {throw new Error("email must stay opted out");}});
  vm.runInNewContext(section("exports.checkDeadlines = onSchedule(", "exports.onScadenzaCreated = onDocumentCreated("), h.context);
  await h.context.exports.checkDeadlines();
  assert.equal(h.sent.length, 1);
  assert.equal(h.records.get(deadlinePath).lastRecipientPushNotifiedAt, "2026-09-18");
  recovered = true;
  h.setNow(Date.parse("2026-09-27T07:00:00Z"));
  await h.context.exports.checkDeadlines();
  assert.equal(h.sent.length, 2);
  assert.equal(h.records.get(deadlinePath).lastRecipientPushNotifiedAt, "2026-09-27");
  h.setNow(Date.parse("2026-09-28T07:00:00Z"));
  await h.context.exports.checkDeadlines();
  assert.equal(h.sent.length, 2);
  h.setNow(Date.parse("2026-09-30T07:00:00Z"));
  await h.context.exports.checkDeadlines();
  assert.equal(h.sent.length, 3);
  assert.equal(h.sent[2].webpush.headers.TTL, "21600");
  h.setNow(Date.parse("2026-10-01T07:00:00Z"));
  await h.context.exports.checkDeadlines();
  assert.equal(h.sent.length, 3);
});
test("push frequency stops all writes; force/today override it", async () => {
  const h = harness();
  const recent = {lastPushNotifiedAt: new Clock()};
  assert.equal(h.context.shouldSendPush(recent, 3), false);
  assert.equal(h.context.shouldSendPush(recent, 0), true);
  assert.equal(h.context.shouldSendPush(recent, 3, true), true);
  assert.equal(h.context.shouldSendPush({lastPushNotifiedAt: "invalid"}, 3), true);
  await h.run(recent);
  assert.equal(h.sent.length + h.writes.length + h.updates.length, 0);
});
test("push creates notification and receipt; repeat preserves viewed state and does not resend", async () => {
  const h = harness();
  await h.run();
  assert.equal(h.records.get(notification).status, "unread");
  assert.deepEqual(plain(h.records.get(notification)), {eventType: "deadline", deadlineId: "dl",
    dueDate: "2026-09-30", diffDays: 4, status: "unread", createdAt: "synthetic-time"});
  assert.equal(h.records.get(delivery).status, "sent");
  assert.deepEqual(plain(h.records.get(delivery).attempts), {increment: 1});
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].data.notificationId, "dl_20260930_after_initial");
  assert.equal(h.sent[0].data.deliveryTag, "dl_20260930_after_initial_device");
  assert.equal(h.sent[0].webpush.headers.TTL, "86400");
  assert.equal(h.updates[0].path, "users/owner/scadenze/dl");
  h.records.get(notification).status = "viewed";
  await h.run();
  assert.equal(h.sent.length, 1);
  assert.equal(h.records.get(notification).status, "viewed");
});
test("push lease blocks recent work, expired lease retries", async () => {
  for (const minutes of [9, 11]) {
    const h = harness({initial: {[delivery]: {status: "sending", updatedAt: {toMillis: () => NOW - minutes * 60000}}}});
    await h.run();
    assert.equal(h.sent.length, minutes === 11 ? 1 : 0);
  }
});
test("push permanent token errors disable only device; transient errors preserve device and date", async () => {
  for (const code of ["messaging/registration-token-not-registered", "messaging/internal-error"]) {
    const h = harness({failure: Object.assign(new Error("synthetic"), {code})});
    await h.run();
    assert.equal(h.records.get(delivery).status, "failed");
    assert.equal(h.records.has(devicePath), code === "messaging/registration-token-not-registered");
    if (h.records.has(devicePath)) assert.equal(h.records.get(devicePath).enabled, false);
    assert.equal(h.updates.length, 0);
  }
});
test("push no devices still produces inbox record; D0 has distinct ID and short TTL", async () => {
  const h = harness({devices: {}});
  await h.run();
  assert.equal(h.sent.length, 0);
  assert.equal(h.records.get(notification).status, "unread");
  assert.equal(h.updates.length, 1);
  const today = harness();
  await today.run({}, 0);
  assert.equal(today.sent[0].data.notificationId, "dl_20260930_D0");
  assert.equal(today.sent[0].webpush.headers.TTL, "21600");
});
test("recipient push sends only to synchronized recipients, with received ID", async () => {
  const h = harness({devices: {"users/guest/pushDevices/device": active,
    "users/outsider/pushDevices/device": active}, shared: new Map([["guest", {}]]),
    users: {"a@example.invalid": {uid: "guest"}, "b@example.invalid": {uid: "outsider"}}});
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
    recipients: [{email: "a@example.invalid", sendPush: true, canManage: true},
      {email: "b@example.invalid", sendPush: true}]}, 4);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].data.receivedDeadlineId, crypto.createHash("sha256").update("owner:dl").digest("hex").slice(0, 40));
  assert.match(h.sent[0].data.body, /Se la gestisci tu/);
  assert.equal(h.updates.length, 1);
});

test("recipient invalid token disables device without marking successful delivery", async () => {
  const path = "users/guest/pushDevices/device";
  const h = harness({devices: {[path]: active}, shared: new Map([["guest", {}]]),
    users: {"a@example.invalid": {uid: "guest"}},
    failure: Object.assign(new Error("synthetic"), {code: "messaging/invalid-registration-token"})});
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
    recipients: [{email: "a@example.invalid", sendPush: true}]}, 4);
  assert.equal(h.records.get(path).enabled, false);
  assert.equal(h.records.get(path).status, "invalid");
  assert.equal(h.updates.length, 0);
});

test("push frequency crosses DST and both markers use the Italian day", async () => {
  const spring = harness({now: Date.parse("2026-03-30T07:00:00Z")});
  assert.equal(spring.context.shouldSendPush({lastPushNotifiedAt: "2026-03-23", notif_frequency: 7}, 3), true);
  assert.equal(spring.context.shouldSendPush({lastPushNotifiedAt: "2026-03-24", notif_frequency: 7}, 3), false);
  const h = harness({now: Date.parse("2026-09-26T22:30:00Z"),
    devices: {[devicePath]: active, "users/guest/pushDevices/device": active},
    shared: new Map([["guest", {}]]), users: {"a@example.invalid": {uid: "guest"}}});
  await h.run();
  assert.equal(h.updates[0].value.lastPushNotifiedAt, "2026-09-27");
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
    recipients: [{email: "a@example.invalid", sendPush: true}]}, 3);
  assert.equal(h.updates[1].value.lastRecipientPushNotifiedAt, "2026-09-27");
});

test("recipient total temporary failure preserves marker; partial success keeps its cadence", async () => {
  for (const partial of [false, true]) {
    const h = harness({devices: {"users/guest/pushDevices/one": {...active, token: "one"},
      "users/guest/pushDevices/two": {...active, token: "two"}},
      users: {"a@example.invalid": {uid: "guest"}}, shared: new Map([["guest", {}]]),
      failure: payload => partial && payload.token === "one" ? null : Object.assign(new Error("synthetic"), {code: "messaging/server-unavailable"})});
    await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
      recipients: [{email: "a@example.invalid", sendPush: true}]}, 4);
    assert.equal(h.sent.length, 2);
    assert.equal(h.updates.length, partial ? 1 : 0);
    if (partial) assert.ok(h.updates[0].value.lastRecipientPushNotifiedAt);
  }
});

test("recipient temporary failure permits a later retry, successful retry advances marker", async () => {
  let recovered = false;
  const h = harness({devices: {"users/guest/pushDevices/one": active},
    users: {"a@example.invalid": {uid: "guest"}}, shared: new Map([["guest", {}]]),
    failure: () => recovered ? null : Object.assign(new Error("synthetic"), {code: "messaging/internal-error"})});
  const deadline = {dueDate: "2026-09-30", lastRecipientPushNotifiedAt: "2026-09-18",
    recipients: [{email: "a@example.invalid", sendPush: true}]};
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", deadline, 4);
  assert.equal(h.updates.length, 0);
  assert.equal(deadline.lastRecipientPushNotifiedAt, "2026-09-18");
  recovered = true;
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", deadline, 3);
  assert.equal(h.sent.length, 2);
  assert.equal(h.updates.length, 1);
});

test("owner partial failure retries the failed device without resending the accepted device", async () => {
  let recovered = false;
  const h = harness({devices: {[devicePath]: {...active, token: "one"},
    "users/owner/pushDevices/two": {...active, token: "two"}},
    failure: payload => !recovered && payload.token === "two" ? Object.assign(new Error("synthetic"), {code: "messaging/server-unavailable"}) : null});
  await h.run();
  assert.equal(h.updates.length, 0);
  recovered = true;
  await h.run();
  assert.deepEqual(h.sent.map(payload => payload.token), ["one", "two", "two"]);
  assert.equal(h.updates.length, 1);
});

test("recipient no-device and failed sends do not advance success marker", async () => {
  for (const errorCode of [null, "messaging/invalid-argument", "messaging/quota-exceeded"]) {
    const h = harness({devices: errorCode ? {"users/guest/pushDevices/device": active} : {},
      users: {"a@example.invalid": {uid: "guest"}}, shared: new Map([["guest", {}]]),
      failure: errorCode ? Object.assign(new Error("synthetic"), {code: errorCode}) : null});
    await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
      recipients: [{email: "a@example.invalid", sendPush: true}]}, 4);
    assert.equal(h.updates.length, 0);
    assert.equal(h.sent.length, errorCode ? 1 : 0);
  }
});

test("mixed invalid and temporary failures disable only invalid device and retain marker", async () => {
  const bad = "users/guest/pushDevices/bad";
  const h = harness({devices: {[bad]: {...active, token: "bad"}, "users/guest/pushDevices/temporary": active},
    users: {"a@example.invalid": {uid: "guest"}}, shared: new Map([["guest", {}]]),
    failure: payload => Object.assign(new Error("synthetic"), {code: payload.token === "bad"
      ? "messaging/invalid-registration-token" : "messaging/internal-error"})});
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
    recipients: [{email: "a@example.invalid", sendPush: true}]}, 4);
  assert.equal(h.records.get(bad).enabled, false);
  assert.equal(h.updates.length, 0);
  const available = await h.context.activePushDevices(h.db, "guest");
  assert.deepEqual(Array.from(available, device => device.id), ["temporary"]);
});

test("concurrent owner calls share one reservation under serialized transactions", async () => {
  let release, entered;
  const pending = new Promise(resolve => {release = resolve;});
  const started = new Promise(resolve => {entered = resolve;});
  const h = harness({failure: async () => {entered(); await pending; return null;}});
  h.context.admin.firestore.FieldValue.serverTimestamp = () => ({toMillis: () => NOW});
  // Model atomic transactions, not Firestore contention/retry implementation.
  let tail = Promise.resolve();
  const original = h.db.runTransaction;
  h.db.runTransaction = fn => {
    const next = tail.then(() => original(fn));
    tail = next.catch(() => {});
    return next;
  };
  const first = h.run();
  try {
    await started;
    await h.run();
    assert.equal(h.sent.length, 1);
  } finally {release(); await first;}
  assert.equal(h.records.get(delivery).status, "sent");
});

test("overlapping recipient calls share the per-device reservation", async () => {
  let release, entered;
  const pending = new Promise(resolve => {release = resolve;});
  const started = new Promise(resolve => {entered = resolve;});
  const h = harness({devices: {"users/guest/pushDevices/device": active},
    users: {"a@example.invalid": {uid: "guest"}}, shared: new Map([["guest", {}]]),
    failure: async () => {entered(); await pending; return null;}});
  const deadline = {dueDate: "2026-09-30", recipients: [{email: "a@example.invalid", sendPush: true}]};
  const run = () => h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", deadline, 4);
  const first = run();
  await started;
  const second = run();
  release();
  await Promise.all([first, second]);
  assert.equal(h.sent.length, 1, "one active claim; uncertain retries still may duplicate");
  assert.equal(h.updates.length, 1);
});

test("recipient partial success retries only failed device despite today's global marker", async () => {
  let recovered = false;
  const h = harness({devices: {"users/guest/pushDevices/one": {...active, token: "one"},
    "users/guest/pushDevices/two": {...active, token: "two"}}, users: {"a@example.invalid": {uid: "guest"}},
    shared: new Map([["guest", {}]]), failure: payload => !recovered && payload.token === "two"
      ? Object.assign(new Error("synthetic"), {code: "messaging/internal-error"}) : null});
  const deadline = {dueDate: "2026-09-30", recipients: [{email: "a@example.invalid", sendPush: true}]};
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", deadline, 4);
  recovered = true;
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {...deadline, lastRecipientPushNotifiedAt: "2026-09-26"}, 4);
  assert.deepEqual(h.sent.map(payload => payload.token), ["one", "two", "two"]);
});

test("invalid old push token cannot disable a concurrent replacement", async () => {
  const path = "users/guest/pushDevices/device";
  const h = harness({devices: {[path]: active}, users: {"a@example.invalid": {uid: "guest"}},
    shared: new Map([["guest", {}]]), failure: () => {
      h.records.set(path, {...active, token: "replacement"});
      return Object.assign(new Error("synthetic"), {code: "messaging/invalid-registration-token"});
    }});
  await h.context.sendRecipientDeadlinePushes(h.db, "owner", "dl", {dueDate: "2026-09-30",
    recipients: [{email: "a@example.invalid", sendPush: true}]}, 4);
  assert.equal(h.records.get(path).enabled, true);
  assert.equal(h.records.get(path).token, "replacement");
});
