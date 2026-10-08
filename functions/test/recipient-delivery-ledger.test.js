"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ledger = require("../recipient-delivery-ledger");
const fixture = require("./recipient-ledger-fixture");
const identity = {ownerUid: "owner", deadlineId: "deadline", dueDate: "2026-10-10", recipient: "a@example.invalid", channel: "email"};
const START = Date.parse("2026-09-27T08:00:00Z");
function setup() {
  const {db, records} = fixture();
  let time = START, sends = 0;
  return {db, records, advance: delta => {time += delta;}, get sends() {return sends;},
    run: (patch = {}) => ledger.deliver({db, identity, eligible: async () => true,
      send: async () => {sends++;}, now: () => time, ...patch})};
}
test("atomic claim excludes overlap and successful same-day replay even with force", async () => {
  const h = setup();
  const results = await Promise.all([h.run(), h.run()]);
  assert.equal(h.sends, 1);
  assert.deepEqual(results.map(r => r.status).sort(), ["sent", "skipped"]);
  assert.equal((await h.run({forceImmediate: true})).status, "skipped");
  h.advance(6 * 86400000);
  assert.equal((await h.run()).status, "skipped");
  h.advance(86400000);
  assert.equal((await h.run()).status, "sent");
});
test("recipient/channel/deadline/due identity are independent; failures retry without resending successes", async () => {
  const h = setup();
  await h.run();
  const other = {...identity, recipient: "b@example.invalid"};
  await assert.rejects(h.run({identity: other, send: async () => {throw new Error("private provider token");}}));
  await h.run({identity: other});
  assert.equal((await h.run()).status, "skipped");
  for (const patch of [{channel: "push"}, {deadlineId: "homonym"}, {dueDate: "2026-10-11"}]) await h.run({identity: {...identity, ...patch}});
  assert.equal(h.sends, 5);
  const persisted = JSON.stringify(Array.from(h.records));
  for (const forbidden of ["example.invalid", "private provider", "homonym", "2026-10-10"]) assert.equal(persisted.includes(forbidden), false);
});
test("expired lease permits uncertain retry; stale completion cannot overwrite new token", async () => {
  const h = setup();
  let entered, release;
  const started = new Promise(resolve => {entered = resolve;});
  const pending = new Promise(resolve => {release = resolve;});
  const first = h.run({send: async () => {entered(); await pending;}});
  await started;
  h.advance(ledger.LEASE_MS + 1);
  assert.equal((await h.run()).status, "sent");
  release();
  assert.equal((await first).status, "uncertain");
  assert.equal(Array.from(h.records.values())[0].state, "sent");
});
test("lost DB and withdrawn eligibility cannot authorize an external send", async () => {
  const h = setup();
  await assert.rejects(h.run({db: {...h.db, runTransaction: async () => {throw new Error("offline");}}}));
  assert.equal((await h.run({eligible: async () => false})).status, "cancelled");
  assert.equal(h.sends, 0);
});
test("due day bypasses cadence but not same-day reservation", async () => {
  const h = setup(), due = {...identity, dueDate: "2026-09-28"};
  await h.run({identity: due});
  h.advance(86400000);
  assert.equal((await h.run({identity: due})).status, "sent");
  assert.equal((await h.run({identity: due})).status, "skipped");
});

test("legacy global marker prevents a rollout burst without certifying per-recipient success", async () => {
  const h = setup();
  assert.equal((await h.run({legacyLastSentAt: "2026-09-27"})).status, "skipped");
  assert.equal(h.records.size, 0);
  h.advance(7 * 86400000);
  assert.equal((await h.run({legacyLastSentAt: "2026-09-27"})).status, "sent");
});

test("cadence above retention is explicitly suspended, never silently shortened", async () => {
  const h = setup();
  assert.equal((await h.run({frequency: 45})).status, "policy-blocked");
  assert.equal(h.sends + h.records.size, 0);
  assert.equal((await h.run({frequency: 45, identity: {...identity, dueDate: "2026-09-27"}})).status, "sent");
});

test("Italian calendar cadence across DST and exact 30-day boundary", async () => {
  for (const frequency of [7, 30]) {
    const h = setup();
    let time = Date.parse('2026-10-20T07:00:00Z');
    const run = () => h.run({frequency, identity: {...identity, dueDate: '2026-12-01'}, now: () => time,
      legacyLastSentAt: '2026-10-20'});
    // Seed the first real delivery, not the legacy floor.
    await h.run({frequency, identity: {...identity, dueDate: '2026-12-01'}, now: () => time});
    time += (frequency - 1) * 86400000;
    assert.equal((await run()).status, 'skipped');
    time += 86400000 + 3600000;
    assert.equal((await run()).status, 'sent');
  }
});

test("failed finish after accepted send stays uncertain until lease expiry", async () => {
  const h = setup();
  let fail = true;
  const db = {...h.db, runTransaction: fn => h.db.runTransaction(tx => fn({...tx, set(ref, data) {
    if (fail && data.state === 'sent') throw new Error('finish unavailable');
    return tx.set(ref, data);
  }}))};
  await assert.rejects(h.run({db}), /finish unavailable/);
  assert.equal(h.sends, 1);
  assert.equal((await h.run()).status, 'skipped');
  fail = false;
  h.advance(ledger.LEASE_MS + 1);
  assert.equal((await h.run({db})).status, 'sent');
  assert.equal(h.sends, 2, 'possible duplicate is explicit, not exactly-once');
});
test("cleanup includes uncertain/cancelled states and does not remove live claims", async () => {
  const f = fixture({[`${ledger.COLLECTION}/expired`]: {state: "uncertain", expiresAt: START - 1},
    [`${ledger.COLLECTION}/live`]: {state: "claimed", expiresAt: START - 1, leaseUntil: START + 1000},
    [`${ledger.COLLECTION}/future`]: {state: "cancelled", expiresAt: START + 1000}});
  assert.equal(await ledger.cleanup(f.db, () => START), 1);
  assert.equal(f.records.size, 2);
});
test("current eligibility rejects removed recipient, changed date, opt-out, completed and expired", async () => {
  const base = {dueDate: "2026-10-10", recipients: [{email: identity.recipient, sendEmail: true}]};
  for (const patch of [{completed: true}, {dueDate: "2026-10-11"}, {recipients: []},
    {recipients: [{email: identity.recipient, sendEmail: false}]}]) {
    assert.equal(await ledger.isEligible({docRef: {get: async () => ({exists: true, data: () => ({...base, ...patch})})},
      dueDate: identity.dueDate, recipient: base.recipients[0], channel: "email", recipients: s => s.recipients, now: () => START}), false);
  }
});
