import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EvaluationSchema } from "../lib/evidence/contracts.ts";
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

test("only linked settled provider failures are retryable; unknown outcomes need reconciliation", () => {
  const original = buildDemoFixture(loadApprovedContent()).sessions[0]
    .evaluations[0];
  const failed = EvaluationSchema.parse({
    ...original,
    validation_status: "evaluation_failed",
    result: null,
    applied_result: null,
    failure_reason: "Synthetic terminal rejection",
    evaluator: {
      type: "language_model",
      model: "fixture-only",
      version: "recovery-test",
      provider_reservation_id: randomUUID(),
      provider_outcome: "settled",
    },
  });
  const now = Date.parse(failed.evaluated_at) + 60_000;
  assert.equal(evaluationRecovery([failed], now).allowed, true);
  const unknown = {
    ...failed,
    evaluator: { ...failed.evaluator, provider_outcome: "unknown" as const },
  };
  assert.equal(evaluationRecovery([unknown], now).allowed, false);
  assert.equal(evaluationRecovery([unknown], now).unfinished, true);
  const { provider_reservation_id: reservationId, ...unlinked } =
    failed.evaluator;
  assert.ok(reservationId);
  assert.equal(
    EvaluationSchema.safeParse({ ...failed, evaluator: unlinked }).success,
    false,
  );
  assert.equal(
    EvaluationSchema.safeParse({ ...unknown, validation_status: "rejected" })
      .success,
    false,
  );
  assert.equal(
    EvaluationSchema.safeParse({
      ...failed,
      validation_status: "pending_review",
    }).success,
    false,
  );
});
