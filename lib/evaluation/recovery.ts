import type { Evaluation } from "../evidence/contracts.ts";

// One initial request and at most two explicitly requested retries per answer.
// The provider's own retry count stays zero. Never retry an accepted result.
export function evaluationRecovery(
  evaluations: readonly Evaluation[],
  now: number,
) {
  const modelRuns = evaluations.filter(
    (e) => e.evaluator.type === "language_model",
  );
  const latest = modelRuns.at(-1);
  const unfinished =
    latest?.validation_status === "pending_review" ||
    latest?.evaluator.provider_outcome === "unknown";
  const failed =
    latest && latest.validation_status !== "accepted" ? latest : null;
  const retryAfter = failed
    ? new Date(Date.parse(failed.evaluated_at) + 60_000).toISOString()
    : null;
  return {
    failed,
    retryAfter,
    unfinished,
    allowed:
      !!failed &&
      !unfinished &&
      modelRuns.filter((e) => e.validation_status !== "pending_review").length <
        3 &&
      !evaluations.some((e) => e.validation_status === "accepted") &&
      now >= Date.parse(retryAfter!),
    exhausted:
      modelRuns.filter((e) => e.validation_status !== "pending_review")
        .length >= 3,
  };
}
