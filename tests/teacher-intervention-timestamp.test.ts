import assert from "node:assert/strict";
import test from "node:test";
import { interventionTimestamp } from "../app/teacher/interventions/timestamp.ts";

test("saved intervention instants render with an explicit, stable UTC meaning", () => {
  // The actual R07 server instant, also expressed with the browser's offset.
  assert.equal(
    interventionTimestamp("2026-10-25T16:33:22.123Z"),
    "2026-10-25 16:33:22 UTC",
  );
  assert.equal(
    interventionTimestamp("2026-10-25T12:33:22.123-04:00"),
    "2026-10-25 16:33:22 UTC",
  );
  assert.equal(
    interventionTimestamp("2026-01-01T00:15:00+14:00"),
    "2025-12-31 10:15:00 UTC",
  );
});
