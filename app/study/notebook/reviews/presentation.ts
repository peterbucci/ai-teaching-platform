import type { StudentIntervention } from "../../../../lib/interventions/approval-contracts.ts";
import type { StudentInterventionFollowup } from "../../../../lib/interventions/outcomes-contracts.ts";
import { readingHref } from "../../reading/presentation.ts";

/** A list response does not contain a fresh-check status. Never infer one. */
export type ReviewFollowupState =
  | { status: "not_loaded" | "loading" | "unavailable" }
  | { status: "ready"; followup: StudentInterventionFollowup };

/** Structural bridge for N0's safe card projection; full public DTOs also fit. */
export type ReviewSummaryIntervention = Pick<
  StudentIntervention,
  "approval_id" | "assignment_id" | "delivered_at" | "displayed_at"
> & {
  activity: Pick<
    StudentIntervention["activity"],
    "title" | "learning_objective"
  >;
};

export type ReviewStatus = {
  key:
    | "not_loaded"
    | "loading"
    | "unavailable"
    | "not_started"
    | "started"
    | "submitted"
    | "pending"
    | "failed"
    | "accepted";
  label: string;
  description: string;
  tone: "neutral" | "info" | "warning" | "success";
};

/** Correlation guard only. The existing authenticated loader owns authorization. */
export function linkedReviewFollowup(
  intervention: Pick<StudentIntervention, "approval_id">,
  state: ReviewFollowupState,
): StudentInterventionFollowup | null {
  return state.status === "ready" &&
    state.followup.approval_id === intervention.approval_id
    ? state.followup
    : null;
}

export function reviewStatus(
  intervention: Pick<StudentIntervention, "approval_id">,
  state: ReviewFollowupState = { status: "not_loaded" },
): ReviewStatus {
  if (state.status === "not_loaded")
    return {
      key: "not_loaded",
      label: "Fresh-check status not loaded",
      description: "Open the review to load your saved fresh-check status.",
      tone: "neutral",
    };
  if (state.status === "loading")
    return {
      key: "loading",
      label: "Loading saved status…",
      description: "Wait for the saved status before taking another action.",
      tone: "info",
    };
  const followup = linkedReviewFollowup(intervention, state);
  if (!followup)
    return {
      key: "unavailable",
      label: "Saved status unavailable",
      description:
        "Your fresh-check status could not be loaded. Open the review to refresh it.",
      tone: "warning",
    };
  if (!followup.submitted_at || !followup.attempt_id) {
    if (followup.evaluation_status !== "not_submitted")
      return reviewStatus(intervention, { status: "unavailable" });
    return followup.started_at
      ? {
          key: "started",
          label: "Started · no answer submitted",
          description:
            "Your fresh check has started. No submitted answer is recorded.",
          tone: "info",
        }
      : {
          key: "not_started",
          label: "Fresh check not started",
          description:
            "Opening a review does not start or submit your fresh check.",
          tone: "neutral",
        };
  }
  switch (followup.evaluation_status) {
    case "pending":
      return {
        key: "pending",
        label: "Evaluation pending",
        description:
          "Your answer is submitted. The evaluation is pending or its outcome is unknown; this is not an incorrect result.",
        tone: "info",
      };
    case "failed":
      return {
        key: "failed",
        label: "Evaluation unavailable",
        description:
          "Your answer is submitted, but evaluation did not succeed. This is not an incorrect result. Open the review for recovery options.",
        tone: "warning",
      };
    case "accepted":
      if (!followup.evaluation_id || followup.response_text === null)
        return reviewStatus(intervention, { status: "unavailable" });
      return {
        key: "accepted",
        label: followup.uncertain
          ? "Evaluation accepted · uncertain"
          : "Evaluation accepted",
        description: "Your saved answer has an accepted evaluation.",
        tone: followup.uncertain ? "warning" : "success",
      };
    case "not_submitted":
      return {
        key: "submitted",
        label: "Answer submitted",
        description:
          "Your answer is submitted. An accepted evaluation is not available.",
        tone: "info",
      };
  }
}

export function reviewHref(
  intervention: Pick<StudentIntervention, "approval_id">,
) {
  return `/study/interventions/${encodeURIComponent(intervention.approval_id)}`;
}

export function reviewReadingLinks(intervention: StudentIntervention) {
  return intervention.activity.source_references.map((source) => ({
    passageId: source.passage_id,
    href: readingHref({
      assignmentId: intervention.assignment_id,
      contentVersion: intervention.content_ref.content_version,
      passageId: source.passage_id,
    }),
  }));
}

/** UTC is explicit and stable across server rendering and client hydration. */
export function reviewTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}
