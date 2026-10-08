"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {runAcceptanceMarkerCleanup: cleanup} = require("../invite-revocation-notification");
const {ACCEPTANCE_RETENTION_MS: retention} = require("../invite-acceptance-receipt");
const now = 1800000000000;
const nonce = "11111111-1111-4111-8111-111111111111";
const path = `users/a/notificationDeliveries/n1rev-m-${nonce}`;
const state = "sharingNotificationRetention/scan";
const marker = (expiresAt = now - 1) => ({kind: "n1-invite-revocation-marker",
  schemaVersion: 1, eventAt: expiresAt - retention, expiresAt});
function fixture(seed, {limit = 100, hook, clock = now} = {}) {
  const store = new Map(Object.entries(seed));
  const deletions = [];
  let reads = 0;
  const ref = path => ({path, get: async () => snap(path), set: async data => store.set(path, data)});
  const snap = path => {
    const exists = store.has(path), data = structuredClone(store.get(path));
    return {exists, ref: ref(path), data: () => structuredClone(data)};
  };
  const db = {doc: ref, collectionGroup: name => {
    assert.equal(name, "notificationDeliveries");
    let after = "", count;
    const query = {orderBy: field => {assert.equal(field, "__name__"); return query;},
      limit: n => {count = n; return query;}, startAfter: r => {after = r.path; return query;},
      get: async () => {
        const docs = [...store.keys()].filter(p => p.includes("/notificationDeliveries/") && p > after)
          .sort().slice(0, count).map(snap);
        hook?.(store);
        return {docs, size: docs.length};
      }};
    return query;
  }, runTransaction: async callback => {
    const staged = [];
    const result = await callback({get: async r => {assert.equal(staged.length, 0); reads++; return snap(r.path);},
      delete: r => staged.push(r.path)});
    staged.forEach(p => {store.delete(p); deletions.push(p);});
    return result;
  }};
  return {store, deletions, get reads() {return reads;}, run: () => cleanup({db, statePath: state,
    limit, now: () => clock, serverTimestamp: () => "synthetic"})};
}
test("only exact N1 expired marker removed; other paths/types/schemas preserved", async () => {
  const seed = {[path]: marker(),
    [`users/b/notificationDeliveries/n1rev-m-${nonce}`]: marker(now + 1),
    [`other/a/notificationDeliveries/n1rev-m-${nonce}`]: marker(),
    "users/a/notificationDeliveries/n1rev-m-bad": marker(),
    "users/a/notificationDeliveries/push": {kind: "deadline"},
    [`users/c/notificationDeliveries/n1rev-m-${nonce}`]: {...marker(), schemaVersion: 2},
    [`users/d/notificationDeliveries/n1rev-m-${nonce}`]: {...marker(), extra: true}};
  const f = fixture(seed);
  assert.deepEqual(await f.run(), {scanned: 7, deleted: 1});
  assert.deepEqual(f.deletions, [path]);
  Object.keys(seed).filter(p => p !== path).forEach(p => assert.equal(f.store.has(p), true));
});
test("transaction rereads changed candidate, preserving renewed or foreign record", async () => {
  for (const changed of [marker(now + 1), {...marker(), kind: "deadline"}]) {
    const f = fixture({[path]: marker()}, {hook: store => store.set(path, changed)});
    assert.equal((await f.run()).deleted, 0);
    assert.equal(f.reads, 1);
    assert.deepEqual(f.deletions, []);
    assert.deepEqual(f.store.get(path), changed);
  }
});
test("deleted cursor continues past non-N1 records without restarting", async () => {
  const later = "users/z/notificationDeliveries/push";
  const f = fixture({[path]: marker(), [later]: {kind: "deadline"}}, {limit: 1});
  await f.run();
  assert.equal(f.store.get(state).lastPath, path);
  const behind = `users/0/notificationDeliveries/n1rev-m-${nonce}`;
  f.store.set(behind, marker());
  assert.deepEqual(await f.run(), {scanned: 1, deleted: 0});
  assert.equal(f.store.get(state).lastPath, later);
  assert.equal(f.store.has(behind), true);
  await f.run();
  assert.equal(f.store.get(state).lastPath, null);
  await f.run();
  assert.equal(f.store.has(behind), false);
});
test("invalid clock cannot delete; candidate count bounded", async () => {
  const f = fixture({[path]: marker()}, {clock: NaN});
  assert.equal((await f.run()).deleted, 0);
  await assert.rejects(() => cleanup({db: {}, statePath: state, limit: 101}), /N1_CLEANUP_LIMIT_INVALID/);
});
