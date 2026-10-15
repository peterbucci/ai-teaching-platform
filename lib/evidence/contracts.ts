import { z } from "zod";

const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Required text");
const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const ids = z
  .array(id)
  .refine((values) => new Set(values).size === values.length, "Duplicate IDs");
const names = z
  .array(text)
  .refine((values) => new Set(values).size === values.length, "Duplicate IDs");
const requiredNames = names.refine(
  (values) => values.length > 0,
  "At least one ID is required",
);

export const ContentRefSchema = z.strictObject({
  package_id: text,
  content_version: text,
  source_id: text,
  source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  excerpt_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ContentRef = z.infer<typeof ContentRefSchema>;

export const EmbeddedScaffoldingSchema = z.strictObject({
  type: z.enum([
    "supplied_formula",
    "supplied_relationship",
    "answer_hint",
    "unit_conversion_support",
  ]),
  concept_ids: requiredNames,
  supplied_content: text,
  affected_rubric_criteria: z.array(text),
});

export const QuestionSnapshotSchema = z
  .strictObject({
    origin: z.enum(["curated", "generated"]),
    question_id: text.nullable(),
    sequence_id: text.nullable(),
    prompt_text: text,
    content_ref: ContentRefSchema,
    concept_ids: requiredNames,
    source_passage_ids: requiredNames,
    rubric: z.strictObject({
      version: text,
      answer_guidance: text,
      criteria: z.array(text),
      acceptable_variations: z.array(text),
      partial_credit_guidance: text.nullable(),
    }),
    embedded_scaffolding: z.array(EmbeddedScaffoldingSchema),
    generation: z
      .strictObject({
        model: text,
        prompt_template_version: text,
        generated_at: timestamp,
      })
      .nullable(),
  })
  .superRefine((question, context) => {
    if (
      question.origin === "curated" &&
      (!question.question_id || question.generation)
    ) {
      context.addIssue({
        code: "custom",
        message: "Curated questions require an ID and no generation metadata",
      });
    }
    if (question.origin === "generated" && !question.generation) {
      context.addIssue({
        code: "custom",
        message: "Generated questions require generation metadata",
      });
    }
  });
export type QuestionSnapshot = z.infer<typeof QuestionSnapshotSchema>;

export const IntentSchema = z.enum([
  "initial_retrieval",
  "neutral_clarification",
  "diagnostic_followup",
  "immediate_retest",
  "delayed_review",
]);
export type Intent = z.infer<typeof IntentSchema>;
export const ActionSchema = z.enum([
  "ASK_RETRIEVAL_QUESTION",
  "ASK_SELF_EXPLANATION",
  "ASK_DIAGNOSTIC_FOLLOWUP",
  "GIVE_HINT",
  "GIVE_CORRECTIVE_FEEDBACK",
  "RETEST_CONCEPT",
  "MOVE_TO_NEXT_CONCEPT",
  "SCHEDULE_REVIEW",
  "END_SESSION",
]);
export const HypothesisStatusSchema = z.enum([
  "suspected",
  "supported",
  "not_supported",
  "uncertain",
]);
export const CorrectnessSchema = z.enum([
  "correct",
  "partially_correct",
  "incorrect",
  "uncertain",
]);
export const ErrorTypeSchema = z.enum([
  "conceptual",
  "arithmetic_or_units",
  "terminology_or_ambiguity",
  "insufficient_response",
  "other_or_uncertain",
]);

export const AssistanceSnapshotSchema = z.strictObject({
  intervention_ids: ids,
  assistance_level: z.enum([
    "none_recorded",
    "prompt_supplied_content",
    "hint",
    "worked_example",
    "corrective_feedback",
    "multiple_types",
  ]),
  scaffolding_types: z.array(
    z.enum(["neutral_clarification", "diagnostic_prompt_without_answer"]),
  ),
  independent_retrieval_eligible_by_concept: z.record(text, z.boolean()),
  most_recent_content_assistance_at: timestamp.nullable(),
  elapsed_since_content_assistance_seconds: z.number().nonnegative().nullable(),
});
export type AssistanceSnapshot = z.infer<typeof AssistanceSnapshotSchema>;

export const EpisodeOutcomeSchema = z
  .strictObject({
    root_attempt_id: id,
    concept_ids: requiredNames,
    hypothesis_instance_id: id.nullable(),
    latest_hypothesis_status: HypothesisStatusSchema.nullable(),
    outcome: z.enum([
      "correct_initial_without_content_assistance",
      "correct_after_neutral_clarification_without_content_assistance",
      "correct_diagnostic_without_content_assistance",
      "correct_after_feedback",
      "distance_error_observed_after_feedback",
      "partial_after_feedback_arithmetic_or_units",
      "partial_or_incorrect_after_feedback",
      "uncertain_after_feedback",
      "pending_evaluation",
      "unevaluated",
    ]),
    supporting_attempt_ids: ids,
    intervention_ids: ids,
    recorded_at: timestamp,
    next_review_at: timestamp.nullable(),
    review_policy_version: text,
    review_reason: text,
  })
  .refine(
    (outcome) =>
      (outcome.hypothesis_instance_id === null) ===
      (outcome.latest_hypothesis_status === null),
    {
      message:
        "A hypothesis ID and status must either both be present or both be absent",
    },
  );
export type EpisodeOutcome = z.infer<typeof EpisodeOutcomeSchema>;

export const SessionSchema = z.strictObject({
  id,
  student_id: id,
  assignment_id: id,
  class_id: id,
  status: z.enum(["active", "completed", "pending_evaluation", "unevaluated"]),
  data_origin: z.enum(["synthetic_fixture", "live_demo"]),
  started_at: timestamp,
  ended_at: timestamp.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const AttemptSchema = z
  .strictObject({
    id,
    session_id: id,
    sequence_index: z.number().int().nonnegative(),
    parent_attempt_id: id.nullable(),
    root_attempt_id: id,
    review_of_attempt_id: id.nullable(),
    question: QuestionSnapshotSchema,
    intent: IntentSchema,
    presented_at: timestamp,
    submitted_at: timestamp.nullable(),
    response_text: z.string().nullable(),
    submission_key: id.nullable(),
    assistance: AssistanceSnapshotSchema.nullable(),
    current_evaluation_id: id.nullable(),
    outcome: EpisodeOutcomeSchema.nullable(),
  })
  .superRefine((attempt, context) => {
    const submitted = attempt.submitted_at !== null;
    if (
      [attempt.response_text, attempt.submission_key, attempt.assistance].some(
        (value) => (value !== null) !== submitted,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Submission fields must be recorded together",
      });
    }
    if (
      attempt.submitted_at &&
      Date.parse(attempt.submitted_at) < Date.parse(attempt.presented_at)
    ) {
      context.addIssue({
        code: "custom",
        message: "Submission cannot precede presentation",
      });
    }
    if (
      (attempt.parent_attempt_id === null) !==
      (attempt.root_attempt_id === attempt.id)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only the root attempt has no parent",
      });
    }
    if (
      attempt.outcome &&
      (attempt.root_attempt_id !== attempt.id ||
        attempt.outcome.root_attempt_id !== attempt.id)
    ) {
      context.addIssue({
        code: "custom",
        message: "An episode outcome belongs to its root attempt",
      });
    }
    if (
      attempt.intent === "delayed_review" &&
      attempt.review_of_attempt_id === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Delayed review must link to prior practice",
      });
    }
  });
export type Attempt = z.infer<typeof AttemptSchema>;

export const EvidenceQuoteSchema = z
  .strictObject({
    response_id: id,
    quote: text,
    start_character: z.number().int().nonnegative(),
    end_character: z.number().int().positive(),
    interpretation: text,
  })
  .refine(
    (quote) => quote.end_character > quote.start_character,
    "Quote range must be nonempty",
  );
export type EvidenceQuote = z.infer<typeof EvidenceQuoteSchema>;

export const EvaluationResultSchema = z.strictObject({
  per_concept_results: z
    .array(
      z.strictObject({
        concept_id: text,
        correctness: CorrectnessSchema,
        error_type: ErrorTypeSchema.nullable(),
        rubric_criteria_met: z.array(text),
        rubric_criteria_missing: z.array(text),
      }),
    )
    .min(1),
  source_passage_ids: requiredNames,
  evidence_quotes: z.array(EvidenceQuoteSchema),
  reasoning_observed: z.string(),
  uncertainty_reason: text.nullable(),
  proposed_next_action: ActionSchema,
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const AppliedResultSchema = z.strictObject({
  action: ActionSchema,
  hypothesis_events: z.array(
    z.strictObject({
      id,
      hypothesis_instance_id: id,
      concept_id: text,
      misconception_id: text,
      previous_status: HypothesisStatusSchema.nullable(),
      status: HypothesisStatusSchema,
      evidence_evaluation_ids: ids,
      contradicting_evaluation_ids: ids,
      supporting_response_quotes: z.array(EvidenceQuoteSchema),
      reason: text,
      created_at: timestamp,
    }),
  ),
});
export type AppliedResult = z.infer<typeof AppliedResultSchema>;

export const EvaluationSchema = z
  .strictObject({
    id,
    attempt_id: id,
    validation_status: z.enum([
      "accepted",
      "pending_review",
      "rejected",
      "evaluation_failed",
    ]),
    evaluator: z.strictObject({
      type: z.enum(["language_model", "human_review", "synthetic_fixture"]),
      model: text.nullable(),
      version: text,
    }),
    evaluated_at: timestamp,
    supersedes_id: id.nullable(),
    result: EvaluationResultSchema.nullable(),
    applied_result: AppliedResultSchema.nullable(),
    failure_reason: text.nullable(),
  })
  .superRefine((evaluation, context) => {
    if (evaluation.validation_status === "accepted" && !evaluation.result) {
      context.addIssue({
        code: "custom",
        message: "Accepted evaluations require a result",
      });
    }
    if (
      evaluation.validation_status !== "accepted" &&
      evaluation.applied_result
    ) {
      context.addIssue({
        code: "custom",
        message: "Unaccepted evaluations cannot apply actions or hypotheses",
      });
    }
    if (
      evaluation.evaluator.type === "language_model" &&
      !evaluation.evaluator.model
    ) {
      context.addIssue({
        code: "custom",
        message: "Model evaluations require the actual model identifier",
      });
    }
  });
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const InterventionSchema = z
  .strictObject({
    id,
    session_id: id,
    related_attempt_id: id,
    related_evaluation_id: id.nullable(),
    type: z.enum([
      "hint",
      "corrective_feedback",
      "worked_example",
      "neutral_clarification",
      "diagnostic_prompt_without_answer",
      "fallback",
    ]),
    text_shown: text,
    concept_ids: names,
    source_passage_ids: names,
    content_ref: ContentRefSchema,
    created_at: timestamp,
    visible_at: timestamp.nullable(),
    delivery_status: z.enum(["created", "displayed", "failed"]),
  })
  .superRefine((intervention, context) => {
    if (
      (intervention.delivery_status === "displayed") !==
      (intervention.visible_at !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only displayed interventions have a visibility timestamp",
      });
    }
    if (
      intervention.visible_at &&
      Date.parse(intervention.visible_at) < Date.parse(intervention.created_at)
    ) {
      context.addIssue({
        code: "custom",
        message: "An intervention cannot be visible before creation",
      });
    }
    if (
      intervention.type !== "fallback" &&
      (!intervention.concept_ids.length ||
        !intervention.source_passage_ids.length)
    ) {
      context.addIssue({
        code: "custom",
        message: "Learning interventions require concepts and passages",
      });
    }
  });
export type Intervention = z.infer<typeof InterventionSchema>;

export const SessionEvidenceSchema = z.strictObject({
  session: SessionSchema,
  attempts: z.array(AttemptSchema),
  evaluations: z.array(EvaluationSchema),
  interventions: z.array(InterventionSchema),
});
export type SessionEvidence = z.infer<typeof SessionEvidenceSchema>;

// These are the only answer fields accepted from a student. Ownership, grading,
// assistance and timestamps are established by the server.
export const SubmitAnswerSchema = z.strictObject({
  attempt_id: id,
  submission_key: id,
  response_text: z.string(),
});
export type SubmitAnswer = z.infer<typeof SubmitAnswerSchema>;

export const StudentSessionViewSchema = z.strictObject({
  session: z.strictObject({ id, status: SessionSchema.shape.status }),
  attempts: z.array(
    z.strictObject({
      id,
      sequence_index: z.number().int().nonnegative(),
      intent: IntentSchema,
      prompt_text: text,
      concept_ids: requiredNames,
      presented_at: timestamp,
      submitted_at: timestamp.nullable(),
      response_text: z.string().nullable(),
    }),
  ),
  interventions: z.array(
    z.strictObject({
      id,
      type: z.enum([
        "hint",
        "corrective_feedback",
        "worked_example",
        "neutral_clarification",
        "diagnostic_prompt_without_answer",
        "fallback",
      ]),
      text_shown: text,
      delivery_status: z.enum(["created", "displayed"]),
      visible_at: timestamp.nullable(),
    }),
  ),
});
export type StudentSessionView = z.infer<typeof StudentSessionViewSchema>;
