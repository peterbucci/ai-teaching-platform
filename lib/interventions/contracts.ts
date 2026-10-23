import { z } from "zod";
import {
  AttemptSchema,
  ContentRefSchema,
  EvaluationSchema,
  QuestionSnapshotSchema,
} from "../evidence/contracts.ts";
import { ClassMetricsSchema, OriginFilterSchema } from "../teacher/metrics.ts";
const text = (max: number) => z.string().trim().min(1).max(max);
const unique = <T>(items: T[]) => new Set(items).size === items.length;
export const INTERVENTION_PROMPT_VERSION = "teacher-intervention-v3";
export const InterventionSelectionSchema = z.strictObject({
  assignment_id: z.uuid(),
  concept_id: text(100),
  misconception_id: text(100).nullable().default(null),
  attempt_ids: z
    .array(z.uuid())
    .max(60)
    .refine(unique, "Duplicate attempts")
    .default([]),
  origin: OriginFilterSchema.default("all"),
});
export type InterventionSelection = z.infer<typeof InterventionSelectionSchema>;
const EvidenceRoleSchema = z.enum(["supporting", "contradictory", "context"]);
const SourceReferenceSchema = z.strictObject({
  passage_id: text(100),
  quote: text(3000),
});
const ConceptScopeSchema = z.strictObject({
  id: text(100),
  title: text(300),
  objectives: z.array(text(2000)),
  boundaries: z.array(text(1000)),
  source_passage_ids: z.array(text(100)),
});
export const InterventionEvidenceSchema = z.strictObject({
  selection: InterventionSelectionSchema,
  content_ref: ContentRefSchema,
  concept: ConceptScopeSchema,
  // Older saved drafts remain inspectable without rewriting their provenance.
  related_concepts: z.array(ConceptScopeSchema).default([]),
  metrics: ClassMetricsSchema,
  observations: z
    .array(
      z.strictObject({
        evidence_id: text(20),
        student_id: z.uuid(),
        student_name: text(300),
        pseudonym: text(20),
        session_id: z.uuid(),
        data_origin: z.enum(["synthetic_fixture", "live_demo"]),
        attempt: AttemptSchema,
        evaluation: EvaluationSchema,
        role: EvidenceRoleSchema,
      }),
    )
    .min(1)
    .max(60),
  pattern: z
    .strictObject({
      misconception_id: text(100),
      counts: z.strictObject({
        suspected: z.number().int().nonnegative(),
        supported: z.number().int().nonnegative(),
        not_supported: z.number().int().nonnegative(),
        uncertain: z.number().int().nonnegative(),
      }),
      denominator: z.number().int().nonnegative(),
      observations: z.array(
        z.strictObject({
          student_id: z.uuid(),
          evaluation_id: z.uuid(),
          attempt_id: z.uuid(),
          status: z.enum([
            "suspected",
            "supported",
            "not_supported",
            "uncertain",
          ]),
          reason: z.string(),
          supporting_evaluation_ids: z.array(z.uuid()),
          contradicting_evaluation_ids: z.array(z.uuid()),
        }),
      ),
    })
    .nullable(),
  counts: z.strictObject({
    selected_students: z.number().int().positive(),
    selected_responses: z.number().int().positive(),
    enrolled_students: z.number().int().positive(),
  }),
  sources: z
    .array(
      z.strictObject({
        passage_id: text(100),
        text: z.string().min(1).max(12000),
        url: z.url().nullable(),
      }),
    )
    .min(1),
  scope_note: text(1500),
});
export type InterventionEvidence = z.infer<typeof InterventionEvidenceSchema>;
export const InterventionStrategySchema = z.enum([
  "compare_explanations",
  "predict_then_explain",
  "counterexample",
  "self_explanation",
]);
const ModelQuestionSchema = z.strictObject({
  prompt_text: text(700),
  concept_ids: z.array(text(100)).min(1).max(5),
  source_passage_ids: z.array(text(100)).min(1).max(4),
  answer_guidance: text(3000),
  criteria: z.array(text(1000)).min(1).max(4),
});
/** Provider-only aliases contain no database student, attempt, or evaluation IDs. */
export const ModelInterventionSchema = z.strictObject({
  content_ref: ContentRefSchema,
  title: text(120),
  learning_objective: text(2000),
  strategy: InterventionStrategySchema,
  exercise_text: text(900),
  source_references: z.array(SourceReferenceSchema).min(1).max(4),
  practice_questions: z.array(ModelQuestionSchema).min(1).max(3),
  fresh_check: ModelQuestionSchema,
  evidence_references: z
    .array(
      z.strictObject({
        evidence_id: text(20),
        response_quote: text(1600),
        role: EvidenceRoleSchema,
      }),
    )
    .min(1)
    .max(12),
  suggested_recipients: z
    .array(
      z.strictObject({
        pseudonym: text(20),
        evidence_ids: z.array(text(20)).min(1).max(8),
      }),
    )
    .max(12),
});
export type ModelIntervention = z.infer<typeof ModelInterventionSchema>;
export const InterventionActivitySchema = z.strictObject({
  title: text(120),
  learning_objective: text(2000),
  strategy: InterventionStrategySchema,
  rationale: text(6000),
  explanation: text(12000),
  exercise_text: text(900),
  practice_questions: z.array(QuestionSnapshotSchema).min(1).max(3),
  fresh_check: QuestionSnapshotSchema,
  source_references: z.array(SourceReferenceSchema).min(1).max(4),
  evidence_references: z
    .array(
      z.strictObject({
        attempt_id: z.uuid(),
        evaluation_id: z.uuid(),
        response_quote: text(1600),
        role: EvidenceRoleSchema,
      }),
    )
    .min(1)
    .max(12),
  suggested_recipients: z
    .array(
      z.strictObject({
        student_id: z.uuid(),
        evidence_attempt_ids: z.array(z.uuid()).min(1),
        reason: text(1000),
      }),
    )
    .max(12),
  uncertainty: text(1500),
});
export type InterventionActivity = z.infer<typeof InterventionActivitySchema>;
