"use strict";

// N1 pure validation/planning: caller must supply authentic, transaction-consistent
// server snapshots and persist the notification and deduplication marker atomically.
// Runtime orchestration lives in invite-revocation-notification.js.
// No I/O, clock or randomness. Nonce is server-supplied, never inferred from auditRef.
// Intentional conservative ID subset, NOT the Firestore ID specification:
// legitimate IDs outside this subset fail closed until compatibility is reviewed.
const SEGMENT = /^[A-Za-z0-9_-]{1,120}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_KEYS = ["nonce", "guestUid", "ownerUid", "accountId", "kind", "companyId", "cycle"];
const RECEIPT_KEYS = ["schemaVersion", ...INPUT_KEYS];
const RECEIPT_KINDS = Object.freeze(["private", "company"]);
const REVOCATION_REASONS = Object.freeze(Object.fromEntries([
  "ELIGIBLE", "RECEIPT_ABSENT", "RECEIPT_INVALID", "BEFORE_INVALID",
  "BINDING_MISMATCH", "BEFORE_NOT_ACCEPTED", "BEFORE_SUSPENDED",
  "CURRENT_INVITE_PRESENT", "CURRENT_INVITE_STATE_INVALID", "ACCOUNT_MISSING",
  "ACCOUNT_ARCHIVED", "ACCOUNT_SHAPE_INVALID", "ACCOUNT_CYCLE_INVALID",
  "ACCOUNT_CYCLE_MISMATCH", "GUEST_STILL_ACTIVE"
].map(code => [code, code])));

function fail(code) { return Object.assign(new Error(code), {code}); }
function record(value) {
  return value !== null && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exactKeys(value, keys) {
  if (!record(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) throw fail("RECEIPT_INVALID");
}
function segment(value, code) {
  if (typeof value !== "string" || !SEGMENT.test(value)) throw fail(code);
  return value;
}
function validCycle(value) { return Number.isSafeInteger(value) && value >= 0; }

// Seven explicit input fields; eight output fields including schemaVersion.
function buildAcceptanceReceipt(input) {
  exactKeys(input, INPUT_KEYS);
  if (typeof input.nonce !== "string" || !NONCE.test(input.nonce)) throw fail("RECEIPT_NONCE_INVALID");
  if (!RECEIPT_KINDS.includes(input.kind)) throw fail("RECEIPT_KIND_INVALID");
  const companyId = input.companyId === null ? null : segment(input.companyId, "RECEIPT_COMPANY_INVALID");
  if ((input.kind === "private") !== (companyId === null)) throw fail("RECEIPT_COMPANY_INVALID");
  if (!validCycle(input.cycle)) throw fail("RECEIPT_CYCLE_INVALID");
  return Object.freeze({schemaVersion: 1, nonce: input.nonce,
    guestUid: segment(input.guestUid, "RECEIPT_GUEST_INVALID"),
    ownerUid: segment(input.ownerUid, "RECEIPT_OWNER_INVALID"),
    accountId: segment(input.accountId, "RECEIPT_ACCOUNT_INVALID"),
    kind: input.kind, companyId, cycle: input.cycle});
}
function validateAcceptanceReceipt(value) {
  exactKeys(value, RECEIPT_KEYS);
  if (value.schemaVersion !== 1) throw fail("RECEIPT_VERSION_INVALID");
  return buildAcceptanceReceipt(Object.fromEntries(INPUT_KEYS.map(key => [key, value[key]])));
}
function isValidAcceptanceReceipt(value) {
  try { validateAcceptanceReceipt(value); return true; } catch { return false; }
}
function deny(reason) { return {eligible: false, reason}; }

function acceptanceRevocationEligibility(input) {
  const value = input || {};
  if (!value.receipt) return deny("RECEIPT_ABSENT");
  let receipt;
  try { receipt = validateAcceptanceReceipt(value.receipt); } catch { return deny("RECEIPT_INVALID"); }
  const before = value.before;
  if (!record(before)) return deny("BEFORE_INVALID");
  // Missing cycles retain the callable's legacy-zero normalization.
  const cycle = before.cycle === undefined ? 0 : before.cycle;
  const companyId = before.aziendaId === undefined || before.aziendaId === null ? null : before.aziendaId;
  if (typeof before.ownerId !== "string" || !SEGMENT.test(before.ownerId) ||
      typeof before.accountId !== "string" || !SEGMENT.test(before.accountId) ||
      !validCycle(cycle) || (companyId !== null &&
      (typeof companyId !== "string" || !SEGMENT.test(companyId)))) return deny("BEFORE_INVALID");
  if (receipt.ownerUid !== before.ownerId || receipt.accountId !== before.accountId ||
      receipt.cycle !== cycle || receipt.companyId !== companyId) return deny("BINDING_MISMATCH");
  if (value.currentInviteExists !== false) return deny(value.currentInviteExists === true ?
    "CURRENT_INVITE_PRESENT" : "CURRENT_INVITE_STATE_INVALID");
  if (before.sharingState === "suspended") return deny("BEFORE_SUSPENDED");
  if (before.status !== "accepted") return deny("BEFORE_NOT_ACCEPTED");
  const account = value.currentAccount;
  if (!record(account) || account.exists !== true) return deny("ACCOUNT_MISSING");
  if (account.isArchived !== false) return deny(account.isArchived === true ?
    "ACCOUNT_ARCHIVED" : "ACCOUNT_SHAPE_INVALID");
  const accountCycle = account.sharingCycle === undefined ? 0 : account.sharingCycle;
  if (!validCycle(accountCycle)) return deny("ACCOUNT_CYCLE_INVALID");
  if (accountCycle !== receipt.cycle) return deny("ACCOUNT_CYCLE_MISMATCH");
  if (!Array.isArray(account.sharedWithUids) || account.sharedWithUids.some(uid =>
    typeof uid !== "string" || !SEGMENT.test(uid)) || !record(account.sharedWith)) return deny("ACCOUNT_SHAPE_INVALID");
  if (account.sharedWithUids.includes(receipt.guestUid)) return deny("GUEST_STILL_ACTIVE");
  for (const entry of Object.values(account.sharedWith)) {
    if (!record(entry)) return deny("ACCOUNT_SHAPE_INVALID");
    if (entry.status !== "accepted") continue;
    if (typeof entry.uid !== "string" || !SEGMENT.test(entry.uid)) return deny("ACCOUNT_SHAPE_INVALID");
    if (entry.uid === receipt.guestUid) return deny("GUEST_STILL_ACTIVE");
  }
  return {eligible: true, reason: "ELIGIBLE"};
}

// N1: approved 30-day event window. Only markers expire, not notifications.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MARKER_KIND = "n1-invite-revocation-marker";
const MARKER_PREFIX = "n1rev-m-";
const NOTIFICATION_PREFIX = "n1rev-n-";
const MAX_TIME = 253402300799999;
function validTime(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_TIME;
}
function acceptanceEventWindow(eventTimeMillis, nowMillis) {
  const no = reason => ({inWindow: false, reason, expiresAt: null});
  if (!validTime(eventTimeMillis) || !validTime(nowMillis) ||
      eventTimeMillis + RETENTION_MS > MAX_TIME) return no("EVENT_TIME_INVALID");
  if (eventTimeMillis > nowMillis) return no("EVENT_TIME_FUTURE");
  if (nowMillis - eventTimeMillis >= RETENTION_MS) return no("EVENT_TIME_EXPIRED");
  return {inWindow: true, reason: "IN_WINDOW", expiresAt: eventTimeMillis + RETENTION_MS};
}
function acceptanceNonce(value) {
  if (typeof value !== "string" || !NONCE.test(value)) throw fail("RECEIPT_NONCE_INVALID");
  return value;
}
function acceptanceMarkerId(nonce) { return MARKER_PREFIX + acceptanceNonce(nonce); }
function acceptanceNotificationId(nonce) { return NOTIFICATION_PREFIX + acceptanceNonce(nonce); }
function acceptanceMarkerPayload({eventAt, expiresAt}) {
  if (!validTime(eventAt) || !validTime(expiresAt) || expiresAt !== eventAt + RETENTION_MS) {
    throw fail("MARKER_PAYLOAD_INVALID");
  }
  return Object.freeze({kind: MARKER_KIND, schemaVersion: 1, eventAt, expiresAt});
}
function isAcceptanceMarker(value) {
  try {
    exactKeys(value, ["kind", "schemaVersion", "eventAt", "expiresAt"]);
    acceptanceMarkerPayload(value);
    return value.kind === MARKER_KIND && value.schemaVersion === 1;
  } catch { return false; }
}
function acceptanceNotificationPayload() {
  return Object.freeze({type: "share_revoked", title: "Accesso revocato",
    message: "Il tuo accesso a un account condiviso e' terminato.", read: false,
    n1Protocol: "n1-invite-revocation"});
}
function acceptanceNotificationPlan({receipt, before, currentInviteExists, currentAccount,
  eventTimeMillis, nowMillis, markerRecordExists, notificationExists}) {
  if (markerRecordExists === true) return {action: "skip", reason: "MARKER_PRESENT"};
  if (markerRecordExists !== false) return {action: "skip", reason: "MARKER_STATE_INVALID"};
  if (typeof notificationExists !== "boolean") return {action: "skip", reason: "NOTIFICATION_STATE_INVALID"};
  const window = acceptanceEventWindow(eventTimeMillis, nowMillis);
  if (!window.inWindow) return {action: "skip", reason: window.reason};
  const eligible = acceptanceRevocationEligibility({receipt, before, currentInviteExists, currentAccount});
  if (!eligible.eligible) return {action: "skip", reason: eligible.reason};
  return {action: "write", reason: "ELIGIBLE", markerId: acceptanceMarkerId(receipt.nonce),
    notificationId: acceptanceNotificationId(receipt.nonce),
    markerPayload: acceptanceMarkerPayload({eventAt: eventTimeMillis, expiresAt: window.expiresAt}),
    notificationPayload: acceptanceNotificationPayload(), writeNotification: !notificationExists};
}

module.exports = {
  ACCEPTANCE_RETENTION_MS: RETENTION_MS, ACCEPTANCE_MARKER_KIND: MARKER_KIND,
  ACCEPTANCE_MARKER_PREFIX: MARKER_PREFIX, ACCEPTANCE_NOTIFICATION_PREFIX: NOTIFICATION_PREFIX,
  acceptanceEventWindow, acceptanceMarkerId, acceptanceNotificationId,
  acceptanceMarkerPayload, isAcceptanceMarker, acceptanceNotificationPayload, acceptanceNotificationPlan,
  ACCEPTANCE_RECEIPT_KINDS: RECEIPT_KINDS,
  ACCEPTANCE_RECEIPT_SCHEMA_VERSION: 1,
  REVOCATION_REASONS, buildAcceptanceReceipt, validateAcceptanceReceipt,
  isValidAcceptanceReceipt, acceptanceRevocationEligibility
};
