"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../invite-acceptance-receipt");
const time = 1800000000000;
test("event window is strict at boundary and rejects invalid/future times", () => {
  assert.equal(h.acceptanceEventWindow(time, time + h.ACCEPTANCE_RETENTION_MS - 1).inWindow, true);
  assert.equal(h.acceptanceEventWindow(time, time + h.ACCEPTANCE_RETENTION_MS).reason, "EVENT_TIME_EXPIRED");
  assert.equal(h.acceptanceEventWindow(time, time - 1).reason, "EVENT_TIME_FUTURE");
  for (const value of [null, undefined, NaN, Infinity, "1800000000000", 0, -1, 1.5, 253402300799999]) {
    assert.equal(h.acceptanceEventWindow(value, time).reason, "EVENT_TIME_INVALID");
  }
});
test("marker requires exact schema and exact representable expiry", () => {
  const marker = h.acceptanceMarkerPayload({eventAt: time, expiresAt: time + h.ACCEPTANCE_RETENTION_MS});
  assert.equal(h.isAcceptanceMarker(marker), true);
  for (const change of [{schemaVersion: 2}, {kind: "other"}, {extra: true}, {expiresAt: time + 1}]) {
    assert.equal(h.isAcceptanceMarker({...marker, ...change}), false);
  }
  assert.throws(() => h.acceptanceMarkerPayload({eventAt: 253402300799999, expiresAt: 253402300799999 + h.ACCEPTANCE_RETENTION_MS}));
});
test("raw marker existence blocks any rewrite, including a deleted notification", () => {
  assert.deepEqual(h.acceptanceNotificationPlan({markerRecordExists: true, notificationExists: false}),
    {action: "skip", reason: "MARKER_PRESENT"});
  assert.equal(h.acceptanceNotificationPlan({}).reason, "MARKER_STATE_INVALID");
});
test("eligible plan has separate IDs and generic notification without expiry", () => {
  const receipt = h.buildAcceptanceReceipt({nonce: "11111111-1111-4111-8111-111111111111",
    guestUid: "guest", ownerUid: "owner", accountId: "account", kind: "private", companyId: null, cycle: 0});
  const input = {receipt, before: {ownerId: "owner", accountId: "account", cycle: 0, status: "accepted"},
    currentInviteExists: false, currentAccount: {exists: true, isArchived: false, sharingCycle: 0,
      sharedWith: {}, sharedWithUids: []}, eventTimeMillis: time, nowMillis: time,
    markerRecordExists: false, notificationExists: false};
  const plan = h.acceptanceNotificationPlan(input);
  assert.equal(plan.action, "write");
  assert.notEqual(plan.markerId, plan.notificationId);
  assert.deepEqual(Object.keys(plan.notificationPayload).sort(), ["message", "n1Protocol", "read", "title", "type"]);
  assert.equal(plan.notificationPayload.n1Protocol, "n1-invite-revocation");
  assert.equal(h.acceptanceNotificationPlan({...input, notificationExists: true}).writeNotification, false);
  assert.equal(h.acceptanceNotificationPlan({...input, notificationExists: undefined}).action, "skip");
  assert.equal(h.acceptanceNotificationPlan({...input, currentInviteExists: true}).action, "skip");
});
