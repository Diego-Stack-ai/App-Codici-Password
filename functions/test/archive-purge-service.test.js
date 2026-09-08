const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountPath, isSafeAttachmentPath, purgeDecision, unlinkProfileEmails, validatePurgeCommand
} = require("../archive-purge-service");

test("accetta soltanto account privati o aziendali con identificatori sicuri", () => {
  const privateCommand = validatePurgeCommand({
    accountId: "account-1", operationId: "device:op-1", context: "private",
    expectedRevision: 2, confirmation: "DELETE_FOREVER"
  });
  assert.equal(accountPath("owner-1", privateCommand), "users/owner-1/accounts/account-1");
  assert.equal(privateCommand.confirmation, true);
  assert.throws(() => validatePurgeCommand({
    accountId: "../account", operationId: "op", context: "private", expectedRevision: 0
  }), /INVALID/);
});

test("costruisce il percorso aziendale senza accettare attraversamenti", () => {
  const command = validatePurgeCommand({
    accountId: "a1", companyId: "c1", operationId: "op1", context: "company", expectedRevision: 0
  });
  assert.equal(accountPath("u1", command), "users/u1/aziende/c1/accounts/a1");
  assert.equal(isSafeAttachmentPath("u1", command, "users/u1/aziende/c1/accounts/a1/attachments/file.pdf"), true);
  assert.equal(isSafeAttachmentPath("u1", command, "users/u2/aziende/c1/accounts/a1/attachments/file.pdf"), false);
});

test("la cancellazione richiede archivio, revisione e conferma o retention scaduta", () => {
  const base = {isArchived: true, revision: 3, purgeAfter: "2030-01-31T00:00:00.000Z"};
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: false, now: Date.parse("2030-01-01")}).status, "confirmation-required");
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: true}).status, "ready");
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: false, now: Date.parse("2030-02-01")}).status, "ready");
  assert.equal(purgeDecision({record: base, expectedRevision: 2, confirmed: true}).status, "conflict");
  assert.equal(purgeDecision({record: {...base, isArchived: false}, expectedRevision: 3, confirmed: true}).status, "not-archived");
  assert.equal(purgeDecision({record: null, expectedRevision: 0, confirmed: true}).status, "not-found");
  assert.equal(purgeDecision({record: null, expectedRevision: 0, confirmed: true, previous: {status: "processing"}}).status, "resume");
  assert.deepEqual(purgeDecision({record: null, expectedRevision: 0, confirmed: true, previous: {status: "purged"}}), {status: "purged", duplicate: true});
});

test("rimuove soltanto i collegamenti email riferiti all'account eliminato", () => {
  const emails = [{id: "e1", linkedAccountId: "a1"}, {id: "e2", linkedAccountId: "a2"}];
  assert.deepEqual(unlinkProfileEmails(emails, "a1"), [
    {id: "e1", linkedAccountId: null}, {id: "e2", linkedAccountId: "a2"}
  ]);
});
