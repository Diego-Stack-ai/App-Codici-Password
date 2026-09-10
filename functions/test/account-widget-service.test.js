"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountWidgetPaths, revisionDecision, validateAccountWidgetCommand, widgetBelongsToCommand
} = require("../account-widget-service");

const field = {id: "f1", label: "Risposta", type: "sensitive", encrypted: true,
  valueEnc: "ciphertext", includeInQr: false, copyable: false};

test("valida lo stesso widget incorporato per privato e azienda", () => {
  const privateCommand = validateAccountWidgetCommand({
    action: "create", operationId: "op-1", widgetId: "w-1", context: "private", accountId: "a-1",
    data: {title: "Domande", fields: [field]}
  });
  const companyCommand = validateAccountWidgetCommand({
    action: "create", operationId: "op-2", widgetId: "w-2", context: "company",
    companyId: "c-1", accountId: "a-2", data: {title: "Domande", fields: [field]}
  });
  assert.equal(privateCommand.data.kind, "embedded");
  assert.equal(companyCommand.companyId, "c-1");
  assert.equal(privateCommand.data.fields[0].valueEnc, "ciphertext");
});

test("costruisce percorsi confinati e richiede il contesto aziendale completo", () => {
  const command = validateAccountWidgetCommand({
    action: "delete", operationId: "op-3", widgetId: "w-3", expectedRevision: 2,
    context: "company", companyId: "c-1", accountId: "a-1"
  });
  assert.deepEqual(accountWidgetPaths("owner", command), {
    account: "users/owner/aziende/c-1/accounts/a-1",
    widget: "users/owner/accountWidgets/w-3",
    operation: "users/owner/operationResults/op-3"
  });
  assert.throws(() => validateAccountWidgetCommand({
    action: "create", operationId: "op", widgetId: "w", context: "company", accountId: "a",
    data: {title: "Dato", fields: [field]}
  }), /COMPANY/);
});

test("rifiuta spostamenti impliciti del widget fra Account", () => {
  const command = {context: "company", companyId: "c-1", accountId: "a-1"};
  assert.equal(widgetBelongsToCommand({kind: "embedded", ...command}, command), true);
  assert.equal(widgetBelongsToCommand({kind: "embedded", context: "company", companyId: "c-2", accountId: "a-1"}, command), false);
  assert.equal(widgetBelongsToCommand({kind: "shared-reference", ...command}, command), false);
});

test("revisioni create update e retry restano deterministici", () => {
  assert.equal(revisionDecision({exists: false, action: "create"}).revision, 1);
  assert.equal(revisionDecision({exists: true, currentRevision: 3, expectedRevision: 2, action: "update"}).status, "conflict");
  assert.equal(revisionDecision({previous: {status: "applied", revision: 4}, action: "update"}).duplicate, true);
});
