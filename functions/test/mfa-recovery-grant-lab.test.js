"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createRecoveryGrant,
    authorizeSelectiveWithdrawal,
    finalizeRecoveryGrant,
} = require("../mfa-recovery-grant-lab");

const base = () => createRecoveryGrant({
    uid: "user-synthetic",
    enrollmentId: "totp-lost-device",
    codeHash: "hash-synthetic",
    nowMs: 1_000,
});

test("recovery grant binds user and exactly one enrollment", () => {
    assert.deepEqual(authorizeSelectiveWithdrawal({
        grant: base(),
        decodedToken: {uid: "user-synthetic"},
        enrollmentId: "totp-lost-device",
        nowMs: 2_000,
    }), {uid: "user-synthetic", enrollmentId: "totp-lost-device"});
});

test("recovery grant fails closed on UID, enrollment or expiry mismatch", () => {
    assert.throws(() => authorizeSelectiveWithdrawal({grant: base(), decodedToken: {uid: "other"},
        enrollmentId: "totp-lost-device", nowMs: 2_000}), /TOKEN_UID_MISMATCH/);
    assert.throws(() => authorizeSelectiveWithdrawal({grant: base(), decodedToken: {uid: "user-synthetic"},
        enrollmentId: "totp-new-device", nowMs: 2_000}), /ENROLLMENT_MISMATCH/);
    assert.throws(() => authorizeSelectiveWithdrawal({grant: base(), decodedToken: {uid: "user-synthetic"},
        enrollmentId: "totp-lost-device", nowMs: 400_001}), /GRANT_EXPIRED/);
});

test("code is consumed only after the bound factor is observed absent", () => {
    assert.throws(() => finalizeRecoveryGrant({grant: base(),
        observedEnrollmentIds: ["totp-lost-device", "totp-new-device"], nowMs: 2_000}),
    /FACTOR_STILL_PRESENT/);
    const consumed = finalizeRecoveryGrant({grant: base(),
        observedEnrollmentIds: ["totp-new-device"], nowMs: 2_000});
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.codeHash, "hash-synthetic");
});
