"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const calendar = require("../deadline-calendar");

test("civil dates stay literal; malformed dates and ambiguous timestamps are rejected", () => {
  for (const value of [null, undefined, {}, true, "", "2026-9-1", "2026-02-30", "2026-02-30T12:00:00Z", "2026-09-26T12:00:00", new Date(NaN), NaN]) {
    assert.equal(calendar.day(value), null, String(value));
  }
  assert.equal(calendar.day("2028-02-29"), "2028-02-29");
  assert.equal(calendar.day("2026-09-26T22:30:00.123456789Z"), "2026-09-27");
  assert.equal(calendar.day("2026-09-26T21:00:00-04:00"), "2026-09-27");
  assert.equal(calendar.day("2026-09-26"), "2026-09-26");
  assert.equal(calendar.distance("invalid", "2026-09-26"), null);
});
test("Italian midnight is explicit in summer and winter, including numeric and Date inputs", () => {
  for (const [instant, expected] of [["2026-09-26T21:59:59Z", "2026-09-26"],
    ["2026-09-26T22:00:00Z", "2026-09-27"], ["2026-01-15T22:59:59Z", "2026-01-15"],
    ["2026-01-15T23:00:00Z", "2026-01-16"], ["2026-09-27T00:00:00+02:00", "2026-09-27"]]) {
    assert.equal(calendar.day(instant), expected);
    assert.equal(calendar.day(new Date(instant)), expected);
    assert.equal(calendar.day(Date.parse(instant)), expected);
  }
});
test("calendar arithmetic ignores 23/25 hour days and preserves Italian display", () => {
  assert.equal(calendar.distance("2026-03-23", "2026-03-30"), 7);
  assert.equal(calendar.distance("2026-10-25", "2026-10-26"), 1);
  assert.equal(calendar.distance("2026-12-31", "2027-01-01"), 1);
  assert.equal(calendar.distance("2026-09-27", "2026-09-26"), -1);
  assert.equal(calendar.format("2026-09-26"), "26 settembre 2026");
});
test("real calendar module gives identical results in three host timezones", () => {
  const script = `const c=require(${JSON.stringify(require.resolve("../deadline-calendar"))});
    console.log(JSON.stringify([c.day('2026-09-26'),c.day('2026-09-26T22:30:00Z'),
      c.distance('2026-03-23','2026-03-30'),c.format('2026-09-26')]));`;
  for (const TZ of ["UTC", "Europe/Rome", "America/Los_Angeles"]) {
    const output = execFileSync(process.execPath, ["-e", script], {env: {...process.env, TZ}, encoding: "utf8"});
    assert.deepEqual(JSON.parse(output), ["2026-09-26", "2026-09-27", 7, "26 settembre 2026"]);
  }
});
