"use strict";

const crypto = require("node:crypto");
const calendar = require("./deadline-calendar");
const COLLECTION = "recipientDeliveryLedger";
const RETENTION_MS = 30 * 86400000;
const LEASE_MS = 5 * 60000;

function deliveryId({ownerUid, deadlineId, dueDate, recipient, channel}) {
  const due = calendar.day(dueDate);
  if (!due || !["email", "push"].includes(channel) ||
      [ownerUid, deadlineId, recipient].some(value => typeof value !== "string" || !value)) {
    throw new Error("INVALID_DELIVERY_IDENTITY");
  }
  return crypto.createHash("sha256").update(JSON.stringify([ownerUid, deadlineId, due, recipient, channel])).digest("hex");
}

// Root collection: denied to clients by the default Rules, unlike the generic
// owner-writable subtree. Persist no addresses, device tokens, payload or errors.
async function deliver({db, identity, frequency = 7, forceImmediate = false,
  legacyLastSentAt, eligible, send, now = Date.now}) {
  const interval = Number.isFinite(Number(frequency)) ? Math.max(1, Number(frequency)) : 7;
  // The approved 30-day ledger cannot remember longer individual cadences.
  // Approved maximum cadence: 30 days. Legacy longer cadences are not silently
  // shortened or retained longer. Due-day notifications remain independently due.
  if (interval > 30 && calendar.day(identity.dueDate) !== calendar.day(now())) return {status: "policy-blocked"};
  const ref = db.collection(COLLECTION).doc(deliveryId(identity));
  const token = crypto.randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snap = await tx.get(ref), time = now();
    const prior = snap.exists ? snap.data() : {};
    const state = Number(prior.expiresAt || 0) > time ? prior : {};
    if (state.state === "claimed" && state.leaseUntil > time) return false;
    const today = calendar.day(time), due = calendar.day(identity.dueDate);
    // Conservative transition from the legacy sender. A global marker does not
    // prove individual delivery; use it only as a cadence floor when no live
    // per-recipient record exists. Never import it as a successful delivery.
    const last = Number.isFinite(state.lastSentAt) ? calendar.day(state.lastSentAt) :
      Object.keys(state).length ? null : calendar.day(legacyLastSentAt);
    if (last && (last === today || (!forceImmediate && due !== today && calendar.distance(last, today) < interval))) return false;
    tx.set(ref, {state: "claimed", attemptToken: token, claimedAt: time,
      leaseUntil: time + LEASE_MS, lastSentAt: state.lastSentAt ?? null,
      expiresAt: time + RETENTION_MS});
    return true;
  });
  if (!claim) return {status: "skipped"};
  const finish = async status => db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().attemptToken !== token) return false;
    const time = now();
    // Replace, rather than merge: no accidental accumulation of diagnostic data.
    tx.set(ref, {state: status, finishedAt: time,
      lastSentAt: status === "sent" ? time : snap.data().lastSentAt ?? null,
      expiresAt: time + RETENTION_MS});
    return true;
  });
  try {
    if (!await eligible()) {
      await finish("cancelled");
      return {status: "cancelled"};
    }
    // Recheck lease/token after slow eligibility reads. A send already submitted
    // cannot be fenced by Firestore; uncertain retries may duplicate delivery.
    const current = await ref.get();
    if (!current.exists || current.data().attemptToken !== token || current.data().leaseUntil <= now()) return {status: "stale"};
    await send();
  } catch (error) {
    await finish("uncertain");
    throw error;
  }
  if (!await finish("sent")) return {status: "uncertain"};
  return {status: "sent"};
}

// Bounded cleanup, independent of notification success. Expiry is rechecked in
// the transaction so a refreshed/claimed record is never deleted from a stale scan.
async function cleanup(db, now = Date.now, limit = 500) {
  const expired = await db.collection(COLLECTION).where("expiresAt", "<=", now()).limit(limit).get();
  let removed = 0;
  for (const item of expired.docs) {
    const deleted = await db.runTransaction(async tx => {
      const snap = await tx.get(item.ref), time = now();
      if (!snap.exists || snap.data().expiresAt > time || snap.data().leaseUntil > time) return false;
      tx.delete(item.ref);
      return true;
    });
    if (deleted) removed++;
  }
  return removed;
}

async function isEligible({docRef, dueDate, recipient, channel, recipients, now = Date.now}) {
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const current = snap.data(), due = calendar.day(current.dueDate);
  if (current.completed || !due || due !== calendar.day(dueDate)) return false;
  const days = calendar.distance(calendar.day(now()), due);
  if (days < 0 || days > Number(current.notif_days_before || 14)) return false;
  const match = recipients(current).find(item => item.email === recipient.email);
  return Boolean(match && match[channel === "email" ? "sendEmail" : "sendPush"] &&
    Boolean(match.canManage) === Boolean(recipient.canManage));
}

module.exports = {deliver, cleanup, isEligible, deliveryId, COLLECTION, LEASE_MS, RETENTION_MS};
