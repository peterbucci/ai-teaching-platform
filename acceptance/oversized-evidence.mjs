// Run only inside the named PR116 or combined acceptance app. Retains its own fictional class.
// Imports reviewed application services; never calls a model or changes application code.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [sourceSha, output = "/tmp/acceptance-oversized-evidence.json"] =
  process.argv.slice(2);
assert.equal(
  existsSync(output),
  false,
  "Choose a fresh fixture output path; preserve prior fixture identities.",
);
assert.match(sourceSha ?? "", /^[a-f0-9]{40}$/);
const allowedProjects = {
  "lp-accept-pr116": "http://localhost:3322",
  "lp-accept-combined": "http://localhost:3325",
};
assert.ok(Object.hasOwn(allowedProjects, process.env.ACCEPTANCE_PROJECT ?? ""));
assert.equal(
  process.env.AUTH_URL,
  allowedProjects[process.env.ACCEPTANCE_PROJECT],
);
const expectedSources = {
  "lp-accept-pr116": "5d6363d2867a6f0250f8220db0474342b1241d00",
  "lp-accept-combined": "545b880749c757f7502a9bfa7fd127afdf290afd",
};
assert.equal(sourceSha, expectedSources[process.env.ACCEPTANCE_PROJECT]);
assert.equal(process.env.PGHOST, "db");
assert.equal(process.env.PGDATABASE, "learning_platform");
assert.equal(process.env.OPENAI_API_KEY?.trim() ?? "", "");
assert.equal(process.env.OPENAI_MODEL?.trim() ?? "", "");
assert.equal(process.cwd(), "/app");
const app = (name) => import(pathToFileURL(join(process.cwd(), name)).href);
const { getPool } = await app("lib/db.ts");
const { DEMO_IDS } = await app("lib/evidence/demo.ts");
const { loadApprovedContent, getCuratedQuestion } = await app(
  "lib/evidence/content.ts",
);
const {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
} = await app("lib/evidence/store.ts");
const { assignmentReview, approveAssignment } = await app(
  "lib/assignments/store.ts",
);
const { readAssignmentEvidence } = await app("lib/teacher/store.ts");
const { buildInterventionEvidence } = await app(
  "lib/interventions/evidence.ts",
);
const { InterventionSelectionSchema } = await app(
  "lib/interventions/contracts.ts",
);
const db = getPool();
const classId = randomUUID();
const assignmentId = randomUUID();
const report = {
  sourceSha,
  category:
    "provider-disabled PostgreSQL; authored synthetic accepted evaluations; browser narrowing unrun by this script",
  fixture:
    "61 fictional students, one preserved response each, new isolated class and assignment",
  project: process.env.ACCEPTANCE_PROJECT,
  startedAt: new Date().toISOString(),
  classId,
  assignmentId,
  created: [],
  paidCalls: 0,
  status: "running",
};
try {
  const teacherRow = await db.query(
    "SELECT auth_user_id FROM profiles WHERE id=$1",
    [DEMO_IDS.teacher],
  );
  assert.equal(teacherRow.rowCount, 1, "Seed fictional demo accounts first");
  const teacher = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: teacherRow.rows[0].auth_user_id,
  });
  const baseline = await readAssignmentEvidence(
    teacher,
    DEMO_IDS.assignmentId,
    "all",
  );
  const beforeRequests = await db.query(
    "SELECT count(*)::int AS count FROM teacher_intervention_requests",
  );
  const content = loadApprovedContent();
  report.contentRef = content.content_ref;
  const question = getCuratedQuestion(content, "NP-TX-01");
  await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    classId,
    DEMO_IDS.teacher,
    "Independent acceptance: oversized evidence (fictional)",
  ]);
  const cloned = await db.query(
    `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval)
    SELECT $1,$2,'Independent acceptance: 61 synthetic responses',content_ref,approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval FROM assignments WHERE id=$3`,
    [assignmentId, classId, DEMO_IDS.assignmentId],
  );
  assert.equal(cloned.rowCount, 1);
  const review = await assignmentReview(teacher, assignmentId);
  await approveAssignment(teacher, assignmentId, review.review_token);
  for (let index = 1; index <= 61; index++) {
    const studentId = randomUUID();
    const userId = `acceptance-oversized-${studentId}`;
    const name = `Acceptance learner ${String(index).padStart(2, "0")} (fictional)`;
    await db.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
      userId,
      name,
      `${studentId}@example.invalid`,
    ]);
    await db.query(
      "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
      [studentId, userId, name],
    );
    await db.query(
      "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)",
      [classId, studentId],
    );
    const student = evidenceAccess({ profileId: studentId, userId });
    const session = await startSession(
      student,
      assignmentId,
      "synthetic_fixture",
    );
    const attempt = await presentQuestion(student, session.id, {
      question,
      intent: "initial_retrieval",
    });
    const correct = index % 2 === 0;
    const response = correct
      ? `Fictional response ${index}: ${question.rubric.answer_guidance}`
      : `Fictional response ${index}: doubling cable length doubles transmission delay because bits have twice as far to travel.`;
    await submitAnswer(student, session.id, {
      attempt_id: attempt.id,
      submission_key: randomUUID(),
      response_text: response,
    });
    const evaluationId = randomUUID();
    await recordEvaluation(student, session.id, {
      id: evaluationId,
      attempt_id: attempt.id,
      validation_status: "accepted",
      evaluator: {
        type: "synthetic_fixture",
        model: null,
        version: "acceptance-oversized-v1",
      },
      supersedes_id: null,
      applied_result: null,
      failure_reason: null,
      result: {
        per_concept_results: question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness: correct ? "correct" : "incorrect",
          error_type: correct ? null : "conceptual",
          rubric_criteria_met: correct ? question.rubric.criteria : [],
          rubric_criteria_missing: correct ? [] : question.rubric.criteria,
        })),
        source_passage_ids: question.source_passage_ids,
        evidence_quotes: [
          {
            response_id: attempt.id,
            quote: response,
            start_character: 0,
            end_character: Array.from(response).length,
            interpretation:
              "Explicitly authored synthetic acceptance fixture, not a model judgment.",
          },
        ],
        reasoning_observed:
          "Synthetic fixture verifies evidence selection bounds, not instructional quality.",
        uncertainty_reason: null,
        proposed_next_action: correct
          ? "SCHEDULE_REVIEW"
          : "ASK_DIAGNOSTIC_FOLLOWUP",
      },
    });
    report.created.push({
      studentId,
      sessionId: session.id,
      attemptId: attempt.id,
      acceptedEvaluationId: evaluationId,
      response,
    });
  }
  const snapshot = await readAssignmentEvidence(
    teacher,
    assignmentId,
    "synthetic_fixture",
  );
  assert.equal(snapshot.students.length, 61);
  const selection = {
    assignment_id: assignmentId,
    concept_id: "transmission_delay",
    misconception_id: null,
    attempt_ids: [],
    origin: "synthetic_fixture",
  };
  assert.throws(
    () => buildInterventionEvidence(snapshot, content, selection),
    /too much evidence/,
  );
  assert.equal(
    InterventionSelectionSchema.safeParse({
      ...selection,
      attempt_ids: report.created.map((row) => row.attemptId),
    }).success,
    false,
    "Explicit 61-ID selection must be rejected before generation",
  );
  const narrowed = buildInterventionEvidence(snapshot, content, {
    ...selection,
    attempt_ids: [report.created[0].attemptId],
  });
  assert.equal(narrowed.counts.selected_students, 1);
  assert.equal(narrowed.counts.selected_responses, 1);
  assert.equal(
    narrowed.observations[0].attempt.response_text,
    report.created[0].response,
  );
  assert.equal(
    narrowed.observations[0].evaluation.id,
    report.created[0].acceptedEvaluationId,
  );
  assert.deepEqual(
    await readAssignmentEvidence(teacher, DEMO_IDS.assignmentId, "all"),
    baseline,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM teacher_intervention_requests",
      )
    ).rows,
    beforeRequests.rows,
  );
  report.checks = [
    "61 accepted responses are refused without truncation",
    "Explicit 61 attempt IDs fail the request schema",
    "One-student selection narrows safely with exact response/evaluation preserved",
    "Original demo assignment evidence unchanged",
    "No intervention generation request created",
  ];
  report.browserUrl = `${process.env.AUTH_URL}/teacher/interventions?assignment=${assignmentId}&concept=transmission_delay&origin=synthetic_fixture`;
  report.narrowedBrowserUrl = `${report.browserUrl}&seedAttempt=${report.created[0].attemptId}`;
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: report.status,
      sourceSha,
      output,
      classId,
      assignmentId,
      createdStudents: report.created.length,
      browserUrl: report.browserUrl,
      error: report.error,
    }),
  );
  await db.end();
}
