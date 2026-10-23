import { z } from "zod";
import {
  ActionSchema,
  ContentRefSchema,
  QuestionSnapshotSchema,
  type QuestionSnapshot,
} from "../evidence/contracts.ts";

const identifier = z.string().trim().min(1).max(160);
const note = z.string().max(6000);
const requiredNote = note.refine(
  (value) => value.trim().length > 0,
  "Required text",
);
const identifiers = z
  .array(identifier)
  .max(40)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate identifiers",
  );

export const QuestionFormatSchema = z.enum([
  "short_answer",
  "multiple_choice",
  "calculation",
]);
export const QuestionDifficultySchema = z.enum([
  "foundational",
  "intermediate",
  "advanced",
]);
export const QuestionBankPreferencesSchema = z.strictObject({
  format: QuestionFormatSchema,
  difficulty: QuestionDifficultySchema,
  emphasized_concept_ids: identifiers,
  priorities: z
    .array(z.enum(["explanation", "application", "comparison", "calculation"]))
    .min(1)
    .max(4)
    .refine(
      (values) => new Set(values).size === values.length,
      "Duplicate priorities",
    ),
  misconception_ids: identifiers,
  reasoning_errors: z.array(requiredNote).max(20),
  student_instructions: note,
});
export type QuestionBankPreferences = z.infer<
  typeof QuestionBankPreferencesSchema
>;

export const DEFAULT_QUESTION_BANK_PREFERENCES: QuestionBankPreferences = {
  format: "short_answer",
  difficulty: "intermediate",
  emphasized_concept_ids: [],
  priorities: ["explanation"],
  misconception_ids: [],
  reasoning_errors: [],
  student_instructions: "",
};

export const QuestionCalculationSchema = z.strictObject({
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  operands: z.array(z.number().finite()).min(2).max(8),
  expected: z.number().finite(),
  unit: z.string().trim().min(1).max(80),
});
export type QuestionCalculation = z.infer<typeof QuestionCalculationSchema>;

/** Authoring metadata only. Wording, rubrics and source identity stay in snapshots. */
export const QuestionBankItemSchema = z.strictObject({
  question_id: identifier,
  family_id: identifier,
  role: z.enum(["initial", "alternative", "diagnostic", "retest"]),
  format: QuestionFormatSchema,
  difficulty: QuestionDifficultySchema,
  feedback_guidance: note,
  // An unconfirmed reasoning error is a hypothesis, never a new approved ID.
  reasoning_error: requiredNote.nullable(),
  source_support: z
    .array(
      z.strictObject({
        passage_id: identifier,
        quote: requiredNote,
        criterion: requiredNote,
      }),
    )
    .min(1)
    .max(40),
  calculation: QuestionCalculationSchema.nullable(),
  review_status: z.enum(["needs_review", "reviewed"]),
  review_notes: note,
  quality_issues: z.array(requiredNote).max(20),
});
export type QuestionBankItem = z.infer<typeof QuestionBankItemSchema>;

export const DEFAULT_QUESTION_BANK_DELIVERY = {
  closing_feedback: {
    correct_after_feedback:
      "Your answer after feedback has been saved. A later independent check can provide different evidence of your understanding.",
    uncertain_after_feedback:
      "Some reasoning remains unclear. Review the assigned passages with your teacher; your original responses have been saved.",
    partial_after_feedback_arithmetic_or_units:
      "Your reasoning and remaining calculation or unit difficulty have been saved. Review the assigned passages with your teacher.",
    partial_or_incorrect_after_feedback:
      "There are still parts to review. Your teacher can inspect your original responses and the assistance you received.",
  },
  fallback_message:
    "Please answer the current question using the assigned reading. Your saved work is preserved if you need to return later.",
};
export const QuestionBankDeliverySchema = z.strictObject({
  closing_feedback: z.strictObject({
    correct_after_feedback: requiredNote,
    uncertain_after_feedback: requiredNote,
    partial_after_feedback_arithmetic_or_units: requiredNote,
    partial_or_incorrect_after_feedback: requiredNote,
  }),
  fallback_message: requiredNote,
});

export const QuestionBankMetadataSchema = z.strictObject({
  preferences: QuestionBankPreferencesSchema,
  items: z.array(QuestionBankItemSchema).max(80),
  delivery: QuestionBankDeliverySchema.default(DEFAULT_QUESTION_BANK_DELIVERY),
  approval: z
    .strictObject({
      reviewed_by: z.uuid(),
      reviewed_at: z.iso.datetime({ offset: true }),
      content_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .nullable(),
});
export type QuestionBankMetadata = z.infer<typeof QuestionBankMetadataSchema>;

/** Browser display projection only; writes use the full canonical server schemas. */
export const QuestionBankViewSchema = z.object({
  lesson_id: identifier,
  title: requiredNote,
  revision: z.number().int().nonnegative(),
  draft: z.object({
    content_ref: ContentRefSchema.optional(),
    concepts: z
      .array(
        z.object({
          id: identifier,
          title: requiredNote,
          objectives: z.array(requiredNote),
          source_passage_ids: z.array(identifier),
          review_status: z.literal("approved"),
        }),
      )
      .optional(),
    passages: z
      .array(
        z.object({
          id: identifier,
          text: z.string().min(1),
          page_number: z.number().int().positive().optional(),
          section: requiredNote.optional(),
        }),
      )
      .optional(),
    misconceptions: z
      .array(
        z.object({
          id: identifier,
          concept_id: identifier.nullable(),
          definition: requiredNote,
        }),
      )
      .optional(),
    questions: z.array(QuestionSnapshotSchema).max(80).optional(),
    question_guidance: z
      .array(
        z.object({
          question_id: identifier,
          assumptions: z.array(requiredNote),
          misconception_ids: z.array(identifier),
        }),
      )
      .optional(),
    question_bank: QuestionBankMetadataSchema.optional(),
    activity_policy: z
      .object({
        allowed_actions: z.array(ActionSchema).min(1),
        allow_runtime_generation: z.boolean(),
      })
      .optional(),
  }),
  issues: z.array(
    z.object({ question_id: z.string().nullable(), message: z.string() }),
  ),
  operations: z
    .array(
      z.object({
        request_id: z.uuid(),
        status: z.enum(["pending", "completed", "failed", "stale", "unknown"]),
        message: z.string().nullable(),
        result: z.unknown().nullable(),
        applied_revision: z.number().int().nullable(),
        created_at: z.string(),
      }),
    )
    .default([]),
});

export type QuestionBankIssue = {
  question_id: string | null;
  message: string;
};

/** Explicit student projection. Never spread a snapshot or private bank metadata. */
export function projectStudentQuestion(question: QuestionSnapshot) {
  return {
    question_id: question.question_id,
    prompt_text: question.prompt_text,
    concept_ids: [...question.concept_ids],
    source_passage_ids: [...question.source_passage_ids],
  };
}
