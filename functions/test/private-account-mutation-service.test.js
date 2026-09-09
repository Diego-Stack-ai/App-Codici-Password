const assert = require("node:assert/strict");
const test = require("node:test");
const {
  privateAccountMutationDecision, validatePrivateAccountMutation
} = require("../private-account-mutation-service");

const cipher = "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB";
const valid = (overrides = {}) => ({
  schemaVersion: 1,
  operationId: "device-a:operation-1",
  recordId: "account-1",
  deviceId: "device-a",
  expectedRevision: 0,
  record: {
    nomeAccount: "Prova M6", username: cipher, account: cipher, password: cipher, note: cipher,
    type: "account", visibility: "private", _encrypted: true,
    sharedWith: {}, sharedWithUids: [], acceptedCount: 0
  },
  ...overrides
});

test("accetta soltanto account privati con segreti gia cifrati", () => {
  assert.equal(validatePrivateAccountMutation(valid()).record.nomeAccount, "Prova M6");
  assert.equal(validatePrivateAccountMutation({
    ...valid(),
    record: {...valid().record, account: "", note: ""}
  }).record.account, "");
  for (const mutation of [
    valid({record: {...valid().record, visibility: "shared"}}),
    valid({record: {...valid().record, password: "segreto-in-chiaro"}}),
    valid({record: {...valid().record, note: "nota-in-chiaro"}}),
    valid({record: {...valid().record, isBanking: true, banking: [{iban: "IT00"}]}}),
    valid({record: {...valid().record, sharedWithUids: ["guest"]}}),
    valid({recordId: "../account"})
  ]) assert.throws(() => validatePrivateAccountMutation(mutation), /INVALID/);
});

test("creazione, aggiornamento, conflitto e retry sono deterministici", () => {
  assert.deepEqual(privateAccountMutationDecision({exists: false, currentRevision: 0, expectedRevision: 0}),
    {status: "applied", revision: 1, duplicate: false});
  assert.deepEqual(privateAccountMutationDecision({exists: true, currentRevision: 2, expectedRevision: 2}),
    {status: "applied", revision: 3, duplicate: false});
  assert.deepEqual(privateAccountMutationDecision({exists: true, currentRevision: 3, expectedRevision: 2}),
    {status: "conflict", currentRevision: 3, duplicate: false});
  assert.deepEqual(privateAccountMutationDecision({exists: true, currentRevision: 3, expectedRevision: 2,
    previous: {status: "applied", revision: 3}}),
  {status: "applied", revision: 3, duplicate: true});
});
