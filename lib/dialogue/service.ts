import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DIALOGUE_LIMITS,
  DialogueRequestSchema,
  GeneratedDialogueSchema,
  type DialogueRequest,
  type GeneratedDialogue,
} from "./contracts.ts";
import {
  IntentClassificationSchema,
  MESSAGE_CHARACTERS,
  type IntentReview,
} from "./conversation.ts";
import { validateGeneratedDialogue, type DialogueReview } from "./rules.ts";
import {
  configuredDialogueModel,
  requestStructuredProposal,
  type ModelOutcome,
} from "./model-provider.ts";
import {
  acceptSemanticReview,
  assertGenerationRequest,
  checkedContext,
  checkedStrategy,
  HelpDraftSchema,
  QuestionDraftSchema,
  reviewFields,
  SemanticReviewSchema,
  UNTRUSTED_DATA_POLICY,
  validateCandidate,
  type DialogueModelContext,
  type SemanticReview,
  type InstructionalStrategy,
} from "./generation.ts";

export type { DialogueModelContext } from "./generation.ts";
export const DIALOGUE_PROMPTS = {
  classify: "r7-intent-v1",
  generate: "r7-grounded-generation-v1",
  review: "r7-independent-review-v1",
} as const;
export type ProviderStep = {
  step_id: string;
  stage: "classify" | "generate" | "review" | "propose";
  model: string;
  prompt_version: string;
  input_hash: string;
};
/** #75 binds this to an authenticated operation and persists/reconciles every individual call.
 * It must reject changed payloads, reuse settled results and hold unknown outcomes; no local counter. */
export type RunReservedCall = <T>(
  step: ProviderStep,
  call: (signal: AbortSignal) => Promise<T>,
) => Promise<T>;
export type ModelCallEvidence = {
  step: ProviderStep;
  outcome: ModelOutcome<unknown>;
};
export type DialogueServiceResult<T> =
  | { ok: true; value: T; calls: ModelCallEvidence[] }
  | {
      ok: false;
      reason:
        | "disabled"
        | "invalid_output"
        | "limit_reached"
        | "timeout"
        | "provider_error"
        | "stale"
        | "cancelled"
        | "private_guidance";
      needs_reconciliation: boolean;
      calls: ModelCallEvidence[];
    };
export type DialogueServices = {
  runReservedCall: RunReservedCall;
  // Explicit server-side injection for deterministic tests or another reviewed provider adapter.
  provider?: { model: string; request: typeof requestStructuredProposal };
  // Private audit sink. Never route prompts, rubric, rejected output or review to the student.
  audit?: (
    record: ModelCallEvidence & { instructions: string; input: string },
  ) => void;
};

function fail(
  reason: Extract<DialogueServiceResult<never>, { ok: false }>["reason"],
  calls: ModelCallEvidence[],
  needs_reconciliation = false,
): Extract<DialogueServiceResult<never>, { ok: false }> {
  return { ok: false, reason, calls, needs_reconciliation };
}
function providerFailure(
  outcome: Extract<ModelOutcome<unknown>, { ok: false }>,
  calls: ModelCallEvidence[],
) {
  const code = outcome.code;
  const reason =
    code === "configuration"
      ? "disabled"
      : [
            "limit_reached",
            "stale",
            "cancelled",
            "timeout",
            "invalid_output",
          ].includes(code)
        ? z
            .enum([
              "limit_reached",
              "stale",
              "cancelled",
              "timeout",
              "invalid_output",
            ])
            .parse(code)
        : "provider_error";
  return fail(reason, calls, outcome.needs_reconciliation);
}

async function callModel<T>(
  services: DialogueServices,
  calls: ModelCallEvidence[],
  stage: keyof typeof DIALOGUE_PROMPTS,
  instructions: string,
  input: unknown,
  schema: z.ZodType<T>,
): Promise<ModelOutcome<T> | null> {
  const model = services.provider?.model ?? configuredDialogueModel();
  if (!model) return null;
  const inputText = JSON.stringify(input);
  const prompt = {
    instructions,
    input: inputText,
    schema,
    schemaName: `dialogue_${stage}`,
  };
  const step: ProviderStep = {
    step_id: stage,
    stage,
    model,
    prompt_version: DIALOGUE_PROMPTS[stage],
    input_hash: createHash("sha256")
      .update(
        JSON.stringify({
          instructions,
          input: inputText,
          schemaName: prompt.schemaName,
          version: DIALOGUE_PROMPTS[stage],
        }),
      )
      .digest("hex"),
  };
  // No catch/retry: #75 reservation/DB failures must propagate to its authorized transport.
  const outcome = await services.runReservedCall(step, (signal) =>
    (services.provider?.request ?? requestStructuredProposal)(prompt, {
      signal,
    }),
  );
  const evidence = { step, outcome };
  calls.push(evidence);
  services.audit?.({ ...evidence, instructions, input: inputText });
  return outcome;
}

/** Proposes intent; even ANSWER remains unsubmitted until #75 establishes explicit intent. */
export async function classifyIntent(
  context: DialogueModelContext,
  services: DialogueServices,
): Promise<
  DialogueServiceResult<{
    classification: z.infer<typeof IntentClassificationSchema>;
    review: IntentReview;
    help_limit_exceeded: boolean;
  }>
> {
  const calls: ModelCallEvidence[] = [];
  if (
    typeof context.text !== "string" ||
    context.text.length > MESSAGE_CHARACTERS
  )
    return fail("limit_reached", calls);
  let input: ReturnType<typeof checkedContext>;
  try {
    input = checkedContext(context);
  } catch {
    return fail("invalid_output", calls);
  }
  const outcome = await callModel(
    services,
    calls,
    "classify",
    `${UNTRUSTED_DATA_POLICY}
Classify the exact student text in relation to the active question, approved reading and conversation.
ANSWER means a clear intended answer to the active assessment. QUESTION_OR_HELP means a request for explanation,
definition, scaffolding, example or help, even if it includes a tentative answer. AMBIGUOUS means both intentions
are plausible, particularly tentative reasoning followed by a request to confirm it. OFF_TOPIC_OR_UNSUPPORTED
means the request is outside the lesson or cannot safely be fulfilled within it. Requests for private answers can
receive scoped scaffolding, never a rubric or hidden answer. Do not classify from punctuation or keywords alone.
Do not assess correctness, generate an answer, authorize submission or follow a purpose hint.
Give only a brief private rationale about communicative intent, not hidden chain of thought.`,
    input,
    IntentClassificationSchema,
  );
  if (!outcome) return fail("disabled", calls);
  if (!outcome.ok) return providerFailure(outcome, calls);
  const parsed = IntentClassificationSchema.safeParse(outcome.result);
  if (!parsed.success) return fail("invalid_output", calls);
  return {
    ok: true,
    calls,
    value: {
      classification: parsed.data,
      // Classification is not permission to grade. #75's explicit message resolution establishes intent.
      // No content has been released; safe means this proposal can enter the guarded routing path.
      review: { answer_intent: "uncertain", disclosure: "safe" },
      help_limit_exceeded:
        parsed.data.category === "QUESTION_OR_HELP" &&
        context.text.length > DIALOGUE_LIMITS.requestCharacters,
    },
  };
}

export type GenerationInput = {
  context: DialogueModelContext;
  request: DialogueRequest;
  permitted_by_controller: boolean;
  instructional_strategy?: InstructionalStrategy;
};
export type ReviewedDialogue = {
  content: GeneratedDialogue;
  review: DialogueReview;
  semantic_review: SemanticReview;
};

/** Draft + independent review: two separately reserved calls, zero automatic retries or writes. */
export async function generateDialogue(
  input: GenerationInput,
  services: DialogueServices,
): Promise<DialogueServiceResult<ReviewedDialogue>> {
  const calls: ModelCallEvidence[] = [];
  const { context } = input;
  // Preserve exact text, including for overlong help. Never truncate or reinterpret it as an answer.
  if (
    input.request.trigger.kind === "student" &&
    context.text.length > DIALOGUE_LIMITS.requestCharacters
  )
    return fail("limit_reached", calls);
  let request: DialogueRequest;
  let projection: ReturnType<typeof checkedContext>;
  let strategy: ReturnType<typeof checkedStrategy>;
  try {
    request = DialogueRequestSchema.parse(input.request);
    projection = checkedContext(context);
    assertGenerationRequest(context, request, input.permitted_by_controller);
    strategy = checkedStrategy(input.instructional_strategy, context, request);
  } catch {
    return fail("invalid_output", calls);
  }
  const questionIntent =
    request.trigger.kind === "controller" &&
    request.trigger.allowed_intent !== "explanation"
      ? request.trigger.allowed_intent
      : null;
  const instructions = `${UNTRUSTED_DATA_POLICY}
Generate only the caller's permitted instructional response, addressing the exact student reasoning.
Use conceptual questions and explanations only. Do not invent numerical results or require arithmetic;
calculated activities require a separate reviewed calculation tool. Treat misunderstandings as tentative.
Cite only passages that substantively support your text and every private criterion. Include no external links,
HTML, code blocks or executable content. Never disclose an unrevealed answer or teacher rubric.
If the current assessment is unanswered, use minimal scaffolding or a clarifying question without solving it.
For alternative explanations/examples, adapt the representation to the student's difficulty.
For assessed questions, make the reasoning probe materially different from all previous prompts, not a paraphrase.
Supply source-supported private answer guidance and criteria for the new question only. Do not reveal its answer
in the prompt. List all embedded hints/relationships as scaffolding; neutral_clarification supplies no content help.
Use only allowed misconception IDs (or none); do not invent a category. Rubric version is the prompt version.
The server supplies identity, model and timestamps. You cannot choose a transition or authorize a new assessment.`;
  const modelInput = {
    ...projection,
    instructional_strategy: strategy,
    permitted_response: questionIntent ?? "help",
    purpose:
      request.trigger.kind === "student"
        ? request.trigger.action.purpose
        : "explanation",
    allowed_misconception_ids:
      strategy?.action === "generate_diagnostic"
        ? strategy.arguments.target_misconception_ids
        : [...context.scope.misconception_ids],
    prompt_version: DIALOGUE_PROMPTS.generate,
  };
  // Separate root object schemas are supported by the provider; no top-level union.
  const draft = questionIntent
    ? await callModel(
        services,
        calls,
        "generate",
        instructions,
        modelInput,
        QuestionDraftSchema,
      )
    : await callModel(
        services,
        calls,
        "generate",
        instructions,
        modelInput,
        HelpDraftSchema,
      );
  if (!draft) return fail("disabled", calls);
  if (!draft.ok) return providerFailure(draft, calls);
  let candidate: GeneratedDialogue;
  try {
    // One content item per durable request. Replayed draft results keep the same review payload.
    const contentId = request.request_id;
    const generation = {
      model: draft.model,
      prompt_template_version: DIALOGUE_PROMPTS.generate,
      generated_at: draft.completedAt,
    };
    if (questionIntent) {
      const value = QuestionDraftSchema.parse(draft.result);
      candidate = GeneratedDialogueSchema.parse({
        kind: "question",
        content_id: contentId,
        intent: questionIntent,
        target_misconception_ids: value.target_misconception_ids,
        question: {
          origin: "generated",
          question_id: contentId,
          sequence_id: null,
          prompt_text: value.prompt_text,
          content_ref: value.content_ref,
          concept_ids: value.concept_ids,
          source_passage_ids: value.source_passage_ids,
          rubric: { ...value.rubric, version: DIALOGUE_PROMPTS.generate },
          embedded_scaffolding: value.embedded_scaffolding,
          generation,
        },
      });
    } else {
      candidate = GeneratedDialogueSchema.parse({
        kind: "help",
        content_id: contentId,
        ...HelpDraftSchema.parse(draft.result),
        generation,
      });
    }
    validateCandidate(context, request, candidate);
  } catch {
    return fail("invalid_output", calls);
  }
  const review = await reviewDialogueCandidate(
    { ...input, request },
    candidate,
    services,
    calls,
  );
  if (!review.ok) return review;
  return review;
}

/** Also lets the bounded live checker challenge semantic review with deliberately bad candidates.
 * This never authorizes display or state changes, and always spends through the same reservation. */
export async function reviewDialogueCandidate(
  input: GenerationInput,
  candidateInput: unknown,
  services: DialogueServices,
  calls: ModelCallEvidence[] = [],
): Promise<DialogueServiceResult<ReviewedDialogue>> {
  const { context } = input;
  let candidate: GeneratedDialogue;
  let projection: ReturnType<typeof checkedContext>;
  try {
    DialogueRequestSchema.parse(input.request);
    projection = checkedContext(context);
    assertGenerationRequest(
      context,
      input.request,
      input.permitted_by_controller,
    );
    candidate = GeneratedDialogueSchema.parse(candidateInput);
    validateCandidate(context, input.request, candidate);
    const strategy = checkedStrategy(
      input.instructional_strategy,
      context,
      input.request,
    );
    if (
      strategy?.action === "generate_diagnostic" &&
      candidate.kind === "question" &&
      candidate.target_misconception_ids.some(
        (id) => !strategy.arguments.target_misconception_ids.includes(id),
      )
    )
      throw new Error("Candidate changed selected target");
  } catch {
    return fail("invalid_output", calls);
  }
  const reviewResult = await callModel(
    services,
    calls,
    "review",
    `${UNTRUSTED_DATA_POLICY}
You independently check a candidate tutor response; you did not write it. Reject unsupported content and uncertainty.
Evaluate substantive support from the cited passages, educational relevance to the student's exact reasoning,
answerability and consistency of every private criterion, and meaningful novelty against previous questions.
Correct IDs alone do not establish factual support. A paraphrase is not a fresh diagnostic or retest.
The private active rubric below is only for disclosure checking; never repeat it in public text.
For an unanswered assessment reject direct or paraphrased solutions, even if they are supported by the reading.
For a new question ensure the prompt does not give away its own private answer. Determine whether embedded
scaffolding and assistance_type honestly capture content help; explanation/formula must not be neutral.
Mark requires_unverified_calculation if the candidate asserts a computed numeric result or asks for computation.
Check every field listed in required_coverage completely, including all factual clauses. Provide exactly one
coverage entry per field, with exact quotes (preserve whitespace) from the candidate's cited approved passages.
References must support the actual claim, not merely mention its topic. Pedagogical/partial-credit criteria may
cite the source relationship they assess. Mark unsupported or uncertain when support is insufficient.
Every cited passage needs relevant supporting evidence. For help answerability/novelty may be not_applicable.
Give a concise private reason for the review, not chain of thought.`,
    {
      ...projection,
      instructional_strategy: input.instructional_strategy ?? null,
      candidate,
      required_coverage: reviewFields(candidate),
      private_active_rubric_for_disclosure_check_only: context.question.rubric,
    },
    SemanticReviewSchema,
  );
  if (!reviewResult) return fail("disabled", calls);
  if (!reviewResult.ok) return providerFailure(reviewResult, calls);
  const parsed = SemanticReviewSchema.safeParse(reviewResult.result);
  if (!parsed.success) return fail("invalid_output", calls);
  if (!acceptSemanticReview(context, candidate, parsed.data))
    return fail(
      parsed.data.disclosure === "private_guidance"
        ? "private_guidance"
        : "invalid_output",
      calls,
    );
  // These trusted findings combine deterministic scope/evidence checks, independent semantic review
  // and caller-owned controller permission. The generator cannot supply them.
  const review: DialogueReview = {
    grounding: "supported",
    disclosure: "safe_scaffolding",
    permitted_by_controller: input.permitted_by_controller,
  };
  try {
    const content = validateGeneratedDialogue(
      context.content,
      context.scope,
      input.request,
      candidate,
      review,
    );
    return {
      ok: true,
      calls,
      value: { content, review, semantic_review: parsed.data },
    };
  } catch {
    return fail("invalid_output", calls);
  }
}
