"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {verifiedRequestEmail, verifiedUserByEmail} = require("../verified-email-identity");

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

test("request email requires the strict verified claim", () => {
  assert.throws(() => verifiedRequestEmail({auth: {token: {email: "user@example.invalid"}}}, HttpsError),
    {code: "permission-denied"});
  assert.throws(() => verifiedRequestEmail({auth: {token: {email: "user@example.invalid", email_verified: false}}}, HttpsError),
    {code: "permission-denied"});
  assert.equal(verifiedRequestEmail({auth: {token: {email: " User@Example.Invalid ", email_verified: true}}}, HttpsError),
    "user@example.invalid");
});

test("Admin lookup returns only verified users", async () => {
  const auth = {getUserByEmail: async email => ({uid: email, emailVerified: email.startsWith("verified")})};
  assert.equal(await verifiedUserByEmail(auth, "pending@example.invalid"), null);
  assert.equal((await verifiedUserByEmail(auth, "verified@example.invalid")).uid, "verified@example.invalid");
});

test("missing users are ignored but provider failures remain visible", async () => {
  assert.equal(await verifiedUserByEmail({getUserByEmail: async () => {
    throw Object.assign(new Error("missing"), {code: "auth/user-not-found"});
  }}, "missing@example.invalid"), null);
  await assert.rejects(() => verifiedUserByEmail({getUserByEmail: async () => {
    throw Object.assign(new Error("offline"), {code: "auth/internal-error"});
  }}, "user@example.invalid"), {code: "auth/internal-error"});
});
