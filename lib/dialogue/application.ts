import { evaluateSubmittedAttempt } from "../evaluation/evaluate.ts";
import { applyTutoring, tutorView } from "../tutoring/store.ts";
import { TutorStepSchema } from "../tutoring/contracts.ts";
import { reserveControllerOperation } from "./controller-store.ts";
import "server-only";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { ConversationActionSchema } from "./conversation.ts";
import { DIALOGUE_LIMITS, type DialogueRequest } from "./contracts.ts";
import {
  InstructionalStrategySchema,
  type DialogueModelContext,
} from "./generation.ts";
import {
  configuredDialogueModel,
  requestStructuredProposal,
} from "./model-provider.ts";
import {
  conflict,
  dialogueContext,
  withDialogueOperation,
  type DialogueContext,
} from "./persistence.ts";
import { createReservedCall } from "./provider-store.ts";
import { createOrchestrationPersistence } from "./orchestration-store.ts";
import {
  actConversation,
  commitConversationIntent,
  failConversationOperation,
  loadConversation,
  projectConversation,
  reserveConversationOperation,
} from "./store.ts";
import {
  classifyIntent,
  generateDialogue,
  type DialogueServices,
} from "./service.ts";
import {
  runtimeGenerationEnabled,
  INSTALLED_RUNTIME_TOOLS,
} from "./runtime-policy.ts";
import { createProposalService } from "../tutoring/orchestration/provider.ts";
import { runTutorOrchestration } from "../tutoring/orchestration/run.ts";
import { OrchestrationError } from "../tutoring/orchestration/errors.ts";
import type { OrchestrationPorts } from "../tutoring/orchestration/contracts.ts";

function boundedQuestions(context: DialogueContext) {
  const questions = context.evidence.attempts
    .map((attempt) => attempt.question)
    .slice(-DIALOGUE_LIMITS.historyMessages);
  while (
    questions.reduce(
      (total, question) => total + question.prompt_text.length,
      0,
    ) > DIALOGUE_LIMITS.historyCharacters
  )
    questions.shift();
  return questions;
}

function modelContext(
  context: DialogueContext,
  text: string,
): DialogueModelContext {
  const view = projectConversation(context);
  const history: DialogueModelContext["history"] = [];
  for (const message of view.messages) {
    if (
      ["answer", "help"].includes(message.outcome.status) &&
      message.text.length <= DIALOGUE_LIMITS.responseCharacters
    )
      history.push({ role: "student", text: message.text });
    const turn = view.dialogue.turns.find(
      (item) => item.request_id === message.request_id,
    );
    if (turn?.response.status === "displayed")
      history.push({ role: "tutor", text: turn.response.content.text });
  }
  while (
    history.length > DIALOGUE_LIMITS.historyMessages ||
    history.reduce((total, message) => total + message.text.length, 0) >
      DIALOGUE_LIMITS.historyCharacters
  )
    history.shift();
  return {
    content: context.content,
    scope: context.scope,
    lesson: context.lesson,
    revision: context.revision,
    question: context.attempt.question,
    assessment_status: context.attempt.submitted_at
      ? "evaluated"
      : "unanswered",
    text,
    history,
    prior_questions: boundedQuestions(context),
  };
}

/** Shared composition: the same reserved provider/generator serves student help
 * and controller-authorized follow-ups. All side effects stay in existing stores. */
export async function executeInstruction(
  access: EvidenceAccess,
  request: DialogueRequest,
  context: DialogueContext,
) {
  const model = configuredDialogueModel();
  if (!model) throw new EvidenceError(503, "Tutor generation is unavailable.");
  const runReservedCall = createReservedCall(
    access,
    request.session_id,
    request.request_id,
  );
  const services: DialogueServices = { runReservedCall };
  const ports: OrchestrationPorts = {
    ...createOrchestrationPersistence(access, request.session_id, (current) =>
      runtimeGenerationEnabled(current.lesson.assignment_id)
        ? INSTALLED_RUNTIME_TOOLS
        : [],
    ),
    propose: createProposalService({
      model,
      requestStructuredProposal,
      runReservedCall,
    }),
    async generate({
      proposal,
      request: generationRequest,
      context: current,
      signal,
    }) {
      const attempt = current.evidence.attempts.at(-1);
      if (!attempt) throw new OrchestrationError("invalid_context");
      const text =
        generationRequest.trigger.kind === "student"
          ? generationRequest.trigger.action.text
          : attempt.response_text;
      if (!text) throw new OrchestrationError("invalid_context");
      const result = await generateDialogue(
        {
          context: {
            ...modelContext(context, text),
            content: current.content,
            lesson: current.state.lesson,
            revision: current.state.revision,
            question: attempt.question,
            assessment_status:
              generationRequest.trigger.kind === "student"
                ? "unanswered"
                : "evaluated",
            history: current.history,
          },
          request: generationRequest,
          permitted_by_controller: true,
          instructional_strategy: InstructionalStrategySchema.parse({
            action: proposal.action,
            arguments: proposal.arguments,
          }),
          selected_source: {
            concept_ids: proposal.concept_ids,
            source_passage_ids: proposal.source_passage_ids,
          },
        },
        {
          ...services,
          runReservedCall: (step, call) =>
            runReservedCall(step, (reservedSignal) =>
              call(AbortSignal.any([signal, reservedSignal])),
            ),
        },
      );
      if (!result.ok)
        throw new OrchestrationError(
          result.reason === "private_guidance"
            ? "invalid_output"
            : result.reason,
          result.needs_reconciliation,
        );
      return { content: result.value.content, review: result.value.review };
    },
  };
  return runTutorOrchestration(request, ports);
}

/** Authenticated POST only. GET/replay/cancellation never starts paid work. */
export async function actApplicationConversation(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const action = ConversationActionSchema.parse(input);
  conflict(action.session_id === sessionId, "Wrong conversation session.");
  const initial = await transaction((client) =>
    dialogueContext(client, access, sessionId, false),
  );
  if (
    !runtimeGenerationEnabled(initial.lesson.assignment_id) ||
    !configuredDialogueModel()
  )
    return actConversation(access, sessionId, action);

  const reserved = await reserveConversationOperation(access, action);
  if (
    reserved.replay ||
    action.action === "cancel_message" ||
    (action.action === "resolve_intent" && action.choice === "answer")
  )
    return loadConversation(access, sessionId);

  if (action.action === "send_message") {
    const context = await withDialogueOperation(
      access,
      sessionId,
      reserved.request_id,
      async (_client, current, operation) => {
        conflict(operation.message, "Missing original message.");
        return modelContext(current, operation.message.text);
      },
    );
    const classification = await classifyIntent(context, {
      runReservedCall: createReservedCall(
        access,
        sessionId,
        reserved.request_id,
      ),
    });
    if (!classification.ok) {
      if (classification.needs_reconciliation)
        return loadConversation(access, sessionId);
      return failConversationOperation(
        access,
        sessionId,
        reserved.request_id,
        classification.reason === "private_guidance"
          ? "invalid_output"
          : classification.reason,
      );
    }
    await commitConversationIntent(
      access,
      sessionId,
      reserved.request_id,
      classification.value.classification,
      classification.value.review,
    );
  }

  // Classification/resolution may have settled as ambiguity, answer, or fallback.
  const current = await transaction((client) =>
    dialogueContext(client, access, sessionId, false),
  );
  const operation = current.operations.find(
    (item) => item.request_id === reserved.request_id,
  );
  if (operation?.status === "pending" && operation.dialogue_request)
    await executeInstruction(access, operation.dialogue_request, current);
  return loadConversation(access, sessionId);
}

/** An explicit existing Evaluate/Continue action, never a GET/resume side effect. */
export async function continueApplicationTutoring(
  access: EvidenceAccess,
  sessionId: string,
  input: unknown,
) {
  const step = TutorStepSchema.parse(input);
  const run = await evaluateSubmittedAttempt(
    access,
    sessionId,
    step.attempt_id,
    step.retry_of,
  );
  if (!run.evaluation)
    throw new EvidenceError(
      503,
      "Your answer is saved. Evaluation is unavailable; please ask your teacher to check the service.",
    );
  if (
    run.evaluation.validation_status !== "accepted" ||
    run.evaluation.applied_result
  )
    return tutorView(access, sessionId);

  const context = await transaction((client) =>
    dialogueContext(client, access, sessionId, false),
  );
  const existing = context.operations.find(
    (operation) =>
      operation.payload.action === "controller_action" &&
      operation.payload.evaluation_id === run.evaluation?.id,
  );
  if (context.unresolved_provider_calls || existing?.status === "pending")
    throw new EvidenceError(
      409,
      "Your answer is saved. The instructional request is awaiting reconciliation; refreshing will not repeat it.",
    );
  if (existing?.status === "resolved") return tutorView(access, sessionId);
  if (
    existing?.status === "fallback" ||
    !runtimeGenerationEnabled(context.lesson.assignment_id) ||
    !configuredDialogueModel() ||
    context.turns_used >= DIALOGUE_LIMITS.turnsPerSession ||
    context.provider_requests_used >= DIALOGUE_LIMITS.providerRequestsPerSession
  )
    return applyTutoring(access, sessionId, run.evaluation.id);

  const reserved = await reserveControllerOperation(
    access,
    sessionId,
    run.evaluation.id,
  );
  if (reserved.replay) return tutorView(access, sessionId);
  const receipt = await executeInstruction(access, reserved.request, context);
  if (receipt.status === "stopped") {
    if (receipt.reconcile)
      throw new EvidenceError(
        409,
        "Your answer is saved. The instructional request is awaiting reconciliation; no new model call was started.",
      );
    return applyTutoring(access, sessionId, run.evaluation.id);
  }
  return tutorView(access, sessionId);
}
