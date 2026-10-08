"use strict";

// Civil dates are not instants. Existing date-only markers remain literal.
const DAY_MS = 86400000;
const rome = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
});
function ordinal(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null;
  return date.getTime() / DAY_MS;
}
function day(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return ordinal(value) === null ? null : value;
  }
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (typeof value === "string" && ordinal(value.slice(0, 10)) === null) return null;
  if (typeof value !== "string" && typeof value !== "number" && Object.prototype.toString.call(value) !== "[object Date]") return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = rome.formatToParts(date);
  const part = name => parts.find(item => item.type === name).value;
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  return ordinal(result) === null ? null : result;
}
function distance(from, to) {
  const a = ordinal(from), b = ordinal(to);
  return a === null || b === null ? null : b - a;
}
function format(dayValue) {
  if (ordinal(dayValue) === null) return "";
  return new Date(`${dayValue}T12:00:00Z`).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric"
  });
}
module.exports = {day, distance, format};
