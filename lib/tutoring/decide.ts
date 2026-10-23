import { randomUUID } from "node:crypto";
import type { ApprovedContent } from "../evidence/content.ts";
import type {
  AppliedResult,
  Attempt,
  EpisodeOutcome,
  Evaluation,
  Intervention,
  SessionEvidence,
} from "../evidence/contracts.ts";
import { validateSessionEvidence } from "../evidence/rules.ts";

export const TUTOR_POLICY_VERSION = "approved-sequence-v1";
type Outcome = EpisodeOutcome["outcome"];
type Help = Pick<
  Intervention,
  "type" | "text_shown" | "concept_ids" | "source_passage_ids"
>;
export type TutorDecision = {
  applied: AppliedResult;
  nextQuestionId: string | null;
  help: Help | null;
  outcome: Outcome | null;
};

/** Executes the bounded authored sequence's semantics, never its natural-language
 * conditions or the model's recommendation. IDs and activities come from content.
 * New lesson shapes need a reviewed policy, not arbitrary executable content. */
export function decideTutoring(
  content: ApprovedContent,
  input: SessionEvidence,
  evaluationId: string,
  now: string,
): TutorDecision {
  const evidence = validateSessionEvidence(content, input);
  const foundAttempt = evidence.attempts.at(-1);
  const foundEvaluation = evidence.evaluations.find(
    (item) => item.id === evaluationId,
  );
  if (!foundAttempt || !foundEvaluation)
    throw new Error("Missing current evidence");
  const attempt = foundAttempt;
  const evaluation = foundEvaluation;
  if (
    evidence.session.status !== "active" ||
    evaluation.attempt_id !== attempt.id ||
    attempt.current_evaluation_id !== evaluation.id ||
    evaluation.validation_status !== "accepted" ||
    !evaluation.result ||
    evaluation.applied_result
  )
    throw new Error(
      "Only the latest unapplied accepted evaluation can advance an active session",
    );
  const lesson = content.sequence;
  if (attempt.question.sequence_id !== lesson.sequence_id)
    throw new Error(
      "This question has no supported approved tutoring sequence",
    );
  const node = lesson.nodes.find(
    (item) => item.node_id === attempt.question.question_id,
  );
  if (!node) throw new Error("Question is outside the approved sequence");
  const episode = evidence.attempts.filter(
    (item) => item.root_attempt_id === attempt.root_attempt_id,
  );
  const result = evaluation.result;
  const judgments = result.per_concept_results;
  const correct = judgments.every((item) => item.correctness === "correct");
  const arithmeticOnly = judgments.every(
    (item) =>
      item.correctness === "correct" ||
      (item.correctness === "partially_correct" &&
        item.error_type === "arithmetic_or_units"),
  );
  const unsupported = judgments.every(
    (item) =>
      item.correctness === "uncertain" &&
      item.error_type === "insufficient_response",
  );
  const events = evidence.evaluations
    .filter((item) => episode.some((a) => a.id === item.attempt_id))
    .flatMap((item) => item.applied_result?.hypothesis_events ?? []);
  const diagnostic = lesson.diagnostic_options.find(
    (option) =>
      option.misconception_id !== null &&
      result.misconception_candidates?.some(
        (item) => item.misconception_id === option.misconception_id,
      ) &&
      !episode.some((item) => item.question.question_id === option.question_id),
  );
  const hypothesisId =
    node.kind === "diagnostic_followup"
      ? (lesson.diagnostic_options.find(
          (option) => option.question_id === node.node_id,
        )?.misconception_id ?? null)
      : node.kind === "immediate_retest"
        ? (events.at(-1)?.misconception_id ?? lesson.hypothesis_id)
        : (diagnostic?.misconception_id ?? lesson.hypothesis_id);
  const candidate = result.misconception_candidates?.find(
    (item) => item.misconception_id === hypothesisId,
  );
  const previous = events
    .filter(
      (item) =>
        item.misconception_id === hypothesisId &&
        (!candidate || item.concept_id === candidate.concept_id),
    )
    .at(-1);
  const hypothesisEvents: AppliedResult["hypothesis_events"] = [];
  const count = (kind: string) =>
    new Set(
      episode
        .filter(
          (item) =>
            lesson.nodes.find((n) => n.node_id === item.question.question_id)
              ?.kind === kind,
        )
        .map((item) => item.question.question_id),
    ).size;
  function activity(kind: string) {
    const matches = lesson.nodes.filter((item) => item.kind === kind);
    if (matches.length !== 1)
      throw new Error(`Expected one approved ${kind} activity`);
    return matches[0];
  }
  function question(id: string) {
    if (
      !content.questions.has(id) ||
      !lesson.nodes.some((n) => n.node_id === id)
    )
      throw new Error("Next question is unavailable in the approved lesson");
    return id;
  }
  function decision(
    action: AppliedResult["action"],
    nextQuestionId: string | null = null,
    help: Help | null = null,
    outcome: Outcome | null = null,
  ): TutorDecision {
    if (
      nextQuestionId &&
      episode.length >= lesson.bounds.max_student_response_prompts
    )
      return {
        applied: { action: "END_SESSION", hypothesis_events: [] },
        nextQuestionId: null,
        help: {
          type: "fallback",
          text_shown:
            "Your work is saved. Please ask your teacher for help before continuing.",
          concept_ids: [],
          source_passage_ids: [],
        },
        outcome: "unevaluated",
      };
    return {
      applied: { action, hypothesis_events: hypothesisEvents },
      nextQuestionId,
      help,
      outcome,
    };
  }
  function updateHypothesis(
    status: "suspected" | "supported" | "not_supported" | "uncertain",
  ) {
    if (hypothesisId === null || (!candidate && !previous)) return;
    const conceptId = candidate?.concept_id ?? previous?.concept_id;
    if (!conceptId) throw new Error("Hypothesis requires an assessed concept");
    // Earlier evidence is not evidence about this response. Preserve its hypothesis
    // unchanged when the current question/evaluation did not assess that concept.
    if (
      !attempt.question.concept_ids.includes(conceptId) ||
      !judgments.some((judgment) => judgment.concept_id === conceptId)
    )
      return;
    hypothesisEvents.push({
      id: randomUUID(),
      hypothesis_instance_id: previous?.hypothesis_instance_id ?? randomUUID(),
      concept_id: conceptId,
      misconception_id: hypothesisId,
      previous_status: previous?.status ?? null,
      status,
      evidence_evaluation_ids: [
        ...new Set([
          ...(previous?.evidence_evaluation_ids ?? []),
          ...(candidate ? [evaluation.id] : []),
        ]),
      ],
      contradicting_evaluation_ids: [
        ...new Set([
          ...(previous?.contradicting_evaluation_ids ?? []),
          ...(status === "not_supported" ? [evaluation.id] : []),
        ]),
      ],
      supporting_response_quotes: [
        ...(previous?.supporting_response_quotes ?? []),
        ...(candidate?.evidence_quotes ?? []),
      ],
      reason:
        status === "supported"
          ? "A distinct diagnostic response repeats the target explanation; this is evidence consistent with a possible misconception, not proof of a belief."
          : status === "not_supported"
            ? "The diagnostic explanation contradicts the earlier hypothesis before teaching."
            : status === "uncertain"
              ? "The follow-up does not clearly support or contradict the earlier explanation."
              : "Explicit response evidence suggests the lesson's target hypothesis; persistence has not been established.",
      created_at: now,
    });
  }
  function helpFor(kind: string): Help {
    const selected = activity(kind);
    if (!selected.feedback || !selected.source_passage_ids)
      throw new Error("Approved feedback is incomplete");
    const credited = judgments
      .filter((item) => item.correctness === "correct")
      .map((item) => content.concepts.get(item.concept_id)?.title)
      .filter(Boolean);
    const prefix = credited.length
      ? `Your explanation of ${credited.join(" and ")} was correct. `
      : "";
    return {
      type:
        kind === "arithmetic_feedback"
          ? "worked_example"
          : "corrective_feedback",
      text_shown: prefix + selected.feedback,
      concept_ids: [...lesson.concept_ids],
      source_passage_ids: selected.source_passage_ids,
    };
  }
  function correction(arithmetic = false) {
    // The authored numerical worked example applies only to the diagnostic's numbers.
    // Elsewhere preserve credit and request a unit/calculation check, without inventing numbers.
    const kind =
      arithmetic && node?.kind === "diagnostic_followup"
        ? "arithmetic_feedback"
        : "corrective_feedback";
    const selected = activity(kind);
    if (!selected.next_node_id)
      throw new Error("Feedback must lead to a fresh retest");
    const next = content.questions.get(question(selected.next_node_id));
    if (
      !next ||
      next.prompt_text === attempt.question.prompt_text ||
      next.question_id === attempt.question.question_id
    )
      throw new Error("Retest must differ from the submitted question");
    const help = helpFor(kind);
    if (arithmetic && kind !== "arithmetic_feedback")
      help.text_shown =
        "Check the arithmetic and units in your calculation; this is separate from the conceptual reasoning. " +
        help.text_shown;
    return decision("GIVE_CORRECTIVE_FEEDBACK", next.question_id, help);
  }
  if (unsupported) {
    const repeated =
      episode.length -
      new Set(episode.map((item) => item.question.question_id)).size;
    const fallback = activity("unsupported_input_or_evaluation_fallback");
    const message = fallback.feedback_variants?.unrelated_or_empty;
    if (!message) throw new Error("Approved fallback is missing");
    const retry = repeated < lesson.bounds.max_unsupported_input_retries_total;
    return decision(
      retry ? "ASK_RETRIEVAL_QUESTION" : "END_SESSION",
      retry ? question(node.node_id) : null,
      {
        type: "fallback",
        text_shown: message,
        concept_ids: [],
        source_passage_ids: [],
      },
      retry ? null : "unevaluated",
    );
  }
  if (node.kind === "immediate_retest") {
    if (node.next_node_id) {
      if (
        count("immediate_retest") >= lesson.bounds.max_immediate_retest_prompts
      )
        throw new Error("Retest limit exceeded");
      return decision("RETEST_CONCEPT", question(node.next_node_id));
    }
    const retests = [
      ...new Map(
        episode
          .filter((item) => item.intent === "immediate_retest")
          .map((item) => [item.question.question_id, item]),
      ).values(),
    ];
    const evaluations = retests.map((a) =>
      evidence.evaluations.find((e) => e.id === a.current_evaluation_id),
    );
    if (
      retests.length < lesson.bounds.max_immediate_retest_prompts ||
      evaluations.some((e) => !e?.result)
    )
      throw new Error("Closing requires the approved retest evidence");
    const paired = evaluations.flatMap(
      (e) => e?.result?.per_concept_results ?? [],
    );
    const outcome: Outcome = paired.every((j) => j.correctness === "correct")
      ? "correct_after_feedback"
      : candidate &&
          content.content_ref.package_id === "network-performance-v1" &&
          "source_commit" in content.content_ref
        ? "distance_error_observed_after_feedback"
        : paired.some((j) => j.correctness === "uncertain")
          ? "uncertain_after_feedback"
          : paired.every(
                (j) =>
                  j.correctness === "correct" ||
                  j.error_type === "arithmetic_or_units",
              )
            ? "partial_after_feedback_arithmetic_or_units"
            : "partial_or_incorrect_after_feedback";
    if (candidate && previous?.status !== "supported")
      updateHypothesis("suspected");
    const closing = activity("closing_feedback_and_review");
    const message = closing.feedback_variants?.[outcome];
    if (!message || !closing.source_passage_ids)
      throw new Error("Closing feedback is unavailable");
    return decision(
      "SCHEDULE_REVIEW",
      null,
      {
        type: "corrective_feedback",
        text_shown: message,
        concept_ids: [...lesson.concept_ids],
        source_passage_ids: closing.source_passage_ids,
      },
      outcome,
    );
  }
  if (node.kind === "diagnostic_followup") {
    if (candidate) updateHypothesis(previous ? "supported" : "suspected");
    else if (correct || arithmeticOnly) updateHypothesis("not_supported");
    else updateHypothesis("uncertain");
    if (correct)
      return decision(
        "END_SESSION",
        null,
        null,
        "correct_diagnostic_without_content_assistance",
      );
    return correction(arithmeticOnly);
  }
  if (!["initial_retrieval", "neutral_clarification"].includes(node.kind))
    throw new Error("Unsupported response activity");
  if (
    candidate &&
    diagnostic &&
    count("diagnostic_followup") < lesson.bounds.max_diagnostic_prompts
  ) {
    updateHypothesis("suspected");
    return decision(
      "ASK_DIAGNOSTIC_FOLLOWUP",
      question(diagnostic.question_id),
    );
  }
  if (correct)
    return decision(
      "END_SESSION",
      null,
      null,
      node.kind === "neutral_clarification"
        ? "correct_after_neutral_clarification_without_content_assistance"
        : "correct_initial_without_content_assistance",
    );
  const unclear = judgments.some(
    (item) =>
      item.correctness === "uncertain" ||
      item.error_type === "terminology_or_ambiguity",
  );
  if (
    unclear &&
    count("neutral_clarification") < lesson.bounds.max_neutral_clarifications
  )
    return decision(
      "ASK_SELF_EXPLANATION",
      question(activity("neutral_clarification").node_id),
    );
  const neutralDiagnostic = lesson.diagnostic_options.find(
    (option) =>
      option.misconception_id === null &&
      !episode.some((item) => item.question.question_id === option.question_id),
  );
  const conceptualError = judgments.some(
    (item) =>
      ["incorrect", "partially_correct"].includes(item.correctness) &&
      item.error_type === "conceptual",
  );
  if (
    !unclear &&
    !diagnostic &&
    neutralDiagnostic &&
    conceptualError &&
    count("diagnostic_followup") < lesson.bounds.max_diagnostic_prompts
  )
    return decision(
      "ASK_DIAGNOSTIC_FOLLOWUP",
      question(neutralDiagnostic.question_id),
    );
  return correction(arithmeticOnly);
}

/** One illustrative interval from the approved demo, not a mastery/spacing model. */
export function tutoringOutcome(
  evidence: SessionEvidence,
  attempt: Attempt,
  evaluation: Evaluation,
  decision: TutorDecision,
  now: string,
): EpisodeOutcome | null {
  if (!decision.outcome) return null;
  const episode = evidence.attempts.filter(
    (a) => a.root_attempt_id === attempt.root_attempt_id,
  );
  const latest = [
    ...evidence.evaluations.flatMap(
      (e) => e.applied_result?.hypothesis_events ?? [],
    ),
    ...decision.applied.hypothesis_events,
  ].at(-1);
  return {
    root_attempt_id: attempt.root_attempt_id,
    concept_ids: [...attempt.question.concept_ids],
    hypothesis_instance_id: latest?.hypothesis_instance_id ?? null,
    latest_hypothesis_status: latest?.status ?? null,
    outcome: decision.outcome,
    supporting_attempt_ids: episode
      .filter((a) => a.current_evaluation_id || a.id === evaluation.attempt_id)
      .map((a) => a.id),
    intervention_ids: evidence.interventions
      .filter((i) => i.delivery_status === "displayed")
      .map((i) => i.id),
    recorded_at: now,
    next_review_at:
      decision.outcome === "unevaluated"
        ? null
        : new Date(Date.parse(now) + 86_400_000).toISOString(),
    review_policy_version: TUTOR_POLICY_VERSION,
    review_reason:
      "Illustrative 24-hour review after this session. Immediate success after assistance does not establish lasting retention.",
  };
}
