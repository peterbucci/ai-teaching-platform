import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  DIALOGUE_LIMITS,
  type DialogueRequest,
  type GeneratedDialogue,
} from "../lib/dialogue/contracts.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import type { DialogueReview } from "../lib/dialogue/rules.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  ORCHESTRATION_VERSION,
  OrchestrationReceiptSchema,
  OrchestrationRecordSchema,
  TutorProposalSchema,
  TutorToolResultSchema,
  type OrchestrationContext,
  type OrchestrationPorts,
  type OrchestrationReceipt,
  type OrchestrationRecord,
  type ProposalPrompt,
  type TutorProposal,
  type TutorTool,
} from "../lib/tutoring/orchestration/contracts.ts";
import { OrchestrationError } from "../lib/tutoring/orchestration/errors.ts";
import {
  runTutorOrchestration,
  toStudentOrchestrationReceipt,
} from "../lib/tutoring/orchestration/run.ts";

import {
  createProposalService,
  type ReservedProposalCall,
} from "../lib/tutoring/orchestration/provider.ts";

import { decideTutoring } from "../lib/tutoring/decide.ts";
import { bindGeneratedQuestion } from "../lib/tutoring/generated-question.ts";

const content = loadApprovedContent();
const f = makeDialogueExamples(content);
const authored = buildDemoFixture(content).sessions[0];
const tools: TutorTool[] = [
  "retrieve_passages",
  "clarify",
  "explain",
  "generate_diagnostic",
  "generate_followup",
  "generate_retest",
  "return_to_lesson",
  "advance_lesson",
];
function studentContext(): OrchestrationContext {
  return {
    actor_profile_id: authored.session.student_id,
    state: {
      ...structuredClone(f.state),
      active_request_id: f.studentRequest.request_id,
      turns_used: 1,
    },
    evidence: {
      session: { ...authored.session, status: "active", ended_at: null },
      attempts: [structuredClone(f.unansweredAttempt)],
      evaluations: [],
      interventions: [],
    },
    content,
    source_scope: {
      concept_ids: content.concept_ids,
      passage_ids: content.passage_ids,
      misconception_ids: new Set(content.misconception_concepts.keys()),
    },
    history: [],
    lesson_policy: tools,
    installed_tools: tools,
  };
}
function controllerFixture() {
  const context = studentContext();
  const attempt = { ...structuredClone(authored.attempts[0]), outcome: null };
  const evaluation = structuredClone(authored.evaluations[0]);
  const hypothesis = evaluation.applied_result!.hypothesis_events[0];
  evaluation.result!.misconception_candidates = [
    {
      concept_id: hypothesis.concept_id,
      misconception_id: hypothesis.misconception_id,
      status: "tentative",
      evidence_quotes: hypothesis.supporting_response_quotes,
      uncertainty_reason:
        "A single response does not establish a stable belief.",
    },
  ];
  evaluation.applied_result = null;
  context.evidence.attempts = [attempt];
  context.evidence.evaluations = [evaluation];
  context.state.progress.phase = "evaluate";
  const request = structuredClone(f.controllerRequests.distance);
  context.state.active_request_id = request.request_id;
  return { context, request };
}
function proposal(
  action: "retrieve_passages" | "return_to_lesson" = "retrieve_passages",
): TutorProposal {
  return {
    version: ORCHESTRATION_VERSION,
    action,
    content_ref: content.content_ref,
    concept_ids: [...f.curatedQuestion.concept_ids],
    source_passage_ids: ["P07", "P08"],
    reason_summary:
      "Use the approved passage to distinguish the two intervals.",
    arguments: {},
  };
}
function explanation(): TutorProposal {
  return { ...proposal(), action: "explain", arguments: { style: "hint" } };
}

/** Simulates #75 claim/replay and commit rechecks; these are not database tests. */
function fixture(initial = studentContext()) {
  const state = {
    context: initial,
    proposal: proposal() as unknown,
    generated: structuredClone(f.help) as unknown,
    review: structuredClone(f.review) as DialogueReview,
    records: [] as OrchestrationRecord[],
    prompts: [] as ProposalPrompt[],
    calls: { claim: 0, propose: 0, generate: 0, complete: 0, fail: 0 },
    operations: new Map<
      string,
      { request: DialogueRequest; receipt: OrchestrationReceipt | null }
    >(),
    onPropose: null as
      | null
      | ((prompt: ProposalPrompt, signal: AbortSignal) => Promise<unknown>),
    onGenerate: null as null | (() => Promise<void>),
    onCheckpoint: null as null | ((record: OrchestrationRecord) => void),
    onComplete: null as null | (() => void),
    failUnavailable: false,
  };
  function recheck(request: DialogueRequest) {
    if (
      request.expected_revision !== state.context.state.revision ||
      !isDeepStrictEqual(request.lesson, state.context.state.lesson)
    )
      throw new OrchestrationError("stale");
    if (state.context.state.active_request_id !== request.request_id)
      throw new OrchestrationError("cancelled");
  }
  const ports: OrchestrationPorts = {
    async claim(request) {
      state.calls.claim++;
      const saved = state.operations.get(request.request_id);
      if (saved) {
        if (!isDeepStrictEqual(saved.request, request))
          return { kind: "blocked", reason: "forbidden" };
        return saved.receipt
          ? { kind: "replay", receipt: structuredClone(saved.receipt) }
          : { kind: "blocked", reason: "pending" };
      }
      state.operations.set(request.request_id, {
        request: structuredClone(request),
        receipt: null,
      });
      return { kind: "claimed", context: structuredClone(state.context) };
    },
    async checkpoint(request, record) {
      state.onCheckpoint?.(record);
      recheck(request);
      state.records.push(OrchestrationRecordSchema.parse(record));
      return structuredClone(state.context);
    },
    async propose(prompt, _schema, signal) {
      state.calls.propose++;
      state.context.state.provider_requests_used++;
      state.prompts.push(structuredClone(prompt));
      return state.onPropose
        ? state.onPropose(prompt, signal)
        : structuredClone(state.proposal);
    },
    async generate() {
      state.calls.generate++;
      // Generation and its independent semantic review each consume a reservation.
      state.context.state.provider_requests_used += 2;
      await state.onGenerate?.();
      return {
        content: structuredClone(state.generated),
        review: state.review,
      };
    },
    async complete(request, selected, result) {
      state.calls.complete++;
      state.onComplete?.();
      recheck(request);
      const receipt = OrchestrationReceiptSchema.parse({
        status: "executed",
        request_id: request.request_id,
        action: selected.action,
        result: TutorToolResultSchema.parse(result),
      });
      state.records.push(
        OrchestrationRecordSchema.parse({
          phase: "executed",
          action_id: request.request_id,
          tool: selected.action,
          result,
        }),
      );
      state.operations.get(request.request_id)!.receipt = receipt;
      state.context.state.active_request_id = null;
      return receipt;
    },
    async fail(request, record, receipt) {
      state.calls.fail++;
      if (state.failUnavailable) throw new Error("Simulated storage outage");
      state.records.push(OrchestrationRecordSchema.parse(record));
      // Unknown outcomes remain reserved until reconciliation.
      if (receipt.status === "stopped" && !receipt.reconcile) {
        state.operations.get(request.request_id)!.receipt = receipt;
        state.context.state.active_request_id = null;
      }
    },
  };
  return { state, ports };
}
function assertStopped(receipt: OrchestrationReceipt, reason?: string) {
  assert.equal(receipt.status, "stopped");
  if (receipt.status !== "stopped") throw new Error("Expected safe fallback");
  if (reason) assert.equal(receipt.reason, reason);
  assert.equal(receipt.fallback.next, "return_to_lesson");
  assert.ok(receipt.fallback.text.length > 0);
  return receipt;
}

test("retrieval executes exactly one approved tool with separate proposal and validation audit", async () => {
  const { state, ports } = fixture();
  const before = structuredClone(state.context.evidence);
  const receipt = await runTutorOrchestration(f.studentRequest, ports);
  assert.equal(receipt.status, "executed");
  if (receipt.status !== "executed" || receipt.result.kind !== "passages")
    throw new Error("Expected approved passage retrieval");
  assert.equal(receipt.action, "retrieve_passages");
  assert.deepEqual(receipt.result.content_ref, content.content_ref);
  assert.deepEqual(
    receipt.result.passages.map((p) => p.id),
    ["P07", "P08"],
  );
  for (const p of receipt.result.passages)
    assert.equal(p.text, content.passages.get(p.id)?.text);
  assert.equal(state.calls.propose, 1);
  assert.equal(state.calls.generate, 0);
  assert.equal(state.calls.complete, 1);
  assert.deepEqual(
    state.records.map((r) => r.phase),
    ["proposed", "validated", "dispatch_started", "executed"],
  );
  assert.deepEqual(state.context.evidence, before);
});

test("returning preserves the original unanswered activity without submitting or discarding work", async () => {
  const { state, ports } = fixture();
  state.proposal = proposal("return_to_lesson");
  const before = structuredClone(state.context.evidence);
  const receipt = await runTutorOrchestration(f.studentRequest, ports);
  assert.equal(receipt.status, "executed");
  if (receipt.status !== "executed") throw new Error("Expected lesson return");
  assert.deepEqual(receipt.result, {
    kind: "return_to_lesson",
    attempt_id: f.unansweredAttempt.id,
  });
  assert.deepEqual(state.context.evidence, before);
  assert.equal(state.context.evidence.attempts[0].response_text, null);
});

test("model-selected tools cannot bypass teacher policy, installed capabilities or the controller", async () => {
  for (const candidate of [
    {
      ...explanation(),
      action: "execute_code",
      arguments: { code: "fetch('/private')" },
    },
    { ...proposal(), action: "advance_lesson" },
    { ...proposal(), action: "generate_retest" },
    {
      ...proposal(),
      action: "generate_diagnostic",
      arguments: { target_misconception_ids: [] },
    },
  ]) {
    const { state, ports } = fixture();
    state.proposal = candidate;
    assertStopped(await runTutorOrchestration(f.studentRequest, ports));
    assert.equal(state.calls.generate, 0);
    assert.equal(state.calls.complete, 0);
    assert.equal(
      state.records.some((r) => r.phase === "dispatch_started"),
      false,
    );
  }
  for (const field of ["lesson_policy", "installed_tools"] as const) {
    const { state, ports } = fixture();
    state.context[field] = ["return_to_lesson"];
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "forbidden",
    );
    assert.equal(state.calls.complete, 0);
  }
});

test("strict arguments reject injected permissions, malformed values and duplicate references", async () => {
  for (const candidate of [
    { ...proposal(), arguments: { teacher_approved: true } },
    { ...explanation(), arguments: { style: "run_javascript" } },
    { ...proposal(), concept_ids: [] },
    { ...proposal(), source_passage_ids: ["P07", "P07"] },
    { ...proposal(), permissions: ["admin"] },
  ]) {
    const { state, ports } = fixture();
    state.proposal = candidate;
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "invalid_proposal",
    );
    assert.equal(state.calls.complete, 0);
    assert.ok(
      state.records.some((r) => r.phase === "proposed" && r.invalid_proposal),
    );
  }
});

test("source version and scope mismatches fail closed before dispatch", async () => {
  for (const candidate of [
    {
      ...proposal(),
      content_ref: { ...content.content_ref, content_version: "other-version" },
    },
    {
      ...proposal(),
      content_ref: { ...content.content_ref, excerpt_sha256: "a".repeat(64) },
    },
    { ...proposal(), source_passage_ids: ["NOT-APPROVED"] },
    { ...proposal(), concept_ids: ["outside-assignment"] },
  ]) {
    const { state, ports } = fixture();
    state.proposal = candidate;
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "source_mismatch",
    );
    assert.equal(state.calls.complete, 0);
    assert.equal(state.calls.generate, 0);
  }
});

test("stale preflight, disabled sessions and actor mismatches stop before a paid proposal", async () => {
  for (const alter of [
    (c: OrchestrationContext) => {
      c.state.revision++;
    },
    (c: OrchestrationContext) => {
      c.actor_profile_id = "85000000-0000-4000-9000-000000000900";
    },
    (c: OrchestrationContext) => {
      c.state.enabled = false;
    },
    (c: OrchestrationContext) => {
      c.state.lesson.content_ref = {
        ...content.content_ref,
        content_version: "stale",
      };
    },
  ]) {
    const { state, ports } = fixture();
    alter(state.context);
    assertStopped(await runTutorOrchestration(f.studentRequest, ports));
    assert.equal(state.calls.propose, 0);
    assert.equal(state.calls.complete, 0);
  }
});

test("late proposals cannot cross a revision change or cancellation", async () => {
  for (const cancel of [false, true]) {
    const { state, ports } = fixture();
    state.onPropose = async () => {
      if (cancel) state.context.state.active_request_id = null;
      else state.context.state.revision++;
      return proposal();
    };
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      cancel ? "cancelled" : "stale",
    );
    assert.equal(state.calls.complete, 0);
    assert.equal(state.calls.generate, 0);
  }
});

test("generated output cannot commit after the lesson changes", async () => {
  const { state, ports } = fixture();
  state.proposal = explanation();
  state.onComplete = () => {
    state.context.state.revision++;
  };
  assertStopped(await runTutorOrchestration(f.studentRequest, ports), "stale");
  assert.equal(state.calls.generate, 1);
  assert.equal(
    state.records.some((r) => r.phase === "executed"),
    false,
  );
  assert.equal(state.context.evidence.interventions.length, 0);
});

test("identical requests replay but an altered payload with the same identity is rejected", async () => {
  const { state, ports } = fixture();
  const first = await runTutorOrchestration(f.studentRequest, ports);
  assert.equal(first.status, "executed");
  assert.deepEqual(await runTutorOrchestration(f.studentRequest, ports), first);
  const changed = structuredClone(f.studentRequest);
  if (changed.trigger.kind === "student")
    changed.trigger.action.text = "Different student intent";
  assertStopped(await runTutorOrchestration(changed, ports), "forbidden");
  assert.equal(state.calls.propose, 1);
  assert.equal(state.calls.complete, 1);
});

test("overlapping duplicates cannot dispatch while the original provider call is pending", async () => {
  const { state, ports } = fixture();
  let resolveProposal: (value: unknown) => void = () => {
    throw new Error("Provider not started");
  };
  let providerStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    providerStarted = resolve;
  });
  state.onPropose = () =>
    new Promise((resolve) => {
      resolveProposal = resolve;
      providerStarted();
    });
  const first = runTutorOrchestration(f.studentRequest, ports);
  await started;
  const pending = assertStopped(
    await runTutorOrchestration(f.studentRequest, ports),
    "pending",
  );
  assert.equal(pending.reconcile, true);
  resolveProposal(proposal());
  assert.equal((await first).status, "executed");
  assert.equal(state.calls.propose, 1);
  assert.equal(state.calls.complete, 1);
});

test("shared provider limits include one proposal and separate generation and review calls", async () => {
  const exhausted = fixture();
  exhausted.state.context.state.provider_requests_used =
    DIALOGUE_LIMITS.providerRequestsPerSession;
  assertStopped(
    await runTutorOrchestration(f.studentRequest, exhausted.ports),
    "limit_reached",
  );
  assert.equal(exhausted.state.calls.propose, 0);
  const reading = fixture();
  reading.state.context.state.provider_requests_used =
    DIALOGUE_LIMITS.providerRequestsPerSession - 1;
  assert.equal(
    (await runTutorOrchestration(f.studentRequest, reading.ports)).status,
    "executed",
  );
  assert.equal(
    reading.state.context.state.provider_requests_used,
    DIALOGUE_LIMITS.providerRequestsPerSession,
  );
  const insufficient = fixture();
  insufficient.state.context.state.provider_requests_used =
    DIALOGUE_LIMITS.providerRequestsPerSession - 2;
  insufficient.state.proposal = explanation();
  assertStopped(
    await runTutorOrchestration(f.studentRequest, insufficient.ports),
  );
  assert.equal(insufficient.state.calls.generate, 0);
  const enough = fixture();
  enough.state.context.state.provider_requests_used =
    DIALOGUE_LIMITS.providerRequestsPerSession - 3;
  enough.state.proposal = explanation();
  assert.equal(
    (await runTutorOrchestration(f.studentRequest, enough.ports)).status,
    "executed",
  );
  assert.equal(
    enough.state.context.state.provider_requests_used,
    DIALOGUE_LIMITS.providerRequestsPerSession,
  );
});

test("known provider failures retain safe fallback with no automatic paid retry", async () => {
  for (const stage of ["proposal", "generation"] as const) {
    const { state, ports } = fixture();
    state.proposal = explanation();
    const failure = async () => {
      throw new OrchestrationError("provider_error");
    };
    if (stage === "proposal") state.onPropose = failure;
    else state.onGenerate = failure;
    const stopped = assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "provider_error",
    );
    assert.equal(stopped.reconcile, false);
    assert.equal(state.calls.propose, 1);
    assert.ok(state.calls.generate <= 1);
    assert.equal(
      state.records.some((r) => r.phase === "executed"),
      false,
    );
    assert.deepEqual(
      await runTutorOrchestration(f.studentRequest, ports),
      stopped,
    );
    assert.equal(state.calls.propose, 1);
  }
});

test("unknown provider and commit outcomes require reconciliation instead of blind reruns", async () => {
  for (const stage of ["timeout", "provider", "commit"] as const) {
    const { state, ports } = fixture();
    if (stage === "commit")
      state.onComplete = () => {
        throw new Error("Unknown commit");
      };
    else
      state.onPropose = async () => {
        if (stage === "timeout") throw new OrchestrationError("timeout", true);
        throw new Error("Uncertain result; PRIVATE_PROVIDER_DETAIL");
      };
    const stopped = assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
    );
    assert.equal(stopped.reconcile, true);
    assert.equal(
      JSON.stringify(stopped).includes("PRIVATE_PROVIDER_DETAIL"),
      false,
    );
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "pending",
    );
    assert.equal(state.calls.propose, 1);
    assert.ok(
      state.records.some((r) => r.phase === "failed" && r.outcome_unknown),
    );
  }
});

test("failure to save a failure remains reconcilable", async () => {
  const { state, ports } = fixture();
  state.onPropose = async () => {
    throw new OrchestrationError("provider_error");
  };
  state.failUnavailable = true;
  assert.equal(
    assertStopped(await runTutorOrchestration(f.studentRequest, ports))
      .reconcile,
    true,
  );
  assertStopped(
    await runTutorOrchestration(f.studentRequest, ports),
    "pending",
  );
  assert.equal(state.calls.propose, 1);
});

test("generation requires trusted grounding and leakage review plus exact source references", async () => {
  for (const invalid of [
    "grounding",
    "disclosure",
    "source",
    "kind",
  ] as const) {
    const { state, ports } = fixture();
    state.proposal = explanation();
    if (invalid === "grounding") state.review.grounding = "unsupported";
    if (invalid === "disclosure") state.review.disclosure = "private_guidance";
    if (invalid === "source") state.generated = f.invalid.mismatchedSource;
    if (invalid === "kind") state.generated = f.diagnostics.distance;
    assertStopped(
      await runTutorOrchestration(f.studentRequest, ports),
      "invalid_output",
    );
    assert.equal(state.calls.generate, 1);
    assert.equal(state.calls.complete, 0);
    assert.equal(state.context.evidence.interventions.length, 0);
  }
});

test("generated help is not displayed assistance and student projection excludes private metadata", async () => {
  const { state, ports } = fixture();
  state.proposal = {
    ...explanation(),
    reason_summary: "PRIVATE_SELECTION_REASON",
  };
  const before = structuredClone(state.context.evidence);
  const receipt = await runTutorOrchestration(f.studentRequest, ports);
  assert.equal(receipt.status, "executed");
  assert.deepEqual(state.context.evidence, before);
  assert.equal(state.context.evidence.interventions.length, 0);
  const student = JSON.stringify(toStudentOrchestrationReceipt(receipt));
  assert.ok(student.includes(f.help.kind === "help" ? f.help.text : ""));
  for (const privateText of [
    "PRIVATE_SELECTION_REASON",
    "synthetic-contract-fixture",
    "prompt_template_version",
    "reason_summary",
    "generation",
  ])
    assert.equal(student.includes(privateText), false);
});

test("controller-authorized diagnostics preserve question snapshots and keep rubrics private", async () => {
  const { context, request } = controllerFixture();
  const { state, ports } = fixture(context);
  state.proposal = {
    ...proposal(),
    action: "generate_diagnostic",
    concept_ids:
      f.diagnostics.distance.kind === "question"
        ? f.diagnostics.distance.question.concept_ids
        : [],
    arguments: {
      target_misconception_ids: ["transmission_depends_on_distance"],
    },
  };
  state.generated = f.diagnostics.distance;
  const receipt = await runTutorOrchestration(request, ports);
  assert.equal(receipt.status, "executed");
  if (receipt.status !== "executed" || receipt.result.kind !== "generated")
    throw new Error("Expected generated snapshot");
  assert.deepEqual(receipt.result.content, f.diagnostics.distance);
  const student = JSON.stringify(toStudentOrchestrationReceipt(receipt));
  for (const name of [
    "rubric",
    "answer_guidance",
    "target_misconception_ids",
    "generation",
  ])
    assert.equal(student.includes(name), false);
  assert.equal(
    state.context.evidence.attempts.length,
    1,
    "The injected controller adapter owns assessed-question handoff",
  );
});

test("proposal input uses current reasoning and approved objectives without private answer criteria", async () => {
  const { state, ports } = fixture();
  state.context.history = [
    {
      role: "student",
      text: "I thought the signal needed more time to enter a longer cable.",
    },
    { role: "tutor", text: "Which part happens at the sender?" },
  ];
  await runTutorOrchestration(f.studentRequest, ports);
  const prompt = state.prompts[0];
  assert.ok(prompt.input.includes(state.context.history[0].text));
  assert.ok(prompt.input.includes(f.asks.question.text));
  assert.ok(prompt.input.includes("P07"));
  assert.ok(prompt.input.includes("transmission_delay"));
  assert.equal(
    prompt.input.includes(f.curatedQuestion.rubric.answer_guidance),
    false,
  );
  assert.equal(prompt.input.includes("rubric"), false);
  assert.equal(prompt.input.includes("answer_guidance"), false);
});

test("a simulated new observation reaches a subsequent decision with a changed tool", async () => {
  const { state, ports } = fixture();
  state.context.history = [
    {
      role: "student",
      text: "The longer cable must take longer to fill with bits.",
    },
  ];
  const first = await runTutorOrchestration(f.studentRequest, ports);
  const next = structuredClone(f.studentRequest);
  next.request_id = "85000000-0000-4000-9000-000000000002";
  if (next.trigger.kind === "student") {
    next.trigger.action.request_id = next.request_id;
    next.trigger.action.text =
      "I now separate entry from travel, but how does packet size change the entry interval?";
  }
  state.context.state.active_request_id = next.request_id;
  state.context.state.turns_used++;
  state.context.history.push(
    { role: "tutor", text: "Read the two intervals in P07 and P08." },
    {
      role: "student",
      text: next.trigger.kind === "student" ? next.trigger.action.text : "",
    },
  );
  // An explicit independent provider fixture, never a keyword router or a live-AI claim.
  state.proposal = explanation();
  const second = await runTutorOrchestration(next, ports);
  assert.equal(first.status, "executed");
  assert.equal(second.status, "executed");
  if (first.status !== "executed" || second.status !== "executed")
    throw new Error("Expected two simulated cycles");
  assert.notEqual(first.action, second.action);
  assert.equal(state.calls.propose, 2);
  assert.equal(state.calls.complete, 2);
  assert.ok(state.prompts[1].input.includes("how does packet size"));
  assert.notEqual(state.prompts[0].input, state.prompts[1].input);
});

test("malformed unidentified requests fail before storage or provider work", async () => {
  const { state, ports } = fixture();
  await assert.rejects(runTutorOrchestration({ request_id: "invalid" }, ports));
  assert.equal(state.calls.claim, 0);
  assert.equal(state.calls.propose, 0);
});

test("an explanation cannot claim neutral assistance while neutral clarification remains permitted", async () => {
  const rejected = fixture();
  rejected.state.proposal = explanation();
  rejected.state.generated = {
    ...f.help,
    assistance_type: "neutral_clarification",
  };
  assertStopped(
    await runTutorOrchestration(f.studentRequest, rejected.ports),
    "invalid_output",
  );
  assert.equal(rejected.state.calls.complete, 0);
  const accepted = fixture();
  accepted.state.proposal = {
    ...proposal(),
    action: "clarify",
    arguments: { focus: "terminology" },
  };
  accepted.state.generated = {
    ...f.help,
    assistance_type: "neutral_clarification",
  };
  assert.equal(
    (await runTutorOrchestration(f.studentRequest, accepted.ports)).status,
    "executed",
  );
});

test("the bounded timeout aborts the provider and ignores its late result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { state, ports } = fixture();
  const signals: AbortSignal[] = [];
  let release: (value: unknown) => void = () => {
    throw new Error("Provider not started");
  };
  let notifyStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  state.onPropose = (_prompt, signal) =>
    new Promise((resolve) => {
      signals.push(signal);
      release = resolve;
      notifyStarted();
    });
  const pending = runTutorOrchestration(f.studentRequest, ports);
  await started;
  t.mock.timers.tick(DIALOGUE_LIMITS.timeoutMs);
  const stopped = assertStopped(await pending, "timeout");
  assert.equal(stopped.reconcile, true);
  assert.equal(signals[0].aborted, true);
  release(proposal());
  await Promise.resolve();
  assert.equal(state.calls.complete, 0);
  assertStopped(
    await runTutorOrchestration(f.studentRequest, ports),
    "pending",
  );
  assert.equal(state.calls.propose, 1);
});

test("only displayed help enters the next decision's assistance history", async () => {
  for (const displayed of [false, true]) {
    const { state, ports } = fixture();
    state.context.evidence.interventions = [
      {
        ...structuredClone(authored.interventions[0]),
        related_attempt_id: f.unansweredAttempt.id,
        related_evaluation_id: null,
        text_shown: "ASSISTANCE_VISIBLE_ONLY_AFTER_ACKNOWLEDGEMENT",
        delivery_status: displayed ? "displayed" : "created",
        visible_at: displayed ? authored.interventions[0].visible_at : null,
      },
    ];
    assert.equal(
      (await runTutorOrchestration(f.studentRequest, ports)).status,
      "executed",
    );
    assert.equal(
      state.prompts[0].input.includes(
        "ASSISTANCE_VISIBLE_ONLY_AFTER_ACKNOWLEDGEMENT",
      ),
      displayed,
    );
  }
});

test("an accepted evaluation informs the proposal with original saved reasoning and uncertainty", async () => {
  const { context, request } = controllerFixture();
  const { state, ports } = fixture(context);
  assert.equal(
    (await runTutorOrchestration(request, ports)).status,
    "executed",
  );
  const input: unknown = JSON.parse(state.prompts[0].input);
  const serialized = JSON.stringify(input);
  assert.ok(serialized.includes(context.evidence.attempts[0].response_text!));
  assert.ok(serialized.includes("accepted_evaluations"));
  assert.ok(serialized.includes("incorrect"));
  assert.ok(
    serialized.includes(
      "A single response does not establish a stable belief.",
    ),
  );
  assert.equal(serialized.includes("rubric_criteria_missing"), false);
  assert.equal(
    serialized.includes(
      context.evidence.attempts[0].question.rubric.answer_guidance,
    ),
    false,
  );
});

test("the proposal bridge reserves every call with stable provenance and a schema-wrapped result", async () => {
  const steps: Parameters<ReservedProposalCall>[0][] = [];
  const signals: AbortSignal[] = [];
  let calls = 0;
  const service = createProposalService({
    model: "synthetic-provider",
    runReservedCall: async (step, call) => {
      steps.push(step);
      return call(new AbortController().signal);
    },
    requestStructuredProposal: async (input, options) => {
      calls++;
      signals.push(options.signal);
      assert.equal(input.schemaName, "tutor_instructional_proposal");
      assert.ok(input.instructions.includes("proposal field"));
      return {
        ok: true,
        needs_reconciliation: false,
        result: input.schema.parse({ proposal: proposal() }),
      };
    },
  });
  const prompt = {
    instructions: "Choose one permitted strategy.",
    input: "Original saved reasoning.",
  };
  const signal = new AbortController().signal;
  assert.deepEqual(
    await service(prompt, TutorProposalSchema, signal),
    proposal(),
  );
  await service(prompt, TutorProposalSchema, signal);
  await service(
    { ...prompt, input: "A genuinely new observation." },
    TutorProposalSchema,
    signal,
  );
  assert.equal(calls, 3);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].stage, "propose");
  assert.equal(steps[0].step_id, "propose");
  assert.equal(steps[0].prompt_version, ORCHESTRATION_VERSION);
  assert.equal(steps[0].model, "synthetic-provider");
  assert.match(steps[0].input_hash, /^[a-f0-9]{64}$/);
  assert.equal(steps[0].input_hash, steps[1].input_hash);
  assert.notEqual(steps[0].input_hash, steps[2].input_hash);
  assert.equal(
    signals.every((item) => !item.aborted),
    true,
  );
});

test("the proposal bridge preserves provider uncertainty and never retries a failed reservation", async () => {
  for (const code of ["timeout", "configuration", "upstream_unavailable"]) {
    let calls = 0;
    let reservations = 0;
    const service = createProposalService({
      model: "synthetic-provider",
      runReservedCall: async (_step, call) => {
        reservations++;
        return call(new AbortController().signal);
      },
      requestStructuredProposal: async () => {
        calls++;
        return { ok: false, code, needs_reconciliation: true };
      },
    });
    await assert.rejects(
      service(
        { instructions: "Choose.", input: "Observation." },
        TutorProposalSchema,
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof OrchestrationError &&
        error.reconcile &&
        error.reason ===
          (code === "configuration"
            ? "disabled"
            : code === "timeout"
              ? "timeout"
              : "provider_error"),
    );
    assert.equal(reservations, 1);
    assert.equal(calls, 1);
  }
});

test("missing provider configuration or cancellation prevents even a reservation", async () => {
  for (const configured of [false, true]) {
    let reservations = 0;
    const abort = new AbortController();
    if (configured) abort.abort();
    const service = createProposalService({
      model: configured ? "synthetic-provider" : null,
      runReservedCall: async (_step, call) => {
        reservations++;
        return call(new AbortController().signal);
      },
      requestStructuredProposal: async () => {
        throw new Error("Must not call provider");
      },
    });
    await assert.rejects(
      service(
        { instructions: "Choose.", input: "Observation." },
        TutorProposalSchema,
        abort.signal,
      ),
      (error: unknown) =>
        error instanceof OrchestrationError &&
        error.reason === (configured ? "cancelled" : "disabled"),
    );
    assert.equal(reservations, 0);
  }
});

test("retrieving a passage records every exposed concept even when the proposed target is narrower", async () => {
  const { state, ports } = fixture();
  state.proposal = {
    ...proposal(),
    concept_ids: ["transmission_delay"],
    source_passage_ids: ["P07"],
  };
  const receipt = await runTutorOrchestration(f.studentRequest, ports);
  assert.equal(receipt.status, "executed");
  if (receipt.status !== "executed" || receipt.result.kind !== "passages")
    throw new Error("Expected approved reading");
  assert.ok(receipt.result.concept_ids.includes("transmission_delay"));
  assert.ok(
    receipt.result.concept_ids.includes("propagation_delay"),
    "The exposed passage teaches propagation too; the model cannot hide its assistance",
  );
});

test("generation allows its two bounded provider calls but stops after their combined deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { state, ports } = fixture();
  state.proposal = explanation();
  const signals: AbortSignal[] = [];
  const originalGenerate = ports.generate!;
  ports.generate = async (input) => {
    signals.push(input.signal);
    return originalGenerate(input);
  };
  let release: () => void = () => {
    throw new Error("Generation not started");
  };
  let notifyStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  state.onGenerate = () =>
    new Promise<void>((resolve) => {
      release = resolve;
      notifyStarted();
    });
  const pending = runTutorOrchestration(f.studentRequest, ports);
  await started;
  t.mock.timers.tick(DIALOGUE_LIMITS.timeoutMs);
  const prematurelyAborted = signals[0].aborted;
  t.mock.timers.tick(DIALOGUE_LIMITS.timeoutMs);
  const stopped = assertStopped(await pending, "timeout");
  assert.equal(
    prematurelyAborted,
    false,
    "Generation and review each have one 45-second reservation",
  );
  assert.equal(signals[0].aborted, true);
  assert.equal(stopped.reconcile, true);
  release();
  await Promise.resolve();
  assert.equal(state.calls.complete, 0);
});

test("a controller-permitted generated retest needs a fresh question and installed handoff capability", async () => {
  assert.equal(f.diagnostics.packetSize.kind, "question");
  if (f.diagnostics.packetSize.kind !== "question")
    throw new Error("Missing generated fixture");
  for (const variant of [
    "fresh",
    "same_prompt",
    "same_id",
    "unavailable",
  ] as const) {
    const context = studentContext();
    context.evidence.attempts = structuredClone(authored.attempts.slice(0, 3));
    context.evidence.attempts[0].outcome = null;
    context.evidence.evaluations = structuredClone(
      authored.evaluations.slice(0, 3),
    );
    context.evidence.evaluations[2].applied_result = null;
    context.evidence.interventions = structuredClone(
      authored.interventions.slice(0, 1),
    );
    const current = context.evidence.attempts[2];
    context.state.lesson = {
      ...context.state.lesson,
      attempt_id: current.id,
      root_attempt_id: current.root_attempt_id,
      sequence_index: current.sequence_index,
    };
    context.state.progress = {
      ...context.state.progress,
      phase: "evaluate",
      current_attempt_id: current.id,
    };
    const request: DialogueRequest = {
      ...structuredClone(f.controllerRequests.distance),
      lesson: context.state.lesson,
      trigger: {
        kind: "controller",
        evaluation_id: current.current_evaluation_id!,
        allowed_intent: "immediate_retest",
      },
    };
    context.state.active_request_id = request.request_id;
    const candidate: Extract<GeneratedDialogue, { kind: "question" }> = {
      ...structuredClone(f.diagnostics.packetSize),
      intent: "immediate_retest" as const,
      target_misconception_ids: [],
    };
    if (variant === "same_prompt")
      candidate.question.prompt_text =
        "  " + current.question.prompt_text.toUpperCase() + "  ";
    if (variant === "same_id") {
      // A saved generated activity earlier in the same episode already owns this ID.
      const previous = context.evidence.attempts[1];
      const priorApplied = context.evidence.evaluations[0].applied_result;
      assert.ok(priorApplied);
      previous.question = bindGeneratedQuestion(
        content,
        {
          ...context.evidence,
          attempts: context.evidence.attempts.slice(0, 1),
        },
        {
          applied: priorApplied,
          nextQuestionId: previous.question.question_id,
          help: null,
          outcome: null,
        },
        {
          ...candidate,
          intent: "diagnostic_followup",
          question: {
            ...previous.question,
            origin: "generated",
            sequence_id: null,
            question_id: candidate.content_id,
            generation: candidate.question.generation,
          },
        },
      );
    }
    if (variant === "unavailable")
      context.installed_tools = tools.filter(
        (tool) => tool !== "generate_retest",
      );
    assert.equal(
      decideTutoring(
        content,
        context.evidence,
        current.current_evaluation_id!,
        request.requested_at,
      ).applied.action,
      "RETEST_CONCEPT",
    );
    const { state, ports } = fixture(context);
    state.proposal = {
      ...proposal(),
      action: "generate_retest",
      concept_ids: candidate.question.concept_ids,
      arguments: {},
    };
    state.generated = candidate;
    const receipt = await runTutorOrchestration(request, ports);
    if (variant === "fresh") {
      assert.equal(receipt.status, "executed");
      if (receipt.status !== "executed")
        throw new Error("Expected permitted retest");
      assert.equal(receipt.action, "generate_retest");
      assert.deepEqual(receipt.result, {
        kind: "generated",
        content: candidate,
      });
      assert.equal(state.calls.complete, 1);
    } else {
      assertStopped(
        receipt,
        variant === "unavailable" ? "forbidden" : "invalid_output",
      );
      assert.equal(state.calls.complete, 0);
    }
    assert.equal(state.calls.generate, variant === "unavailable" ? 0 : 1);
  }
});
