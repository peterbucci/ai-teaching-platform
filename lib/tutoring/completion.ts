import type { SessionEvidence } from "../evidence/contracts.ts";

const performanceNote =
  "This records today's performance, not lasting mastery.";
const completedWithoutResult = `Practice complete. ${performanceNote}`;

/** Student-safe wording from the current accepted result, never private criteria. */
export function tutoringCompletionMessage(evidence: SessionEvidence): string {
  if (evidence.session.status !== "completed")
    return "Your work is saved. An assessment is not yet confirmed. This does not establish lasting mastery.";

  const attempt = evidence.attempts.reduce<
    SessionEvidence["attempts"][number] | undefined
  >(
    (latest, item) =>
      !latest || item.sequence_index > latest.sequence_index ? item : latest,
    undefined,
  );
  if (
    !attempt?.submitted_at ||
    attempt.session_id !== evidence.session.id ||
    !attempt.current_evaluation_id
  )
    return completedWithoutResult;
  const evaluation = evidence.evaluations.find(
    (item) => item.id === attempt.current_evaluation_id,
  );
  if (
    !evaluation ||
    evaluation.attempt_id !== attempt.id ||
    evaluation.validation_status !== "accepted" ||
    evaluation.evaluator.provider_outcome === "unknown" ||
    !evaluation.result ||
    evidence.evaluations.some(
      (item) =>
        item.attempt_id === attempt.id &&
        item.validation_status === "accepted" &&
        item.supersedes_id === evaluation.id,
    )
  )
    return completedWithoutResult;

  const concepts = new Set(attempt.question.concept_ids);
  const results = evaluation.result.per_concept_results;
  if (
    !concepts.size ||
    concepts.size !== attempt.question.concept_ids.length ||
    results.length !== concepts.size ||
    new Set(results.map((result) => result.concept_id)).size !==
      concepts.size ||
    results.some((result) => !concepts.has(result.concept_id))
  )
    return completedWithoutResult;

  const answer = results.some((result) => result.correctness === "uncertain")
    ? "Your latest answer could not be assessed with confidence."
    : results.every((result) => result.correctness === "correct")
      ? "Your answer is correct."
      : results.every((result) => result.correctness === "incorrect")
        ? "Your latest answer is not correct yet."
        : "Your latest answer is partly correct.";
  const assistance =
    attempt.assistance &&
    attempt.assistance.assistance_level !== "none_recorded"
      ? " This answer followed help."
      : "";
  return `${answer} Practice complete.${assistance} ${performanceNote}`;
}
