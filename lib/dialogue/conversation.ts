import { z } from "zod";
import { SubmitAnswerSchema } from "../evidence/contracts.ts";
import {
  AskTutorSchema,
  DIALOGUE_LIMITS,
  DialogueFailureSchema,
  DialogueStateSchema,
  type AskTutor,
  type DialogueState,
  type DisplayDialogue,
} from "./contracts.ts";
import {
  makeAskAction,
  parseStudentDialogueView,
  StudentDialogueViewSchema,
} from "./student-view.ts";

export const CONVERSATION_VERSION = "r7-conversation-v1";
export const MESSAGE_CHARACTERS = 12_000;
const requiredText = z.string().refine((value) => value.trim().length > 0);
export const MessageIntentSchema = z.enum([
  "ANSWER",
  "QUESTION_OR_HELP",
  "AMBIGUOUS",
  "OFF_TOPIC_OR_UNSUPPORTED",
]);
// Provider output only. The rationale stays in authorized server evidence.
export const IntentClassificationSchema = z.strictObject({
  category: MessageIntentSchema,
  rationale: requiredText.max(600),
});
const envelope = {
  version: z.literal(CONVERSATION_VERSION),
  request_id: z.uuid(),
  session_id: z.uuid(),
  attempt_id: z.uuid(),
  expected_revision: z.int().nonnegative(),
};
export const ConversationActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...envelope,
    action: z.literal("send_message"),
    text: requiredText.max(MESSAGE_CHARACTERS),
    purpose_hint: AskTutorSchema.shape.purpose.optional(),
  }),
  z.strictObject({
    ...envelope,
    action: z.literal("resolve_intent"),
    message_request_id: z.uuid(),
    choice: z.enum(["answer", "help"]),
  }),
  z.strictObject({
    ...envelope,
    action: z.literal("cancel_message"),
    message_request_id: z.uuid(),
  }),
]);
export type ConversationAction = z.infer<typeof ConversationActionSchema>;

export const ConversationMessageSchema = z.strictObject({
  request_id: z.uuid(),
  attempt_id: z.uuid(),
  expected_revision: z.int().nonnegative(),
  text: requiredText.max(MESSAGE_CHARACTERS),
  purpose_hint: AskTutorSchema.shape.purpose.optional(),
  classification: MessageIntentSchema.nullable(),
  outcome: z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("pending") }),
    z.strictObject({ status: z.literal("clarification") }),
    z.strictObject({
      status: z.literal("help"),
      dialogue_request_id: z.uuid(),
    }),
    z.strictObject({ status: z.literal("answer"), submission_key: z.uuid() }),
    z.strictObject({
      status: z.literal("fallback"),
      reason: DialogueFailureSchema,
      text: requiredText.max(DIALOGUE_LIMITS.responseCharacters),
    }),
    z.strictObject({ status: z.literal("cancelled") }),
  ]),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

/** Student projection. Never add raw provider output, rationale or grading guidance. */
export const ConversationViewSchema = z
  .strictObject({
    dialogue: StudentDialogueViewSchema,
    messages: z
      .array(ConversationMessageSchema)
      .max(
        DIALOGUE_LIMITS.turnsPerSession *
          (DIALOGUE_LIMITS.explicitRetriesPerTurn + 1),
      ),
  })
  .superRefine((view, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: "custom", message });
    const state = view.dialogue.state;
    const requests = new Set<string>();
    const submissions = new Set<string>();
    const helpRequests = new Set<string>();
    let unresolved = 0;
    for (const message of view.messages) {
      if (requests.has(message.request_id))
        fail("Duplicate conversation request");
      requests.add(message.request_id);
      if (message.expected_revision > state.revision)
        fail("Future message revision");
      const outcome = message.outcome;
      if (outcome.status === "pending" || outcome.status === "clarification") {
        unresolved++;
        if (
          message.attempt_id !== state.lesson.attempt_id ||
          message.expected_revision !== state.revision ||
          state.active_request_id !== message.request_id ||
          state.progress.phase !== "answer"
        )
          fail("Unresolved message belongs to a stale activity");
        if (
          outcome.status === "pending"
            ? message.classification !== null
            : message.classification !== "AMBIGUOUS"
        )
          fail("Invalid unresolved intent");
      }
      if (outcome.status === "answer") {
        if (!["ANSWER", "AMBIGUOUS"].includes(message.classification ?? ""))
          fail("Help cannot become an assessed answer");
        if (submissions.has(outcome.submission_key))
          fail("Duplicate answer submission");
        submissions.add(outcome.submission_key);
      }
      if (outcome.status === "help") {
        if (
          !["QUESTION_OR_HELP", "AMBIGUOUS"].includes(
            message.classification ?? "",
          )
        )
          fail("Invalid help intent");
        const turn = view.dialogue.turns.find(
          (item) => item.request_id === outcome.dialogue_request_id,
        );
        if (
          !turn ||
          turn.attempt_id !== message.attempt_id ||
          turn.text !== message.text
        )
          fail("Help must preserve its original message and activity");
        if (helpRequests.has(outcome.dialogue_request_id))
          fail("Duplicate help request");
        helpRequests.add(outcome.dialogue_request_id);
      }
    }
    if (unresolved > 1) fail("Only one message may await intent resolution");
  });
export type ConversationView = z.infer<typeof ConversationViewSchema>;
export type ConversationTransport = {
  load(): Promise<unknown>;
  act(action: ConversationAction): Promise<unknown>;
  acknowledge(input: DisplayDialogue): Promise<unknown>;
};

function requireRule(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Consistency checking only; the authenticated server owns routing and persistence. */
export function parseConversationView(
  input: unknown,
  expected: { sessionId: string; attemptId: string },
  previous?: ConversationView,
): ConversationView {
  const view = ConversationViewSchema.parse(input);
  parseStudentDialogueView(view.dialogue, expected, previous?.dialogue);
  if (previous) {
    const before = ConversationViewSchema.parse(previous);
    for (const [index, saved] of before.messages.entries()) {
      const current = view.messages[index];
      requireRule(
        !!current && current.request_id === saved.request_id,
        "Original message disappeared or moved",
      );
      requireRule(
        current.text === saved.text &&
          current.attempt_id === saved.attempt_id &&
          current.expected_revision === saved.expected_revision &&
          current.purpose_hint === saved.purpose_hint,
        "Original message changed",
      );
      if (saved.classification !== null)
        requireRule(
          current.classification === saved.classification,
          "Saved classification changed",
        );
      if (saved.outcome.status === "pending") continue;
      if (saved.outcome.status === "clarification") {
        requireRule(
          current.outcome.status !== "pending",
          "Clarification regressed",
        );
        continue;
      }
      requireRule(same(current, saved), "Settled message changed");
    }
  }
  return view;
}

function actionEnvelope(state: DialogueState, requestId: string) {
  const current = DialogueStateSchema.parse(state);
  return {
    version: CONVERSATION_VERSION,
    request_id: requestId,
    session_id: current.lesson.session_id,
    attempt_id: current.lesson.attempt_id,
    expected_revision: current.revision,
  };
}
export function makeMessageAction(
  state: DialogueState,
  text: string,
  requestId: string,
  purposeHint?: AskTutor["purpose"],
) {
  return ConversationActionSchema.parse({
    ...actionEnvelope(state, requestId),
    action: "send_message",
    text,
    ...(purposeHint ? { purpose_hint: purposeHint } : {}),
  });
}
export function makeResolveAction(
  state: DialogueState,
  messageRequestId: string,
  choice: "answer" | "help",
  requestId: string,
) {
  return ConversationActionSchema.parse({
    ...actionEnvelope(state, requestId),
    action: "resolve_intent",
    message_request_id: messageRequestId,
    choice,
  });
}
export function makeCancelAction(
  state: DialogueState,
  messageRequestId: string,
  requestId: string,
) {
  return ConversationActionSchema.parse({
    ...actionEnvelope(state, requestId),
    action: "cancel_message",
    message_request_id: messageRequestId,
  });
}

/** Caller authenticates and locks the owned session first. No effects or provider calls. */
export function validateConversationAction(
  input: unknown,
  current: ConversationView,
  previous?: ConversationAction,
) {
  const action = ConversationActionSchema.parse(input);
  const view = ConversationViewSchema.parse(current);
  const state = view.dialogue.state;
  requireRule(action.session_id === state.lesson.session_id, "Wrong session");
  if (previous) {
    const saved = ConversationActionSchema.parse(previous);
    requireRule(
      saved.request_id === action.request_id && same(saved, action),
      "Request ID reused with different input",
    );
    return { kind: "replay" as const, request_id: action.request_id };
  }
  requireRule(action.expected_revision === state.revision, "Stale revision");
  requireRule(
    action.attempt_id === state.lesson.attempt_id &&
      state.progress.phase === "answer",
    "Wrong active activity",
  );
  requireRule(
    !view.dialogue.turns.some((turn) => turn.response.status === "accepted"),
    "Confirm displayed help before continuing",
  );
  if (action.action === "send_message") {
    requireRule(
      !view.messages.some(
        (message) => message.request_id === action.request_id,
      ),
      "Reconcile the saved request before retrying",
    );
    requireRule(
      state.active_request_id === null &&
        !view.messages.some((message) =>
          ["pending", "clarification"].includes(message.outcome.status),
        ),
      "Another message is unresolved",
    );
    requireRule(state.enabled, "Intent recognition is unavailable");
    requireRule(
      state.turns_used < DIALOGUE_LIMITS.turnsPerSession &&
        state.provider_requests_used <
          DIALOGUE_LIMITS.providerRequestsPerSession,
      "Dialogue usage limit reached",
    );
    return { kind: "classify" as const, action };
  }
  const message = view.messages.find(
    (item) => item.request_id === action.message_request_id,
  );
  requireRule(
    !!message &&
      message.attempt_id === action.attempt_id &&
      message.expected_revision === state.revision &&
      state.active_request_id === message.request_id,
    "Message is missing or stale",
  );
  requireRule(
    action.request_id !== message.request_id,
    "Resolution needs its own request identity",
  );
  if (action.action === "cancel_message") {
    requireRule(
      ["pending", "clarification"].includes(message.outcome.status),
      "Message is already settled",
    );
    return { kind: "cancel" as const, message };
  }
  requireRule(
    message.outcome.status === "clarification",
    "Message is not awaiting clarification",
  );
  return { kind: "resolve" as const, message, choice: action.choice };
}

// These findings come from server policy/context, never browser fields or the model itself.
export type IntentReview = {
  answer_intent: "established" | "uncertain";
  disclosure: "safe" | "private_guidance" | "uncertain";
};

/** A routing proposal only. #74/#75 must validate and commit it through existing stores. */
export function routeClassifiedMessage(
  current: ConversationView,
  messageRequestId: string,
  input: unknown,
  review: IntentReview,
  submissionKey: string,
) {
  const view = ConversationViewSchema.parse(current);
  const state = view.dialogue.state;
  const classification = IntentClassificationSchema.parse(input);
  const message = view.messages.find(
    (item) => item.request_id === messageRequestId,
  );
  requireRule(
    !!message &&
      message.outcome.status === "pending" &&
      message.attempt_id === state.lesson.attempt_id &&
      message.expected_revision === state.revision &&
      state.active_request_id === message.request_id &&
      state.progress.phase === "answer" &&
      state.enabled,
    "Classification belongs to a stale or cancelled message",
  );
  requireRule(
    !view.dialogue.turns.some((turn) => turn.response.status === "accepted"),
    "Confirm displayed help before routing",
  );
  if (review.disclosure !== "safe")
    return { kind: "fallback" as const, reason: "private_guidance" as const };
  switch (classification.category) {
    case "ANSWER":
      if (review.answer_intent !== "established")
        return { kind: "clarify" as const };
      return {
        kind: "submit_answer" as const,
        answer: SubmitAnswerSchema.parse({
          attempt_id: message.attempt_id,
          submission_key: submissionKey,
          response_text: message.text,
        }),
      };
    case "QUESTION_OR_HELP":
      if (message.text.length > DIALOGUE_LIMITS.requestCharacters)
        return { kind: "fallback" as const, reason: "limit_reached" as const };
      return {
        kind: "ask_tutor" as const,
        action: makeAskAction(
          state,
          message.purpose_hint ?? "question",
          message.text,
          message.request_id,
        ),
      };
    case "AMBIGUOUS":
      return { kind: "clarify" as const };
    case "OFF_TOPIC_OR_UNSUPPORTED":
      return { kind: "fallback" as const, reason: "off_topic" as const };
  }
}
