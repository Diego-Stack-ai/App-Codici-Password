"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const budget = require("../notification-provider-budget");
const ledger = require("../recipient-delivery-ledger");
const invites = require("../invite-notification-guard");
const fixture = require("./recipient-ledger-fixture");
const NOW = Date.parse("2026-11-07T12:00:00Z");
const HOUR = 3600000;
const DAY = 24 * HOUR;
const hash = parts => crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const recordsIn = (f, collection) => [...f.records].filter(([path]) => path.startsWith(`${collection}/`));

function harness() {
  const f = fixture();
  let sends = 0;
  const send = async () => {sends++; return true;};
  const deadline = (index, overrides = {}) => ledger.deliver({db: f.db,
    identity: {ownerUid: "owner", deadlineId: `deadline-${index}`, dueDate: "2026-11-10",
      recipient: `recipient-${index}@example.invalid`, channel: "email"},
    eligible: async () => true, send, now: () => NOW, ...overrides});
  function invitation(index, overrides = {}) {
    const ownerId = `owner-${index}`, accountId = `account-${index}`;
    const recipientEmail = `invite-${index}@example.invalid`;
    const key = recipientEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const inviteId = `${accountId}_${key}`;
    const invite = {inviteId, ownerId, senderId: ownerId, accountId, recipientEmail,
      status: "pending", cycle: 0, auditRef: "11111111-1111-4111-8111-111111111111"};
    f.records.set(`users/${ownerId}/accounts/${accountId}`, {sharingCycle: 0,
      sharedWith: {[key]: {email: recipientEmail, status: "pending", notifyEmail: true}}});
    f.records.set(`invites/${inviteId}`, invite);
    return invites.deliver({db: f.db, auth: {getUserByEmail: async () => ({uid: `guest-${index}`})},
      invite, inviteId, channel: "email", now: () => NOW, send, ...overrides});
  }
  return {...f, deadline, invitation, get sends() {return sends;}};
}

test("concurrent fresh deadline IDs share recipient budget and reject without new ledgers", async () => {
  const h = harness();
  const results = await Promise.all(Array.from({length: 40}, (_, index) => h.deadline(index, {
    identity: {ownerUid: `owner-${index}`, deadlineId: `deadline-${index}`, dueDate: "2026-11-07",
      recipient: index % 2 ? "target@example.invalid" : " TARGET@EXAMPLE.INVALID ", channel: "email"},
    forceImmediate: true})));
  assert.equal(h.sends, budget.RECIPIENT_LIMIT_PER_HOUR);
  assert.equal(results.filter(result => result.status === "rate-limited").length, 35);
  assert.equal(recordsIn(h, ledger.COLLECTION).length, 5);
  assert.equal(recordsIn(h, budget.RATE_COLLECTION).length, 12);
  assert.equal(JSON.stringify(recordsIn(h, ledger.COLLECTION).concat(recordsIn(h, budget.RATE_COLLECTION)))
    .includes("example.invalid"), false);
});

test("concurrent deadlines share owner daily quota across hours and reset on the next day", async () => {
  const h = harness();
  const results = await Promise.all(Array.from({length: 110}, (_, index) => h.deadline(index)));
  assert.equal(results.filter(result => result.status === "sent").length, budget.OWNER_LIMIT_PER_DAY.email);
  assert.equal((await h.deadline("next-hour", {now: () => NOW + HOUR})).status, "rate-limited");
  assert.equal(recordsIn(h, ledger.COLLECTION).length, 100);
  assert.equal((await h.deadline("next-day", {now: () => NOW + DAY})).status, "sent");
  assert.equal(h.sends, 101);
});

test("invites and deadlines atomically contend for one global provider budget", async () => {
  const h = harness();
  const attempts = Array.from({length: 420}, (_, index) => index % 2 ? h.invitation(index) : h.deadline(index, {
    identity: {ownerUid: `owner-${index}`, deadlineId: `deadline-${index}`, dueDate: "2026-11-10",
      recipient: `recipient-${index}@example.invalid`, channel: "email"}}));
  const results = await Promise.all(attempts);
  assert.equal(h.sends, budget.GLOBAL_LIMIT_PER_DAY.email);
  assert.equal(results.filter(result => result.status === "rate-limited").length, 20);
  assert.equal(recordsIn(h, ledger.COLLECTION).length + recordsIn(h, invites.LEDGER_COLLECTION).length, 400);
  const globalPath = `${budget.RATE_COLLECTION}/${hash(["global-day", "email", Math.floor(NOW / DAY)])}`;
  assert.equal(h.records.get(globalPath).count, 400);
  assert.equal((await h.deadline("global-next-hour", {now: () => NOW + HOUR})).status, "rate-limited");
});

test("existing invitation owner and recipient counters also block deadline admission", async () => {
  for (const [parts, count] of [
    [["owner", "owner", "email", Math.floor(NOW / HOUR)], budget.OWNER_LIMIT_PER_HOUR],
    [["owner-day", "owner", "email", Math.floor(NOW / DAY)], budget.OWNER_LIMIT_PER_DAY.email],
    [["recipient", "recipient-1@example.invalid", "email", Math.floor(NOW / HOUR)], budget.RECIPIENT_LIMIT_PER_HOUR],
    [["global-day", "email", Math.floor(NOW / DAY)], budget.GLOBAL_LIMIT_PER_DAY.email]
  ]) {
    const h = harness();
    h.records.set(`${budget.RATE_COLLECTION}/${hash(parts)}`, {count, expiresAt: NOW + budget.RETENTION_MS});
    assert.equal((await h.deadline(1)).status, "rate-limited");
    assert.equal(h.sends, 0);
    assert.equal(h.records.size, 1);
    assert.equal((await h.deadline(1, {identity: {ownerUid: "owner", deadlineId: "push", dueDate: "2026-11-10",
      recipient: "recipient-1@example.invalid", channel: "push"}})).status, "sent");
  }
});

test("corrupt shared provider counter fails closed without growing deadline records", async () => {
  const h = harness();
  const path = `${budget.RATE_COLLECTION}/${hash(["global-day", "email", Math.floor(NOW / DAY)])}`;
  h.records.set(path, {count: -1});
  const results = await Promise.all(Array.from({length: 20}, (_, index) => h.deadline(index)));
  assert.ok(results.every(result => result.status === "blocked"));
  assert.equal(h.sends, 0);
  assert.equal(h.records.size, 1);
});

test("uncertain retries consume provider attempts, successes retain cadence, later hour can retry", async () => {
  const h = harness();
  const identity = {ownerUid: "owner", deadlineId: "deadline", dueDate: "2026-11-07",
    recipient: "target@example.invalid", channel: "email"};
  let attempts = 0;
  const failing = async () => {attempts++; throw Error("provider uncertain");};
  for (let index = 0; index < budget.RECIPIENT_LIMIT_PER_HOUR; index++) {
    await assert.rejects(h.deadline(index, {identity, forceImmediate: true, send: failing}), /provider uncertain/);
  }
  assert.equal((await h.deadline("blocked", {identity, forceImmediate: true, send: failing})).status, "rate-limited");
  assert.equal(attempts, 5);
  assert.equal(recordsIn(h, ledger.COLLECTION).length, 1);
  assert.equal((await h.deadline("resumed", {identity, now: () => NOW + HOUR})).status, "sent");
  assert.equal((await h.deadline("duplicate", {identity, forceImmediate: true, now: () => NOW + HOUR})).status, "skipped");
});
