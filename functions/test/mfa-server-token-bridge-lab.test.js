"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {runServerOnlyTokenBridgeLab} = require("../mfa-server-token-bridge-lab");

test("server-only bridge never returns Firebase session tokens", async () => {
    const calls = [];
    const result = await runServerOnlyTokenBridgeLab({uid: "user-synthetic", enrollmentId: "totp-old",
        mintCustomToken: async (uid, claims) => { calls.push(["mint", uid, claims]); return "custom"; },
        exchangeCustomToken: async token => { calls.push(["exchange", token]);
            return {idToken: "id-secret", refreshToken: "refresh-secret"}; },
        withdraw: async input => calls.push(["withdraw", input]),
        revokeRefreshTokens: async uid => calls.push(["revoke", uid])});
    assert.deepEqual(result, {ok: true, removedEnrollmentId: "totp-old"});
    assert.equal(JSON.stringify(result).includes("secret"), false);
    assert.deepEqual(calls.at(-1), ["revoke", "user-synthetic"]);
});

test("server-only bridge revokes session when withdrawal fails", async () => {
    let revoked = 0;
    await assert.rejects(runServerOnlyTokenBridgeLab({uid: "user-synthetic", enrollmentId: "totp-old",
        mintCustomToken: async () => "custom",
        exchangeCustomToken: async () => ({idToken: "id-secret", refreshToken: "refresh-secret"}),
        withdraw: async () => { throw Error("WITHDRAW_FAILED"); },
        revokeRefreshTokens: async () => { revoked++; }}), /WITHDRAW_FAILED/);
    assert.equal(revoked, 1);
});

test("invalid exchange performs no withdrawal", async () => {
    let withdrew = 0;
    await assert.rejects(runServerOnlyTokenBridgeLab({uid: "user-synthetic", enrollmentId: "totp-old",
        mintCustomToken: async () => "custom", exchangeCustomToken: async () => ({}),
        withdraw: async () => { withdrew++; }, revokeRefreshTokens: async () => {}}),
    /EXCHANGE_INVALID/);
    assert.equal(withdrew, 0);
});
