"use strict";

const crypto = require("node:crypto");

// Preserve the approved invitation provider policy and its existing counters.
// Deadline email and invitation email must compete for these same documents.
const RATE_COLLECTION = "inviteNotificationRateLimits";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RETENTION_MS = 30 * DAY_MS;
const OWNER_LIMIT_PER_HOUR = 100;
const RECIPIENT_LIMIT_PER_HOUR = 5;
const OWNER_LIMIT_PER_DAY = Object.freeze({email: 100, push: 500});
const GLOBAL_LIMIT_PER_DAY = Object.freeze({email: 400, push: 2000});
const MAX_RATE_DOCUMENTS_PER_DAY = 3 * (GLOBAL_LIMIT_PER_DAY.email + GLOBAL_LIMIT_PER_DAY.push) + 2;

function hash(parts) {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

// Call after every other transaction read, before any caller writes. A rejected
// reservation creates no counters or delivery ledger, even for arbitrary IDs.
async function reserve({tx, db, ownerId, recipientEmail, channel, time}) {
  const email = String(recipientEmail || "").trim().toLowerCase();
  if (typeof ownerId !== "string" || !ownerId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["email", "push"].includes(channel) || !Number.isFinite(time)) return {status: "blocked"};
  const bucket = Math.floor(time / HOUR_MS), dayBucket = Math.floor(time / DAY_MS);
  const counters = [
    {parts: ["owner", ownerId, channel, bucket], kind: "owner", bucket, limit: OWNER_LIMIT_PER_HOUR},
    {parts: ["owner-day", ownerId, channel, dayBucket], kind: "owner-day", bucket: dayBucket, limit: OWNER_LIMIT_PER_DAY[channel]},
    {parts: ["recipient", email, channel, bucket], kind: "recipient", bucket, limit: RECIPIENT_LIMIT_PER_HOUR},
    {parts: ["global-day", channel, dayBucket], kind: "global-day", bucket: dayBucket, limit: GLOBAL_LIMIT_PER_DAY[channel]}
  ];
  const refs = counters.map(counter => db.collection(RATE_COLLECTION).doc(hash(counter.parts)));
  const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
  const counts = snapshots.map(snapshot => Number(snapshot.exists ? snapshot.data().count : 0));
  if (!counts.every(count => Number.isSafeInteger(count) && count >= 0)) return {status: "blocked"};
  if (counters.some((counter, index) => counts[index] >= counter.limit)) return {status: "rate-limited"};
  counters.forEach((counter, index) => tx.set(refs[index], {
    kind: counter.kind, bucket: counter.bucket, count: counts[index] + 1, expiresAt: time + RETENTION_MS
  }));
  return {status: "admitted"};
}

module.exports = {reserve, RATE_COLLECTION, RETENTION_MS, OWNER_LIMIT_PER_HOUR, RECIPIENT_LIMIT_PER_HOUR,
  OWNER_LIMIT_PER_DAY, GLOBAL_LIMIT_PER_DAY, MAX_RATE_DOCUMENTS_PER_DAY};
