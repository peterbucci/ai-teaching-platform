import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { ConversationActionSchema } from "../lib/dialogue/conversation.ts";
import { controllerAllowedIntent } from "../lib/dialogue/controller-store.ts";
import {
  ControllerOperationPayloadSchema,
  OperationSchema,
  currentOperation,
  isCurrentOperation,
  type DialogueContext,
} from "../lib/dialogue/persistence.ts";
import {
  buildProposalPrompt,
  validateProposal,
} from "../lib/tutoring/orchestration/policy.ts";
import {
  ORCHESTRATION_VERSION,
  type OrchestrationContext,
  type TutorProposal,
} from "../lib/tutoring/orchestration/contracts.ts";

const content = loadApprovedContent();
const examples = makeDialogueExamples(content);
function fixture() {
  const original = structuredClone(buildDemoFixture(content).sessions[0]);
  const attempt = { ...original.attempts[0], outcome: null };
  const evaluation = { ...original.evaluations[0], applied_result: null };
  const request = examples.controllerRequests.distance;
  const payload = ControllerOperationPayloadSchema.parse({
    action: "controller_action",
    request_id: request.request_id,
    session_id: request.session_id,
    attempt_id: attempt.id,
    expected_revision: request.expected_revision,
    evaluation_id: evaluation.id,
  });
  const operation = OperationSchema.parse({
    request_id: request.request_id,
    session_id: request.session_id,
    attempt_id: attempt.id,
    actor_id: original.session.student_id,
    expected_revision: request.expected_revision,
    lesson: request.lesson,
    payload,
    message_request_id: null,
    status: "pending",
    proposed_intent: null,
    authorized_route: "controller_action",
    message: null,
    dialogue_request: request,
    intervention_id: null,
    created_at: request.requested_at,
  });
  const context: DialogueContext = {
    evidence: {
      session: { ...original.session, status: "active", ended_at: null },
      attempts: [attempt],
      evaluations: [evaluation],
      interventions: [],
    },
    attempt,
    lesson: request.lesson,
    revision: request.expected_revision,
    operations: [operation],
    events: [],
    turns_used: 1,
    provider_requests_used: 1,
    unresolved_provider_calls: 0,
    content,
    scope: {
      concept_ids: content.concept_ids,
      passage_ids: content.passage_ids,
      misconception_ids: new Set(content.misconception_concepts.keys()),
    },
  };
  return { context, operation, request };
}

test("a controller reservation stays separate from browser messages and requires accepted unapplied evidence", () => {
  const { context, operation } = fixture();
  assert.equal(
    ConversationActionSchema.safeParse(operation.payload).success,
    false,
  );
  assert.equal(currentOperation(context, operation.request_id), operation);
  assert.equal(
    isCurrentOperation(
      { ...context, revision: context.revision + 1 },
      operation,
    ),
    false,
  );
  const before = structuredClone(context.evidence.evaluations[0]);
  context.evidence.evaluations[0].validation_status = "pending_review";
  assert.throws(() => currentOperation(context, operation.request_id), /stale/);
  context.evidence.evaluations[0] = before;
  context.evidence.evaluations[0].applied_result = {
    action: "END_SESSION",
    hypothesis_events: [],
  };
  assert.throws(() => currentOperation(context, operation.request_id), /stale/);
});

test("controller recovery cannot revive settled, cancelled, changed or unanswered observations", () => {
  const { context, operation } = fixture();
  for (const status of ["resolved", "cancelled", "fallback"] as const) {
    operation.status = status;
    assert.throws(
      () => currentOperation(context, operation.request_id),
      /settled/,
    );
  }
  operation.status = "pending";
  context.attempt.submitted_at = null;
  assert.equal(isCurrentOperation(context, operation), false);
  context.attempt.submitted_at = "2026-10-21T12:00:00Z";
  context.attempt.current_evaluation_id = null;
  assert.equal(isCurrentOperation(context, operation), false);
});

test("controller request intent follows the established activity decision", () => {
  assert.equal(
    controllerAllowedIntent("ASK_DIAGNOSTIC_FOLLOWUP"),
    "diagnostic_followup",
  );
  assert.equal(
    controllerAllowedIntent("ASK_SELF_EXPLANATION"),
    "neutral_clarification",
  );
  assert.equal(controllerAllowedIntent("RETEST_CONCEPT"), "immediate_retest");
  assert.equal(
    controllerAllowedIntent("GIVE_CORRECTIVE_FEEDBACK"),
    "explanation",
  );
  assert.equal(controllerAllowedIntent("END_SESSION"), "explanation");
});

test("installed controller coverage is advertised and rejects narrowing before generation", () => {
  const { context, request } = fixture();
  // This accepted fixture supplies a diagnostic hypothesis without treating it as confirmed.
  const evaluation = context.evidence.evaluations[0];
  evaluation.result!.misconception_candidates = [
    {
      concept_id: "transmission_delay",
      misconception_id: "transmission_depends_on_distance",
      status: "tentative",
      evidence_quotes: structuredClone(
        buildDemoFixture(content).sessions[0].evaluations[0].applied_result!
          .hypothesis_events[0].supporting_response_quotes,
      ),
      uncertainty_reason: "Synthetic tentative diagnostic evidence.",
    },
  ];
  const orchestration: OrchestrationContext = {
    actor_profile_id: context.evidence.session.student_id,
    evidence: context.evidence,
    content,
    history: [],
    source_scope: context.scope,
    state: {
      ...examples.state,
      active_request_id: request.request_id,
      turns_used: 1,
      progress: { ...examples.state.progress, phase: "evaluate" },
    },
    lesson_policy: ["generate_diagnostic", "advance_lesson"],
    installed_tools: ["generate_diagnostic", "advance_lesson"],
    instructional_scope: {
      question_concept_ids: [...context.attempt.question.concept_ids],
      help_concept_ids: null,
    },
  };
  const proposal: TutorProposal = {
    version: ORCHESTRATION_VERSION,
    action: "generate_diagnostic",
    arguments: { target_misconception_ids: [] },
    content_ref: content.content_ref,
    concept_ids: [...context.attempt.question.concept_ids],
    source_passage_ids: ["P07", "P08"],
    reason_summary:
      "Probe the stated reasoning with complete approved coverage.",
  };
  orchestration.source_scope = {
    ...context.scope,
    passage_ids: new Set(context.attempt.question.source_passage_ids),
  };
  const prompt = buildProposalPrompt(
    request,
    orchestration,
    orchestration.installed_tools,
  );
  assert.equal(
    JSON.parse(prompt.input).approved_passages.some(
      (passage: { id: string }) => passage.id === "P05",
    ),
    false,
  );
  assert.throws(() =>
    validateProposal(
      { ...proposal, source_passage_ids: ["P05"] },
      request,
      orchestration,
      orchestration.installed_tools,
    ),
  );
  assert.deepEqual(
    JSON.parse(prompt.input).required_instructional_coverage,
    orchestration.instructional_scope,
  );
  assert.doesNotThrow(() =>
    validateProposal(
      proposal,
      request,
      orchestration,
      orchestration.installed_tools,
    ),
  );
  assert.throws(() =>
    validateProposal(
      { ...proposal, concept_ids: [proposal.concept_ids[0]] },
      request,
      orchestration,
      orchestration.installed_tools,
    ),
  );
  orchestration.state.provider_requests_used = 36;
  assert.throws(() =>
    validateProposal(
      proposal,
      request,
      orchestration,
      orchestration.installed_tools,
    ),
  );
  assert.doesNotThrow(() =>
    validateProposal(
      proposal,
      request,
      orchestration,
      orchestration.installed_tools,
      { completed: true },
    ),
  );
  orchestration.lesson_policy = ["advance_lesson"];
  assert.throws(() =>
    validateProposal(
      proposal,
      request,
      orchestration,
      orchestration.installed_tools,
      { completed: true },
    ),
  );
});
