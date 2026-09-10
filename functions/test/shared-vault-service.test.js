"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountPath, revisionDecision, sharedVaultPaths, validateSharedVaultCommand
} = require("../shared-vault-service");

const encryptedField = {
  id: "field-1", label: "Codice app", type: "sensitive", order: 0,
  encrypted: true, valueEnc: "ciphertext", includeInQr: false, copyable: false
};

test("accetta una Credenziale comune con solo ciphertext per il campo sensibile", () => {
  const command = validateSharedVaultCommand({
    operationId: "op-1", action: "create", sharedDataId: "shared-1",
    data: {title: "Legal Mail", fields: [encryptedField]}
  });
  assert.equal(command.data.fields[0].valueEnc, "ciphertext");
  assert.equal("value" in command.data.fields[0], false);
  assert.equal(command.data.fields[0].preview, false);
});

test("rifiuta plaintext, QR e copia nei campi sensibili", () => {
  const base = {operationId: "op-1", action: "create", sharedDataId: "shared-1"};
  assert.throws(() => validateSharedVaultCommand({...base, data: {
    title: "Dato", fields: [{...encryptedField, value: "segreto"}]
  }}), /ENCRYPTION/);
  assert.throws(() => validateSharedVaultCommand({...base, data: {
    title: "Dato", fields: [{...encryptedField, copyable: true}]
  }}), /EXPOSURE/);
});

test("costruisce percorsi confinati al proprietario per privato e azienda", () => {
  assert.equal(accountPath("owner", {context: "private", accountId: "a1"}), "users/owner/accounts/a1");
  assert.equal(accountPath("owner", {context: "company", companyId: "c1", accountId: "a1"}),
    "users/owner/aziende/c1/accounts/a1");
  const command = validateSharedVaultCommand({
    operationId: "op-2", action: "link", sharedDataId: "shared-1", expectedRevision: 1,
    linkId: "link-1", widgetId: "widget-1", link: {context: "company", companyId: "c1", accountId: "a1"}
  });
  assert.deepEqual(sharedVaultPaths("owner", command), {
    data: "users/owner/sharedVaultData/shared-1",
    operation: "users/owner/operationResults/op-2",
    link: "users/owner/sharedVaultLinks/link-1",
    widget: "users/owner/accountWidgets/widget-1",
    account: "users/owner/aziende/c1/accounts/a1"
  });
});

test("decisione revisione è idempotente e rileva conflitti", () => {
  assert.deepEqual(revisionDecision({exists: false, action: "create"}),
    {status: "applied", duplicate: false, revision: 1});
  assert.equal(revisionDecision({exists: true, currentRevision: 2, expectedRevision: 1, action: "update"}).status,
    "conflict");
  assert.deepEqual(revisionDecision({previous: {status: "applied", revision: 3}, action: "link"}),
    {status: "applied", duplicate: true, revision: 3});
});
