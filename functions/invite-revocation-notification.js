"use strict";

// Backend-only orchestration. Injected database/clock allow offline tests.
const {ACCEPTANCE_MARKER_KIND, ACCEPTANCE_MARKER_PREFIX, acceptanceMarkerId,
  acceptanceNotificationId, acceptanceNotificationPlan, isAcceptanceMarker,
  isValidAcceptanceReceipt, acceptanceEventWindow} = require("./invite-acceptance-receipt");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function markerNonceOf(path) {
  const parts = String(path || "").split("/");
  if (parts.length !== 4 || parts[0] !== "users" || !parts[1] ||
      parts[2] !== "notificationDeliveries" || !parts[3].startsWith(ACCEPTANCE_MARKER_PREFIX)) return null;
  const nonce = parts[3].slice(ACCEPTANCE_MARKER_PREFIX.length);
  return UUID.test(nonce) ? nonce : null;
}

async function runInviteRevocationNotification({db, inviteId, before, eventTimeMillis,
  now = () => Date.now(), serverTimestamp = () => null}) {
  const receipt = before?.acceptanceReceipt;
  if (!isValidAcceptanceReceipt(receipt)) return {action: "skip",
    reason: receipt == null ? "RECEIPT_ABSENT" : "RECEIPT_INVALID"};
  const initialWindow = acceptanceEventWindow(eventTimeMillis, now());
  if (!initialWindow.inWindow) return {action: "skip", reason: initialWindow.reason};
  const user = db.collection("users").doc(receipt.guestUid);
  const markerRef = user.collection("notificationDeliveries").doc(acceptanceMarkerId(receipt.nonce));
  const notificationRef = user.collection("notifications").doc(acceptanceNotificationId(receipt.nonce));
  const accountRef = db.doc(receipt.kind === "company"
    ? `users/${receipt.ownerUid}/aziende/${receipt.companyId}/accounts/${receipt.accountId}`
    : `users/${receipt.ownerUid}/accounts/${receipt.accountId}`);
  const inviteRef = db.doc(`invites/${inviteId}`);
  return db.runTransaction(async transaction => {
    const marker = await transaction.get(markerRef);
    const notification = await transaction.get(notificationRef);
    const invite = await transaction.get(inviteRef);
    const account = await transaction.get(accountRef);
    // Clock MUST be re-evaluated after reads on every transaction attempt.
    const plan = acceptanceNotificationPlan({receipt, before,
      currentInviteExists: invite.exists === true,
      currentAccount: account.exists ? {...account.data(), exists: true} : {exists: false},
      eventTimeMillis, nowMillis: now(), markerRecordExists: marker.exists === true,
      notificationExists: notification.exists === true});
    if (plan.action !== "write") return {action: "skip", reason: plan.reason};
    if (plan.writeNotification) transaction.set(notificationRef,
      {...plan.notificationPayload, timestamp: serverTimestamp()});
    transaction.set(markerRef, plan.markerPayload);
    return {action: "write", reason: plan.reason};
  });
}

async function runAcceptanceMarkerCleanup({db, statePath, now = () => Date.now(),
  limit = 100, serverTimestamp = () => null}) {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) throw new Error("N1_CLEANUP_LIMIT_INVALID");
  const stateRef = db.doc(statePath);
  const stored = await stateRef.get();
  const lastPath = stored.exists && typeof stored.data()?.lastPath === "string" ? stored.data().lastPath : null;
  let query = db.collectionGroup("notificationDeliveries").orderBy("__name__").limit(limit);
  if (lastPath) query = query.startAfter(db.doc(lastPath));
  const page = await query.get();
  let deleted = 0;
  for (const candidate of page.docs) {
    if (markerNonceOf(candidate.ref.path) === null || candidate.data()?.kind !== ACCEPTANCE_MARKER_KIND) continue;
    const committed = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(candidate.ref);
      if (!snapshot.exists || markerNonceOf(snapshot.ref.path) === null) return false;
      const data = snapshot.data();
      const clock = now();
      if (!isAcceptanceMarker(data) || !Number.isSafeInteger(clock) || data.expiresAt > clock) return false;
      transaction.delete(snapshot.ref);
      return true;
    });
    if (committed) deleted += 1;
  }
  const last = page.docs[page.docs.length - 1];
  await stateRef.set({lastPath: page.size === limit && last ? last.ref.path : null,
    updatedAt: serverTimestamp()}, {merge: true});
  return {scanned: page.size, deleted};
}

module.exports = {markerNonceOf, runAcceptanceMarkerCleanup, runInviteRevocationNotification};
