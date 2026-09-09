const ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/;
const OPERATION_PATTERN = /^[A-Za-z0-9:_-]{1,180}$/;
const MAX_RECORD_BYTES = 300000;
const ALLOWED_FIELDS = new Set([
  "nomeAccount", "username", "account", "password", "url", "note", "logo",
  "referenteNome", "referenteTelefono", "referenteCellulare", "type", "visibility",
  "isBanking", "banking", "isExplicitMemo", "updatedAt", "createdAt", "_encrypted",
  "sharedWith", "sharedWithUids", "acceptedCount"
]);

function isCiphertext(value) {
  return typeof value === "string" && value.length >= 30 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isCiphertextOrEmpty(value) {
  return value === "" || isCiphertext(value);
}

function validatePrivateAccountMutation(input) {
  const operation = input || {};
  if (operation.schemaVersion !== 1 ||
      !OPERATION_PATTERN.test(String(operation.operationId || "")) ||
      !ID_PATTERN.test(String(operation.recordId || "")) ||
      !OPERATION_PATTERN.test(String(operation.deviceId || "")) ||
      !Number.isInteger(operation.expectedRevision) || operation.expectedRevision < 0 ||
      !operation.record || typeof operation.record !== "object" || Array.isArray(operation.record)) {
    throw new Error("PRIVATE_ACCOUNT_MUTATION_INVALID");
  }
  const record = operation.record;
  const isAccount = record.type === "account";
  const isPrivateMemo = record.type === "memo";
  if (Object.keys(record).some(key => !ALLOWED_FIELDS.has(key)) ||
      (!isAccount && !isPrivateMemo) || record.visibility !== "private" || record._encrypted !== true ||
      typeof record.nomeAccount !== "string" || !record.nomeAccount.trim() || record.nomeAccount.length > 240 ||
      !isCiphertextOrEmpty(record.username) || !isCiphertextOrEmpty(record.account) ||
      !isCiphertextOrEmpty(record.password) || !isCiphertextOrEmpty(record.note) ||
      (isPrivateMemo && [record.username, record.account, record.password].some(value => value !== "")) ||
      record.isBanking === true || (Array.isArray(record.banking) && record.banking.length > 0) ||
      Object.keys(record.sharedWith || {}).length !== 0 ||
      (record.sharedWithUids || []).length !== 0 || Number(record.acceptedCount || 0) !== 0) {
    throw new Error("PRIVATE_ACCOUNT_MUTATION_INVALID");
  }
  const serialized = JSON.stringify(record);
  if (Buffer.byteLength(serialized, "utf8") > MAX_RECORD_BYTES) {
    throw new Error("PRIVATE_ACCOUNT_MUTATION_TOO_LARGE");
  }
  return {
    schemaVersion: 1,
    operationId: operation.operationId,
    recordId: operation.recordId,
    deviceId: operation.deviceId,
    expectedRevision: operation.expectedRevision,
    record: JSON.parse(serialized)
  };
}

function privateAccountMutationDecision({exists, currentRevision, expectedRevision, previous}) {
  if (previous) return {...previous, duplicate: true};
  if ((!exists && expectedRevision !== 0) || (exists && currentRevision !== expectedRevision)) {
    return {status: "conflict", currentRevision: exists ? currentRevision : 0, duplicate: false};
  }
  return {status: "applied", revision: (exists ? currentRevision : 0) + 1, duplicate: false};
}

module.exports = {MAX_RECORD_BYTES, privateAccountMutationDecision, validatePrivateAccountMutation};
