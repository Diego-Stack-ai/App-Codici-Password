"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountWidgetPaths, revisionDecision, validateAccountWidgetCommand, widgetBelongsToCommand, resolveAccountWidgetBankData
} = require("../account-widget-service");

const field = {id: "f1", label: "Risposta", type: "sensitive", encrypted: true,
  valueEnc: "ciphertext", includeInQr: false, copyable: false};

test("revisioni widget ammettono solo incrementi interi rappresentabili", () => {
  for (const action of ["update", "delete"]) {
    const input = {action, operationId: "op-boundary", widgetId: "widget-boundary",
      context: "private", accountId: "account-boundary", data: {title: "Sintetico", fields: [field]}};
    for (const expectedRevision of [null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      assert.throws(() => validateAccountWidgetCommand({...input, expectedRevision}),
        /ACCOUNT_WIDGET_REVISION_INVALID/, `${action}: ${expectedRevision}`);
    }
    const command = validateAccountWidgetCommand({...input, expectedRevision: Number.MAX_SAFE_INTEGER - 1});
    const result = revisionDecision({exists: true, currentRevision: command.expectedRevision,
      expectedRevision: command.expectedRevision, action});
    assert.equal(result.revision, Number.MAX_SAFE_INTEGER);
    assert.equal(Number.isSafeInteger(result.revision), true);
  }
});

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

test("bankId opzionale distingue omissione, destinazione valida e rimozione esplicita", () => {
  const input = {action: "update", operationId: "op", widgetId: "widget", expectedRevision: 1,
    context: "private", accountId: "account", data: {title: "Dato", fields: [field]}};
  const account = {banking: [{bankId: "bank-one"}, {bankId: "bank-two"}]};
  const previous = {bankId: "bank-one"};
  const omitted = validateAccountWidgetCommand(input);
  assert.equal(Object.hasOwn(omitted.data, "bankId"), false);
  assert.equal(resolveAccountWidgetBankData(omitted, account, previous).bankId, "bank-one");
  const moved = validateAccountWidgetCommand({...input, data: {...input.data, bankId: "bank-two"}});
  assert.equal(resolveAccountWidgetBankData(moved, account, previous).bankId, "bank-two");
  const cleared = validateAccountWidgetCommand({...input, data: {...input.data, bankId: null}});
  assert.equal(Object.hasOwn(resolveAccountWidgetBankData(cleared, {}, previous), "bankId"), false);
  assert.equal(previous.bankId, "bank-one");
  assert.equal(cleared.data.bankId, null);
});

test("bankId rifiuta valori invalidi e destinazioni non canoniche o ambigue", () => {
  const input = {action: "create", operationId: "op", widgetId: "widget",
    context: "private", accountId: "account", data: {title: "Dato", fields: [field]}};
  for (const bankId of ["", "../bank", 123, {}, true]) {
    assert.throws(() => validateAccountWidgetCommand({...input, data: {...input.data, bankId}}), /BANK_INVALID/);
  }
  const command = validateAccountWidgetCommand({...input, data: {...input.data, bankId: "bank"}});
  for (const account of [{}, {banking: {bankId: "bank"}}, {banking: [{bankId: "other"}]},
    {banking: [{bankId: "bank"}, {bankId: "bank"}]}]) {
    assert.throws(() => resolveAccountWidgetBankData(command, account), /BANK_TARGET_INVALID/);
  }
  assert.equal(resolveAccountWidgetBankData({...command, action: "delete"}, {}, {bankId: "orphan"}), null);
});

test("normalizza solo testi strutturali e conserva il valore del campo", () => {
  const command = validateAccountWidgetCommand({
    action: "create", operationId: "op-title", widgetId: "w-title", context: "private", accountId: "a-title",
    data: {title: "  REFERENTE banca 2", fields: [{id: "name", label: "NOMINATIVO referente",
      type: "text", encrypted: false, value: "mARIO ROSSI"}]}
  });
  assert.equal(command.data.title, "Referente Banca 2");
  assert.equal(command.data.fields[0].label, "Nominativo Referente");
  assert.equal(command.data.fields[0].value, "mARIO ROSSI");
});

test("profilo Account e profilo Banca rispettano la destinazione", () => {
  const base = {action: "create", operationId: "op-profile", widgetId: "widget-profile",
    context: "private", accountId: "account", data: {title: "Libero", fields: [field], profileId: "profile-1"}};
  const account = validateAccountWidgetCommand({...base, data: {...base.data, profileCategory: "account"}});
  assert.equal(account.data.profileId, "profile-1");
  assert.throws(() => validateAccountWidgetCommand({...base, data: {...base.data, profileCategory: "account", bankId: "bank"}}), /PLACEMENT/);
  const bank = validateAccountWidgetCommand({...base, data: {...base.data, profileCategory: "bank", bankId: "bank"}});
  assert.equal(bank.data.profileCategory, "bank");
  assert.throws(() => validateAccountWidgetCommand({...base, data: {...base.data, profileCategory: "bank"}}), /PLACEMENT/);
});
