import { z } from "zod";
import type { LessonDraftContent } from "../../../../../lib/lessons/contracts.ts";
import {
  ActionSchema,
  QuestionSnapshotSchema,
} from "../../../../../lib/evidence/contracts.ts";
import {
  QuestionBankDeliverySchema,
  QuestionBankItemSchema,
  QuestionBankMetadataSchema,
  QuestionBankPreferencesSchema,
  QuestionCalculationSchema,
  type QuestionBankItem,
} from "../../../../../lib/question-bank/contracts.ts";

/** Hidden arithmetic specifications must not survive a non-calculation format. */
export function questionFormatChange(
  item: Pick<QuestionBankItem, "calculation">,
  format: QuestionBankItem["format"],
): Pick<QuestionBankItem, "format" | "calculation"> {
  return {
    format,
    calculation: format === "calculation" ? item.calculation : null,
  };
}

/** Preserve the existing reviewed action policy when changing help permission. */
export function withHintPermission(
  policy: NonNullable<LessonDraftContent["activity_policy"]>,
  enabled: boolean,
): NonNullable<LessonDraftContent["activity_policy"]> {
  const allowed_actions = enabled
    ? policy.allowed_actions.includes("GIVE_HINT")
      ? policy.allowed_actions
      : [...policy.allowed_actions, "GIVE_HINT" as const]
    : policy.allowed_actions.filter((action) => action !== "GIVE_HINT");
  return { ...policy, allowed_actions };
}

// Recovery preserves unfinished editable text, including temporarily empty
// delivery and calculation fields. Canonical schemas still validate every save.
const RecoverySchema = z.object({
  lesson_id: z.string(),
  revision: z.number().int(),
  bank: z.object({
    questions: z.array(
      QuestionSnapshotSchema.safeExtend({
        prompt_text: z.string(),
        concept_ids: z.array(z.string()),
        source_passage_ids: z.array(z.string()),
        rubric: z.object({
          ...QuestionSnapshotSchema.shape.rubric.shape,
          answer_guidance: z.string(),
          criteria: z.array(z.string()),
          acceptable_variations: z.array(z.string()),
          partial_credit_guidance: z.string().nullable(),
        }),
      }),
    ),
    question_guidance: z.array(
      z.object({
        question_id: z.string(),
        assumptions: z.array(z.string()),
        misconception_ids: z.array(z.string()),
      }),
    ),
    question_bank: QuestionBankMetadataSchema.safeExtend({
      preferences: QuestionBankPreferencesSchema.safeExtend({
        priorities: z.array(
          z.enum(["explanation", "application", "comparison", "calculation"]),
        ),
        reasoning_errors: z.array(z.string()),
        student_instructions: z.string(),
      }),
      delivery: QuestionBankDeliverySchema.safeExtend({
        closing_feedback:
          QuestionBankDeliverySchema.shape.closing_feedback.safeExtend({
            correct_after_feedback: z.string(),
            uncertain_after_feedback: z.string(),
            partial_after_feedback_arithmetic_or_units: z.string(),
            partial_or_incorrect_after_feedback: z.string(),
          }),
        fallback_message: z.string(),
      }),
      items: z.array(
        QuestionBankItemSchema.safeExtend({
          family_id: z.string(),
          feedback_guidance: z.string(),
          reasoning_error: z.string().nullable(),
          source_support: z.array(
            z.object({
              passage_id: z.string(),
              quote: z.string(),
              criterion: z.string(),
            }),
          ),
          calculation: QuestionCalculationSchema.safeExtend({
            unit: z.string(),
            operands: z.array(z.number().finite()),
          }).nullable(),
          review_notes: z.string(),
        }),
      ),
    }),
    activity_policy: z.object({
      allowed_actions: z.array(ActionSchema),
      allow_runtime_generation: z.boolean(),
    }),
  }),
});

export function parseRecovery(value: string | null) {
  if (!value) return null;
  try {
    const parsed = RecoverySchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
