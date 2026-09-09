const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_RECORDS_PER_CHUNK = 400;
const MAX_RECORD_BYTES = 800 * 1024;
const MAX_CHUNK_BYTES = 7 * 1024 * 1024;
const SCOPES = new Set([
  "profile", "settings", "private-account", "company", "company-account",
  "private-account-attachment", "company-account-attachment",
  "deadline", "contact", "profile-widget"
]);

function identifier(value) {
  const normalized = String(value || "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error("BACKUP_IDENTIFIER_INVALID");
  return normalized;
}

function plainObject(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("BACKUP_RECORD_DATA_INVALID");
  }
  return value;
}

function restorePath(uid, record) {
  const owner = identifier(uid);
  if (!SCOPES.has(record.scope)) throw new Error("BACKUP_SCOPE_INVALID");
  const id = record.scope === "profile" ? owner : identifier(record.id);
  const root = `users/${owner}`;
  const paths = {
    profile: root,
    settings: `${root}/settings/${id}`,
    "private-account": `${root}/accounts/${id}`,
    company: `${root}/aziende/${id}`,
    deadline: `${root}/scadenze/${id}`,
    contact: `${root}/contacts/${id}`,
    "profile-widget": `${root}/profileWidgets/${id}`
  };
  if (record.scope === "company-account") {
    return `${root}/aziende/${identifier(record.companyId)}/accounts/${id}`;
  }
  if (record.scope === "private-account-attachment") {
    return `${root}/accounts/${identifier(record.accountId)}/attachments/${id}`;
  }
  if (record.scope === "company-account-attachment") {
    return `${root}/aziende/${identifier(record.companyId)}/accounts/${identifier(record.accountId)}/attachments/${id}`;
  }
  return paths[record.scope];
}

function validateRestoreChunk(input = {}, uid) {
  const operationId = identifier(input.operationId);
  const backupId = identifier(input.backupId);
  const chunkIndex = Number(input.chunkIndex);
  const chunkCount = Number(input.chunkCount);
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(chunkCount) ||
      chunkIndex < 0 || chunkCount < 1 || chunkIndex >= chunkCount || chunkCount > 10000) {
    throw new Error("BACKUP_CHUNK_INVALID");
  }
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > MAX_RECORDS_PER_CHUNK) {
    throw new Error("BACKUP_RECORD_COUNT_INVALID");
  }
  const paths = new Set();
  let chunkBytes = 0;
  const records = input.records.map(record => {
    plainObject(record);
    const data = structuredClone(plainObject(record.data));
    const path = restorePath(uid, record);
    if (paths.has(path)) throw new Error("BACKUP_RECORD_DUPLICATE");
    paths.add(path);
    const recordBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
    chunkBytes += recordBytes;
    if (recordBytes > MAX_RECORD_BYTES) {
      throw new Error("BACKUP_RECORD_TOO_LARGE");
    }
    return {path, data};
  });
  if (chunkBytes > MAX_CHUNK_BYTES) throw new Error("BACKUP_CHUNK_TOO_LARGE");
  const mode = input.mode === "preview" ? "preview" : input.mode === "apply" ? "apply" : null;
  if (!mode) throw new Error("BACKUP_MODE_INVALID");
  return {
    operationId, backupId, chunkIndex, chunkCount, records, mode,
    overwriteExisting: input.overwriteExisting === true,
    overwriteConfirmed: input.confirmation === "RESTORE_SELECTED_OVERWRITE",
    confirmed: input.confirmation === "RESTORE_VALIDATED" ||
      input.confirmation === "RESTORE_SELECTED_OVERWRITE"
  };
}

function decodeFirestoreValue(value, types = {}) {
  if (Array.isArray(value)) return value.map(item => decodeFirestoreValue(item, types));
  if (!value || typeof value !== "object") return value;
  if (value.$type === "timestamp") {
    if (!types.timestamp) throw new Error("BACKUP_TIMESTAMP_FACTORY_REQUIRED");
    return types.timestamp(value.seconds, value.nanoseconds);
  }
  if (value.$type === "date") return new Date(value.value);
  if (value.$type === "bytes") {
    if (!types.bytes) throw new Error("BACKUP_BYTES_FACTORY_REQUIRED");
    return types.bytes(Uint8Array.from(value.value));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeFirestoreValue(item, types)]));
}

function restoreChunkDecision({previous, collisions = [], overwriteExisting = false}) {
  if (previous?.status === "applied") return {status: "applied", duplicate: true};
  if (collisions.length && !overwriteExisting) {
    return {status: "collision", duplicate: false, collisionCount: collisions.length};
  }
  return {status: "ready", duplicate: false};
}

function safeRestoreAudit({uid, operationId, backupId, chunkIndex, recordCount}) {
  return {
    action: "backup-restore-chunk", actorUid: identifier(uid),
    operationId: identifier(operationId), backupId: identifier(backupId),
    chunkIndex: Number(chunkIndex), recordCount: Number(recordCount)
  };
}

module.exports = {
  MAX_RECORDS_PER_CHUNK,
  decodeFirestoreValue,
  restoreChunkDecision,
  restorePath,
  safeRestoreAudit,
  validateRestoreChunk
};
