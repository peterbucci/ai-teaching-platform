import type { Evaluation } from "../../../lib/evidence/contracts.ts";
import { canPrepareFromRow, type EvidenceRow } from "./model.ts";

/** Describe the displayed evaluation without changing the response's accepted
 * pointer or treating an unaccepted retry as the whole response's result. */
export function evidenceEvaluationDisplay(
  row: EvidenceRow,
  evaluation: Evaluation | undefined,
  concept: string | undefined,
) {
  const current =
    row.evaluation?.id === row.attempt.current_evaluation_id &&
    row.evaluation?.attempt_id === row.attempt.id &&
    row.evaluation?.validation_status === "accepted"
      ? row.evaluation
      : undefined;
  const responseEligible = canPrepareFromRow(row, concept ?? "");
  const selectedIsCurrent = Boolean(
    current &&
    evaluation?.id === current.id &&
    evaluation.attempt_id === row.attempt.id &&
    evaluation.validation_status === "accepted",
  );
  const preparationNote = current
    ? responseEligible
      ? "This selected evaluation is not used for intervention preparation. The response remains eligible through its current accepted evaluation."
      : "This selected evaluation is not used for intervention preparation. Preparation eligibility depends on the current accepted evaluation for this concept."
    : "This response is not eligible for intervention preparation until a current accepted evaluation is recorded.";

  if (selectedIsCurrent)
    return {
      kind: "current_accepted" as const,
      canPrepareSelected: responseEligible,
      notice: null,
      preparationNote: responseEligible
        ? "This current accepted evaluation can be used for intervention preparation."
        : "This evaluation does not support preparation for the selected concept.",
    };
  if (!current)
    return {
      kind: "no_current_accepted" as const,
      canPrepareSelected: false,
      notice:
        evaluation?.validation_status === "accepted"
          ? "This saved evaluation is marked accepted, but no current accepted result is recorded for this response. Preparation is unavailable until a current accepted result is recorded."
          : "No current accepted evaluation is recorded for this response.",
      preparationNote,
    };
  if (evaluation?.validation_status === "accepted")
    return {
      kind: "historical_accepted" as const,
      canPrepareSelected: false,
      notice:
        "You are viewing a historical accepted evaluation. Intervention preparation uses the current accepted evaluation.",
      preparationNote,
    };
  const later = Boolean(
    evaluation &&
    Date.parse(evaluation.evaluated_at) > Date.parse(current.evaluated_at),
  );
  return {
    kind: later ? ("later_unaccepted" as const) : ("other_unaccepted" as const),
    canPrepareSelected: false,
    notice: evaluation
      ? later
        ? "This later evaluation attempt has not been accepted. The earlier accepted result remains current."
        : "This evaluation attempt has not been accepted. A separate accepted result remains current."
      : "No evaluation is selected. This response has a current accepted evaluation.",
    preparationNote,
  };
}
