"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    MATURITY_TEST_EMAIL,
    isMaturityTestActor,
} = require("../maturity-rollout-policy");

test("maturity rollout accepts only the dedicated password-auth account", () => {
    assert.equal(isMaturityTestActor({
        uid: "synthetic-uid",
        token: {
            email: MATURITY_TEST_EMAIL.toUpperCase(),
            firebase: {sign_in_provider: "password"},
        },
    }), true);
});

test("maturity rollout rejects real, incomplete and spoofed identities", () => {
    const rejected = [
        null,
        {},
        {uid: "synthetic-uid", token: {}},
        {uid: "synthetic-uid", token: {email: MATURITY_TEST_EMAIL}},
        {uid: "synthetic-uid", token: {
            email: "owner@example.com",
            firebase: {sign_in_provider: "password"},
        }},
        {uid: "synthetic-uid", token: {
            email: MATURITY_TEST_EMAIL,
            firebase: {sign_in_provider: "google.com"},
        }},
    ];
    for (const auth of rejected) assert.equal(isMaturityTestActor(auth), false);
});
