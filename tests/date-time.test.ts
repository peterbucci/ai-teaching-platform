import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TIME_ZONE,
  formatLocalDate,
  resolveTimeZone,
} from "../lib/date-time.ts";

test("local dates use supported browser zones and Eastern fallback for missing or invalid zones", () => {
  assert.equal(DEFAULT_TIME_ZONE, "America/New_York");
  for (const unavailable of [undefined, null, "", "  ", "Not/AZone", "+04:00"])
    assert.equal(resolveTimeZone(unavailable), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone("Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(resolveTimeZone(" UTC "), "UTC");
  assert.equal(
    formatLocalDate("2026-10-01T02:05:00Z", "invalid"),
    formatLocalDate("2026-10-01T02:05:00Z"),
  );
});

test("assignment dates use the local calendar day near midnight without changing their timestamp", () => {
  const value = "2026-10-01T02:05:00Z";
  assert.equal(formatLocalDate(value), "Sep 30, 2026");
  assert.equal(formatLocalDate(value, "UTC"), "Oct 1, 2026");
  assert.equal(formatLocalDate(value, "Asia/Tokyo"), "Oct 1, 2026");
  assert.match(
    formatLocalDate(value, "America/New_York", true),
    /^Sep 30, 2026,? (?:at )?10:05 PM EDT$/,
  );
  assert.match(
    formatLocalDate(value, "Asia/Tokyo", true),
    /^Oct 1, 2026,? (?:at )?11:05 AM /,
  );
});

test("saved work timestamps follow Eastern daylight saving rather than a fixed UTC offset", () => {
  assert.match(
    formatLocalDate("2026-01-15T15:05:00Z", undefined, true),
    /10:05 AM EST$/,
  );
  assert.match(
    formatLocalDate("2026-07-15T15:05:00Z", undefined, true),
    /11:05 AM EDT$/,
  );
  assert.match(
    formatLocalDate("2026-03-08T06:59:00Z", undefined, true),
    /1:59 AM EST$/,
  );
  assert.match(
    formatLocalDate("2026-03-08T07:00:00Z", undefined, true),
    /3:00 AM EDT$/,
  );
});
