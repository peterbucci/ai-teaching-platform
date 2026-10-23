import assert from "node:assert/strict";
import { test } from "node:test";
import { runtimeGenerationEnabled } from "../lib/dialogue/runtime-policy.ts";

test("runtime generation requires an explicit valid assignment opt-in", () => {
  const own = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  assert.equal(runtimeGenerationEnabled(own, ""), false);
  assert.equal(runtimeGenerationEnabled(own, own), true);
  assert.equal(runtimeGenerationEnabled(other, own), false);
  assert.equal(runtimeGenerationEnabled(own, own + ",invalid"), false);
});
