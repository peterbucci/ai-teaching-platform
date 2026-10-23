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
import type { Attempt } from "../lib/evidence/contracts.ts";
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
) {
  assert.ok(attempt.response_text);
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
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: attempt.response_text,
          start_character: 0,
          end_character: Array.from(attempt.response_text).length,
          interpretation:
            "Deterministic fixture judgment of these exact words.",
        },
      ],
      misconception_candidates: [],
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
    "PASS: curated and uploaded resolution; source replay/concurrency/revision controls; draft/source approval gates; teacher/class/enrollment authorization; exact refs/passages and SQL guards; immutable source and lesson versions; shared evaluator/controller/reading paths; private student projections; v1 evidence preserved after v2 publication. No model call was made.",
  );
  console.log(
    `Retained labeled synthetic probe ${run} in the configured development database.`,
  );
} finally {
  await db.end();
}
