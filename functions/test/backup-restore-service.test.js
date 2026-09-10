const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeFirestoreValue, restoreChunkDecision, restorePath, safeRestoreAudit, validateRestoreChunk
} = require("../backup-restore-service");

test("costruisce soltanto percorsi appartenenti allo UID autenticato", () => {
  assert.equal(restorePath("owner", {scope: "profile"}), "users/owner");
  assert.equal(restorePath("owner", {scope: "private-account", id: "a1"}), "users/owner/accounts/a1");
  assert.equal(restorePath("owner", {scope: "company-account", companyId: "c1", id: "a1"}), "users/owner/aziende/c1/accounts/a1");
  assert.equal(restorePath("owner", {scope: "private-account-attachment", accountId: "a1", id: "f1"}), "users/owner/accounts/a1/attachments/f1");
  assert.equal(restorePath("owner", {scope: "private-account-widget", accountId: "a1", id: "w1"}), "users/owner/accountWidgets/w1");
  assert.equal(restorePath("owner", {scope: "company-account-widget", companyId: "c1", accountId: "a1", id: "w1"}), "users/owner/accountWidgets/w1");
  assert.equal(restorePath("owner", {scope: "shared-vault-data", id: "s1"}), "users/owner/sharedVaultData/s1");
  assert.equal(restorePath("owner", {scope: "shared-vault-data-link", sharedDataId: "s1", id: "l1"}), "users/owner/sharedVaultLinks/l1");
  assert.throws(() => restorePath("owner", {scope: "notifications", id: "n1"}), /SCOPE/);
  assert.throws(() => restorePath("owner", {scope: "settings", id: "..\/security"}), /IDENTIFIER/);
});

test("valida chunk limitati senza duplicati o prototipi speciali", () => {
  const chunk = validateRestoreChunk({
    operationId: "device:restore:1", backupId: "backup-1", chunkIndex: 0, chunkCount: 1,
    mode: "preview", records: [{scope: "settings", id: "generalConfig", data: {schemaVersion: 1}}]
  }, "owner");
  assert.equal(chunk.records[0].path, "users/owner/settings/generalConfig");
  assert.equal(chunk.overwriteConfirmed, false);
  const overwrite = validateRestoreChunk({
    operationId: "device:restore:2", backupId: "backup-1", chunkIndex: 0, chunkCount: 1,
    mode: "apply", overwriteExisting: true, confirmation: "RESTORE_SELECTED_OVERWRITE",
    records: [{scope: "private-account", id: "a1", data: {nomeAccount: "Account"}}]
  }, "owner");
  assert.equal(overwrite.overwriteConfirmed, true);
  assert.throws(() => validateRestoreChunk({
    operationId: "op", backupId: "b", chunkIndex: 0, chunkCount: 1,
    mode: "preview", records: [
      {scope: "contact", id: "c1", data: {}},
      {scope: "contact", id: "c1", data: {}}
    ]
  }, "owner"), /DUPLICATE/);
});

test("ricostruisce tipi Firestore soltanto tramite factory esplicite", () => {
  const decoded = decodeFirestoreValue({
    at: {$type: "timestamp", seconds: 1, nanoseconds: 2},
    bytes: {$type: "bytes", value: [3, 4]}, date: {$type: "date", value: "2030-01-01T00:00:00.000Z"}
  }, {timestamp: (seconds, nanoseconds) => ({seconds, nanoseconds}), bytes: value => [...value]});
  assert.deepEqual(decoded.at, {seconds: 1, nanoseconds: 2});
  assert.deepEqual(decoded.bytes, [3, 4]);
  assert.equal(decoded.date.toISOString(), "2030-01-01T00:00:00.000Z");
});

test("blocca collisioni e rende idempotente un chunk già applicato", () => {
  assert.deepEqual(restoreChunkDecision({previous: {status: "applied"}}), {status: "applied", duplicate: true});
  assert.equal(restoreChunkDecision({collisions: ["users/owner/accounts/a1"]}).status, "collision");
  assert.equal(restoreChunkDecision({collisions: ["users/owner/accounts/a1"], overwriteExisting: true}).status, "ready");
  assert.equal(restoreChunkDecision({collisions: []}).status, "ready");
});

test("audit conserva soltanto contatori e identificatori tecnici", () => {
  const audit = safeRestoreAudit({
    uid: "owner", operationId: "op1", backupId: "b1", chunkIndex: 2,
    recordCount: 10, password: "VIETATA"
  });
  assert.equal(JSON.stringify(audit).includes("VIETATA"), false);
  assert.equal(audit.recordCount, 10);
});
