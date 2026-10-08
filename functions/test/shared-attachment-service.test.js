"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {createSharedAttachmentService, expectedKeyId} = require("../shared-attachment-service");

class TestHttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

class Ref {
  constructor(db, path) { this.db = db; this.path = path; }
  collection(name) { return new Collection(this.db, `${this.path}/${name}`); }
}
class Collection {
  constructor(db, path) { this.db = db; this.path = path; }
  doc(id) { return new Ref(this.db, `${this.path}/${id}`); }
}
class Snapshot {
  constructor(value) { this.value = value; this.exists = value !== undefined; }
  data() { return structuredClone(this.value); }
}

function fakeDb(initial = {}) {
  const DELETE = "__DELETE_FIELD__";
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  const db = {
    values,
    collection: name => new Collection(db, name),
    runTransaction: async callback => callback({
      get: async ref => new Snapshot(values.get(ref.path)),
      create: (ref, value) => {
        if (values.has(ref.path)) throw new Error("ALREADY_EXISTS");
        values.set(ref.path, structuredClone(value));
      },
      update: (ref, patch) => {
        if (!values.has(ref.path)) throw new Error("NOT_FOUND");
        const next = {...values.get(ref.path)};
        for (const [key, value] of Object.entries(patch)) {
          if (value === DELETE) delete next[key];
          else next[key] = structuredClone(value);
        }
        values.set(ref.path, next);
      },
    }),
  };
  return {db, deleteField: () => DELETE};
}

const publicJwk = {key_ops: [], ext: true, kty: "EC", crv: "P-256",
  x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  y: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"};
const keyId = expectedKeyId(publicJwk);
const publicIdentity = {schemaVersion: 1, agreement: "ECDH-P256", uid: "owner-1",
  keyId, publicJwk, createdAt: 1};
const privateEnvelope = {schemaVersion: 1, cipher: "HKDF-SHA256+A256GCM", uid: "owner-1",
  keyId, salt: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", iv: "AAAAAAAAAAAAAAAA",
  ciphertext: "AAAAAAAAAAAAAAAAAAAAAA==", createdAt: 1};
const envelope = recipientUid => ({version: 1, agreement: "ECDH-P256",
  keyWrap: "HKDF-SHA256+A256GCM", recipientId: recipientUid,
  salt: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", iv: "AAAAAAAAAAAAAAAA",
  wrappedKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  ephemeralPublicKey: publicJwk});

test("register creates one bound identity and rejects silent replacement", async () => {
  const {db, deleteField} = fakeDb();
  const service = createSharedAttachmentService({db, deleteField, HttpsError: TestHttpsError});
  assert.deepEqual(await service.register({auth: {uid: "owner-1"}, data: {publicIdentity, privateEnvelope}}),
    {created: true, keyId});
  assert.equal(db.values.get("cryptoPublicKeys/owner-1").keyId, keyId);
  assert.equal(db.values.get("users/owner-1/cryptoIdentity/current").ciphertext,
    privateEnvelope.ciphertext);
  assert.deepEqual(await service.register({auth: {uid: "owner-1"}, data: {publicIdentity, privateEnvelope}}),
    {created: false, keyId});
  await assert.rejects(service.register({auth: {uid: "owner-1"}, data: {
    publicIdentity: {...publicIdentity, keyId: "changed"},
    privateEnvelope: {...privateEnvelope, keyId: "changed"},
  }}), error => error.code === "invalid-argument");
});

test("publish accepts only owner, encrypted attachment and active recipients", async () => {
  const {db, deleteField} = fakeDb({
    "users/owner-1/accounts/account-1": {sharedWithUids: ["guest-1"], isArchived: false},
    "users/owner-1/accounts/account-1/attachments/attachment-1": {
      encryption: {version: 1}, name: "fixture.pdf", url: "https://token.invalid/file",
    },
  });
  const service = createSharedAttachmentService({db, deleteField, HttpsError: TestHttpsError});
  assert.deepEqual(await service.publish({auth: {uid: "owner-1"}, data: {
    scope: "private", accountId: "account-1", attachmentId: "attachment-1",
    envelopes: {"guest-1": envelope("guest-1")},
  }}), {updated: 1});
  assert.equal(db.values.get("users/owner-1/accounts/account-1/attachments/attachment-1")
    .recipientKeyEnvelopes["guest-1"].recipientId, "guest-1");
  assert.deepEqual(db.values.get("users/owner-1/accounts/account-1/attachments/attachment-1")
    .sharedReadyRecipientUids, ["guest-1"]);
  assert.equal("url" in db.values.get("users/owner-1/accounts/account-1/attachments/attachment-1"), false);
  await assert.rejects(service.publish({auth: {uid: "owner-1"}, data: {
    scope: "private", accountId: "account-1", attachmentId: "attachment-1",
    envelopes: {stranger: envelope("stranger")},
  }}), error => error.code === "failed-precondition");
});

test("company scope stays inside the authenticated owner namespace", async () => {
  const path = "users/owner-1/aziende/company-1/accounts/account-1";
  const {db, deleteField} = fakeDb({
    [path]: {sharedWithUids: ["guest-1"], isArchived: false},
    [`${path}/attachments/attachment-1`]: {encryption: {version: 1}},
  });
  const service = createSharedAttachmentService({db, deleteField, HttpsError: TestHttpsError});
  await service.publish({auth: {uid: "owner-1"}, data: {scope: "company", companyId: "company-1",
    accountId: "account-1", attachmentId: "attachment-1",
    envelopes: {"guest-1": envelope("guest-1")}}});
  assert.equal(db.values.get(`${path}/attachments/attachment-1`).recipientKeyEnvelopes["guest-1"]
    .recipientId, "guest-1");
});

test("unauthenticated, malformed and incomplete identities fail closed", async () => {
  const {db, deleteField} = fakeDb();
  const service = createSharedAttachmentService({db, deleteField, HttpsError: TestHttpsError});
  await assert.rejects(service.register({data: {publicIdentity, privateEnvelope}}),
    error => error.code === "unauthenticated");
  await assert.rejects(service.register({auth: {uid: "owner-1"}, data: {
    publicIdentity: {...publicIdentity, publicJwk: {...publicJwk, x: "!"}}, privateEnvelope,
  }}), error => error.code === "invalid-argument");
});
