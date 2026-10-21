import { z } from "zod";
import {
  ContentRefSchema,
  QuestionSnapshotSchema,
  SubmitAnswerSchema,
} from "../evidence/contracts.ts";
import { TutorViewSchema } from "../tutoring/contracts.ts";

export const DIALOGUE_VERSION = "r7-v1";
export const DIALOGUE_LIMITS = {
  requestCharacters: 2_000,
  draftCharacters: 16_000,
  responseCharacters: 6_000,
  generatedContentCharacters: 16_000,
  historyMessages: 12,
  historyCharacters: 12_000,
  turnsPerSession: 12,
  providerRequestsPerSession: 36,
  concurrentRequestsPerSession: 1,
  timeoutMs: 45_000,
  maxOutputTokens: 4_096,
  automaticRetries: 0,
  explicitRetriesPerTurn: 2,
  retryCooldownMs: 60_000,
} as const;

const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Required text");
const timestamp = z.iso.datetime({ offset: true });
const revision = z.int().nonnegative();
const envelope = {
  version: z.literal(DIALOGUE_VERSION),
  request_id: z.uuid(),
  session_id: z.uuid(),
  expected_revision: revision,
};
export const AskTutorSchema = z.strictObject({
  ...envelope,
  action: z.literal("ask_tutor"),
  attempt_id: z.uuid(),
  purpose: z.enum([
    "question",
    "clarification",
    "example",
    "alternative_explanation",
  ]),
  text: text.max(DIALOGUE_LIMITS.requestCharacters),
  retry_of: z.uuid().optional(),
});
export const StudentActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...envelope,
    action: z.literal("submit_answer"),
    answer: SubmitAnswerSchema,
  }),
  AskTutorSchema,
  z.strictObject({
    ...envelope,
    action: z.literal("return_to_lesson"),
    attempt_id: z.uuid(),
  }),
]);
export type StudentAction = z.infer<typeof StudentActionSchema>;

// Issued from authorized session/attempt records, never from a browser's claims.
export const LessonAnchorSchema = z.strictObject({
  session_id: z.uuid(),
  assignment_id: z.uuid(),
  attempt_id: z.uuid(),
  root_attempt_id: z.uuid(),
  sequence_index: z.int().nonnegative(),
  content_ref: ContentRefSchema,
});
export const DialogueStateSchema = z
  .strictObject({
    version: z.literal(DIALOGUE_VERSION),
    revision,
    lesson: LessonAnchorSchema,
    progress: TutorViewSchema.shape.progress,
    enabled: z.boolean(),
    active_request_id: z.uuid().nullable(),
    turns_used: z.int().nonnegative(),
    provider_requests_used: z.int().nonnegative(),
  })
  .refine(
    (state) => state.progress.current_attempt_id === state.lesson.attempt_id,
    "Dialogue must refer to the controller's current attempt",
  );
export type DialogueState = z.infer<typeof DialogueStateSchema>;
export const LessonDraftSchema = z.strictObject({
  lesson: LessonAnchorSchema,
  text: z.string().max(DIALOGUE_LIMITS.draftCharacters),
});

// Only accepted, student-safe messages enter model history. No rubrics or raw outputs.
export const DialogueHistorySchema = z
  .array(
    z.strictObject({
      role: z.enum(["student", "tutor"]),
      text: text.max(DIALOGUE_LIMITS.responseCharacters),
    }),
  )
  .max(DIALOGUE_LIMITS.historyMessages)
  .refine(
    (messages) =>
      messages.reduce((total, message) => total + message.text.length, 0) <=
      DIALOGUE_LIMITS.historyCharacters,
    "Dialogue history is too long",
  );

const questionFields = QuestionSnapshotSchema.shape;
const generatedQuestion = QuestionSnapshotSchema.superRefine(
  (question, context) => {
    if (
      question.origin !== "generated" ||
      !question.question_id ||
      !question.generation ||
      !question.rubric.criteria.length
    )
      context.addIssue({
        code: "custom",
        message:
          "Generated activities need immutable identity, provenance and evaluation criteria",
      });
  },
);
export const GeneratedDialogueSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("help"),
      content_id: z.uuid(),
      text: text.max(DIALOGUE_LIMITS.responseCharacters),
      // Explanations use hint/corrective_feedback, so displayed help counts as assistance.
      assistance_type: z.enum([
        "hint",
        "worked_example",
        "corrective_feedback",
        "neutral_clarification",
      ]),
      content_ref: ContentRefSchema,
      concept_ids: questionFields.concept_ids,
      source_passage_ids: questionFields.source_passage_ids,
      generation: questionFields.generation.unwrap(),
    }),
    z.strictObject({
      kind: z.literal("question"),
      content_id: z.uuid(),
      intent: z.enum(["diagnostic_followup", "neutral_clarification"]),
      question: generatedQuestion,
      // Investigated possibilities, never confirmed beliefs or student-visible labels.
      target_misconception_ids: z
        .array(text)
        .refine((ids) => new Set(ids).size === ids.length, "Duplicate IDs"),
    }),
  ])
  .refine(
    (content) =>
      JSON.stringify(content).length <=
      DIALOGUE_LIMITS.generatedContentCharacters,
    "Generated content is too long",
  );
export type GeneratedDialogue = z.infer<typeof GeneratedDialogueSchema>;

export const DialogueRequestSchema = z
  .strictObject({
    ...envelope,
    lesson: LessonAnchorSchema,
    requested_at: timestamp,
    retry: z
      .strictObject({
        of_request_id: z.uuid(),
        number: z.int().min(1).max(DIALOGUE_LIMITS.explicitRetriesPerTurn),
      })
      .nullable(),
    trigger: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("student"), action: AskTutorSchema }),
      z.strictObject({
        kind: z.literal("controller"),
        evaluation_id: z.uuid(),
        allowed_intent: z.enum([
          "diagnostic_followup",
          "neutral_clarification",
          "explanation",
        ]),
      }),
    ]),
  })
  .superRefine((request, context) => {
    const action =
      request.trigger.kind === "student" ? request.trigger.action : null;
    if (
      request.session_id !== request.lesson.session_id ||
      (action &&
        (action.request_id !== request.request_id ||
          action.session_id !== request.session_id ||
          action.expected_revision !== request.expected_revision ||
          action.attempt_id !== request.lesson.attempt_id ||
          (action.retry_of ?? null) !== (request.retry?.of_request_id ?? null)))
    )
      context.addIssue({
        code: "custom",
        message: "Request identities must match its lesson and action",
      });
  });
export type DialogueRequest = z.infer<typeof DialogueRequestSchema>;

export const DialogueFailureSchema = z.enum([
  "disabled",
  "off_topic",
  "private_guidance",
  "intent_unclear",
  "limit_reached",
  "timeout",
  "provider_error",
  "invalid_output",
  "stale",
  "cancelled",
]);
// Events describe one request's delivery, not lesson transitions. IDs/times are server-issued.
const eventBase = {
  version: z.literal(DIALOGUE_VERSION),
  event_id: z.uuid(),
  request_id: z.uuid(),
  at: timestamp,
};
export const DialogueEventSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ ...eventBase, outcome: z.literal("requested") }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("generated"),
    content: GeneratedDialogueSchema,
  }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("accepted"),
    content_id: z.uuid(),
    applied_attempt_id: z.uuid().nullable(),
    applied_revision: revision,
  }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("displayed"),
    content_id: z.uuid(),
    intervention_id: z.uuid().nullable(),
    assessed_attempt_id: z.uuid().nullable(),
  }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("rejected"),
    reason: DialogueFailureSchema,
  }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("failed"),
    reason: DialogueFailureSchema,
  }),
  z.strictObject({
    ...eventBase,
    outcome: z.literal("cancelled"),
    reason: z.literal("cancelled"),
  }),
]);
export type DialogueEvent = z.infer<typeof DialogueEventSchema>;
export const DisplayDialogueSchema = z.strictObject({
  ...envelope,
  accepted_event_id: z.uuid(),
  content_id: z.uuid(),
});

export const StudentQuestionSchema = z.strictObject({
  question_id: questionFields.question_id,
  prompt_text: questionFields.prompt_text,
  concept_ids: questionFields.concept_ids,
  source_passage_ids: questionFields.source_passage_ids,
  content_ref: ContentRefSchema,
});
export const StudentDialogueContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("help"),
    content_id: z.uuid(),
    text: text,
    concept_ids: questionFields.concept_ids,
    source_passage_ids: questionFields.source_passage_ids,
    content_ref: ContentRefSchema,
  }),
  z.strictObject({
    kind: z.literal("question"),
    content_id: z.uuid(),
    question: StudentQuestionSchema,
  }),
]);
export const StudentDialogueFallbackSchema = z.strictObject({
  kind: z.literal("fallback"),
  reason: DialogueFailureSchema,
  text,
  next: z.literal("return_to_lesson"),
});

export type AskTutor = z.infer<typeof AskTutorSchema>;
export type LessonAnchor = z.infer<typeof LessonAnchorSchema>;
export type LessonDraft = z.infer<typeof LessonDraftSchema>;
export type DialogueHistory = z.infer<typeof DialogueHistorySchema>;
export type DisplayDialogue = z.infer<typeof DisplayDialogueSchema>;
export type StudentDialogueContent = z.infer<
  typeof StudentDialogueContentSchema
>;
export type StudentDialogueFallback = z.infer<
  typeof StudentDialogueFallbackSchema
>;
