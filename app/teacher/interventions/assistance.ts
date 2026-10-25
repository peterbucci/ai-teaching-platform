import type { Attempt } from "../../../lib/evidence/contracts.ts";

export function interventionAssistanceLabels(
  attempt: Pick<Attempt, "assistance" | "response_text" | "submitted_at">,
  conceptId: string,
) {
  const assistance = attempt.assistance;
  if (
    !assistance ||
    attempt.submitted_at === null ||
    attempt.response_text === null
  )
    return {
      support: "Assistance not recorded",
      independence: "Independence not recorded for this concept",
    };
  const independent =
    assistance.independent_retrieval_eligible_by_concept[conceptId];
  const support =
    assistance.assistance_level !== "none_recorded"
      ? `Recorded help: ${assistance.assistance_level.replaceAll("_", " ")}`
      : assistance.scaffolding_types.length
        ? `Recorded scaffolding: ${assistance.scaffolding_types.map((type) => type.replaceAll("_", " ")).join(", ")}`
        : assistance.intervention_ids.length ||
            assistance.most_recent_content_assistance_at
          ? "Recorded tutor support"
          : "No recorded help";
  return {
    support,
    independence:
      independent === true
        ? "Independent retrieval eligible for this concept"
        : independent === false
          ? "Not an independent retrieval for this concept"
          : "Independence not recorded for this concept",
  };
}
