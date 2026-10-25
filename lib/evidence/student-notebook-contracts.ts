import { z } from "zod";
import {
  AssistanceSnapshotSchema,
  CuratedContentRefSchema,
  UploadedContentRefSchema,
  CorrectnessSchema,
  IntentSchema,
  InterventionSchema,
  SessionSchema,
} from "./contracts.ts";

export const NOTEBOOK_VERSION = "student-notebook-v1" as const;
export const NOTEBOOK_LIMITS = {
  attempts: 128,
  evaluations: 512,
  interventions: 512,
  operations: 256,
  provider_calls: 512,
  audit_events: 2048,
  reviews: 100,
  events_per_attempt: 128,
  bytes: 2 * 1024 * 1024,
  input_bytes: 16 * 1024 * 1024,
} as const;
const id = z.uuid();
const time = z.iso.datetime({ offset: true });
const text = z.string();
const source = z.strictObject({
  lesson_id: text.min(1),
  lesson_version: text.min(1),
  title: text.min(1),
  content_ref: z.union([
    CuratedContentRefSchema,
    UploadedContentRefSchema.omit({ access_scope: true }),
  ]),
});
export const NotebookLinkSchema = z.strictObject({
  session_id: id,
  attempt_id: id,
  assignment_id: id,
  href: text.startsWith("/study/"),
});
export type NotebookLink = z.infer<typeof NotebookLinkSchema>;
export const NotebookReviewSchema = z.strictObject({
  approval_id: id,
  approved_revision: z.int().positive(),
  assignment_id: id,
  delivered_at: time,
  displayed_at: time.nullable(),
  relation: z.enum([
    "fresh_check_for_this_approval",
    "references_this_attempt",
  ]),
  followup: NotebookLinkSchema.nullable(),
  href: text.startsWith("/study/interventions/"),
});
export type NotebookReview = z.infer<typeof NotebookReviewSchema>;

const assessment = z.strictObject({
  evaluation_id: id,
  evaluated_at: time,
  supersedes_id: id.nullable(),
  is_current: z.boolean(),
  results: z
    .array(z.strictObject({ concept_id: text, correctness: CorrectnessSchema }))
    .min(1),
  uncertainty_recorded: z.boolean(),
});
const aidOwner = z.enum([
  "conversation",
  "controller",
  "reading",
  "teacher_review",
]);
const aid = z.strictObject({
  intervention_id: id,
  owner: aidOwner,
  related_evaluation_id: id.nullable(),
  message_request_id: id.nullable(),
  type: InterventionSchema.shape.type,
  text,
  displayed_at: time,
  source_passage_ids: z.array(text),
  counted_at_submission: z.boolean().nullable(),
});
const eventBase = {
  event_id: text.min(1),
  recorded_at: time,
  order: z.int().nonnegative(),
  time_basis: z.enum([
    "question_presentation",
    "message_saved",
    "audit_recorded",
    "display_acknowledged",
    "answer_submitted",
    "evaluation_recorded",
  ]),
  order_basis: z.enum(["recorded_time", "stable_tie"]),
};
export const NotebookEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...eventBase, kind: z.literal("question_presented") }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("student_message"),
    request_id: id,
    content: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("text"), text }),
      z.strictObject({
        kind: z.literal("submitted_answer_reference"),
        answer_id: text,
      }),
    ]),
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("intent_clarification_requested"),
    request_id: id,
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("intent_resolved"),
    request_id: id,
    resolution_request_id: id,
    choice: z.enum(["answer", "help"]),
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("message_cancelled"),
    request_id: id,
    cancellation_request_id: id,
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("message_unavailable"),
    request_id: id,
    reason: z.enum(["unavailable", "stale"]),
  }),
  z.strictObject({ ...eventBase, kind: z.literal("help_displayed"), aid }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("answer_submitted"),
    answer_id: text,
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("assessment_recorded"),
    assessment,
  }),
  z.strictObject({
    ...eventBase,
    kind: z.literal("evaluation_status_recorded"),
    evaluation_id: id,
    status: z.enum(["pending", "failed", "rejected", "outcome_unknown"]),
  }),
]);
export type NotebookEvent = z.infer<typeof NotebookEventSchema>;
export const NotebookAssessmentStateSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("not_submitted") }),
  z.strictObject({ status: z.literal("not_recorded") }),
  z.strictObject({
    status: z.literal("pending"),
    outcome: z.enum(["pending", "unknown"]),
  }),
  z.strictObject({ status: z.literal("failed") }),
  z.strictObject({ status: z.literal("rejected") }),
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({ status: z.literal("accepted"), current_evaluation_id: id }),
]);
export const NotebookPageSchema = z.strictObject({
  attempt_id: id,
  sequence_index: z.int().nonnegative(),
  root_attempt_id: id,
  parent_attempt_id: id.nullable(),
  review_of: NotebookLinkSchema.nullable(),
  intent: IntentSchema,
  source,
  question: z.strictObject({
    question_id: text.nullable(),
    origin: z.enum(["curated", "generated"]),
    prompt_text: text,
    concept_ids: z.array(text),
    source_passage_ids: z.array(text),
    presented_at: time,
    display_evidence: z.literal("not_recorded"),
  }),
  submission: z
    .strictObject({
      answer_id: text,
      submission_key: id,
      submitted_at: time,
      response_text: text,
      message_request_id: id.nullable(),
      assistance_at_submission: AssistanceSnapshotSchema,
    })
    .nullable(),
  assessment: NotebookAssessmentStateSchema,
  messages: z.array(
    z.strictObject({
      request_id: id,
      state: z.enum([
        "pending",
        "clarification",
        "help",
        "answer",
        "fallback",
        "cancelled",
      ]),
      execution: z.enum([
        "pending",
        "outcome_unknown",
        "settled",
        "not_recorded",
      ]),
    }),
  ),
  events: z.array(NotebookEventSchema).max(NOTEBOOK_LIMITS.events_per_attempt),
  pending_deliveries: z.array(
    z.strictObject({
      intervention_id: id,
      owner: aidOwner,
      state: z.enum(["awaiting_display", "display_unconfirmed", "unavailable"]),
      resume_href: text.startsWith("/study/"),
    }),
  ),
  subsequent: z.array(
    z.strictObject({
      relation: z.enum(["child_attempt", "delayed_review"]),
      target: NotebookLinkSchema,
    }),
  ),
  teacher_reviews: z.array(NotebookReviewSchema).max(NOTEBOOK_LIMITS.reviews),
  gaps: z.array(
    z.enum([
      "question_view_time_not_recorded",
      "clarification_wording_not_recorded",
      "message_transition_time_not_recorded",
      "display_receipt_unconfirmed",
      "accepted_result_unavailable",
      "related_record_unavailable",
    ]),
  ),
});
export type NotebookPage = z.infer<typeof NotebookPageSchema>;
export const StudentNotebookSchema = z.strictObject({
  version: z.literal(NOTEBOOK_VERSION),
  mode: z.literal("recorded_chronology"),
  snapshot: z.strictObject({ id: text.regex(/^[a-f0-9]{64}$/), read_at: time }),
  session: z.strictObject({
    id,
    assignment_id: id,
    kind: z.enum(["tutoring", "teacher_intervention_followup"]),
    status: SessionSchema.shape.status,
    data_origin: SessionSchema.shape.data_origin,
    started_at: time,
    ended_at: time.nullable(),
    resume_href: text.startsWith("/study/"),
  }),
  pages: z.array(NotebookPageSchema).max(25),
  paging: z.strictObject({
    next_cursor: text.nullable(),
    total_attempts: z.int().nonnegative(),
    selected_attempt_id: id.nullable(),
    previous: NotebookLinkSchema.nullable(),
    next: NotebookLinkSchema.nullable(),
  }),
  coverage: z.literal("all_available_recorded_events_in_returned_pages"),
});
export type StudentNotebook = z.infer<typeof StudentNotebookSchema>;
export const NotebookQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(25).default(10),
    cursor: text.min(1).max(2048).optional(),
    attempt_id: id.optional(),
  })
  .refine(
    (query) => !query.cursor || !query.attempt_id,
    "Choose cursor or attempt_id.",
  );
