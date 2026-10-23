import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import {
  DIALOGUE_LIMITS,
  GeneratedDialogueSchema,
  type DialogueRequest,
  type GeneratedDialogue,
} from "../lib/dialogue/contracts.ts";
import { MESSAGE_CHARACTERS } from "../lib/dialogue/conversation.ts";
import {
  reviewFields,
  type SemanticReview,
} from "../lib/dialogue/generation.ts";
import type {
  ModelOutcome,
  requestStructuredProposal,
} from "../lib/dialogue/model-provider.ts";
import {
  classifyIntent,
  generateDialogue,
  reviewDialogueCandidate,
  type DialogueModelContext,
  type DialogueServices,
  type GenerationInput,
  type ProviderStep,
  type RunReservedCall,
} from "../lib/dialogue/service.ts";

const content = loadApprovedContent();
const f = makeDialogueExamples(content);
const completedAt = "2026-10-22T20:00:00.000Z";
const model = "deterministic-test-provider";

function context(
  overrides: Partial<DialogueModelContext> = {},
): DialogueModelContext {
  return {
    content,
    scope: f.scope,
    lesson: f.state.lesson,
    revision: f.state.revision,
    question: f.curatedQuestion,
    assessment_status: "unanswered",
    text: f.asks.question.text,
    history: [],
    prior_questions: [],
    ...overrides,
  };
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    context: context(),
    request: f.studentRequest,
    permitted_by_controller: true,
    ...overrides,
  };
}

function helpDraft() {
  assert.equal(f.help.kind, "help");
  if (f.help.kind !== "help") throw new Error("Expected help fixture");
  return {
    text: f.help.text,
    assistance_type: f.help.assistance_type,
    content_ref: f.help.content_ref,
    concept_ids: f.help.concept_ids,
    source_passage_ids: f.help.source_passage_ids,
  };
}

function questionDraft() {
  const candidate = f.diagnostics.distance;
  assert.equal(candidate.kind, "question");
  if (candidate.kind !== "question")
    throw new Error("Expected question fixture");
  return {
    prompt_text: candidate.question.prompt_text,
    content_ref: candidate.question.content_ref,
    concept_ids: candidate.question.concept_ids,
    source_passage_ids: candidate.question.source_passage_ids,
    rubric: candidate.question.rubric,
    embedded_scaffolding: candidate.question.embedded_scaffolding,
    target_misconception_ids: candidate.target_misconception_ids,
  };
}

// This models reviewed evidence for deterministic rejection tests, not a claim
// that these fixtures establish real semantic grounding or live AI behavior.
function acceptedReview(candidate: GeneratedDialogue): SemanticReview {
  const source = candidate.kind === "help" ? candidate : candidate.question;
  return {
    grounding: "supported",
    disclosure: "safe_scaffolding",
    relevance: "relevant",
    answerability: candidate.kind === "help" ? "not_applicable" : "answerable",
    novelty:
      candidate.kind === "help" ? "not_applicable" : "meaningfully_different",
    assistance: "accurate",
    requires_unverified_calculation: false,
    coverage: reviewFields(candidate).map(({ field }) => ({
      field,
      support: "supported",
      sources: source.source_passage_ids.map((passage_id) => {
        const passage = content.passages.get(passage_id);
        assert.ok(passage);
        return { passage_id, quote: passage.text.slice(0, 120) };
      }),
    })),
    reason: "Deterministic review fixture.",
  };
}

type Prompt = Parameters<typeof requestStructuredProposal>[0];
type Reply = unknown | ((prompt: Prompt) => unknown);
function harness(replies: Reply[], overrideReservation?: RunReservedCall) {
  const prompts: Prompt[] = [];
  const reservations: ProviderStep[] = [];
  const signals: AbortSignal[] = [];
  const request: typeof requestStructuredProposal = async <T>(
    prompt: Parameters<typeof requestStructuredProposal<T>>[0],
    options: Parameters<typeof requestStructuredProposal<T>>[1] = {},
  ): Promise<ModelOutcome<T>> => {
    prompts.push(prompt);
    assert.ok(
      options.signal,
      "The reservation cancellation signal reaches the provider",
    );
    signals.push(options.signal);
    assert.ok(replies.length, "Unexpected provider call or automatic retry");
    const reply = replies.shift();
    const result: unknown = typeof reply === "function" ? reply(prompt) : reply;
    return {
      ok: true,
      // Deliberately bypass the adapter's type contract so these tests verify
      // the service also rejects malformed or adversarial provider results.
      result: result as T,
      model,
      responseId: `fixture-response-${prompts.length}`,
      latencyMs: 1,
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      needs_reconciliation: false,
      completedAt,
    };
  };
  const runReservedCall: RunReservedCall = async (step, call) => {
    reservations.push(step);
    if (overrideReservation) return overrideReservation(step, call);
    return call(new AbortController().signal);
  };
  const services: DialogueServices = {
    provider: { model, request },
    runReservedCall,
  };
  return { services, prompts, reservations, signals };
}

function reviewReply(mutate?: (review: SemanticReview) => SemanticReview) {
  return (prompt: Prompt) => {
    const { candidate } = z
      .object({ candidate: GeneratedDialogueSchema })
      .parse(JSON.parse(prompt.input));
    const review = acceptedReview(candidate);
    return mutate ? mutate(review) : review;
  };
}

test("contextual classification preserves exact student text and remains a proposal, including ANSWER", async () => {
  const messages = [
    [
      "ANSWER",
      "  Transmission depends on packet size and rate.\nThat is my answer.  ",
    ],
    ["QUESTION_OR_HELP", "Explain what packet size means"],
    [
      "AMBIGUOUS",
      "I think the longer cable takes more time; is that my answer?",
    ],
    ["OFF_TOPIC_OR_UNSUPPORTED", "What movie should I watch tonight?"],
  ] as const;
  for (const [category, text] of messages) {
    const h = harness([
      { category, rationale: "Intent from the active question and message." },
    ]);
    const before = context({
      text,
      history: [{ role: "tutor", text: "Explain your reasoning." }],
    });
    const snapshot = structuredClone(before);
    const result = await classifyIntent(before, h.services);
    assert.ok(result.ok);
    assert.equal(result.value.classification.category, category);
    assert.equal(result.value.review.answer_intent, "uncertain");
    assert.equal("answer" in result.value, false);
    const sent = z
      .object({
        student_text: z.string(),
        active_question: z.object({ prompt_text: z.string() }),
        passages: z.array(z.object({ id: z.string(), text: z.string() })),
        history: z.array(z.object({ role: z.string(), text: z.string() })),
      })
      .parse(JSON.parse(h.prompts[0].input));
    assert.equal(sent.student_text, text);
    assert.equal(
      sent.active_question.prompt_text,
      f.curatedQuestion.prompt_text,
    );
    assert.deepEqual(sent.history, before.history);
    assert.deepEqual(
      sent.passages.map((p) => p.id),
      [...f.scope.passage_ids],
    );
    assert.equal(h.prompts[0].input.includes('"rubric"'), false);
    assert.equal(h.prompts[0].input.includes('"answer_guidance"'), false);
    assert.deepEqual(before, snapshot);
    assert.deepEqual(
      h.reservations.map((step) => step.stage),
      ["classify"],
    );
  }
});

test("classification accepts 12000 characters but overlong help cannot enter generation or be truncated", async () => {
  const text = "x".repeat(MESSAGE_CHARACTERS);
  const h = harness([
    { category: "QUESTION_OR_HELP", rationale: "A long help request." },
  ]);
  const result = await classifyIntent(context({ text }), h.services);
  assert.ok(result.ok);
  assert.equal(result.value.help_limit_exceeded, true);
  assert.equal(JSON.parse(h.prompts[0].input).student_text, text);
  const generation = await generateDialogue(
    input({ context: context({ text }) }),
    h.services,
  );
  assert.equal(generation.ok, false);
  if (!generation.ok) assert.equal(generation.reason, "limit_reached");
  const tooLong = await classifyIntent(
    context({ text: text + "x" }),
    h.services,
  );
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.reason, "limit_reached");
  assert.equal(h.prompts.length, 1);
});

test("help uses its own 2000-character limit and rejects inconsistent original messages", async () => {
  const text = "x".repeat(DIALOGUE_LIMITS.requestCharacters);
  assert.equal(f.studentRequest.trigger.kind, "student");
  if (f.studentRequest.trigger.kind !== "student")
    throw new Error("Expected student request");
  const request: DialogueRequest = {
    ...f.studentRequest,
    trigger: {
      kind: "student",
      action: { ...f.studentRequest.trigger.action, text },
    },
  };
  const h = harness([helpDraft(), reviewReply()]);
  assert.equal(
    (
      await generateDialogue(
        input({ context: context({ text }), request }),
        h.services,
      )
    ).ok,
    true,
  );
  const unused = harness([]);
  const mismatch = await generateDialogue(
    input({ context: context({ text: "A different message" }) }),
    unused.services,
  );
  assert.equal(mismatch.ok, false);
  assert.equal(unused.reservations.length, 0);
});

test("malformed classifier output cannot introduce an action or bypass intent categories", async () => {
  for (const output of [
    { category: "GRADE_NOW", rationale: "Do it" },
    { category: "ANSWER", rationale: "Intent", authorized: true },
    { category: "ANSWER", rationale: "" },
    null,
  ]) {
    const h = harness([output]);
    const result = await classifyIntent(context(), h.services);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.equal(h.prompts.length, 1);
  }
});

test("grounded help uses separate generation and review reservations and only review sees the private rubric", async () => {
  const h = harness([helpDraft(), reviewReply()]);
  const result = await generateDialogue(input(), h.services);
  assert.ok(result.ok);
  assert.equal(result.value.content.kind, "help");
  assert.deepEqual(result.value.review, {
    grounding: "supported",
    disclosure: "safe_scaffolding",
    permitted_by_controller: true,
  });
  assert.deepEqual(
    h.reservations.map((step) => step.stage),
    ["generate", "review"],
  );
  assert.equal(new Set(h.reservations.map((step) => step.step_id)).size, 2);
  assert.notEqual(h.reservations[0].input_hash, h.reservations[1].input_hash);
  for (const step of h.reservations) {
    assert.equal(step.model, model);
    assert.match(step.input_hash, /^[a-f0-9]{64}$/);
  }
  assert.equal(h.prompts[0].input.includes('"rubric"'), false);
  assert.deepEqual(
    JSON.parse(h.prompts[1].input)
      .private_active_rubric_for_disclosure_check_only,
    f.curatedQuestion.rubric,
  );
  assert.equal(result.calls.length, 2);
  assert.equal(f.unansweredAttempt.response_text, null);
});

test("replaying stored generation preserves content identity, provenance and the review reservation payload", async () => {
  const saved = new Map<string, { step: ProviderStep; value: unknown }>();
  const replay: RunReservedCall = async <T>(
    step: ProviderStep,
    call: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    const previous = saved.get(step.step_id);
    if (previous) {
      assert.deepEqual(
        step,
        previous.step,
        "A replay must keep the complete reserved payload unchanged",
      );
      // This fake returns the exact typed callback value saved under the same
      // stage and payload; durable serialization and ownership belong to #75.
      return previous.value as T;
    }
    const value = await call(new AbortController().signal);
    saved.set(step.step_id, { step, value });
    return value;
  };
  const h = harness([helpDraft(), reviewReply()], replay);
  const first = await generateDialogue(input(), h.services);
  const repeated = await generateDialogue(input(), h.services);
  assert.ok(first.ok);
  assert.ok(repeated.ok);
  assert.deepEqual(repeated.value, first.value);
  assert.deepEqual(repeated.calls[0].outcome, first.calls[0].outcome);
  assert.equal(
    repeated.calls[1].step.input_hash,
    first.calls[1].step.input_hash,
  );
  assert.equal(first.value.content.content_id, f.studentRequest.request_id);
  assert.equal(first.value.content.kind, "help");
  if (first.value.content.kind !== "help") throw new Error("Expected help");
  assert.equal(first.value.content.generation.generated_at, completedAt);
  assert.equal(
    h.prompts.length,
    2,
    "Both settled reservations replay without additional provider calls",
  );
  assert.equal(h.reservations.length, 4);
});

test("the permitted explanation strategy reaches both generation and independent review", async () => {
  const instructional_strategy = {
    action: "explain",
    arguments: { style: "alternative_explanation" },
  } as const;
  const h = harness([helpDraft(), reviewReply()]);
  const result = await generateDialogue(
    input({ instructional_strategy }),
    h.services,
  );
  assert.ok(result.ok);
  assert.equal(h.prompts.length, 2);
  for (const prompt of h.prompts) {
    assert.deepEqual(
      JSON.parse(prompt.input).instructional_strategy,
      instructional_strategy,
    );
  }
});

test("a selected transmission diagnostic preserves the full joint-question context in both prompts", async () => {
  const selected_source = {
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P07", "P08"],
  };
  assert.deepEqual(f.curatedQuestion.concept_ids, [
    "transmission_delay",
    "propagation_delay",
  ]);
  const h = harness([
    { ...questionDraft(), source_passage_ids: ["P07"] },
    reviewReply(),
  ]);
  const result = await generateDialogue(
    input({
      context: context({ assessment_status: "evaluated" }),
      request: f.controllerRequests.distance,
      selected_source,
    }),
    h.services,
  );
  assert.ok(result.ok);
  assert.equal(result.value.content.kind, "question");
  if (result.value.content.kind !== "question")
    throw new Error("Expected diagnostic");
  assert.deepEqual(
    result.value.content.question.concept_ids,
    selected_source.concept_ids,
  );
  assert.deepEqual(result.value.content.question.source_passage_ids, ["P07"]);
  assert.equal(h.prompts.length, 2);
  for (const prompt of h.prompts) {
    const sent = z
      .object({
        selected_source: z.object({
          concept_ids: z.array(z.string()),
          source_passage_ids: z.array(z.string()),
        }),
        active_question: z.object({
          concept_ids: z.array(z.string()),
          source_passage_ids: z.array(z.string()),
          prompt_text: z.string(),
        }),
        passages: z.array(z.object({ id: z.string() })),
      })
      .parse(JSON.parse(prompt.input));
    assert.deepEqual(sent.selected_source, selected_source);
    assert.deepEqual(
      sent.active_question.concept_ids,
      f.curatedQuestion.concept_ids,
    );
    assert.deepEqual(
      sent.active_question.source_passage_ids,
      f.curatedQuestion.source_passage_ids,
    );
    assert.equal(
      sent.active_question.prompt_text,
      f.curatedQuestion.prompt_text,
    );
    assert.deepEqual(
      sent.passages.map((passage) => passage.id),
      [...f.scope.passage_ids],
    );
  }
});

test("generated concepts and citations cannot broaden or change the selected source before review", async () => {
  const selected_source = {
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P07"],
  };
  const draft = { ...questionDraft(), source_passage_ids: ["P07"] };
  for (const candidate of [
    { ...draft, concept_ids: ["transmission_delay", "propagation_delay"] },
    {
      ...draft,
      concept_ids: ["propagation_delay"],
      target_misconception_ids: [],
    },
    { ...draft, source_passage_ids: ["P07", "P08"] },
  ]) {
    const h = harness([candidate]);
    const result = await generateDialogue(
      input({
        context: context({ assessment_status: "evaluated" }),
        request: f.controllerRequests.distance,
        selected_source,
      }),
      h.services,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.deepEqual(
      h.reservations.map((step) => step.stage),
      ["generate"],
    );
  }
});

test("source selection outside the authorized concept or passage scope fails before any call", async () => {
  const outsideConcept = [...content.concept_ids].find(
    (id) => !f.scope.concept_ids.has(id),
  );
  const outsidePassage = [...content.passage_ids].find(
    (id) => !f.scope.passage_ids.has(id),
  );
  assert.ok(outsideConcept);
  assert.ok(outsidePassage);
  for (const selected_source of [
    { concept_ids: [outsideConcept], source_passage_ids: ["P07"] },
    {
      concept_ids: ["transmission_delay"],
      source_passage_ids: [outsidePassage],
    },
  ]) {
    const h = harness([]);
    const result = await generateDialogue(
      input({
        context: context({ assessment_status: "evaluated" }),
        request: f.controllerRequests.distance,
        selected_source,
      }),
      h.services,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.equal(h.reservations.length, 0);
    assert.equal(h.prompts.length, 0);
  }
});

test("an instructional strategy incompatible with the permitted response is rejected before spending", async () => {
  for (const attempt of [
    input({
      instructional_strategy: { action: "generate_retest", arguments: {} },
    }),
    input({
      request: f.controllerRequests.distance,
      context: context({ assessment_status: "evaluated" }),
      instructional_strategy: {
        action: "explain",
        arguments: { style: "example" },
      },
    }),
  ]) {
    const h = harness([]);
    const result = await generateDialogue(attempt, h.services);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.equal(h.reservations.length, 0);
    assert.equal(h.prompts.length, 0);
  }
});

test("a valid prior question outside the authorized scope is rejected before any provider reservation", async () => {
  const outside = [...content.questions.values()].find(
    (question) =>
      question.concept_ids.some((id) => !f.scope.concept_ids.has(id)) ||
      question.source_passage_ids.some((id) => !f.scope.passage_ids.has(id)),
  );
  assert.ok(
    outside,
    "The fixture includes an approved question outside this request's scope",
  );
  const invalidContext = context({ prior_questions: [outside] });
  const h = harness([]);
  const classification = await classifyIntent(invalidContext, h.services);
  const generation = await generateDialogue(
    input({ context: invalidContext }),
    h.services,
  );
  for (const result of [classification, generation]) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
  }
  assert.equal(h.reservations.length, 0);
  assert.equal(h.prompts.length, 0);
});

test("generated content rejects malformed, wrong-version, unknown concept and invalid citation drafts before review", async () => {
  const valid = helpDraft();
  for (const draft of [
    { ...valid, text: "" },
    { ...valid, private_answer: "This field is not allowed." },
    {
      ...valid,
      content_ref: {
        ...valid.content_ref,
        content_version: "unapproved-version",
      },
    },
    { ...valid, concept_ids: ["invented_concept"] },
    { ...valid, source_passage_ids: ["UNKNOWN-PASSAGE"] },
    { ...valid, text: "<script>alert('execute')</script>" },
    { ...valid, text: "Use [the answer](https://example.com)." },
  ]) {
    const h = harness([draft]);
    const result = await generateDialogue(input(), h.services);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.equal(h.reservations.length, 1);
  }
});

test("even an existing passage or concept is rejected outside the caller's authorized scope", async () => {
  const outsidePassage = [...content.passage_ids].find(
    (id) => !f.scope.passage_ids.has(id),
  );
  const outsideConcept = [...content.concept_ids].find(
    (id) => !f.scope.concept_ids.has(id),
  );
  assert.ok(outsidePassage);
  assert.ok(outsideConcept);
  for (const draft of [
    { ...helpDraft(), source_passage_ids: [outsidePassage] },
    { ...helpDraft(), concept_ids: [outsideConcept] },
  ]) {
    const h = harness([draft]);
    const result = await generateDialogue(input(), h.services);
    assert.equal(result.ok, false);
    assert.equal(h.reservations.length, 1);
  }
});

test("independent review rejects unsupported claims, irrelevant help, understated assistance and calculations", async () => {
  for (const change of [
    { grounding: "unsupported" },
    { grounding: "uncertain" },
    { relevance: "irrelevant" },
    { assistance: "understated" },
    { requires_unverified_calculation: true },
  ] satisfies Partial<SemanticReview>[]) {
    const h = harness([
      helpDraft(),
      reviewReply((review) => ({ ...review, ...change })),
    ]);
    const result = await generateDialogue(input(), h.services);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
    assert.equal(h.reservations.length, 2);
  }
});

test("semantic coverage requires every field, supported claims and exact quotes from every cited passage", async () => {
  const changes: ((review: SemanticReview) => SemanticReview)[] = [
    (review) => ({ ...review, coverage: [] }),
    (review) => ({
      ...review,
      coverage: [...review.coverage, review.coverage[0]],
    }),
    (review) => ({
      ...review,
      coverage: review.coverage.map((item) => ({
        ...item,
        support: "unsupported",
      })),
    }),
    (review) => ({
      ...review,
      coverage: review.coverage.map((item) => ({
        ...item,
        field: "unreviewed_field",
      })),
    }),
    (review) => ({
      ...review,
      coverage: review.coverage.map((item) => ({
        ...item,
        sources: [
          {
            passage_id: "P07",
            quote: "A fabricated sentence absent from the approved source.",
          },
        ],
      })),
    }),
    (review) => ({
      ...review,
      coverage: review.coverage.map((item) => ({
        ...item,
        sources: item.sources.slice(0, 1),
      })),
    }),
  ];
  for (const change of changes) {
    const h = harness([helpDraft(), reviewReply(change)]);
    const result = await generateDialogue(input(), h.services);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "invalid_output");
  }
});

test("copied private guidance is rejected before review and paraphrased disclosure is rejected by independent review", async () => {
  const copied = harness([
    { ...helpDraft(), text: f.curatedQuestion.rubric.answer_guidance },
  ]);
  assert.equal((await generateDialogue(input(), copied.services)).ok, false);
  assert.equal(copied.reservations.length, 1);
  const paraphrase = harness([
    helpDraft(),
    reviewReply((review) => ({ ...review, disclosure: "private_guidance" })),
  ]);
  const result = await generateDialogue(input(), paraphrase.services);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "private_guidance");
  assert.equal(paraphrase.reservations.length, 2);
});

test("controller generation cannot replace an unanswered question or run without permission", async () => {
  for (const attempt of [
    input({ request: f.controllerRequests.distance }),
    input({ permitted_by_controller: false }),
    input({ context: context({ revision: 1 }) }),
    input({ context: context({ assessment_status: "evaluated" }) }),
  ]) {
    const h = harness([]);
    const result = await generateDialogue(attempt, h.services);
    assert.equal(result.ok, false);
    assert.equal(h.reservations.length, 0);
  }
});

test("diagnostics and permitted retests reuse immutable question snapshots and cover all private criteria", async () => {
  for (const allowed_intent of [
    "diagnostic_followup",
    "immediate_retest",
  ] as const) {
    assert.equal(f.controllerRequests.distance.trigger.kind, "controller");
    if (f.controllerRequests.distance.trigger.kind !== "controller")
      throw new Error("Expected controller request");
    const request: DialogueRequest = {
      ...f.controllerRequests.distance,
      trigger: { ...f.controllerRequests.distance.trigger, allowed_intent },
    };
    const h = harness([questionDraft(), reviewReply()]);
    const result = await generateDialogue(
      input({
        request,
        context: context({
          assessment_status: "evaluated",
          text: "Distance changes transmission time.",
        }),
      }),
      h.services,
    );
    assert.ok(result.ok);
    assert.equal(result.value.content.kind, "question");
    if (result.value.content.kind !== "question")
      throw new Error("Expected question");
    const candidate = result.value.content;
    assert.equal(candidate.intent, allowed_intent);
    assert.equal(candidate.question.question_id, candidate.content_id);
    assert.equal(candidate.question.origin, "generated");
    assert.equal(candidate.question.generation?.model, model);
    assert.deepEqual(candidate.question.content_ref, content.content_ref);
    assert.deepEqual(
      result.value.semantic_review.coverage.map((item) => item.field),
      reviewFields(candidate).map((item) => item.field),
    );
  }
});

test("question review cannot omit private criteria even when the prompt is supported", async () => {
  const h = harness([
    questionDraft(),
    reviewReply((review) => ({
      ...review,
      coverage: review.coverage.filter((item) => item.field === "prompt_text"),
    })),
  ]);
  const result = await generateDialogue(
    input({
      request: f.controllerRequests.distance,
      context: context({ assessment_status: "evaluated" }),
    }),
    h.services,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid_output");
});

test("exact repeated prompts are rejected before review and semantic paraphrases fail novelty review", async () => {
  const evaluated = context({ assessment_status: "evaluated" });
  const same = harness([
    {
      ...questionDraft(),
      prompt_text: f.curatedQuestion.prompt_text.toUpperCase(),
    },
  ]);
  const repeated = await generateDialogue(
    input({ request: f.controllerRequests.distance, context: evaluated }),
    same.services,
  );
  assert.equal(repeated.ok, false);
  assert.equal(same.reservations.length, 1);
  const prior = f.diagnostics.distance;
  assert.equal(prior.kind, "question");
  if (prior.kind !== "question") throw new Error("Expected diagnostic");
  const previous = harness([questionDraft()]);
  assert.equal(
    (
      await generateDialogue(
        input({
          request: f.controllerRequests.distance,
          context: context({
            assessment_status: "evaluated",
            prior_questions: [prior.question],
          }),
        }),
        previous.services,
      )
    ).ok,
    false,
  );
  assert.equal(previous.reservations.length, 1);
  const paraphrase = harness([
    questionDraft(),
    reviewReply((review) => ({ ...review, novelty: "repeated" })),
  ]);
  assert.equal(
    (
      await generateDialogue(
        input({ request: f.controllerRequests.distance, context: evaluated }),
        paraphrase.services,
      )
    ).ok,
    false,
  );
  assert.equal(paraphrase.reservations.length, 2);
});

test("reservation denial propagates without provider work and a denied review cannot expose a draft", async () => {
  const denied = new Error("Shared dialogue budget exhausted");
  const noCalls = harness([], async () => {
    throw denied;
  });
  await assert.rejects(
    classifyIntent(context(), noCalls.services),
    (error) => error === denied,
  );
  assert.equal(noCalls.prompts.length, 0);
  const reviewDenied = harness([helpDraft()], async (step, call) => {
    if (step.stage === "review") throw denied;
    return call(new AbortController().signal);
  });
  await assert.rejects(
    generateDialogue(input(), reviewDenied.services),
    (error) => error === denied,
  );
  assert.equal(reviewDenied.prompts.length, 1);
  assert.deepEqual(
    reviewDenied.reservations.map((step) => step.stage),
    ["generate", "review"],
  );
});

test("unknown provider outcomes preserve reconciliation and never cause an automatic retry", async () => {
  for (const code of [
    "timeout",
    "connection",
    "provider_error",
    "limit_reached",
  ] as const) {
    let calls = 0;
    const provider: DialogueServices["provider"] = {
      model,
      request: async () => {
        calls += 1;
        return {
          ok: false,
          code,
          message: "Synthetic provider failure",
          model,
          responseId: null,
          latencyMs: 1,
          usage: null,
          needs_reconciliation: code !== "limit_reached",
        };
      },
    };
    const h = harness([]);
    h.services.provider = provider;
    const result = await generateDialogue(input(), h.services);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(
        result.reason,
        code === "connection" ? "provider_error" : code,
      );
      assert.equal(result.needs_reconciliation, code !== "limit_reached");
    }
    assert.equal(calls, 1);
    assert.equal(h.reservations.length, 1);
  }
});

test("direct candidate review still enforces authorized context and cannot accept malformed content", async () => {
  const h = harness([]);
  for (const candidate of [
    f.invalid.invalidCitation,
    f.invalid.mismatchedSource,
    { ...f.help, text: "" },
  ]) {
    assert.equal(
      (await reviewDialogueCandidate(input(), candidate, h.services)).ok,
      false,
    );
  }
  assert.equal(
    (
      await reviewDialogueCandidate(
        input({ permitted_by_controller: false }),
        f.help,
        h.services,
      )
    ).ok,
    false,
  );
  assert.equal(h.reservations.length, 0);
});
