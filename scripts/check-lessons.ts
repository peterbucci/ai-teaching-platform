import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import {
  EvidenceError,
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  readSession,
  readStudentSession,
  recordEvaluation,
} from "../lib/evidence/store.ts";
import type { EvidenceAccess } from "../lib/evidence/store.ts";
import type {
  Attempt,
  MisconceptionCandidate,
} from "../lib/evidence/contracts.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { evaluationPrompt } from "../lib/evaluation/evaluate.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import {
  studentReading,
  openPassage,
} from "../lib/assignments/student-reading.ts";
import { studentReader } from "../lib/reading/student-reader.ts";
import { studentDashboard } from "../lib/tutoring/dashboard.ts";
import {
  applyTutoring,
  startTutoring,
  studentStudyHistory,
} from "../lib/tutoring/store.ts";
import {
  saveLessonDraft,
  readLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
  readAssignmentContent,
} from "../lib/lessons/store.ts";
import {
  createSourceVersion,
  readSourceVersion,
} from "../lib/lessons/sources.ts";
import type { CreateSourceVersionInput } from "../lib/lessons/sources.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Run after db:migrate against a dedicated local development database. Each run
// retains labeled fictional records because published versions/evidence are immutable.
// No authentication server or paid model call is used by this service/SQL check.
const db = getPool();
const run = randomUUID();
const ownedClass = randomUUID();
const secondClass = randomUUID();
const foreignClass = randomUUID();
async function actor(label: string): Promise<EvidenceAccess> {
  const profileId = randomUUID();
  const userId = `lesson-check-${profileId}`;
  await db.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
    userId,
    `Synthetic lesson check: ${label}`,
    `${profileId}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
    [profileId, userId, `Synthetic lesson check: ${label}`],
  );
  return evidenceAccess({ profileId, userId });
}
async function denied(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}
async function activate(access: EvidenceAccess, id: string) {
  const preview = await assignmentReview(access, id);
  assert.equal(preview.teacher_approved_at, null);
  return approveAssignment(access, id, preview.review_token);
}
async function fixtureEvaluation(
  access: EvidenceAccess,
  sessionId: string,
  attempt: Attempt,
  correct: boolean,
  candidate?: Pick<MisconceptionCandidate, "concept_id" | "misconception_id">,
) {
  assert.ok(attempt.response_text);
  const quote = {
    response_id: attempt.id,
    quote: attempt.response_text,
    start_character: 0,
    end_character: Array.from(attempt.response_text).length,
    interpretation: "Deterministic fixture judgment of these exact words.",
  };
  const result = await recordEvaluation(access, sessionId, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "lesson-registry-check-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: attempt.question.concept_ids.map((concept_id) => ({
        concept_id,
        correctness: correct ? "correct" : "incorrect",
        error_type: correct ? null : "conceptual",
        rubric_criteria_met: correct
          ? ["Explains the reviewed relationship"]
          : [],
        rubric_criteria_missing: correct
          ? []
          : ["Explains the reviewed relationship"],
      })),
      source_passage_ids: attempt.question.source_passage_ids,
      evidence_quotes: [quote],
      misconception_candidates: candidate
        ? [
            {
              ...candidate,
              status: "tentative",
              evidence_quotes: [quote],
              uncertainty_reason:
                "This response alone does not establish a persistent misconception.",
            },
          ]
        : [],
      reasoning_observed: "Synthetic fixture judgment; no model was called.",
      uncertainty_reason: null,
      proposed_next_action: correct ? "END_SESSION" : "ASK_DIAGNOSTIC_FOLLOWUP",
    },
  });
  return result;
}

try {
  const teacher = await actor("owner teacher");
  const otherTeacher = await actor("other teacher");
  const student = await actor("enrolled student");
  const outsider = await actor("other class student");
  for (const [id, owner] of [
    [ownedClass, teacher],
    [secondClass, teacher],
    [foreignClass, otherTeacher],
  ] as const)
    await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
      id,
      owner.actor.profileId,
      `Synthetic lesson check ${run}`,
    ]);
  await db.query(
    "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2),($3,$4)",
    [
      ownedClass,
      student.actor.profileId,
      foreignClass,
      outsider.actor.profileId,
    ],
  );

  const sourceInput: CreateSourceVersionInput = {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-water.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  };
  const [source, replayed] = await Promise.all([
    createSourceVersion(teacher, sourceInput),
    createSourceVersion(teacher, sourceInput),
  ]);
  assert.deepEqual(
    replayed,
    source,
    "Concurrent matching requests reuse one immutable source version",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM source_versions WHERE request_id=$1",
        [sourceInput.request_id],
      )
    ).rows[0].count,
    1,
  );
  await denied(
    createSourceVersion(teacher, { ...sourceInput, file_name: "changed.txt" }),
    409,
  );
  await denied(
    createSourceVersion(student, { ...sourceInput, request_id: randomUUID() }),
    403,
  );
  await denied(readSourceVersion(otherTeacher, source.document_id, 1), 404);
  assert.ok(!("original_bytes" in source));
  const revisions = await Promise.allSettled(
    [1, 2].map(() =>
      createSourceVersion(teacher, {
        ...sourceInput,
        request_id: randomUUID(),
        document_id: source.document_id,
        expected_latest_version: 1,
      }),
    ),
  );
  assert.equal(
    revisions.filter((item) => item.status === "fulfilled").length,
    1,
  );
  const failedRevision = revisions.find((item) => item.status === "rejected");
  assert.ok(
    failedRevision?.status === "rejected" &&
      failedRevision.reason instanceof EvidenceError &&
      failedRevision.reason.status === 409,
  );
  assert.deepEqual(
    (await readSourceVersion(teacher, source.document_id, 1)).source_ref,
    source.source_ref,
  );
  for (const sql of [
    "UPDATE source_versions SET file_name='rewrite' WHERE document_id=$1 AND version=1",
    "DELETE FROM source_versions WHERE document_id=$1 AND version=1",
  ])
    await assert.rejects(db.query(sql, [source.document_id]), /immutable/);

  let draft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic water lesson",
    draft: {},
  });
  await denied(publishLessonVersion(teacher, draft.id, draft.revision), 409);
  await denied(
    createLessonAssignment(teacher, {
      class_id: ownedClass,
      lesson_id: draft.id,
      version: "1",
      title: "Unavailable draft",
    }),
    404,
  );
  await denied(readLessonDraft(otherTeacher, draft.id), 404);
  const lesson = makeTeacherLesson(source.source_ref, draft.id, "1");
  const badLesson = structuredClone(lesson);
  badLesson.questions[0].source_passage_ids = ["P08"];
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: badLesson,
  });
  await assert.rejects(approveLessonDraft(teacher, draft.id, draft.revision));
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: lesson,
  });
  await denied(
    saveLessonDraft(teacher, {
      lesson_id: draft.id,
      expected_revision: draft.revision - 1,
      title: draft.title,
      draft: lesson,
    }),
    409,
  );
  await approveLessonDraft(teacher, draft.id, draft.revision);
  const published = await publishLessonVersion(
    teacher,
    draft.id,
    draft.revision,
  );
  assert.deepEqual(
    await publishLessonVersion(teacher, draft.id, draft.revision),
    published,
  );
  for (const sql of [
    "UPDATE lesson_versions SET version='changed' WHERE lesson_id=$1 AND version='1'",
    "DELETE FROM lesson_versions WHERE lesson_id=$1 AND version='1'",
  ])
    await assert.rejects(db.query(sql, [draft.id]), /immutable/);

  const extracted = await createSourceVersion(teacher, {
    ...sourceInput,
    request_id: randomUUID(),
    review_status: "extracted",
  });
  let unapproved = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Unapproved source probe",
    draft: {},
  });
  unapproved = await saveLessonDraft(teacher, {
    lesson_id: unapproved.id,
    expected_revision: unapproved.revision,
    title: unapproved.title,
    draft: makeTeacherLesson(extracted.source_ref, unapproved.id, "1"),
  });
  await denied(
    approveLessonDraft(teacher, unapproved.id, unapproved.revision),
    409,
  );

  const assignment = await createLessonAssignment(teacher, {
    class_id: ownedClass,
    lesson_id: draft.id,
    version: "1",
    title: "Synthetic water v1",
  });
  const sameOwnerClass = await createLessonAssignment(teacher, {
    class_id: secondClass,
    lesson_id: draft.id,
    version: "1",
    title: "Synthetic other classroom",
  });
  await denied(
    createLessonAssignment(teacher, {
      class_id: foreignClass,
      lesson_id: draft.id,
      version: "1",
      title: "Wrong class",
    }),
    404,
  );
  await denied(
    createLessonAssignment(otherTeacher, {
      class_id: foreignClass,
      lesson_id: draft.id,
      version: "1",
      title: "Wrong lesson owner",
    }),
    404,
  );
  await denied(
    readAssignmentContent(otherTeacher, assignment.id, "teacher"),
    404,
  );
  await denied(readAssignmentContent(outsider, assignment.id, "student"), 404);
  await denied(
    readAssignmentContent(student, sameOwnerClass.id, "student"),
    404,
  );
  await denied(startSession(student, assignment.id), 409);
  await denied(startTutoring(student, assignment.id), 409);
  await assert.rejects(
    db.query(
      "UPDATE assignments SET content_ref=jsonb_set(content_ref,'{content_version}','\"other\"') WHERE id=$1",
      [assignment.id],
    ),
    /exact authorized/,
  );
  await assert.rejects(
    db.query("UPDATE assignments SET class_id=$2 WHERE id=$1", [
      assignment.id,
      foreignClass,
    ]),
    /exact authorized/,
  );
  await assert.rejects(
    db.query(
      "UPDATE assignments SET approved_passage_ids=ARRAY['P08'] WHERE id=$1",
      [assignment.id],
    ),
    /exact authorized/,
  );
  await activate(teacher, assignment.id);
  const resolved = await readAssignmentContent(
    student,
    assignment.id,
    "student",
  );
  assert.deepEqual([...resolved.concept_ids], ["evaporation", "condensation"]);
  assert.equal(resolved.sequence.diagnostic_options[0].misconception_id, null);
  assert.deepEqual(resolved.content_ref, lesson.content_ref);
  const session = await startSession(
    student,
    assignment.id,
    "synthetic_fixture",
  );
  const originalQuestion = getCuratedQuestion(resolved, "WC-01");
  await assert.rejects(
    presentQuestion(student, session.id, {
      question: { ...originalQuestion, source_passage_ids: ["P08"] },
      intent: "initial_retrieval",
    }),
  );
  await assert.rejects(
    presentQuestion(student, session.id, {
      question: {
        ...originalQuestion,
        content_ref: {
          ...originalQuestion.content_ref,
          content_version: "999",
        },
      },
      intent: "initial_retrieval",
    }),
  );
  const attempt = await presentQuestion(student, session.id, {
    question: originalQuestion,
    intent: "initial_retrieval",
  });
  const originalResponse =
    "Evaporation is gas becoming liquid, while condensation is liquid becoming gas.";
  await submitAnswer(student, session.id, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: originalResponse,
  });
  let saved = await readSession(student, session.id, "student");
  const firstAttempt = saved.attempts[0];
  const prompt = evaluationPrompt(resolved, firstAttempt);
  assert.match(prompt.input, /Water changing state/);
  assert.doesNotMatch(prompt.input, /transmission_delay|NP-TX-01/);
  const reading = await studentReading(student, session.id);
  assert.deepEqual(reading.content_ref, lesson.content_ref);
  assert.equal(reading.sections[0].id, "water-01");
  assert.equal(reading.attribution.url, null);
  assert.doesNotMatch(
    JSON.stringify(reading),
    /answer_guidance|rubric|misconception_ids|original_bytes/,
  );
  await denied(openPassage(student, session.id, { passage_id: "P08" }), 404);
  const firstEvaluation = await fixtureEvaluation(
    student,
    session.id,
    firstAttempt,
    false,
  );
  const next = await applyTutoring(student, session.id, firstEvaluation.id);
  assert.equal(next.progress.phase, "answer");
  saved = await readSession(student, session.id, "student");
  const diagnostic = saved.attempts.at(-1)!;
  assert.equal(diagnostic.question.question_id, "WC-DIAGNOSTIC");
  assert.deepEqual(saved.evaluations[0].applied_result?.hypothesis_events, []);
  const correctResponse =
    "In a wet cloth liquid water becomes gas by evaporation. On a cold mirror gas becomes liquid by condensation.";
  await submitAnswer(student, session.id, {
    attempt_id: diagnostic.id,
    submission_key: randomUUID(),
    response_text: correctResponse,
  });
  const submitted = (
    await readSession(student, session.id, "student")
  ).attempts.at(-1)!;
  const secondEvaluation = await fixtureEvaluation(
    student,
    session.id,
    submitted,
    true,
  );
  assert.equal(
    (await applyTutoring(student, session.id, secondEvaluation.id)).session
      .status,
    "completed",
  );
  const historical = await readSession(teacher, session.id, "teacher");
  const publicView = await readStudentSession(student, session.id);
  assert.doesNotMatch(
    JSON.stringify(publicView),
    /answer_guidance|rubric|misconception_ids|original_bytes/,
  );

  const lessonV2 = makeTeacherLesson(source.source_ref, draft.id, "2");
  lessonV2.questions[0].prompt_text += " Describe both starting states.";
  lessonV2.questions[0].rubric.answer_guidance +=
    " Identify each starting state explicitly.";
  lessonV2.sequence.nodes[0].prompt = lessonV2.questions[0].prompt_text;
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: "Synthetic water v2",
    draft: lessonV2,
  });
  await denied(publishLessonVersion(teacher, draft.id, draft.revision), 409);
  await approveLessonDraft(teacher, draft.id, draft.revision);
  await publishLessonVersion(teacher, draft.id, draft.revision);
  const assignmentV2 = await createLessonAssignment(teacher, {
    class_id: ownedClass,
    lesson_id: draft.id,
    version: "2",
    title: "Synthetic water v2",
  });
  await activate(teacher, assignmentV2.id);
  assert.equal(
    (await readAssignmentContent(student, assignmentV2.id, "student"))
      .content_ref.content_version,
    "2",
  );
  assert.deepEqual(
    await readSession(student, session.id, "student"),
    historical,
  );
  assert.equal(historical.attempts[0].response_text, originalResponse);
  assert.deepEqual(historical.attempts[0].question, originalQuestion);
  assert.deepEqual(
    (await studentReading(student, session.id)).content_ref,
    lesson.content_ref,
  );
  await assert.rejects(
    db.query("UPDATE assignments SET title='rewrite history' WHERE id=$1", [
      assignment.id,
    ]),
    /immutable/,
  );

  // Review regression: a diagnostic must assess the concept whose hypothesis
  // it tests. A correct answer about condensation cannot refute evaporation evidence.
  let scopedDraft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic diagnostic concept scope regression",
    draft: {},
  });
  const scopedLesson = makeTeacherLesson(
    source.source_ref,
    scopedDraft.id,
    "1",
  );
  const misconceptionId = "evaporation_reverses_state_change";
  const misconception = {
    id: misconceptionId,
    definition:
      "Explains evaporation as gas becoming liquid rather than liquid becoming gas.",
    evidence_that_may_support:
      "The original response explicitly states the reversed direction.",
    diagnostic_caution:
      "A single answer does not establish a stable misconception.",
  };
  scopedLesson.misconceptions.push({
    ...misconception,
    concept_id: "evaporation",
  });
  const evaporation = scopedLesson.concepts.find(
    (item) => item.id === "evaporation",
  );
  assert.ok(evaporation);
  evaporation.common_misconceptions.push(misconception);
  scopedLesson.misconception_policy =
    "Test a tentative evaporation direction hypothesis using an approved evaporation diagnostic.";
  scopedLesson.sequence.hypothesis_id = misconceptionId;
  scopedLesson.sequence.diagnostic_options = [
    {
      misconception_id: misconceptionId,
      question_id: "WC-DIAGNOSTIC",
    },
  ];
  const scopedQuestion = scopedLesson.questions.find(
    (item) => item.question_id === "WC-DIAGNOSTIC",
  );
  assert.ok(scopedQuestion);
  scopedQuestion.concept_ids = ["condensation"];
  for (const guidance of scopedLesson.question_guidance) {
    if (["WC-01", "WC-DIAGNOSTIC"].includes(guidance.question_id))
      guidance.misconception_ids = [misconceptionId];
  }
  scopedDraft = await saveLessonDraft(teacher, {
    lesson_id: scopedDraft.id,
    expected_revision: scopedDraft.revision,
    title: scopedDraft.title,
    draft: scopedLesson,
  });
  await assert.rejects(
    approveLessonDraft(teacher, scopedDraft.id, scopedDraft.revision),
    (error: unknown) =>
      error instanceof EvidenceError &&
      error.status === 409 &&
      /Diagnostic must assess its mapped misconception's concept/.test(
        error.message,
      ),
  );
  const rejectedDraft = await readLessonDraft(teacher, scopedDraft.id);
  assert.equal(rejectedDraft.approved_revision, null);
  assert.equal(rejectedDraft.revision, scopedDraft.revision);
  assert.equal(rejectedDraft.draft?.approval, undefined);
  await denied(
    publishLessonVersion(teacher, scopedDraft.id, scopedDraft.revision),
    409,
  );
  // Reproduce a draft approved by the old validator: publishing must recheck
  // compatibility even when a preexisting approval marker is present.
  await db.query(
    "UPDATE lessons SET draft=$2::jsonb,approved_revision=revision WHERE id=$1",
    [scopedDraft.id, JSON.stringify(scopedLesson)],
  );
  await assert.rejects(
    publishLessonVersion(teacher, scopedDraft.id, scopedDraft.revision),
    (error: unknown) =>
      error instanceof EvidenceError &&
      error.status === 409 &&
      /Diagnostic must assess its mapped misconception's concept/.test(
        error.message,
      ),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM lesson_versions WHERE lesson_id=$1",
        [scopedDraft.id],
      )
    ).rows[0].count,
    0,
  );

  // Correct the same draft, then run the real storage/controller path with
  // deterministic judgments. The diagnostic now tests only the relevant concept.
  scopedQuestion.concept_ids = ["evaporation"];
  scopedQuestion.source_passage_ids = ["water-01"];
  scopedQuestion.prompt_text =
    "Wet cloth dries in air. Explain the starting and ending states of its water and name that change.";
  scopedQuestion.rubric.answer_guidance =
    "Liquid water in the cloth becomes water vapor, a gas, by evaporation.";
  scopedQuestion.rubric.criteria = [
    "Explain liquid water changing to gas as evaporation.",
  ];
  const scopedNode = scopedLesson.sequence.nodes.find(
    (item) => item.node_id === "WC-DIAGNOSTIC",
  );
  assert.ok(scopedNode);
  scopedNode.prompt = scopedQuestion.prompt_text;
  scopedNode.expected_answer = scopedQuestion.rubric.answer_guidance;
  scopedNode.source_passage_ids = scopedQuestion.source_passage_ids;
  scopedDraft = await saveLessonDraft(teacher, {
    lesson_id: scopedDraft.id,
    expected_revision: scopedDraft.revision,
    title: scopedDraft.title,
    draft: scopedLesson,
  });
  await approveLessonDraft(teacher, scopedDraft.id, scopedDraft.revision);
  await publishLessonVersion(teacher, scopedDraft.id, scopedDraft.revision);
  const scopedAssignment = await createLessonAssignment(teacher, {
    class_id: ownedClass,
    lesson_id: scopedDraft.id,
    version: "1",
    title: "Synthetic diagnostic scope regression",
  });
  await activate(teacher, scopedAssignment.id);
  const scopedContent = await readAssignmentContent(
    student,
    scopedAssignment.id,
    "student",
  );
  const scopedSession = await startSession(
    student,
    scopedAssignment.id,
    "synthetic_fixture",
  );
  const scopedInitial = await presentQuestion(student, scopedSession.id, {
    question: getCuratedQuestion(scopedContent, "WC-01"),
    intent: "initial_retrieval",
  });
  await submitAnswer(student, scopedSession.id, {
    attempt_id: scopedInitial.id,
    submission_key: randomUUID(),
    response_text: originalResponse,
  });
  const scopedSubmitted = (
    await readSession(student, scopedSession.id, "student")
  ).attempts[0];
  const candidateEvaluation = await fixtureEvaluation(
    student,
    scopedSession.id,
    scopedSubmitted,
    false,
    {
      concept_id: "evaporation",
      misconception_id: misconceptionId,
    },
  );
  const diagnosticView = await applyTutoring(
    student,
    scopedSession.id,
    candidateEvaluation.id,
  );
  assert.deepEqual(
    await applyTutoring(student, scopedSession.id, candidateEvaluation.id),
    diagnosticView,
  );
  const diagnosticEvidence = await readSession(
    student,
    scopedSession.id,
    "student",
  );
  const targetedDiagnostic = diagnosticEvidence.attempts.at(-1)!;
  assert.equal(
    diagnosticEvidence.attempts.length,
    2,
    "Reapplying cannot create a second diagnostic",
  );
  assert.equal(targetedDiagnostic.question.question_id, "WC-DIAGNOSTIC");
  assert.deepEqual(targetedDiagnostic.question.concept_ids, ["evaporation"]);
  const suspected =
    diagnosticEvidence.evaluations[0].applied_result?.hypothesis_events;
  assert.equal(suspected?.length, 1);
  assert.equal(suspected?.[0].status, "suspected");
  assert.equal(suspected?.[0].concept_id, "evaporation");
  await submitAnswer(student, scopedSession.id, {
    attempt_id: targetedDiagnostic.id,
    submission_key: randomUUID(),
    response_text: "Liquid water in the cloth becomes gas by evaporation.",
  });
  const answeredDiagnostic = (
    await readSession(student, scopedSession.id, "student")
  ).attempts.at(-1)!;
  const diagnosticEvaluation = await fixtureEvaluation(
    student,
    scopedSession.id,
    answeredDiagnostic,
    true,
  );
  const completedDiagnostic = await applyTutoring(
    student,
    scopedSession.id,
    diagnosticEvaluation.id,
  );
  assert.equal(completedDiagnostic.session.status, "completed");
  const reconstructed = await readSession(student, scopedSession.id, "student");
  const resolvedHypothesis = reconstructed.evaluations.find(
    (item) => item.id === diagnosticEvaluation.id,
  )?.applied_result?.hypothesis_events;
  assert.equal(resolvedHypothesis?.length, 1);
  assert.equal(resolvedHypothesis?.[0].status, "not_supported");
  assert.equal(resolvedHypothesis?.[0].concept_id, "evaporation");
  assert.deepEqual(resolvedHypothesis?.[0].contradicting_evaluation_ids, [
    diagnosticEvaluation.id,
  ]);
  assert.deepEqual(
    await applyTutoring(student, scopedSession.id, diagnosticEvaluation.id),
    completedDiagnostic,
  );
  assert.deepEqual(
    await readSession(student, scopedSession.id, "student"),
    reconstructed,
  );
  assert.deepEqual(
    await readSession(teacher, scopedSession.id, "teacher"),
    reconstructed,
  );
  assert.equal(reconstructed.attempts[0].response_text, originalResponse);

  const curated = loadApprovedContent();
  const curatedAssignment = await createLessonAssignment(teacher, {
    class_id: ownedClass,
    lesson_id: curated.content_ref.package_id,
    version: curated.content_ref.content_version,
    title: "Synthetic curated regression",
  });
  await activate(teacher, curatedAssignment.id);
  assert.deepEqual(
    (await readAssignmentContent(student, curatedAssignment.id, "student"))
      .content_ref,
    curated.content_ref,
  );
  const curatedView = await startTutoring(student, curatedAssignment.id);
  const curatedSaved = await readSession(
    student,
    curatedView.session.id,
    "student",
  );
  assert.deepEqual(
    curatedSaved.attempts[0].question,
    getCuratedQuestion(curated, "NP-TX-01"),
  );
  assert.equal(
    (await studentReading(student, curatedView.session.id)).sections.length,
    13,
  );
  const dashboard = await studentDashboard(student);
  assert.ok(dashboard.lessons.some((item) => item.id === assignment.id));
  assert.ok(dashboard.lessons.some((item) => item.id === curatedAssignment.id));
  const reader = await studentReader(student, {
    assignmentId: assignment.id,
    contentVersion: "1",
  });
  assert.equal(reader?.reading.content_ref.content_version, "1");
  assert.ok(reader?.readings.some((item) => item.id === curatedAssignment.id));
  await studentStudyHistory(student);
  console.log(
    "PASS: curated and uploaded resolution; source replay/concurrency/revision controls; draft/source approval gates; teacher/class/enrollment authorization; exact refs/passages and SQL guards; immutable source and lesson versions; shared evaluator/controller/reading paths; private student projections; v1 evidence preserved after v2 publication; invalid diagnostic concept scope blocked at approval; corrected diagnostic hypothesis progression and idempotent reconstruction. No model call was made.",
  );
  console.log(
    `Retained labeled synthetic probe ${run} in the configured development database.`,
  );
} finally {
  await db.end();
}
