import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import {
  InterventionSchema,
  type Intervention,
} from "../evidence/contracts.ts";
import {
  validateContentRef,
  validateQuestionSnapshot,
  type ApprovedContent,
} from "../evidence/content.ts";
import {
  DIALOGUE_LIMITS,
  DialogueEventSchema,
  DialogueRequestSchema,
  DialogueStateSchema,
  GeneratedDialogueSchema,
  LessonDraftSchema,
  StudentActionSchema,
  StudentDialogueContentSchema,
  StudentDialogueFallbackSchema,
  type DialogueEvent,
  type DialogueRequest,
  type DialogueState,
  type GeneratedDialogue,
  type StudentAction,
} from "./contracts.ts";

function requireRule(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const same = isDeepStrictEqual;

export function dialogueFallback(
  reason: z.infer<typeof StudentDialogueFallbackSchema>["reason"],
) {
  const messages = {
    disabled:
      "Extra tutor help is unavailable. You can continue your lesson or open the reading.",
    off_topic:
      "Let's stay with the assigned question. You can ask about the reading or return to your answer.",
    private_guidance:
      "I can help you think it through, but I can't give you the answer or grading guide.",
    intent_unclear:
      "Do you want help, or are you ready to submit your answer? Choose an action first.",
    limit_reached:
      "You've reached the extra-help limit. You can still continue your lesson or use the reading.",
    timeout:
      "The tutor took too long. Your question and draft are safe; you can return to the lesson.",
    provider_error:
      "Extra tutor help is temporarily unavailable. You can return to the lesson.",
    invalid_output:
      "That response couldn't be checked. You can return to the lesson or use the reading.",
    stale:
      "Your lesson has changed. Reload its current question before continuing.",
    cancelled:
      "Extra help was cancelled. Return to your question when you're ready.",
  };
  return StudentDialogueFallbackSchema.parse({
    kind: "fallback",
    reason,
    text: messages[reason],
    next: "return_to_lesson",
  });
}

/** Caller authenticates/loads the session first. This never changes lesson state. */
export function validateStudentAction(
  input: unknown,
  current: DialogueState,
  previous?: StudentAction,
) {
  const action = StudentActionSchema.parse(input);
  const state = DialogueStateSchema.parse(current);
  requireRule(action.session_id === state.lesson.session_id, "Wrong session");
  if (previous) {
    const saved = StudentActionSchema.parse(previous);
    requireRule(
      saved.request_id === action.request_id && same(saved, action),
      "Request ID reused with a different action",
    );
    return { kind: "replay" as const, request_id: action.request_id };
  }
  requireRule(action.expected_revision === state.revision, "Stale revision");
  const attemptId =
    action.action === "submit_answer"
      ? action.answer.attempt_id
      : action.attempt_id;
  requireRule(attemptId === state.lesson.attempt_id, "Wrong active attempt");
  if (action.action === "return_to_lesson")
    return {
      kind: "return_to_lesson" as const,
      cancel_request_id: state.active_request_id,
    };
  requireRule(
    state.progress.phase === "answer",
    "The controller is not awaiting an answer",
  );
  if (action.action === "submit_answer")
    return {
      kind: "submit_answer" as const,
      answer: action.answer,
      cancel_request_id: state.active_request_id,
    };
  if (!state.enabled)
    return {
      kind: "fallback" as const,
      fallback: dialogueFallback("disabled"),
    };
  if (
    (!action.retry_of && state.turns_used >= DIALOGUE_LIMITS.turnsPerSession) ||
    state.turns_used > DIALOGUE_LIMITS.turnsPerSession ||
    state.provider_requests_used >= DIALOGUE_LIMITS.providerRequestsPerSession
  )
    return {
      kind: "fallback" as const,
      fallback: dialogueFallback("limit_reached"),
    };
  requireRule(
    state.active_request_id === null,
    "Another dialogue request is active",
  );
  return { kind: "ask_tutor" as const, action };
}

/** The draft is opaque UI recovery data, never an answer or model input. */
export function restoreLessonDraft(
  input: unknown,
  state: DialogueState,
): string {
  const draft = LessonDraftSchema.parse(input);
  requireRule(
    same(draft.lesson, DialogueStateSchema.parse(state).lesson),
    "Draft belongs to a different learning activity",
  );
  return draft.text;
}

/** #75 must reserve counts/one in-flight request under its session transaction. */
export function assertProviderAttemptAllowed(
  state: DialogueState,
  request: DialogueRequest,
  attempt: {
    retry_number: number;
    previous_outcome: "none" | "settled_failure" | "unknown";
    previous_finished_at: string | null;
  },
  now: string,
) {
  DialogueStateSchema.parse(state);
  z.iso.datetime({ offset: true }).parse(now);
  DialogueRequestSchema.parse(request);
  assertCurrentRequest(request, state);
  requireRule(
    state.turns_used <= DIALOGUE_LIMITS.turnsPerSession &&
      state.provider_requests_used < DIALOGUE_LIMITS.providerRequestsPerSession,
    "Dialogue usage limit reached",
  );
  requireRule(
    Number.isInteger(attempt.retry_number) &&
      attempt.retry_number >= 0 &&
      attempt.retry_number <= DIALOGUE_LIMITS.explicitRetriesPerTurn &&
      attempt.retry_number === (request.retry?.number ?? 0),
    "Retry limit reached",
  );
  if (attempt.retry_number === 0) {
    requireRule(
      attempt.previous_outcome === "none" &&
        attempt.previous_finished_at === null,
      "Initial call already attempted",
    );
  } else {
    requireRule(
      attempt.previous_outcome === "settled_failure" &&
        attempt.previous_finished_at !== null,
      "Reconcile the previous provider outcome before retrying",
    );
    const finished = z.iso
      .datetime({ offset: true })
      .parse(attempt.previous_finished_at);
    requireRule(
      Date.parse(now) - Date.parse(finished) >= DIALOGUE_LIMITS.retryCooldownMs,
      "Retry cooldown has not elapsed",
    );
  }
}

export type DialogueScope = {
  concept_ids: ReadonlySet<string>;
  passage_ids: ReadonlySet<string>;
  misconception_ids: ReadonlySet<string>;
};

/** Explicit retries are new linked requests; terminal histories never get rewritten. */
export function validateDialogueRetry(
  request: DialogueRequest,
  previous: DialogueRequest,
  history: DialogueEvent[],
  now: string,
) {
  DialogueRequestSchema.parse(request);
  DialogueRequestSchema.parse(previous);
  z.iso.datetime({ offset: true }).parse(now);
  const last = validateDialogueEvents(previous, history).at(-1);
  requireRule(
    request.request_id !== previous.request_id &&
      request.retry?.of_request_id === previous.request_id &&
      request.retry.number === (previous.retry?.number ?? 0) + 1,
    "Invalid retry lineage",
  );
  requireRule(
    last?.outcome === "failed" ||
      (last?.outcome === "rejected" && last.reason === "invalid_output"),
    "Only failed generation can be retried",
  );
  requireRule(
    Date.parse(now) - Date.parse(last.at) >= DIALOGUE_LIMITS.retryCooldownMs,
    "Retry cooldown has not elapsed",
  );
  requireRule(
    same(request.lesson, previous.lesson) &&
      request.expected_revision === previous.expected_revision,
    "Retry belongs to a stale activity",
  );
  const a = request.trigger;
  const b = previous.trigger;
  requireRule(
    a.kind === "student" && b.kind === "student"
      ? a.action.purpose === b.action.purpose && a.action.text === b.action.text
      : a.kind === "controller" &&
          b.kind === "controller" &&
          a.evaluation_id === b.evaluation_id &&
          a.allowed_intent === b.allowed_intent,
    "Retry changes the original request",
  );
}
// Trusted service/controller findings, NOT fields accepted from the model or browser.
export type DialogueReview = {
  grounding: "supported" | "unsupported" | "uncertain";
  disclosure: "safe_scaffolding" | "private_guidance" | "uncertain";
  permitted_by_controller: boolean;
};
export function validateGeneratedDialogue(
  content: ApprovedContent,
  scope: DialogueScope,
  request: DialogueRequest,
  input: unknown,
  review: DialogueReview,
): GeneratedDialogue {
  DialogueRequestSchema.parse(request);
  const candidate = GeneratedDialogueSchema.parse(input);
  requireRule(
    review.grounding === "supported" &&
      review.disclosure === "safe_scaffolding" &&
      review.permitted_by_controller,
    "Content has not passed server grounding, disclosure and controller review",
  );
  const source = candidate.kind === "question" ? candidate.question : candidate;
  validateContentRef(content, source.content_ref);
  requireRule(
    same(source.content_ref, request.lesson.content_ref),
    "Mismatched lesson source version",
  );
  requireRule(
    source.concept_ids.every(
      (id) => scope.concept_ids.has(id) && content.concept_ids.has(id),
    ),
    "Concept outside authorized scope",
  );
  requireRule(
    source.source_passage_ids.every(
      (id) => scope.passage_ids.has(id) && content.passage_ids.has(id),
    ),
    "Passage outside authorized scope",
  );
  if (candidate.kind === "question") {
    validateQuestionSnapshot(content, candidate.question);
    requireRule(
      candidate.question.question_id === candidate.content_id,
      "Generated question identity must equal content identity",
    );
    requireRule(
      request.trigger.kind === "controller" &&
        request.trigger.allowed_intent === candidate.intent,
      "An ask cannot authorize an assessed question",
    );
    requireRule(
      candidate.target_misconception_ids.every(
        (id) =>
          scope.misconception_ids.has(id) &&
          content.misconception_concepts.has(id) &&
          (content.misconception_concepts.get(id) === null ||
            source.concept_ids.some(
              (concept) => content.misconception_concepts.get(id) === concept,
            )),
      ),
      "Unknown or unrelated misconception",
    );
    requireRule(
      candidate.question.embedded_scaffolding.every((item) =>
        item.concept_ids.every((id) => source.concept_ids.includes(id)),
      ),
      "Scaffolding outside assessed concepts",
    );
  } else {
    requireRule(
      request.trigger.kind === "student" ||
        request.trigger.allowed_intent === "explanation",
      "Controller requested a question, not an explanation",
    );
  }
  return candidate;
}

function assertCurrentRequest(request: DialogueRequest, state: DialogueState) {
  requireRule(
    state.enabled &&
      request.expected_revision === state.revision &&
      same(request.lesson, state.lesson) &&
      state.active_request_id === request.request_id,
    "Stale or cancelled dialogue request",
  );
}

const successors: Record<DialogueEvent["outcome"], DialogueEvent["outcome"][]> =
  {
    requested: ["generated", "rejected", "failed", "cancelled"],
    generated: ["accepted", "rejected", "failed", "cancelled"],
    accepted: ["displayed", "failed", "cancelled"],
    displayed: [],
    rejected: [],
    failed: [],
    cancelled: [],
  };

/** Validate a delivery history without running the lesson controller. */
export function validateDialogueEvents(
  requestInput: unknown,
  input: unknown,
): DialogueEvent[] {
  const request = DialogueRequestSchema.parse(requestInput);
  const events = z.array(DialogueEventSchema).max(4).parse(input);
  requireRule(
    new Set(events.map((event) => event.event_id)).size === events.length,
    "Duplicate event ID",
  );
  let previous: DialogueEvent | undefined;
  let generated: GeneratedDialogue | undefined;
  let accepted: Extract<DialogueEvent, { outcome: "accepted" }> | undefined;
  for (const event of events) {
    requireRule(
      event.request_id === request.request_id,
      "Event belongs to another request",
    );
    requireRule(
      Date.parse(event.at) >= Date.parse(previous?.at ?? request.requested_at),
      "Event timestamp precedes request/history",
    );
    requireRule(
      previous
        ? successors[previous.outcome].includes(event.outcome)
        : event.outcome === "requested",
      "Invalid dialogue lifecycle transition",
    );
    if (event.outcome === "generated") generated = event.content;
    if (event.outcome === "accepted" || event.outcome === "displayed")
      requireRule(
        event.content_id === generated?.content_id,
        "Event refers to different generated content",
      );
    if (event.outcome === "accepted") {
      requireRule(
        generated?.kind === "question"
          ? event.applied_attempt_id !== null &&
              event.applied_attempt_id !== request.lesson.attempt_id &&
              event.applied_revision === request.expected_revision + 1
          : event.applied_attempt_id === null &&
              event.applied_revision === request.expected_revision,
        "Acceptance must describe the controller's actual question handoff",
      );
      accepted = event;
    }
    if (event.outcome === "displayed")
      requireRule(
        generated?.kind === "question"
          ? event.assessed_attempt_id === accepted?.applied_attempt_id &&
              event.intervention_id === null
          : event.assessed_attempt_id === null &&
              event.intervention_id !== null,
        "Display must reference its assessed attempt or help intervention",
      );
    previous = event;
  }
  return events;
}

/** Acceptance requires separate trusted review; storage must commit this atomically. */
export function appendDialogueEvent(
  request: DialogueRequest,
  history: DialogueEvent[],
  input: unknown,
  state: DialogueState,
  acceptance?: {
    content: ApprovedContent;
    scope: DialogueScope;
    review: DialogueReview;
  },
): DialogueEvent[] {
  const events = validateDialogueEvents(request, history);
  const event = DialogueEventSchema.parse(input);
  const duplicate = events.find((saved) => saved.event_id === event.event_id);
  if (duplicate) {
    requireRule(same(duplicate, event), "Event ID reused with different data");
    return events;
  }
  // Reconnects may generate a different acknowledgement ID for the same display.
  const displayed = events.find((saved) => saved.outcome === "displayed");
  if (event.outcome === "displayed" && displayed?.outcome === "displayed") {
    requireRule(
      event.request_id === displayed.request_id &&
        event.content_id === displayed.content_id &&
        event.intervention_id === displayed.intervention_id &&
        event.assessed_attempt_id === displayed.assessed_attempt_id,
      "Conflicting display acknowledgement",
    );
    return events;
  }
  DialogueStateSchema.parse(state);
  const accepted = events.find((saved) => saved.outcome === "accepted");
  if (
    event.outcome === "displayed" &&
    accepted?.outcome === "accepted" &&
    accepted.applied_attempt_id
  ) {
    requireRule(
      state.enabled &&
        state.revision === accepted.applied_revision &&
        state.active_request_id === request.request_id &&
        state.lesson.session_id === request.session_id &&
        state.lesson.assignment_id === request.lesson.assignment_id &&
        state.lesson.root_attempt_id === request.lesson.root_attempt_id &&
        state.lesson.attempt_id === accepted.applied_attempt_id &&
        state.lesson.sequence_index === request.lesson.sequence_index + 1 &&
        same(state.lesson.content_ref, request.lesson.content_ref),
      "Stale generated activity display",
    );
  } else if (!["cancelled", "failed", "rejected"].includes(event.outcome))
    assertCurrentRequest(request, state);
  else
    requireRule(
      request.session_id === state.lesson.session_id &&
        request.lesson.assignment_id === state.lesson.assignment_id,
      "Terminal event belongs to another session",
    );
  const next = validateDialogueEvents(request, [...events, event]);
  if (event.outcome === "accepted") {
    requireRule(
      acceptance !== undefined,
      "Acceptance requires trusted server review",
    );
    const generated = events.find((item) => item.outcome === "generated");
    requireRule(
      generated?.outcome === "generated",
      "No generated content to accept",
    );
    validateGeneratedDialogue(
      acceptance.content,
      acceptance.scope,
      request,
      generated.content,
      acceptance.review,
    );
    if (generated.content.kind === "question")
      requireRule(
        state.progress.phase === "evaluate",
        "Only the controller can replace an evaluated activity",
      );
  }
  return next;
}

/** No raw generated/rejected output, rubric, hypotheses, or provider details leave here. */
export function toStudentDialogueContent(
  request: DialogueRequest,
  history: DialogueEvent[],
) {
  const events = validateDialogueEvents(request, history);
  const last = events.at(-1);
  if (last?.outcome !== "accepted" && last?.outcome !== "displayed")
    return null;
  const generated = events.find((event) => event.outcome === "generated");
  requireRule(
    generated?.outcome === "generated",
    "Accepted content is missing",
  );
  const content = generated.content;
  if (content.kind === "help")
    return StudentDialogueContentSchema.parse({
      kind: "help",
      content_id: content.content_id,
      text: content.text,
      concept_ids: content.concept_ids,
      source_passage_ids: content.source_passage_ids,
      content_ref: content.content_ref,
    });
  const question = content.question;
  return StudentDialogueContentSchema.parse({
    kind: "question",
    content_id: content.content_id,
    question: {
      question_id: question.question_id,
      prompt_text: question.prompt_text,
      concept_ids: question.concept_ids,
      source_passage_ids: question.source_passage_ids,
      content_ref: question.content_ref,
    },
  });
}

/** #75 links this record to its request. Existing assistance rules consume it unchanged. */
export function dialogueIntervention(
  request: DialogueRequest,
  history: DialogueEvent[],
  interventionId: string,
): Intervention {
  const events = validateDialogueEvents(request, history);
  const accepted = events.find((event) => event.outcome === "accepted");
  const generated = events.find((event) => event.outcome === "generated");
  const last = events.at(-1);
  requireRule(
    accepted?.outcome === "accepted" &&
      generated?.outcome === "generated" &&
      (last?.outcome === "accepted" || last?.outcome === "displayed"),
    "Only accepted/displayed content can become assistance",
  );
  // Generated questions become attempts through the controller, not help on an old attempt.
  requireRule(
    generated.content.kind === "help",
    "Use the controller's assessed-question handoff",
  );
  if (last.outcome === "displayed")
    requireRule(
      last.intervention_id === interventionId,
      "Wrong displayed intervention",
    );
  const help = generated.content;
  return InterventionSchema.parse({
    id: interventionId,
    session_id: request.session_id,
    related_attempt_id: request.lesson.attempt_id,
    related_evaluation_id:
      request.trigger.kind === "controller"
        ? request.trigger.evaluation_id
        : null,
    type: help.assistance_type,
    text_shown: help.text,
    concept_ids: help.concept_ids,
    source_passage_ids: help.source_passage_ids,
    content_ref: help.content_ref,
    created_at: accepted.at,
    visible_at: last.outcome === "displayed" ? last.at : null,
    delivery_status: last.outcome === "displayed" ? "displayed" : "created",
  });
}
