"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../invite-acceptance-receipt");
const {runInviteRevocationNotification: run} = require("../invite-revocation-notification");
const T = 1800000000000;
const receipt = h.buildAcceptanceReceipt({nonce: "11111111-1111-4111-8111-111111111111",
  guestUid: "guest", ownerUid: "owner", accountId: "account", kind: "private", companyId: null, cycle: 0});
const before = {ownerId: "owner", accountId: "account", cycle: 0, status: "accepted", acceptanceReceipt: receipt};
const accountPath = "users/owner/accounts/account";
const markerPath = "users/guest/notificationDeliveries/" + h.acceptanceMarkerId(receipt.nonce);
const notificationPath = "users/guest/notifications/" + h.acceptanceNotificationId(receipt.nonce);
const account = {isArchived: false, sharingCycle: 0, sharedWith: {}, sharedWithUids: []};
function fixture(seed = {[accountPath]: account}, retry = false) {
  const store = new Map(Object.entries(seed));
  let reads = 0, attempt = 0;
  const ref = path => ({path, collection: name => collection(path + "/" + name)});
  const collection = path => ({doc: id => ref(path + "/" + id)});
  const db = {doc: ref, collection, runTransaction: async callback => {
    for (attempt = 0; attempt < (retry ? 2 : 1); attempt++) {
      const staged = [];
      const result = await callback({get: async target => {
        assert.equal(staged.length, 0, "read after write"); reads++;
        return {exists: store.has(target.path), data: () => store.get(target.path)};
      }, set: (target, data) => staged.push([target.path, data])});
      if (retry && attempt === 0) continue;
      staged.forEach(([path, data]) => store.set(path, data));
      return result;
    }
  }};
  return {store, get reads() { return reads; }, run: (extra = {}) => run({db, inviteId: "invite",
    before, eventTimeMillis: T, now: () => attempt ? T + h.ACCEPTANCE_RETENTION_MS : T + 1,
    serverTimestamp: () => "synthetic", ...extra})};
}
test("atomic simulated delivery, dedup and deleted notification stays deleted", async () => {
  const f = fixture();
  assert.equal((await f.run()).action, "write");
  assert.equal(f.store.has(markerPath), true);
  assert.equal(f.store.has(notificationPath), true);
  f.store.delete(notificationPath);
  assert.equal((await f.run()).reason, "MARKER_PRESENT");
  assert.equal(f.store.has(notificationPath), false);
});
test("existing foreign marker and existing notification never overwritten", async () => {
  const foreign = {other: true};
  const f = fixture({[accountPath]: account, [markerPath]: foreign});
  assert.equal((await f.run()).reason, "MARKER_PRESENT");
  assert.deepEqual(f.store.get(markerPath), foreign);
  const g = fixture({[accountPath]: account, [notificationPath]: foreign});
  await g.run();
  assert.deepEqual(g.store.get(notificationPath), foreign);
  assert.equal(g.store.has(markerPath), true);
});
test("retry crossing expiry discards staged writes", async () => {
  const f = fixture(undefined, true);
  assert.equal((await f.run()).reason, "EVENT_TIME_EXPIRED");
  assert.equal(f.reads, 8);
  assert.equal(f.store.has(markerPath), false);
  assert.equal(f.store.has(notificationPath), false);
});
test("invalid receipt and event skip without database reads", async () => {
  for (const override of [{before: {}}, {before: {...before, acceptanceReceipt: {}}},
    {eventTimeMillis: undefined}, {eventTimeMillis: T + 100}]) {
    const f = fixture();
    assert.equal((await f.run(override)).action, "skip");
    assert.equal(f.reads, 0);
  }
});
test("reinvite, archive, cycle and active ACL block delivery", async () => {
  for (const seed of [{[accountPath]: account, "invites/invite": {}}, {},
    {[accountPath]: {...account, isArchived: true}}, {[accountPath]: {...account, sharingCycle: 1}},
    {[accountPath]: {...account, sharedWithUids: ["guest"]}},
    {[accountPath]: {...account, sharedWith: {entry: {status: "accepted", uid: "guest"}}}}]) {
    const f = fixture(seed);
    assert.equal((await f.run()).action, "skip");
    assert.equal(f.store.has(markerPath), false);
  }
});
test("company named privato uses company path", async () => {
  const f = fixture({"users/owner/aziende/privato/accounts/account": account});
  assert.equal((await f.run({before: {...before, aziendaId: "privato",
    acceptanceReceipt: {...receipt, kind: "company", companyId: "privato"}}})).action, "write");
});
test("legacy account without cycle is cycle zero, not malformed", async () => {
  const legacy = {...account};
  delete legacy.sharingCycle;
  const f = fixture({[accountPath]: legacy});
  assert.equal((await f.run()).action, "write");
  const invalid = fixture({[accountPath]: {...legacy, sharingCycle: null}});
  assert.equal((await invalid.run()).reason, "ACCOUNT_CYCLE_INVALID");
});
