import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { evaluationRecovery } from "../lib/evaluation/recovery.ts";

test("recovery waits, caps requests, and never retries an accepted judgment", () => {
  const accepted = buildDemoFixture(loadApprovedContent()).sessions[0]
    .evaluations[0];
  accepted.evaluator = {
    type: "language_model",
    model: "fixture-only",
    version: "recovery-test",
  };
  const failed = {
    ...accepted,
    validation_status: "evaluation_failed" as const,
    result: null,
    applied_result: null,
    failure_reason: "Provider unavailable",
  };
  const at = Date.parse(failed.evaluated_at);
  assert.equal(
    evaluationRecovery(
      [{ ...failed, validation_status: "pending_review" }],
      at + 120_000,
    ).allowed,
    false,
  );
  assert.equal(evaluationRecovery([failed], at + 59_999).allowed, false);
  assert.equal(evaluationRecovery([failed], at + 60_000).allowed, true);
  assert.equal(
    evaluationRecovery([failed, failed, failed], at + 120_000).allowed,
    false,
  );
  assert.equal(
    evaluationRecovery([failed, accepted], at + 120_000).allowed,
    false,
  );
});
