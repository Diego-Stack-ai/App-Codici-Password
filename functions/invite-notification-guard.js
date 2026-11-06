"use strict";

const crypto = require("node:crypto");
const {assertTransactionGlobalPurgeUnlocked} = require("./archive-purge-global-lock");

const LEDGER_COLLECTION = "inviteNotificationLedger";
const RATE_COLLECTION = "inviteNotificationRateLimits";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RETENTION_MS = 30 * 24 * HOUR_MS;
const OWNER_LIMIT_PER_HOUR = 100;
const RECIPIENT_LIMIT_PER_HOUR = 5;
const OWNER_LIMIT_PER_DAY = Object.freeze({email: 100, push: 500});
const GLOBAL_LIMIT_PER_DAY = Object.freeze({email: 400, push: 2000});
const MAX_RATE_DOCUMENTS_PER_DAY = 3 * (GLOBAL_LIMIT_PER_DAY.email + GLOBAL_LIMIT_PER_DAY.push) + 2;
const CLEANUP_LIMIT_PER_COLLECTION = 10000;
const SEGMENT = /^[A-Za-z0-9_-]{1,160}$/;
const INVITE_ID = /^[A-Za-z0-9_-]{1,512}$/;
const INSTANCE_REF = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function sanitizeEmail(email) {
  return normalizeEmail(email).replace(/[^a-zA-Z0-9]/g, "_");
}

function safeSegment(value) {
  return typeof value === "string" && SEGMENT.test(value) ? value : "";
}

function safeInviteId(value) {
  return typeof value === "string" && INVITE_ID.test(value) ? value : "";
}

function instanceRef(invite) {
  return typeof invite?.auditRef === "string" && INSTANCE_REF.test(invite.auditRef) ? invite.auditRef : "";
}

function isNotificationTransition(before, after) {
  const nextRef = instanceRef(after);
  if (!nextRef || after?.status !== "pending") return false;
  return !before || before.status !== "pending" || instanceRef(before) !== nextRef;
}

function cycle(value) {
  if (value === undefined) return 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hash(parts) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function accountPath(invite) {
  const ownerId = safeSegment(invite?.ownerId);
  const accountId = safeSegment(invite?.accountId);
  const senderId = safeSegment(invite?.senderId);
  if (!ownerId || !accountId || senderId !== ownerId) return "";
  if (invite.aziendaId === undefined || invite.aziendaId === null || invite.aziendaId === "") {
    return `users/${ownerId}/accounts/${accountId}`;
  }
  const companyId = safeSegment(invite.aziendaId);
  return companyId ? `users/${ownerId}/aziende/${companyId}/accounts/${accountId}` : "";
}

async function resolveRecipientUid(auth, email) {
  if (!auth || typeof auth.getUserByEmail !== 'function') throw Error('INVITE_NOTIFICATION_AUTH_REQUIRED');
  try {
    const user = await auth.getUserByEmail(email);
    if (typeof user?.uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(user.uid)) throw Error('INVITE_RECIPIENT_INVALID');
    return user.uid;
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}
async function assertParticipants(tx, db, ownerId, recipientUid) {
  await assertTransactionGlobalPurgeUnlocked(tx, db, ownerId);
  if (recipientUid && recipientUid !== ownerId) await assertTransactionGlobalPurgeUnlocked(tx, db, recipientUid);
}
async function authoritativeInvite({db, auth, invite, inviteId}) {
  const notificationInstance = instanceRef(invite);
  if (!safeInviteId(inviteId) || !notificationInstance || invite?.inviteId !== inviteId || invite?.status !== 'pending') return null;
  const recipientEmail = normalizeEmail(invite.recipientEmail);
  const path = accountPath(invite);
  const inviteCycle = cycle(invite.cycle);
  if (!recipientEmail || !path || inviteCycle === null) return null;
  const expectedInviteId = `${invite.accountId}_${sanitizeEmail(recipientEmail)}${inviteCycle > 0 ? `_c${inviteCycle}` : ''}`;
  if (inviteId !== expectedInviteId) return null;
  const recipientUid = await resolveRecipientUid(auth, recipientEmail);
  return db.runTransaction(async tx => {
    await assertParticipants(tx, db, invite.ownerId, recipientUid);
    const [snapshot, live] = await Promise.all([tx.get(db.doc(path)), tx.get(db.doc(`invites/${inviteId}`))]);
    if (!snapshot.exists || !live.exists) return null;
    const liveInvite = live.data();
    if (liveInvite?.status !== 'pending' || instanceRef(liveInvite) !== notificationInstance ||
        accountPath(liveInvite) !== path || cycle(liveInvite.cycle) !== inviteCycle ||
        normalizeEmail(liveInvite.recipientEmail) !== recipientEmail) return null;
    const account = snapshot.data();
    if (!account || account.isArchived === true || cycle(account.sharingCycle) !== inviteCycle) return null;
    const entry = account.sharedWith?.[sanitizeEmail(recipientEmail)];
    if (!entry || entry.status !== 'pending' || normalizeEmail(entry.email) !== recipientEmail) return null;
    return Object.freeze({ownerId: invite.ownerId, recipientUid, notificationInstance, recipientEmail,
      notifyEmail: entry.notifyEmail === true, notifyPush: entry.notifyPush !== false,
      accountName: String(account.nomeAccount || 'un account condiviso').trim().slice(0, 100) || 'un account condiviso'});
  });
}

async function claim({db, inviteId, notificationInstance, ownerId, recipientUid = null, recipientEmail, channel, now = Date.now}) {
  if (!safeInviteId(inviteId) || !INSTANCE_REF.test(notificationInstance || "") ||
      !safeSegment(ownerId) || (recipientUid !== null && (typeof recipientUid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(recipientUid))) || !normalizeEmail(recipientEmail) ||
      !["email", "push"].includes(channel)) return {status: "invalid"};
  const time = now();
  const bucket = Math.floor(time / HOUR_MS);
  const dayBucket = Math.floor(time / DAY_MS);
  const deliveryRef = db.collection(LEDGER_COLLECTION).doc(hash([inviteId, notificationInstance, channel]));
  const ownerRef = db.collection(RATE_COLLECTION).doc(hash(["owner", ownerId, channel, bucket]));
  const ownerDailyRef = db.collection(RATE_COLLECTION).doc(hash(["owner-day", ownerId, channel, dayBucket]));
  const recipientRef = db.collection(RATE_COLLECTION).doc(hash(["recipient", recipientEmail, channel, bucket]));
  const globalDailyRef = db.collection(RATE_COLLECTION).doc(hash(["global-day", channel, dayBucket]));
  return db.runTransaction(async tx => {
    await assertParticipants(tx, db, ownerId, recipientUid);
    const [delivery, owner, ownerDaily, recipient, globalDaily] = await Promise.all([
      tx.get(deliveryRef), tx.get(ownerRef), tx.get(ownerDailyRef), tx.get(recipientRef), tx.get(globalDailyRef)
    ]);
    if (delivery.exists) {
      const prior = delivery.data();
      // A known unsubmitted claim may resume without charging rates again.
      if (prior.state === 'claimed' && prior.ownerId === ownerId && prior.recipientUid === recipientUid &&
          prior.notificationInstance === notificationInstance && prior.channel === channel) return {status: 'claimed', ref: deliveryRef};
      return {status: 'duplicate'};
    }
    const ownerCount = Number(owner.exists ? owner.data().count : 0);
    const ownerDailyCount = Number(ownerDaily.exists ? ownerDaily.data().count : 0);
    const recipientCount = Number(recipient.exists ? recipient.data().count : 0);
    const globalDailyCount = Number(globalDaily.exists ? globalDaily.data().count : 0);
    if (![ownerCount, ownerDailyCount, recipientCount, globalDailyCount]
        .every(value => Number.isSafeInteger(value) && value >= 0)) return {status: "blocked"};
    if (ownerCount >= OWNER_LIMIT_PER_HOUR || recipientCount >= RECIPIENT_LIMIT_PER_HOUR ||
        ownerDailyCount >= OWNER_LIMIT_PER_DAY[channel] ||
        globalDailyCount >= GLOBAL_LIMIT_PER_DAY[channel]) {
      return {status: "rate-limited"};
    }
    const expiresAt = time + RETENTION_MS;
    tx.set(ownerRef, {kind: "owner", bucket, count: ownerCount + 1, expiresAt});
    tx.set(ownerDailyRef, {kind: "owner-day", bucket: dayBucket, count: ownerDailyCount + 1, expiresAt});
    tx.set(recipientRef, {kind: "recipient", bucket, count: recipientCount + 1, expiresAt});
    tx.set(globalDailyRef, {kind: "global-day", bucket: dayBucket, count: globalDailyCount + 1, expiresAt});
    tx.set(deliveryRef, {state: "claimed", ownerId, recipientUid, notificationInstance, channel, claimedAt: time, expiresAt});
    return {status: "claimed", ref: deliveryRef};
  });
}

function sameParticipantBinding(record, current) {
  return record?.ownerId === current.ownerId && record.recipientUid === current.recipientUid &&
    record.notificationInstance === current.notificationInstance;
}
async function beginDelivery({db, ref, current}) {
  return db.runTransaction(async tx => {
    await assertParticipants(tx, db, current.ownerId, current.recipientUid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.data().state !== 'claimed' || !sameParticipantBinding(snapshot.data(), current)) return false;
    tx.set(ref, {...snapshot.data(), state: 'sending'});
    return true;
  });
}
async function finish({db, ref, current, status, now = Date.now}) {
  if (!ref || !['sent', 'cancelled', 'failed'].includes(status)) return false;
  return db.runTransaction(async tx => {
    await assertParticipants(tx, db, current.ownerId, current.recipientUid);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || !['claimed', 'sending'].includes(snapshot.data().state) ||
        !sameParticipantBinding(snapshot.data(), current)) return false;
    tx.set(ref, {...snapshot.data(), state: status, finishedAt: now(), expiresAt: now() + RETENTION_MS});
    return true;
  });
}
async function deliver({db, auth, invite, inviteId, channel, send, now = Date.now}) {
  const current = await authoritativeInvite({db, auth, invite, inviteId});
  if (!current || !current[channel === 'email' ? 'notifyEmail' : 'notifyPush']) return {status: 'ineligible'};
  const reservation = await claim({db, inviteId, ownerId: current.ownerId, recipientUid: current.recipientUid,
    notificationInstance: current.notificationInstance, recipientEmail: current.recipientEmail, channel, now});
  if (reservation.status !== 'claimed') return reservation;
  try {
    const rechecked = await authoritativeInvite({db, auth, invite, inviteId});
    if (!rechecked || !sameParticipantBinding(rechecked, current) || !rechecked[channel === 'email' ? 'notifyEmail' : 'notifyPush']) {
      await finish({db, ref: reservation.ref, current, status: 'cancelled', now});
      return {status: 'cancelled'};
    }
    // CAS makes concurrent retries of a deferred claim submit at most once.
    if (!await beginDelivery({db, ref: reservation.ref, current})) return {status: 'duplicate'};
    const sent = await send(rechecked);
    await finish({db, ref: reservation.ref, current, status: sent === false ? 'cancelled' : 'sent', now});
    return {status: sent === false ? 'cancelled' : 'sent'};
  } catch (error) {
    if (/^(RECOVERY_FENCE_|PURGE_LOCK_)/.test(String(error?.code || error?.message))) throw error;
    await finish({db, ref: reservation.ref, current, status: 'failed', now});
    throw error;
  }
}

async function cleanupCollection(db, collectionName, now = Date.now, limit = 500) {
  const expired = await db.collection(collectionName).where("expiresAt", "<=", now()).limit(limit).get();
  let removed = 0;
  for (let offset = 0; offset < expired.docs.length; offset += 400) {
    const chunk = expired.docs.slice(offset, offset + 400);
    const batch = db.batch();
    for (const item of chunk) batch.delete(item.ref, {lastUpdateTime: item.updateTime});
    await batch.commit();
    removed += chunk.length;
  }
  return removed;
}

async function cleanup(db, now = Date.now, limit = CLEANUP_LIMIT_PER_COLLECTION) {
  const [ledger, rates] = await Promise.all([
    cleanupCollection(db, LEDGER_COLLECTION, now, limit),
    cleanupCollection(db, RATE_COLLECTION, now, limit)
  ]);
  return ledger + rates;
}

module.exports = {deliver, authoritativeInvite, claim, cleanup, accountPath, normalizeEmail,
  isNotificationTransition,
  LEDGER_COLLECTION, RATE_COLLECTION, OWNER_LIMIT_PER_HOUR, RECIPIENT_LIMIT_PER_HOUR,
  OWNER_LIMIT_PER_DAY, GLOBAL_LIMIT_PER_DAY, MAX_RATE_DOCUMENTS_PER_DAY,
  CLEANUP_LIMIT_PER_COLLECTION};
