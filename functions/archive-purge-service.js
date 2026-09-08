const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function requireIdentifier(value) {
  const normalized = String(value || "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error("INVALID_IDENTIFIER");
  return normalized;
}

function validatePurgeCommand(input = {}) {
  const context = input.context === "private" ? "private" : input.context === "company" ? "company" : null;
  if (!context) throw new Error("INVALID_CONTEXT");
  const command = {
    accountId: requireIdentifier(input.accountId),
    operationId: requireIdentifier(input.operationId),
    context,
    companyId: context === "company" ? requireIdentifier(input.companyId) : null,
    expectedRevision: Number(input.expectedRevision),
    confirmation: input.confirmation === "DELETE_FOREVER"
  };
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new Error("INVALID_REVISION");
  }
  return command;
}

function accountPath(uid, command) {
  const owner = requireIdentifier(uid);
  if (command.context === "private") return `users/${owner}/accounts/${command.accountId}`;
  return `users/${owner}/aziende/${command.companyId}/accounts/${command.accountId}`;
}

function allowedAttachmentPrefix(uid, command) {
  return `${accountPath(uid, command)}/attachments/`;
}

function isSafeAttachmentPath(uid, command, storagePath) {
  return typeof storagePath === "string" &&
    storagePath.startsWith(allowedAttachmentPrefix(uid, command)) &&
    !storagePath.includes("..") && storagePath.length <= 1024;
}

function toMillis(value) {
  if (typeof value === "string") return Date.parse(value);
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  return Number.NaN;
}

function purgeDecision({record, expectedRevision, confirmed, now = Date.now(), previous}) {
  if (previous?.status === "purged") return {status: "purged", duplicate: true};
  if (previous?.status === "processing" && !record) return {status: "resume", duplicate: false};
  if (!record) return {status: "not-found", duplicate: false};
  if (record.isArchived !== true) return {status: "not-archived", duplicate: false};
  const currentRevision = Number.isInteger(record.revision) ? record.revision : 0;
  if (currentRevision !== expectedRevision) return {status: "conflict", duplicate: false, revision: currentRevision};
  const retentionExpired = Number.isFinite(toMillis(record.purgeAfter)) && toMillis(record.purgeAfter) <= now;
  if (!confirmed && !retentionExpired) return {status: "confirmation-required", duplicate: false};
  return {status: "ready", duplicate: false, revision: currentRevision};
}

function unlinkProfileEmails(contactEmails, accountId) {
  if (!Array.isArray(contactEmails)) return contactEmails;
  return contactEmails.map(email => email?.linkedAccountId === accountId ? {...email, linkedAccountId: null} : email);
}

module.exports = {
  accountPath,
  isSafeAttachmentPath,
  purgeDecision,
  unlinkProfileEmails,
  validatePurgeCommand
};
