"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const service = require("../account-widget-service");
const source = fs.readFileSync(require.resolve("../index.js"), "utf8");
const ownerSource = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.', source.indexOf('function requireMutationOwner(')));
const handlerSource = source.slice(source.indexOf("exports.manageAccountWidget ="), source.indexOf("async function runRecoveryCommand"));
const field = {id: "field", label: "Dato", type: "text", encrypted: false, value: "synthetic"};

function fixture({context = "private", account = {banking: [{bankId: "bank"}, {bankId: "other"}]}, widget, previous} = {}) {
  const command = {action: widget ? "update" : "create", operationId: "op", widgetId: "widget", accountId: "account", expectedOwnerUid: "owner",
    context, ...(context === "company" ? {companyId: "company"} : {}), expectedRevision: 1,
    data: {title: "Synthetic", fields: [field], bankId: "bank"}};
  const paths = service.accountWidgetPaths("owner", command);
  const documents = new Map([[paths.account, account]]), writes = [], reads = [];
  if (widget) documents.set(paths.widget, {kind: "embedded", context, accountId: "account",
    ...(context === "company" ? {companyId: "company"} : {}), revision: 1, createdAt: "old", ...widget});
  if (previous) documents.set(paths.operation, previous);
  const ref = path => ({path, collection: id => ref(`${path}/${id}`), doc: id => ref(`${path}/${id}`)});
  const store = {doc: ref, collection: ref, runTransaction: async callback => callback({
    get: async reference => { reads.push(reference.path); return {exists: documents.has(reference.path), data: () => documents.get(reference.path)}; },
    set: (reference, data) => writes.push({action: "set", path: reference.path, data}),
    delete: reference => writes.push({action: "delete", path: reference.path})
  })};
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const sandbox = {exports: {}, ...service, HttpsError, onCall: (_, callback) => callback,
    getFirestore: () => store, FieldValue: {serverTimestamp: () => "timestamp"}, console: {warn() {}}};
  vm.runInNewContext(ownerSource + handlerSource, sandbox);
  return {command, paths, writes, reads, documents,
    run: () => sandbox.exports.manageAccountWidget({auth: {uid: "owner"}, data: command})};
}

test("create privato/azienda usa solo banking canonico dello stesso account", async () => {
  for (const context of ["private", "company"]) {
    const f = fixture({context});
    assert.equal((await f.run()).status, "applied");
    assert.equal(f.writes.find(write => write.path === f.paths.widget).data.bankId, "bank");
    assert.equal(f.writes.length, 3);
    assert.ok(f.reads.includes(f.paths.account));
  }
});

test("target mancante, legacy o duplicato non scrive widget, ricevuta o audit", async () => {
  for (const account of [{}, {banking: {bankId: "bank"}}, {banking: [{bankId: "elsewhere"}]},
    {banking: [{bankId: "bank"}, {bankId: "bank"}]}]) {
    const f = fixture({account});
    f.documents.set("users/owner/accounts/another", {banking: [{bankId: "bank"}]});
    await assert.rejects(f.run(), error => error.code === "failed-precondition");
    assert.equal(f.writes.length, 0);
  }
});

test("update legacy conserva bankId, spostamento esplicito lo cambia e null lo rimuove", async () => {
  for (const mode of ["omitted", "move", "clear"]) {
    const f = fixture({widget: {bankId: "bank"}});
    if (mode === "omitted") delete f.command.data.bankId;
    if (mode === "move") f.command.data.bankId = "other";
    if (mode === "clear") f.command.data.bankId = null;
    assert.equal((await f.run()).status, "applied");
    const stored = f.writes.find(write => write.path === f.paths.widget).data;
    assert.equal(stored.bankId, mode === "omitted" ? "bank" : mode === "move" ? "other" : undefined);
    assert.equal(stored.revision, 2);
  }
});

test("orfano rifiuta update implicito ma permette rimozione collegamento o eliminazione", async () => {
  for (const mode of ["update", "clear", "delete"]) {
    const f = fixture({account: {}, widget: {bankId: "missing"}});
    delete f.command.data.bankId;
    if (mode === "clear") f.command.data.bankId = null;
    if (mode === "delete") f.command.action = "delete";
    if (mode === "update") {
      await assert.rejects(f.run(), error => error.code === "failed-precondition");
      assert.equal(f.writes.length, 0);
    } else {
      assert.equal((await f.run()).status, "applied");
      assert.equal(f.writes.length, 3);
    }
  }
});

test("widget generici restano validi senza banking; conflitti e retry precedono validazione target", async () => {
  const generic = fixture({account: {}}); delete generic.command.data.bankId;
  assert.equal((await generic.run()).status, "applied");
  assert.equal(Object.hasOwn(generic.writes[0].data, "bankId"), false);
  const conflict = fixture({account: {}, widget: {bankId: "missing", revision: 2}});
  assert.equal((await conflict.run()).status, "conflict"); assert.equal(conflict.writes.length, 0);
  const retry = fixture({account: {}, widget: {bankId: "missing"},
    previous: {domain: "account-widget", widgetId: "widget", action: "update", status: "applied", revision: 2}});
  assert.equal((await retry.run()).duplicate, true); assert.equal(retry.writes.length, 0);
});
