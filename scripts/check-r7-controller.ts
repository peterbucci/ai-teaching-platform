import { createLessonAssignment } from "../lib/lessons/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { createApprovedRuntimeLesson } from "./fixtures/approved-r7-lesson.ts";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { getPool, inTransaction } from "../lib/db.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import {
  EvaluationSchema,
  type Evaluation,
  type Attempt,
} from "../lib/evidence/contracts.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  readSession,
  readStudentSession,
  acknowledgeIntervention,
} from "../lib/evidence/store.ts";
import {
  evaluationPrompt,
  evaluateSubmittedAttempt,
} from "../lib/evaluation/evaluate.ts";
import {
  loadConversation,
  reserveConversationOperation,
  commitConversationIntent,
  readTeacherConversation,
} from "../lib/dialogue/store.ts";
import { CONVERSATION_VERSION } from "../lib/dialogue/conversation.ts";
import {
  type GeneratedDialogue,
  type DialogueRequest,
} from "../lib/dialogue/contracts.ts";
import { reserveControllerOperation } from "../lib/dialogue/controller-store.ts";
import { createOrchestrationPersistence } from "../lib/dialogue/orchestration-store.ts";
import {
  createReservedCall,
  type ProviderCallDescriptor,
} from "../lib/dialogue/provider-store.ts";
import { runTutorOrchestration } from "../lib/tutoring/orchestration/run.ts";
import {
  ORCHESTRATION_VERSION,
  type TutorProposal,
} from "../lib/tutoring/orchestration/contracts.ts";
import {
  applyTutoring,
  applyTutoringInTransaction,
} from "../lib/tutoring/store.ts";

// Real disposable PostgreSQL + existing service checks with synthetic judgments and
// instructional choices. No model API is called; evidence remains for inspection.
assert.equal(process.env.DIALOGUE_CHECK_SYNTHETIC, "1");
for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD"])
  assert.ok(
    process.env[name],
    `Set ${name} explicitly for the disposable database.`,
  );
const pool = getPool();
let content = loadApprovedContent();
const demo = buildDemoFixture(content);
const recorded = z
  .object({
    cases: z.array(
      z.object({
        caseId: z.string(),
        response: z.string(),
        evaluation: EvaluationSchema,
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync("evals/results/2026-10-16-v2-comparison.json", "utf8"),
    ),
  );
const actor = () =>
  evidenceAccess({
    profileId: randomUUID(),
    userId: `controller-fixture-${randomUUID()}`,
  });
const student = actor(),
  teacher = actor(),
  peer = actor();
const classId = randomUUID();
let assignmentId: string;
const report: {
  fixture_only: true;
  model_calls: 0;
  sessions: string[];
  checks: string[];
  error?: string;
} = { fixture_only: true, model_calls: 0, sessions: [], checks: [] };
const pass = (text: string) => {
  report.checks.push(text);
  console.log(`PASS: ${text}`);
};

async function seed() {
  const role = await pool.query<{ superuser: boolean }>(
    "SELECT rolsuper AS superuser FROM pg_roles WHERE rolname=current_user",
  );
  assert.equal(role.rows[0].superuser, false);
  await inTransaction(async (client) => {
    for (const access of [student, teacher, peer]) {
      await client.query(
        "INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)",
        [
          access.actor.userId,
          "Synthetic R7 controller check",
          `${access.actor.userId}@example.invalid`,
        ],
      );
      await client.query(
        "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
        [
          access.actor.profileId,
          access.actor.userId,
          "Synthetic R7 controller check",
        ],
      );
    }
    await client.query(
      "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)",
      [classId, teacher.actor.profileId, "Synthetic controller checks"],
    );
    for (const access of [student, peer])
      await client.query(
        "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
        [classId, access.actor.profileId],
      );
  });
  ({ assignmentId, content } = await createApprovedRuntimeLesson(
    teacher,
    classId,
  ));
}
async function initial() {
  const session = await startSession(
    student,
    assignmentId,
    "synthetic_fixture",
  );
  const attempt = await presentQuestion(student, session.id, {
    question: getCuratedQuestion(content, content.sequence.initial_question_id),
    intent: "initial_retrieval",
  });
  report.sessions.push(session.id);
  return { sessionId: session.id, attempt };
}
async function answer(sessionId: string, attempt: Attempt, text: string) {
  const view = await loadConversation(student, sessionId);
  const action = {
    version: CONVERSATION_VERSION,
    action: "send_message" as const,
    request_id: randomUUID(),
    session_id: sessionId,
    attempt_id: attempt.id,
    expected_revision: view.dialogue.state.revision,
    text,
  };
  await reserveConversationOperation(student, action);
  await commitConversationIntent(
    student,
    sessionId,
    action.request_id,
    { category: "ANSWER", rationale: "Synthetic established-answer fixture." },
    { answer_intent: "established", disclosure: "safe" },
  );
  const replay = await reserveConversationOperation(student, action);
  assert.equal(replay.replay, true);
  return action;
}
async function judged(
  sessionId: string,
  attempt: Attempt,
  template: Evaluation,
) {
  const value = structuredClone(template);
  const priorEvent = value.applied_result?.hypothesis_events.at(-1);
  if (priorEvent && !value.result?.misconception_candidates?.length)
    value.result!.misconception_candidates = [
      {
        concept_id: priorEvent.concept_id,
        misconception_id: priorEvent.misconception_id,
        status: "tentative",
        uncertainty_reason:
          "Synthetic prior diagnostic fixture; not a durable belief.",
        evidence_quotes: priorEvent.supporting_response_quotes.filter(
          (quote) => quote.response_id === template.attempt_id,
        ),
      },
    ];
  value.id = randomUUID();
  value.attempt_id = attempt.id;
  value.applied_result = null;
  value.supersedes_id = null;
  value.evaluator = {
    type: "synthetic_fixture",
    model: null,
    version: "r7-controller-db-fixture-v1",
  };
  value.result!.source_passage_ids = value.result!.source_passage_ids.filter(
    (id) => attempt.question.source_passage_ids.includes(id),
  );
  value.result!.evidence_quotes = value.result!.evidence_quotes.map(
    (quote) => ({ ...quote, response_id: attempt.id }),
  );
  for (const candidate of value.result!.misconception_candidates ?? [])
    candidate.evidence_quotes = candidate.evidence_quotes.map((quote) => ({
      ...quote,
      response_id: attempt.id,
    }));
  const saved = await recordEvaluation(student, sessionId, value);
  const reused = await evaluateSubmittedAttempt(student, sessionId, attempt.id);
  assert.equal(reused.reused, true);
  assert.equal(reused.provider, null);
  assert.equal(reused.evaluation?.id, saved.id);
  return saved;
}
function generatedQuestion(
  slot: string,
): Extract<GeneratedDialogue, { kind: "question" }> {
  const id = randomUUID();
  const node = content.sequence.nodes.find((item) => item.node_id === slot)!;
  assert.ok(
    node.kind === "diagnostic_followup" ||
      node.kind === "neutral_clarification" ||
      node.kind === "immediate_retest",
  );
  return {
    kind: "question",
    content_id: id,
    intent: node.kind,
    target_misconception_ids: [],
    question: {
      ...getCuratedQuestion(content, slot),
      origin: "generated",
      question_id: id,
      sequence_id: null,
      prompt_text: `Synthetic new conceptual probe ${slot}: explain how the sending and travel intervals depend on packet properties and the path.`,
      generation: {
        model: "synthetic-no-provider",
        prompt_template_version: "controller-db-fixture-v1",
        generated_at: new Date().toISOString(),
      },
    },
  };
}
function generatedHelp(): Extract<GeneratedDialogue, { kind: "help" }> {
  return {
    kind: "help",
    content_id: randomUUID(),
    text: "Synthetic explanation: transmission and propagation describe different intervals; compare the packet's sending interval with its travel interval.",
    assistance_type: "corrective_feedback",
    content_ref: content.content_ref,
    concept_ids: [...content.sequence.concept_ids],
    source_passage_ids: [...content.questions.get("D02")!.source_passage_ids],
    generation: {
      model: "synthetic-no-provider",
      prompt_template_version: "controller-db-fixture-v1",
      generated_at: new Date().toISOString(),
    },
  };
}
function proposal(
  request: DialogueRequest,
  generated: GeneratedDialogue,
): TutorProposal {
  const source = generated.kind === "question" ? generated.question : generated;
  const base: Pick<
    TutorProposal,
    | "version"
    | "content_ref"
    | "concept_ids"
    | "source_passage_ids"
    | "reason_summary"
  > = {
    version: ORCHESTRATION_VERSION,
    content_ref: content.content_ref,
    concept_ids: source.concept_ids,
    source_passage_ids: source.source_passage_ids,
    reason_summary:
      "Synthetic instructional choice for persistence testing; not an AI decision.",
  };
  if (generated.kind === "help")
    return {
      ...base,
      action: "explain",
      arguments: { style: "alternative_explanation" },
    };
  if (generated.intent === "diagnostic_followup")
    return {
      ...base,
      action: "generate_diagnostic",
      arguments: { target_misconception_ids: [] },
    };
  if (generated.intent === "neutral_clarification")
    return {
      ...base,
      action: "generate_followup",
      arguments: { intent: "neutral_clarification" },
    };
  return { ...base, action: "generate_retest", arguments: {} };
}
function descriptor(
  stage: ProviderCallDescriptor["stage"],
): ProviderCallDescriptor {
  return {
    stage,
    step_id: stage,
    model: "synthetic-no-provider",
    prompt_version: "controller-db-fixture-v1",
    input_hash: createHash("sha256").update(stage).digest("hex"),
  };
}
function portsFor(request: DialogueRequest, generated: GeneratedDialogue) {
  const savedCall = createReservedCall(
    student,
    request.session_id,
    request.request_id,
  );
  const calls = { propose: 0, generate: 0, review: 0 };
  return {
    calls,
    ports: {
      ...createOrchestrationPersistence(student, request.session_id, [
        "explain",
        "generate_diagnostic",
        "generate_followup",
        "generate_retest",
        "advance_lesson",
      ]),
      async propose() {
        const saved = await savedCall(descriptor("propose"), async () => {
          calls.propose++;
          return {
            ok: true,
            needs_reconciliation: false,
            result: proposal(request, generated),
          };
        });
        return saved.result;
      },
      async generate() {
        const saved = await savedCall(descriptor("generate"), async () => {
          calls.generate++;
          return { ok: true, needs_reconciliation: false, result: generated };
        });
        await savedCall(descriptor("review"), async () => {
          calls.review++;
          return {
            ok: true,
            needs_reconciliation: false,
            result: "Synthetic trusted review",
          };
        });
        return {
          content: saved.result,
          review: {
            grounding: "supported" as const,
            disclosure: "safe_scaffolding" as const,
            permitted_by_controller: true,
          },
        };
      },
    },
  };
}
async function execute(
  sessionId: string,
  evaluation: Evaluation,
  generated: GeneratedDialogue,
) {
  const reserved = await reserveControllerOperation(
    student,
    sessionId,
    evaluation.id,
  );
  assert.equal(
    (await reserveControllerOperation(student, sessionId, evaluation.id))
      .replay,
    true,
  );
  const fixture = portsFor(reserved.request, generated);
  const receipt = await runTutorOrchestration(reserved.request, fixture.ports);
  assert.equal(receipt.status, "executed", JSON.stringify(receipt));
  const before = await readSession(student, sessionId, "student");
  const repeated = await runTutorOrchestration(reserved.request, fixture.ports);
  assert.deepEqual(repeated, receipt);
  assert.deepEqual(fixture.calls, { propose: 1, generate: 1, review: 1 });
  assert.deepEqual(await readSession(student, sessionId, "student"), before);
  return before;
}

async function main() {
  await seed();
  const { sessionId, attempt } = await initial();
  const initialCase = recorded.cases.find(
    (item) => item.caseId === "explicit-distance-confusion",
  )!;
  await answer(sessionId, attempt, initialCase.response);
  const firstEvaluation = await judged(
    sessionId,
    attempt,
    initialCase.evaluation,
  );
  const diagnostic = generatedQuestion("D02");
  let evidence = await execute(sessionId, firstEvaluation, diagnostic);
  assert.equal(evidence.attempts.length, 2);
  const next = evidence.attempts[1];
  assert.equal(next.question.question_id, diagnostic.content_id);
  assert.equal(next.question.controller_node_id, "D02");
  assert.equal(evidence.attempts[0].response_text, initialCase.response);
  assert.equal(
    evidence.evaluations.filter((item) => item.attempt_id === attempt.id)
      .length,
    1,
  );
  assert.equal(
    await inTransaction((client) =>
      applyTutoringInTransaction(
        client,
        student,
        sessionId,
        firstEvaluation.id,
        { generatedQuestion: diagnostic },
      ),
    ),
    null,
  );
  pass(
    "Generated diagnostic commits through the existing controller once; duplicate operations and controller application do not create another attempt or paid stage",
  );

  await answer(sessionId, next, demo.sessions[0].attempts[1].response_text!);
  const submitted = (await readSession(student, sessionId, "student"))
    .attempts[1];
  const prompt = JSON.parse(evaluationPrompt(content, submitted).input);
  assert.equal(prompt.question.question_id, diagnostic.content_id);
  assert.deepEqual(prompt.question.rubric, next.question.rubric);
  const secondEvaluation = await judged(
    sessionId,
    next,
    demo.sessions[0].evaluations[1],
  );
  const secondHelp = generatedHelp();
  evidence = await execute(sessionId, secondEvaluation, secondHelp);
  assert.equal(evidence.attempts.length, 3);
  const help = evidence.interventions.at(-1)!;
  assert.equal(help.delivery_status, "created");
  assert.equal(help.visible_at, null);
  assert.equal(
    evidence.attempts[1].assistance!.assistance_level,
    "none_recorded",
  );
  await assert.rejects(
    submitAnswer(student, sessionId, {
      attempt_id: evidence.attempts[2].id,
      submission_key: randomUUID(),
      response_text: "Too early",
    }),
  );
  await acknowledgeIntervention(student, sessionId, help.id);
  await acknowledgeIntervention(student, sessionId, help.id);
  pass(
    "New generated-question response uses its private snapshot in the existing evaluator; controller explanation remains unassisted until actual display acknowledgment",
  );

  const retest = evidence.attempts[2];
  await answer(sessionId, retest, demo.sessions[0].attempts[2].response_text!);
  const retestEvaluation = await judged(
    sessionId,
    retest,
    demo.sessions[0].evaluations[2],
  );
  const generatedRetest = generatedQuestion("D06");
  evidence = await execute(sessionId, retestEvaluation, generatedRetest);
  assert.equal(
    evidence.attempts[2].assistance!.assistance_level,
    "corrective_feedback",
  );
  assert.equal(evidence.attempts[3].question.controller_node_id, "D06");
  await answer(
    sessionId,
    evidence.attempts[3],
    demo.sessions[0].attempts[3].response_text!,
  );
  const finalEvaluation = await judged(
    sessionId,
    evidence.attempts[3],
    demo.sessions[0].evaluations[3],
  );
  await applyTutoring(student, sessionId, finalEvaluation.id);
  evidence = await readSession(student, sessionId, "student");
  assert.equal(evidence.session.status, "completed");
  assert.equal(evidence.attempts[0].outcome?.outcome, "correct_after_feedback");
  const studentView = JSON.stringify(
    await readStudentSession(student, sessionId),
  );
  assert.ok(
    !studentView.includes('"rubric"') &&
      !studentView.includes('"controller_node_id"'),
  );
  const teacherView = await readTeacherConversation(teacher, sessionId);
  assert.ok(JSON.stringify(teacherView).includes(diagnostic.content_id));
  await assert.rejects(readTeacherConversation(peer, sessionId));
  await assert.rejects(loadConversation(peer, sessionId));
  const beforeRead = JSON.stringify(evidence);
  await loadConversation(student, sessionId);
  assert.equal(
    JSON.stringify(await readSession(student, sessionId, "student")),
    beforeRead,
  );
  pass(
    "Generated retest completes the same authored sequence, preserves assisted outcome, recovers read-only, and is inspectable only by the authorized teacher",
  );

  const failure = await initial();
  await answer(failure.sessionId, failure.attempt, initialCase.response);
  const failedEval = await judged(
    failure.sessionId,
    failure.attempt,
    initialCase.evaluation,
  );
  const request = (
    await reserveControllerOperation(student, failure.sessionId, failedEval.id)
  ).request;
  const invalid = generatedQuestion("D02");
  invalid.question.content_ref = {
    ...invalid.question.content_ref,
    content_version: "unapproved-version",
  };
  const failureFixture = portsFor(request, invalid);
  const failedReceipt = await runTutorOrchestration(
    request,
    failureFixture.ports,
  );
  assert.equal(failedReceipt.status, "stopped");
  let retained = await readSession(student, failure.sessionId, "student");
  assert.equal(retained.attempts.length, 1);
  assert.equal(retained.evaluations[0].applied_result, null);
  assert.equal(retained.attempts[0].response_text, initialCase.response);
  await applyTutoring(student, failure.sessionId, failedEval.id);
  retained = await readSession(student, failure.sessionId, "student");
  assert.equal(retained.attempts[1].question.origin, "curated");
  const callsBefore = { ...failureFixture.calls };
  await runTutorOrchestration(request, failureFixture.ports);
  assert.deepEqual(failureFixture.calls, callsBefore);
  pass(
    "Invalid generated source leaves the original answer/evaluation intact; explicit authored continuation works and stale replay starts no extra stage",
  );

  content = loadApprovedContent();
  const authoredAssignment = await createLessonAssignment(teacher, {
    class_id: classId,
    lesson_id: content.content_ref.package_id,
    version: content.content_ref.content_version,
    title: "Synthetic runtime-disabled controller check",
  });
  assignmentId = authoredAssignment.id;
  const approval = await assignmentReview(teacher, assignmentId);
  await approveAssignment(teacher, assignmentId, approval.review_token);
  const disabled = await initial();
  await answer(disabled.sessionId, disabled.attempt, initialCase.response);
  const disabledEvaluation = await judged(
    disabled.sessionId,
    disabled.attempt,
    initialCase.evaluation,
  );
  const beforeDenied = await readSession(
    student,
    disabled.sessionId,
    "student",
  );
  const forged = structuredClone(content);
  forged.activity_policy.allow_runtime_generation = true;
  await assert.rejects(
    inTransaction((client) =>
      applyTutoringInTransaction(
        client,
        student,
        disabled.sessionId,
        disabledEvaluation.id,
        { content: forged, generatedQuestion: generatedQuestion("D02") },
      ),
    ),
    /not permitted by the published lesson policy/,
  );
  assert.deepEqual(
    await readSession(student, disabled.sessionId, "student"),
    beforeDenied,
  );
  await applyTutoring(student, disabled.sessionId, disabledEvaluation.id);
  const fallback = await readSession(student, disabled.sessionId, "student");
  assert.deepEqual(
    fallback.attempts[1].question,
    getCuratedQuestion(content, "D02"),
  );
  pass(
    "Final controller commit reloads published runtime policy despite a forged caller context; denial preserves evidence and the authored fallback remains available",
  );
}
try {
  await main();
} catch (error) {
  report.error = error instanceof Error ? error.message : "Unknown failure";
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(report, null, 2));
  await pool.end();
}
