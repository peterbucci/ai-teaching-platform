import {
  AssistanceSnapshotSchema,
  SessionEvidenceSchema,
  StudentSessionViewSchema,
} from "./contracts.ts";
import type {
  AssistanceSnapshot,
  Attempt,
  Evaluation,
  EvidenceQuote,
  Intent,
  Intervention,
  QuestionSnapshot,
  SessionEvidence,
  StudentSessionView,
} from "./contracts.ts";
import type { ApprovedContent } from "./content.ts";

const contentAssistance = new Set([
  "hint",
  "worked_example",
  "corrective_feedback",
]);

/** Count help that was actually visible, including content embedded in the prompt. */
export function deriveAssistance(
  question: QuestionSnapshot,
  intent: Intent,
  presented_at: string,
  submitted_at: string,
  interventions: readonly Intervention[],
): AssistanceSnapshot {
  const submissionTime = Date.parse(submitted_at);
  if (
    !Number.isFinite(submissionTime) ||
    !Number.isFinite(Date.parse(presented_at)) ||
    submissionTime < Date.parse(presented_at)
  ) {
    throw new Error("Invalid assistance timing");
  }
  const visible = interventions
    .filter(
      (item) =>
        item.delivery_status === "displayed" &&
        item.visible_at !== null &&
        Date.parse(item.visible_at) <= submissionTime &&
        (item.type === "fallback" ||
          item.concept_ids.some((concept) =>
            question.concept_ids.includes(concept),
          )),
    )
    .sort(
      (a, b) =>
        Date.parse(a.visible_at ?? "") - Date.parse(b.visible_at ?? "") ||
        a.id.localeCompare(b.id),
    );
  const types = new Set<string>();
  const scaffolding = new Set<
    "neutral_clarification" | "diagnostic_prompt_without_answer"
  >();
  const helpedConcepts = new Set<string>();
  const helpTimes: string[] = [];
  for (const embedded of question.embedded_scaffolding) {
    const relevant = embedded.concept_ids.filter((concept) =>
      question.concept_ids.includes(concept),
    );
    if (relevant.length) {
      types.add("prompt_supplied_content");
      relevant.forEach((concept) => helpedConcepts.add(concept));
      helpTimes.push(presented_at);
    }
  }
  for (const item of visible) {
    if (contentAssistance.has(item.type)) {
      types.add(item.type);
      item.concept_ids.forEach((concept) => helpedConcepts.add(concept));
      if (item.visible_at) helpTimes.push(item.visible_at);
    } else if (
      item.type === "neutral_clarification" ||
      item.type === "diagnostic_prompt_without_answer"
    ) {
      scaffolding.add(item.type);
    }
  }
  if (intent === "neutral_clarification")
    scaffolding.add("neutral_clarification");
  if (intent === "diagnostic_followup")
    scaffolding.add("diagnostic_prompt_without_answer");
  const latest =
    helpTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return AssistanceSnapshotSchema.parse({
    intervention_ids: visible.map((item) => item.id),
    assistance_level:
      types.size > 1 ? "multiple_types" : ([...types][0] ?? "none_recorded"),
    scaffolding_types: [...scaffolding],
    independent_retrieval_eligible_by_concept: Object.fromEntries(
      question.concept_ids.map((concept) => [
        concept,
        (intent === "initial_retrieval" || intent === "delayed_review") &&
          !helpedConcepts.has(concept),
      ]),
    ),
    most_recent_content_assistance_at: latest,
    elapsed_since_content_assistance_seconds:
      latest === null ? null : (submissionTime - Date.parse(latest)) / 1000,
  });
}

function requireReference(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function sameMembers(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
  );
}

function sameAssistance(
  left: AssistanceSnapshot,
  right: AssistanceSnapshot,
): boolean {
  return (
    left.assistance_level === right.assistance_level &&
    (left.most_recent_content_assistance_at ===
      right.most_recent_content_assistance_at ||
      (left.most_recent_content_assistance_at !== null &&
        right.most_recent_content_assistance_at !== null &&
        Date.parse(left.most_recent_content_assistance_at) ===
          Date.parse(right.most_recent_content_assistance_at))) &&
    left.elapsed_since_content_assistance_seconds ===
      right.elapsed_since_content_assistance_seconds &&
    sameMembers(left.intervention_ids, right.intervention_ids) &&
    sameMembers(left.scaffolding_types, right.scaffolding_types) &&
    sameMembers(
      Object.keys(left.independent_retrieval_eligible_by_concept),
      Object.keys(right.independent_retrieval_eligible_by_concept),
    ) &&
    Object.entries(left.independent_retrieval_eligible_by_concept).every(
      ([concept, eligible]) =>
        right.independent_retrieval_eligible_by_concept[concept] === eligible,
    )
  );
}

/** Offsets are zero-based Unicode code points, end-exclusive, not UTF-16 indices. */
export function validateQuote(
  quote: EvidenceQuote,
  attempts: readonly Attempt[],
): void {
  const response = attempts.find((attempt) => attempt.id === quote.response_id);
  requireReference(
    response !== undefined && response.response_text !== null,
    "Quote references a missing response",
  );
  const characters = Array.from(response.response_text);
  requireReference(
    quote.end_character <= characters.length &&
      characters.slice(quote.start_character, quote.end_character).join("") ===
        quote.quote,
    "Quote does not match the original response",
  );
}

/** Structural/reference validation, not a claim that an evaluator's judgment is correct. */
export function validateEvaluationReferences(
  content: ApprovedContent,
  evaluation: Evaluation,
  attempt: Attempt,
  attempts: readonly Attempt[],
  evaluations: readonly Evaluation[] = [],
): void {
  requireReference(
    evaluation.attempt_id === attempt.id,
    "Evaluation belongs to a different attempt",
  );
  requireReference(
    attempt.submitted_at !== null && attempt.response_text !== null,
    "Cannot evaluate an unsubmitted attempt",
  );
  requireReference(
    Date.parse(evaluation.evaluated_at) >= Date.parse(attempt.submitted_at),
    "Evaluation predates submission",
  );
  if (evaluation.supersedes_id) {
    requireReference(
      evaluations.some(
        (previous) =>
          previous.id === evaluation.supersedes_id &&
          previous.attempt_id === attempt.id &&
          previous.id !== evaluation.id,
      ),
      "Superseded evaluation must belong to the same attempt",
    );
  }
  const result = evaluation.result;
  if (result) {
    const judged = result.per_concept_results.map((item) => item.concept_id);
    requireReference(
      judged.length === attempt.question.concept_ids.length &&
        new Set(judged).size === judged.length &&
        judged.every((concept) =>
          attempt.question.concept_ids.includes(concept),
        ),
      "Evaluation must judge each assessed concept exactly once",
    );
    requireReference(
      result.source_passage_ids.every(
        (passage) =>
          content.passage_ids.has(passage) &&
          attempt.question.source_passage_ids.includes(passage),
      ),
      "Evaluation cites an unavailable passage",
    );
    for (const quote of result.evidence_quotes) {
      requireReference(
        quote.response_id === attempt.id,
        "Evaluation quote belongs to a different response",
      );
      validateQuote(quote, [attempt]);
    }
    const candidateKeys = new Set<string>();
    for (const candidate of result.misconception_candidates ?? []) {
      requireReference(
        attempt.question.concept_ids.includes(candidate.concept_id),
        "Misconception candidate references an unassessed concept",
      );
      const categoryConcept = content.misconception_concepts.get(
        candidate.misconception_id,
      );
      requireReference(
        categoryConcept !== undefined &&
          (categoryConcept === null ||
            categoryConcept === candidate.concept_id),
        "Unknown or mismatched misconception candidate category",
      );
      const key = JSON.stringify([
        candidate.concept_id,
        candidate.misconception_id,
      ]);
      requireReference(
        !candidateKeys.has(key),
        "Duplicate misconception candidate",
      );
      candidateKeys.add(key);
      for (const quote of candidate.evidence_quotes) {
        requireReference(
          quote.response_id === attempt.id,
          "Misconception candidate quote belongs to a different response",
        );
        validateQuote(quote, [attempt]);
      }
    }
    if (
      result.per_concept_results.some(
        (item) => item.correctness === "uncertain",
      )
    ) {
      requireReference(
        result.uncertainty_reason !== null,
        "Uncertain judgments require a reason",
      );
    }
  }
  const availableEvaluations = [
    ...evaluations.filter((item) => item.id !== evaluation.id),
    evaluation,
  ];
  const episodeAttempts = attempts.filter(
    (item) =>
      item.session_id === attempt.session_id &&
      item.root_attempt_id === attempt.root_attempt_id,
  );
  for (const event of evaluation.applied_result?.hypothesis_events ?? []) {
    requireReference(
      attempt.question.concept_ids.includes(event.concept_id),
      "Hypothesis references an unassessed concept",
    );
    const categoryConcept = content.misconception_concepts.get(
      event.misconception_id,
    );
    requireReference(
      categoryConcept !== undefined &&
        (categoryConcept === null || categoryConcept === event.concept_id),
      "Unknown or mismatched misconception category",
    );
    requireReference(
      event.misconception_id !== "other_or_uncertain" ||
        event.status === "uncertain",
      "Unknown categories cannot establish a specific misconception",
    );
    const referenced = [
      ...event.evidence_evaluation_ids,
      ...event.contradicting_evaluation_ids,
    ];
    for (const evaluationId of referenced) {
      requireReference(
        availableEvaluations.some(
          (item) =>
            item.id === evaluationId &&
            item.validation_status === "accepted" &&
            episodeAttempts.some((response) => response.id === item.attempt_id),
        ),
        "Hypothesis evidence must reference accepted evaluations in the same episode",
      );
    }
    for (const quote of event.supporting_response_quotes) {
      validateQuote(quote, episodeAttempts);
      requireReference(
        availableEvaluations.some(
          (item) =>
            event.evidence_evaluation_ids.includes(item.id) &&
            item.attempt_id === quote.response_id,
        ),
        "Hypothesis quote must link to its supporting evaluation",
      );
    }
    if (event.status === "suspected" || event.status === "supported") {
      requireReference(
        event.supporting_response_quotes.length > 0 &&
          event.evidence_evaluation_ids.length > 0,
        "A hypothesis needs explicit response evidence",
      );
    }
    if (event.status === "supported") {
      const distinctResponses = new Set(
        availableEvaluations
          .filter((item) => event.evidence_evaluation_ids.includes(item.id))
          .map((item) => item.attempt_id),
      );
      requireReference(
        distinctResponses.size >= 2,
        "One response cannot establish a supported hypothesis",
      );
    }
  }
}

/** Validate a complete session read before using its links or returning projections. */
export function validateSessionEvidence(
  content: ApprovedContent,
  input: unknown,
): SessionEvidence {
  const evidence = SessionEvidenceSchema.parse(input);
  const { session, attempts, evaluations, interventions } = evidence;
  for (const collection of [attempts, evaluations, interventions]) {
    requireReference(
      new Set(collection.map((record) => record.id)).size === collection.length,
      "Duplicate evidence record ID",
    );
  }
  requireReference(
    new Set(attempts.map((attempt) => attempt.sequence_index)).size ===
      attempts.length,
    "Duplicate sequence index",
  );
  for (const attempt of attempts) {
    requireReference(
      attempt.session_id === session.id,
      "Attempt belongs to another session",
    );
    requireReference(
      JSON.stringify(attempt.question.content_ref) ===
        JSON.stringify(content.content_ref),
      "Attempt has an unknown content version",
    );
    requireReference(
      attempt.question.concept_ids.every((concept) =>
        content.concept_ids.has(concept),
      ) &&
        attempt.question.source_passage_ids.every((passage) =>
          content.passage_ids.has(passage),
        ),
      "Attempt has unknown content references",
    );
    const root = attempts.find((item) => item.id === attempt.root_attempt_id);
    requireReference(
      root !== undefined &&
        root.id === root.root_attempt_id &&
        root.parent_attempt_id === null,
      "Attempt has an invalid episode root",
    );
    if (attempt.parent_attempt_id) {
      requireReference(
        attempts.some(
          (parent) =>
            parent.id === attempt.parent_attempt_id &&
            parent.root_attempt_id === attempt.root_attempt_id &&
            parent.sequence_index < attempt.sequence_index,
        ),
        "Attempt parent must precede it in the same episode",
      );
    }
    if (attempt.current_evaluation_id) {
      requireReference(
        evaluations.some(
          (item) =>
            item.id === attempt.current_evaluation_id &&
            item.attempt_id === attempt.id &&
            item.validation_status === "accepted",
        ),
        "Current evaluation must be accepted and belong to the attempt",
      );
    }
    if (attempt.assistance && attempt.submitted_at) {
      const expected = deriveAssistance(
        attempt.question,
        attempt.intent,
        attempt.presented_at,
        attempt.submitted_at,
        interventions,
      );
      requireReference(
        sameAssistance(attempt.assistance, expected),
        "Assistance snapshot disagrees with displayed help",
      );
    }
    if (attempt.outcome) {
      const outcome = attempt.outcome;
      requireReference(
        outcome.concept_ids.every((concept) =>
          content.concept_ids.has(concept),
        ),
        "Outcome references an unknown concept",
      );
      requireReference(
        outcome.supporting_attempt_ids.every((reference) =>
          attempts.some(
            (item) =>
              item.id === reference && item.root_attempt_id === attempt.id,
          ),
        ),
        "Outcome references another episode",
      );
      requireReference(
        outcome.intervention_ids.every((reference) =>
          interventions.some(
            (item) =>
              item.id === reference &&
              attempts.some(
                (related) =>
                  related.id === item.related_attempt_id &&
                  related.root_attempt_id === attempt.id,
              ),
          ),
        ),
        "Outcome references an unrelated intervention",
      );
    }
  }
  for (const intervention of interventions) {
    requireReference(
      intervention.session_id === session.id &&
        attempts.some(
          (attempt) => attempt.id === intervention.related_attempt_id,
        ),
      "Intervention belongs to another session",
    );
    requireReference(
      JSON.stringify(intervention.content_ref) ===
        JSON.stringify(content.content_ref),
      "Intervention has an unknown content version",
    );
    requireReference(
      intervention.concept_ids.every((concept) =>
        content.concept_ids.has(concept),
      ) &&
        intervention.source_passage_ids.every((passage) =>
          content.passage_ids.has(passage),
        ),
      "Intervention has unknown content references",
    );
    if (intervention.related_evaluation_id) {
      requireReference(
        evaluations.some(
          (item) =>
            item.id === intervention.related_evaluation_id &&
            item.attempt_id === intervention.related_attempt_id,
        ),
        "Intervention evaluation does not match its attempt",
      );
    }
  }
  for (const evaluation of evaluations) {
    const attempt = attempts.find((item) => item.id === evaluation.attempt_id);
    requireReference(
      attempt !== undefined,
      "Evaluation references another session",
    );
    validateEvaluationReferences(
      content,
      evaluation,
      attempt,
      attempts,
      evaluations,
    );
  }
  return evidence;
}

/** Explicit allowlist: student reads never include answer keys or internal judgments. */
export function toStudentSessionView(
  evidence: SessionEvidence,
): StudentSessionView {
  return StudentSessionViewSchema.parse({
    session: { id: evidence.session.id, status: evidence.session.status },
    attempts: evidence.attempts.map((attempt) => ({
      id: attempt.id,
      sequence_index: attempt.sequence_index,
      intent: attempt.intent,
      prompt_text: attempt.question.prompt_text,
      concept_ids: attempt.question.concept_ids,
      presented_at: attempt.presented_at,
      submitted_at: attempt.submitted_at,
      response_text: attempt.response_text,
    })),
    interventions: evidence.interventions
      .filter((item) => item.delivery_status !== "failed")
      .map((item) => ({
        id: item.id,
        type: item.type,
        text_shown: item.text_shown,
        delivery_status: item.delivery_status,
        visible_at: item.visible_at,
      })),
  });
}
