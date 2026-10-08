"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {buildAcceptanceReceipt: build, validateAcceptanceReceipt: validate,
  isValidAcceptanceReceipt: valid, acceptanceRevocationEligibility: decide} = require("../invite-acceptance-receipt");
const input = {nonce: "11111111-1111-4111-8111-111111111111", guestUid: "guest-1",
  ownerUid: "owner-1", accountId: "account-1", kind: "private", companyId: null, cycle: 0};
const before = {ownerId: "owner-1", accountId: "account-1", cycle: 0, status: "accepted"};
const account = {exists: true, isArchived: false, sharingCycle: 0, sharedWithUids: [], sharedWith: {}};
const request = () => ({receipt: build(input), before: {...before}, currentInviteExists: false,
  currentAccount: {...account, sharedWithUids: [], sharedWith: {}}});
const reason = overrides => decide({...request(), ...overrides}).reason;

test("builder shapes, immutability and exact version", () => {
  const snapshot = JSON.stringify(input);
  const receipt = build(input);
  assert.equal(Object.keys(input).length, 7);
  assert.equal(Object.keys(receipt).length, 8);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(valid(receipt), true);
  for (const version of [0, 2, undefined, null, "1"]) {
    assert.throws(() => validate({...receipt, schemaVersion: version}));
    assert.equal(reason({receipt: {...receipt, schemaVersion: version}}), "RECEIPT_INVALID");
  }
  assert.throws(() => build({...input, schemaVersion: 1}));
});
test("every missing field and invalid cycle fails closed", () => {
  for (const source of [input, build(input)]) {
    for (const key of Object.keys(source)) {
      const copy = {...source}; delete copy[key];
      assert.throws(() => source.schemaVersion ? validate(copy) : build(copy), key);
    }
  }
  for (const cycle of [undefined, null, -1, 1.5, "0", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => build({...input, cycle}));
    assert.equal(valid({...build(input), cycle}), false);
  }
  assert.throws(() => build({...input, extra: true}));
});
test("invalid identifiers, nonce and explicit company type", () => {
  for (const key of ["guestUid", "ownerUid", "accountId"]) {
    for (const value of ["", "x/y", " ", undefined, "g".repeat(121), "guest.1"]) {
      assert.throws(() => build({...input, [key]: value}));
    }
  }
  assert.throws(() => build({...input, nonce: "audit-ref"}));
  assert.throws(() => build({...input, kind: "team"}));
  assert.throws(() => build({...input, kind: "company"}));
  assert.throws(() => build({...input, companyId: "company-1"}));
  assert.equal(build({...input, guestUid: "g".repeat(120)}).guestUid.length, 120);
  for (const companyId of ["company-1", "privato"]) {
    const receipt = build({...input, kind: "company", companyId});
    assert.equal(reason({receipt, before: {...before, aziendaId: companyId}}), "ELIGIBLE");
    assert.equal(reason({receipt}), "BINDING_MISMATCH");
  }
});
test("binding, legacy receipt absence, archive and reinvites", () => {
  assert.equal(reason({receipt: undefined}), "RECEIPT_ABSENT");
  assert.equal(reason({before: undefined}), "BEFORE_INVALID");
  for (const patch of [{ownerId: "other"}, {accountId: "other"}, {cycle: 1}, {aziendaId: "privato"}]) {
    assert.equal(reason({before: {...before, ...patch}}), "BINDING_MISMATCH");
  }
  assert.equal(reason({before: {...before, cycle: "0"}}), "BEFORE_INVALID");
  assert.equal(reason({before: {...before, status: "pending"}}), "BEFORE_NOT_ACCEPTED");
  assert.equal(reason({before: {...before, sharingState: "suspended"}}), "BEFORE_SUSPENDED");
  assert.equal(reason({currentInviteExists: true}), "CURRENT_INVITE_PRESENT");
  for (const state of [undefined, null, "false", 0, ""]) {
    assert.equal(reason({currentInviteExists: state}), "CURRENT_INVITE_STATE_INVALID");
  }
  const missing = request(); delete missing.currentInviteExists;
  assert.equal(decide(missing).eligible, false);
});
test("account shape must prove absence of archive and matching cycle", () => {
  assert.equal(reason({currentAccount: undefined}), "ACCOUNT_MISSING");
  for (const patch of [{exists: false}, {isArchived: true}, {isArchived: undefined},
    {isArchived: "false"}, {sharingCycle: null}, {sharingCycle: "0"}, {sharingCycle: 1},
    {sharedWith: []}, {sharedWith: null}, {sharedWith: new Date(0)},
    {sharedWithUids: undefined}, {sharedWithUids: [""]}]) {
    assert.notEqual(reason({currentAccount: {...account, ...patch}}), "ELIGIBLE");
  }
  const missing = {...account}; delete missing.isArchived;
  assert.equal(reason({currentAccount: missing}), "ACCOUNT_SHAPE_INVALID");
});
test("ACL and accepted map independently block active recipient", () => {
  assert.equal(reason({currentAccount: {...account, sharedWithUids: ["guest-1"]}}), "GUEST_STILL_ACTIVE");
  assert.equal(reason({currentAccount: {...account, sharedWith: {k: {status: "accepted", uid: "guest-1"}}}}), "GUEST_STILL_ACTIVE");
  for (const entry of [null, [], "accepted", {status: "accepted", uid: null}]) {
    assert.equal(reason({currentAccount: {...account, sharedWith: {k: entry}}}), "ACCOUNT_SHAPE_INVALID");
  }
});
test("positive private and legacy before, deterministic and no mutation", () => {
  const value = request();
  const snapshot = JSON.stringify(value);
  assert.deepEqual(decide(value), {eligible: true, reason: "ELIGIBLE"});
  assert.deepEqual(decide(value), decide(value));
  assert.equal(JSON.stringify(value), snapshot);
  delete value.before.cycle;
  assert.equal(decide(value).eligible, true);
});
test("pure module has no imports, clock, randomness or output", () => {
  const source = fs.readFileSync(require.resolve("../invite-acceptance-receipt"), "utf8");
  for (const forbidden of ["require(", "firebase", "Math.random", "randomUUID", "Date.now", "new Date", "console."]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
