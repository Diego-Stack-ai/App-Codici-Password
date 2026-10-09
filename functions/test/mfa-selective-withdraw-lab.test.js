"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createSelectiveMfaWithdrawLab,
    IDENTITY_TOOLKIT_WITHDRAW_URL,
} = require("../mfa-selective-withdraw-lab");

test("selective MFA withdrawal is hard-off by default and performs no request", async () => {
    let calls = 0;
    const withdraw = createSelectiveMfaWithdrawLab({request: async () => { calls++; }});
    await assert.rejects(withdraw({
        idToken: "synthetic-id-token",
        mfaEnrollmentId: "totp-old",
    }), /MFA_SELECTIVE_WITHDRAW_DISABLED/);
    assert.equal(calls, 0);
});

test("selective MFA withdrawal binds exactly one enrollment id", async () => {
    const calls = [];
    const withdraw = createSelectiveMfaWithdrawLab({
        enabled: true,
        request: async request => {
            calls.push(request);
            return {idToken: "new-id-token", refreshToken: "new-refresh-token"};
        },
    });
    const result = await withdraw({
        idToken: "synthetic-id-token",
        mfaEnrollmentId: " totp-old ",
    });
    assert.deepEqual(calls, [{
        method: "POST",
        url: IDENTITY_TOOLKIT_WITHDRAW_URL,
        body: {idToken: "synthetic-id-token", mfaEnrollmentId: "totp-old"},
    }]);
    assert.equal(result.removedEnrollmentId, "totp-old");
    assert.equal(Object.hasOwn(calls[0].body, "enrolledFactors"), false);
});

test("selective MFA withdrawal rejects missing binding and malformed response", async () => {
    const withdraw = createSelectiveMfaWithdrawLab({enabled: true, request: async () => ({})});
    await assert.rejects(withdraw({idToken: "synthetic-id-token"}),
        /MFA_WITHDRAW_ENROLLMENT_ID_REQUIRED/);
    await assert.rejects(withdraw({
        idToken: "synthetic-id-token",
        mfaEnrollmentId: "totp-old",
    }), /MFA_WITHDRAW_RESPONSE_INVALID/);
});
