"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {createRecoveryGrant, finalizeRecoveryGrant} = require("../mfa-recovery-grant-lab");
const {runSelectiveRecoveryLab} = require("../mfa-selective-recovery-flow-lab");

function fixture() {
    return createRecoveryGrant({uid: "user-synthetic", enrollmentId: "totp-old",
        codeHash: "hash-synthetic", nowMs: 1000});
}

test("selective flow removes only bound factor and consumes code after reread", async () => {
    const factors = new Set(["totp-old", "totp-new"]);
    const result = await runSelectiveRecoveryLab({grant: fixture(), idToken: "synthetic-token",
        enrollmentId: "totp-old", nowMs: 2000,
        verifyIdToken: async () => ({uid: "user-synthetic"}),
        withdraw: async ({mfaEnrollmentId}) => factors.delete(mfaEnrollmentId),
        listEnrollmentIds: async () => [...factors],
        finalize: finalizeRecoveryGrant});
    assert.equal(result.status, "consumed");
    assert.deepEqual([...factors], ["totp-new"]);
});

test("lost withdraw response reconciles absence before consuming code", async () => {
    const factors = new Set(["totp-old", "totp-new"]);
    const result = await runSelectiveRecoveryLab({grant: fixture(), idToken: "synthetic-token",
        enrollmentId: "totp-old", nowMs: 2000,
        verifyIdToken: async () => ({uid: "user-synthetic"}),
        withdraw: async ({mfaEnrollmentId}) => { factors.delete(mfaEnrollmentId); throw Error("RESPONSE_LOST"); },
        listEnrollmentIds: async () => [...factors],
        finalize: finalizeRecoveryGrant});
    assert.equal(result.status, "consumed");
    assert.deepEqual([...factors], ["totp-new"]);
});

test("failed withdrawal preserves code while target factor remains", async () => {
    const factors = new Set(["totp-old", "totp-new"]);
    await assert.rejects(runSelectiveRecoveryLab({grant: fixture(), idToken: "synthetic-token",
        enrollmentId: "totp-old", nowMs: 2000,
        verifyIdToken: async () => ({uid: "user-synthetic"}),
        withdraw: async () => { throw Error("WITHDRAW_FAILED"); },
        listEnrollmentIds: async () => [...factors], finalize: finalizeRecoveryGrant}), /WITHDRAW_FAILED/);
    assert.deepEqual([...factors], ["totp-old", "totp-new"]);
});
