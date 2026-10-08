"use strict";
// Conservative UTC parser; rejects normalized invalid calendar dates.
function parseCloudEventTime(raw) {
  const invalid = {ok: false, millis: null, reason: "EVENT_TIME_INVALID"};
  if (typeof raw !== "string") return invalid;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(raw);
  if (!match) return invalid;
  const canonical = match[1] + "." + (match[2] || "").padEnd(3, "0").slice(0, 3) + "Z";
  const millis = Date.parse(canonical);
  if (!Number.isSafeInteger(millis) || new Date(millis).toISOString() !== canonical) return invalid;
  return {ok: true, millis, reason: "VALID"};
}
module.exports = {parseCloudEventTime};
