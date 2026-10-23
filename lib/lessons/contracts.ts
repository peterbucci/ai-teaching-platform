import { z } from "zod";
import {
  ActionSchema,
  ContentRefSchema,
  QuestionSnapshotSchema,
} from "../evidence/contracts.ts";
import {
  ConceptsSchema,
  BankSchema,
  SequenceSchema,
} from "../evidence/content.ts";
import { AttributionSchema } from "./source-contracts.ts";
import { QuestionBankMetadataSchema } from "../question-bank/contracts.ts";
import { ObjectiveWorkflowSchema } from "../objectives/contracts.ts";

const text = z.string().min(1);
export const LessonPassageSchema = z.strictObject({
  id: text,
  source_id: text,
  source_commit: text.optional(),
  source_version: z.number().int().positive().optional(),
  text,
  url: z.url().nullable(),
  start_line: z.number().int().positive().nullable(),
  end_line: z.number().int().positive().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  page_number: z.number().int().positive().optional(),
  section: text.optional(),
});
const MisconceptionSchema = z.strictObject({
  id: text,
  concept_id: text.nullable(),
  definition: text,
  handling: text.optional(),
  evidence_that_may_support: text.optional(),
  diagnostic_caution: text.optional(),
});
export const ActivityPolicySchema = z.strictObject({
  allowed_actions: z.array(ActionSchema).min(1),
  allow_runtime_generation: z.boolean(),
});
/** JSON wire representation of the existing approved-content context. Server-private. */
export const LessonContentSchema = z.strictObject({
  content_ref: ContentRefSchema,
  attribution: AttributionSchema,
  assignment_key: text,
  approval: z.strictObject({
    status: z.literal("approved"),
    approved_by: text,
    approved_at: text,
    approval_type: text,
    approval_note: text,
  }),
  concepts: ConceptsSchema.shape.concepts,
  passages: z.array(LessonPassageSchema).min(1),
  misconceptions: z.array(MisconceptionSchema),
  scope: text,
  terminology_policy: text,
  misconception_policy: text,
  scoring_policy: BankSchema.shape.scoring_policy,
  sequence: SequenceSchema,
  questions: z.array(QuestionSnapshotSchema).min(1),
  question_guidance: z.array(
    z.strictObject({
      question_id: text,
      assumptions: z.array(text),
      misconception_ids: z.array(text),
    }),
  ),
  activity_policy: ActivityPolicySchema,
});
export type LessonContent = z.infer<typeof LessonContentSchema>;
/** Incomplete authoring state is allowed; approval/publication requires the full schema. */
export const LessonDraftContentSchema = LessonContentSchema.partial().extend({
  question_bank: QuestionBankMetadataSchema.optional(),
  objective_workflow: ObjectiveWorkflowSchema.optional(),
});
export type LessonDraftContent = z.infer<typeof LessonDraftContentSchema>;
/** Draft review metadata is not a second published lesson contract. */
export function projectLessonDraftContent(draft: LessonDraftContent) {
  return LessonContentSchema.partial().strip().parse(draft);
}
export type ResolvedLessonContent = Omit<
  LessonContent,
  "concepts" | "passages" | "questions" | "misconceptions" | "question_guidance"
> & {
  concept_ids: Set<string>;
  passage_ids: Set<string>;
  concepts: Map<string, LessonContent["concepts"][number]>;
  passages: Map<string, LessonContent["passages"][number]>;
  misconceptions: Map<string, LessonContent["misconceptions"][number]>;
  misconception_concepts: Map<string, string | null>;
  questions: Map<string, LessonContent["questions"][number]>;
  question_guidance: Map<
    string,
    Omit<LessonContent["question_guidance"][number], "question_id">
  >;
  sequence_id: string;
  sequence_interpretation_rules: string[];
};
