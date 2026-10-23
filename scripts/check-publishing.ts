import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { getCuratedQuestion } from "../lib/evidence/content.ts";
import type { Attempt } from "../lib/evidence/contracts.ts";
import {
  EvidenceError,
  evidenceAccess,
  presentQuestion,
  readSession,
  readStudentSession,
  recordEvaluation,
  startSession,
  submitAnswer,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import { evaluationPrompt } from "../lib/evaluation/evaluate.ts";
import {
  approveAssignment,
  assignmentReview,
} from "../lib/assignments/store.ts";
import { studentReading } from "../lib/assignments/student-reading.ts";
import {
  approveLessonDraft,
  assembleReviewedLessonDraft,
  createLessonAssignment,
  publishLessonVersion,
  readAssignmentContent,
  readLessonDraft,
  saveLessonDraft,
} from "../lib/lessons/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  createObjectiveDraft,
  saveObjectiveDraft,
  approveObjectives,
} from "../lib/objectives/store.ts";
import { updateQuestionBank } from "../lib/question-bank/store.ts";
import { makeQuestionBankObjectiveEdits } from "../tests/fixtures/question-bank-objectives.ts";
import {
  DEFAULT_QUESTION_BANK_PREFERENCES,
  QuestionBankMetadataSchema,
} from "../lib/question-bank/contracts.ts";
import { studentReader } from "../lib/reading/student-reader.ts";
import { studentDashboard } from "../lib/tutoring/dashboard.ts";
import {
  lessonPublishingReview,
  listTeacherLessons,
  readPublishedLessonForReview,
} from "../lib/lessons/publishing.ts";
import {
  readAssignmentEvidence,
  readTeacherSession,
} from "../lib/teacher/store.ts";
import { applyTutoring, startTutoring } from "../lib/tutoring/store.ts";
import {
  makeTeacherLesson,
  makeTeacherSourceReference,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Run after db:migrate against a dedicated local development database. This is a
// service/SQL integration check with original synthetic material and fixture
// evaluations, not a browser test, importer/generator test, or actual-model test.
// Immutable, clearly labeled fictional records are retained for inspection.
const db = getPool();
const run = randomUUID();

async function actor(label: string): Promise<EvidenceAccess> {
  const profileId = randomUUID();
  const userId = `publishing-check-${profileId}`;
  const name = `Synthetic publishing check: ${label}`;
  await db.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
    userId,
    name,
    `${profileId}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
    [profileId, userId, name],
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

async function evaluateFixture(
  access: EvidenceAccess,
  sessionId: string,
  attempt: Attempt,
  correct: boolean,
) {
  assert.ok(attempt.response_text);
  return recordEvaluation(access, sessionId, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "publishing-check-v1",
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
          ? ["Explains the reviewed state changes"]
          : [],
        rubric_criteria_missing: correct
          ? []
          : ["Explains the reviewed state changes"],
      })),
      source_passage_ids: attempt.question.source_passage_ids,
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: attempt.response_text,
          start_character: 0,
          end_character: Array.from(attempt.response_text).length,
          interpretation:
            "Explicit synthetic fixture judgment of the preserved response.",
        },
      ],
      misconception_candidates: [],
      reasoning_observed: "Synthetic fixture judgment; no model was called.",
      uncertainty_reason: null,
      proposed_next_action: correct ? "END_SESSION" : "ASK_DIAGNOSTIC_FOLLOWUP",
    },
  });
}

try {
  const teacher = await actor("owner teacher");
  const otherTeacher = await actor("unrelated teacher");
  const studentA = await actor("class A student");
  const studentB = await actor("class B student");
  const classA = randomUUID();
  const classB = randomUUID();
  const foreignClass = randomUUID();
  for (const [id, owner, label] of [
    [classA, teacher, "A"],
    [classB, teacher, "B"],
    [foreignClass, otherTeacher, "foreign"],
  ] as const) {
    await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
      id,
      owner.actor.profileId,
      `Synthetic publishing ${run}: ${label}`,
    ]);
  }
  await db.query(
    "INSERT INTO enrollments(class_id,student_id) VALUES($1,$2),($3,$4)",
    [classA, studentA.actor.profileId, classB, studentB.actor.profileId],
  );

  const sourceInput = {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-publishing-water.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved" as const,
    permitted_use: true as const,
  };
  const source = await createSourceVersion(teacher, sourceInput);

  // Exercise real #50 objective save/approval and #51 bank save/approval services.
  // Inputs are source-backed synthetic teacher edits, not generated model output.
  let bankDraft = await createObjectiveDraft(teacher, {
    request_id: randomUUID(),
    title: "Synthetic reviewed-bank assembly check",
    source_id: source.document_id,
    source_version: source.version,
  });
  const objectiveEdits = makeQuestionBankObjectiveEdits();
  bankDraft = await saveObjectiveDraft(teacher, {
    lesson_id: bankDraft.id,
    expected_revision: bankDraft.revision,
    title: bankDraft.title,
    items: objectiveEdits,
  });
  bankDraft = await approveObjectives(teacher, {
    lesson_id: bankDraft.id,
    expected_revision: bankDraft.revision,
  });
  assert.equal(
    bankDraft.draft?.objective_workflow?.reviewed?.reviewed_by,
    teacher.actor.profileId,
  );
  const bank = makeTeacherLesson(source.source_ref, bankDraft.id, "1");
  const questions = bank.questions.map((question) => ({
    ...question,
    concept_ids: objectiveEdits.map((item) => item.concept_id),
  }));
  const roles = ["initial", "alternative", "diagnostic", "retest", "retest"];
  const metadata = QuestionBankMetadataSchema.parse({
    preferences: DEFAULT_QUESTION_BANK_PREFERENCES,
    items: questions.map((question, index) => ({
      question_id: question.question_id,
      family_id: "water-state",
      role: roles[index],
      format: "short_answer",
      difficulty: "intermediate",
      feedback_guidance:
        "Evaporation changes liquid water to vapor; condensation changes vapor to liquid. Compare the starting and ending states.",
      reasoning_error: null,
      source_support: question.rubric.criteria.map(
        (criterion, criterionIndex) => ({
          passage_id: bank.passages[criterionIndex].id,
          quote: bank.passages[criterionIndex].text.split(". ")[0] + ".",
          criterion,
        }),
      ),
      calculation: null,
      review_status: "reviewed",
      review_notes: "Reviewed synthetic example; no model call.",
      quality_issues: [],
    })),
    approval: null,
  });
  const noGenerationProvider = async () => {
    throw new Error(
      "Publishing service check must not call a generation provider.",
    );
  };
  await updateQuestionBank(
    teacher,
    bankDraft.id,
    {
      action: "save",
      expected_revision: bankDraft.revision,
      questions,
      question_guidance: bank.question_guidance,
      question_bank: metadata,
      activity_policy: bank.activity_policy,
    },
    noGenerationProvider,
  );
  bankDraft = await readLessonDraft(teacher, bankDraft.id);
  assert.equal(bankDraft.draft?.question_bank?.approval, null);
  await denied(
    assembleReviewedLessonDraft(teacher, bankDraft.id, bankDraft.revision),
    409,
  );
  await denied(
    updateQuestionBank(
      otherTeacher,
      bankDraft.id,
      {
        action: "approve",
        expected_revision: bankDraft.revision,
      },
      noGenerationProvider,
    ),
    404,
  );
  await denied(
    updateQuestionBank(
      teacher,
      bankDraft.id,
      {
        action: "approve",
        expected_revision: bankDraft.revision - 1,
      },
      noGenerationProvider,
    ),
    409,
  );
  await updateQuestionBank(
    teacher,
    bankDraft.id,
    {
      action: "approve",
      expected_revision: bankDraft.revision,
    },
    noGenerationProvider,
  );
  bankDraft = await readLessonDraft(teacher, bankDraft.id);
  const reviewedBank = bankDraft.draft?.question_bank;
  assert.equal(reviewedBank?.approval?.reviewed_by, teacher.actor.profileId);
  await denied(
    assembleReviewedLessonDraft(otherTeacher, bankDraft.id, bankDraft.revision),
    404,
  );
  const bankRevision = bankDraft.revision;
  const assembled = await assembleReviewedLessonDraft(
    teacher,
    bankDraft.id,
    bankRevision,
    "water-state",
  );
  assert.equal(assembled.revision, bankRevision + 1);
  assert.equal(
    assembled.approved_revision,
    null,
    "Assembly does not approve the lesson",
  );
  assert.deepEqual(assembled.draft?.question_bank, reviewedBank);
  assert.ok(assembled.draft?.sequence);
  await denied(
    assembleReviewedLessonDraft(
      teacher,
      bankDraft.id,
      bankRevision,
      "water-state",
    ),
    409,
  );
  assert.equal(
    (await readLessonDraft(teacher, bankDraft.id)).revision,
    assembled.revision,
  );
  await denied(
    publishLessonVersion(teacher, bankDraft.id, assembled.revision),
    409,
  );
  await approveLessonDraft(teacher, bankDraft.id, assembled.revision);
  const bankPublication = await publishLessonVersion(
    teacher,
    bankDraft.id,
    assembled.revision,
  );
  assert.deepEqual(
    await publishLessonVersion(teacher, bankDraft.id, assembled.revision),
    bankPublication,
  );
  const publishedBank = await readPublishedLessonForReview(
    teacher,
    bankDraft.id,
    "1",
  );
  assert.equal("question_bank" in publishedBank, false);
  assert.equal("objective_workflow" in publishedBank, false);
  assert.equal(publishedBank.sequence.initial_question_id, "WC-01");
  assert.deepEqual(
    (await readLessonDraft(teacher, bankDraft.id)).draft?.question_bank,
    reviewedBank,
  );
  let draft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic publishing water lesson",
    draft: {},
  });
  const incompleteReview = await lessonPublishingReview(teacher, draft.id);
  assert.equal(incompleteReview.validation.valid, false);
  assert.ok(incompleteReview.validation.issues.length > 0);
  assert.equal(incompleteReview.lesson.approved_revision, null);
  await denied(lessonPublishingReview(studentA, draft.id), 404);
  await denied(listTeacherLessons(studentA), 403);
  assert.ok(
    (await listTeacherLessons(teacher)).some(
      (lesson) => lesson.id === draft.id,
    ),
  );
  await assert.rejects(approveLessonDraft(teacher, draft.id, draft.revision));
  await denied(publishLessonVersion(teacher, draft.id, draft.revision), 409);
  await denied(readLessonDraft(otherTeacher, draft.id), 404);
  await denied(approveLessonDraft(studentA, draft.id, draft.revision), 404);
  await denied(
    createLessonAssignment(teacher, {
      request_id: randomUUID(),
      class_id: classA,
      lesson_id: draft.id,
      version: "1",
      title: "Unpublished lesson must not assign",
    }),
    404,
  );

  // A syntactically complete package cannot substitute for a saved, approved source.
  for (const reviewStatus of ["missing", "extracted"] as const) {
    const reference =
      reviewStatus === "missing"
        ? makeTeacherSourceReference(randomUUID(), teacher.actor.profileId)
        : (
            await createSourceVersion(teacher, {
              ...sourceInput,
              request_id: randomUUID(),
              review_status: "extracted",
            })
          ).source_ref;
    let invalid = await saveLessonDraft(teacher, {
      expected_revision: 0,
      title: `Synthetic ${reviewStatus} source check`,
      draft: {},
    });
    invalid = await saveLessonDraft(teacher, {
      lesson_id: invalid.id,
      expected_revision: invalid.revision,
      title: invalid.title,
      draft: makeTeacherLesson(reference, invalid.id, "1"),
    });
    await denied(
      approveLessonDraft(teacher, invalid.id, invalid.revision),
      reviewStatus === "missing" ? 404 : 409,
    );
    await denied(
      publishLessonVersion(teacher, invalid.id, invalid.revision),
      409,
    );
  }

  const lessonV1 = makeTeacherLesson(source.source_ref, draft.id, "1");
  const invalidScope = structuredClone(lessonV1);
  invalidScope.questions[0].source_passage_ids = ["P08"];
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: invalidScope,
  });
  const invalidScopeReview = await lessonPublishingReview(teacher, draft.id);
  assert.equal(invalidScopeReview.validation.valid, false);
  assert.ok(
    invalidScopeReview.validation.issues.some(
      (issue) =>
        issue.path === "content" &&
        issue.message === "Unknown question passage ID",
    ),
  );
  await denied(approveLessonDraft(teacher, draft.id, draft.revision), 409);
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: lessonV1,
  });
  await approveLessonDraft(teacher, draft.id, draft.revision);
  const previousRevision = draft.revision;
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: lessonV1,
  });
  assert.equal(
    draft.approved_revision,
    null,
    "Editing invalidates prior approval",
  );
  await denied(approveLessonDraft(teacher, draft.id, previousRevision), 409);
  await denied(publishLessonVersion(teacher, draft.id, previousRevision), 409);
  await denied(publishLessonVersion(teacher, draft.id, draft.revision), 409);
  const readyReview = await lessonPublishingReview(teacher, draft.id);
  assert.deepEqual(readyReview.validation, { valid: true, issues: [] });
  assert.equal(
    readyReview.lesson.approved_revision,
    null,
    "Review is read-only",
  );
  assert.deepEqual(
    new Set(readyReview.classes.map((item) => item.id)),
    new Set([classA, classB]),
  );
  const approved = await approveLessonDraft(teacher, draft.id, draft.revision);
  assert.deepEqual(
    await approveLessonDraft(teacher, draft.id, draft.revision),
    approved,
  );
  const published = await Promise.all([
    publishLessonVersion(teacher, draft.id, draft.revision),
    publishLessonVersion(teacher, draft.id, draft.revision),
  ]);
  assert.deepEqual(published[0], published[1]);
  assert.deepEqual(
    (await readPublishedLessonForReview(teacher, draft.id, "1")).content_ref,
    lessonV1.content_ref,
  );
  await denied(readPublishedLessonForReview(otherTeacher, draft.id, "1"), 404);
  await denied(
    publishLessonVersion(otherTeacher, draft.id, draft.revision),
    404,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM lesson_versions WHERE lesson_id=$1",
        [draft.id],
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    db.query(
      "UPDATE lesson_versions SET version='rewritten' WHERE lesson_id=$1",
      [draft.id],
    ),
    /immutable/,
  );

  const requestA = {
    request_id: randomUUID(),
    class_id: classA,
    lesson_id: draft.id,
    version: "1",
    title: "Synthetic water practice A",
    instructions: "Explain both changes using the approved reading.",
  };
  const [assignmentA, replayedA] = await Promise.all([
    createLessonAssignment(teacher, requestA),
    createLessonAssignment(teacher, requestA),
  ]);
  assert.deepEqual(
    assignmentA,
    replayedA,
    "A concurrent replay must create one assignment",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM assignments WHERE creation_request_id=$1",
        [requestA.request_id],
      )
    ).rows[0].count,
    1,
  );
  for (const changed of [
    { title: "A changed title" },
    { instructions: "Different instructions" },
    { class_id: classB },
  ])
    await denied(
      createLessonAssignment(teacher, { ...requestA, ...changed }),
      409,
    );
  await denied(createLessonAssignment(otherTeacher, requestA), 404);
  await denied(
    createLessonAssignment(teacher, {
      ...requestA,
      request_id: randomUUID(),
      class_id: foreignClass,
    }),
    404,
  );
  const instructionsB =
    "Compare starting and ending states, then name each change.";
  const assignmentB = await createLessonAssignment(teacher, {
    ...requestA,
    request_id: randomUUID(),
    class_id: classB,
    title: "Synthetic water practice B",
    instructions: instructionsB,
  });
  assert.notEqual(assignmentA.id, assignmentB.id);
  assert.equal(assignmentA.lesson_version, assignmentB.lesson_version);
  await denied(startTutoring(studentA, assignmentA.id), 409);
  await denied(startTutoring(studentB, assignmentB.id), 409);
  await denied(readAssignmentContent(studentA, assignmentB.id, "student"), 404);
  await denied(readAssignmentContent(studentB, assignmentA.id, "student"), 404);

  // Probe stale activation independently so the original creation request remains unchanged.
  const pending = await createLessonAssignment(teacher, {
    ...requestA,
    request_id: randomUUID(),
    title: "Synthetic stale activation check",
  });
  const stale = await assignmentReview(teacher, pending.id);
  await db.query("UPDATE assignments SET instructions=$2 WHERE id=$1", [
    pending.id,
    "Revised before activation",
  ]);
  await denied(approveAssignment(teacher, pending.id, stale.review_token), 409);
  assert.equal(
    (await assignmentReview(teacher, pending.id)).teacher_approved_at,
    null,
  );

  for (const [assignment, student] of [
    [assignmentA, studentA],
    [assignmentB, studentB],
  ] as const) {
    const review = await assignmentReview(teacher, assignment.id);
    assert.equal(
      review.instructions,
      assignment.id === assignmentA.id ? requestA.instructions : instructionsB,
    );
    assert.equal(review.teacher_approved_at, null);
    await denied(
      approveAssignment(student, assignment.id, review.review_token),
      404,
    );
    await denied(
      approveAssignment(otherTeacher, assignment.id, review.review_token),
      404,
    );
    const [first, repeated] = await Promise.all([
      approveAssignment(teacher, assignment.id, review.review_token),
      approveAssignment(teacher, assignment.id, review.review_token),
    ]);
    assert.deepEqual(first, repeated);
    assert.equal(first.teacher_approved_by, teacher.actor.profileId);
    assert.ok(first.teacher_approved_at);
    await assert.rejects(
      db.query("UPDATE assignments SET instructions='rewrite' WHERE id=$1", [
        assignment.id,
      ]),
      /immutable/,
    );
  }
  assert.deepEqual(
    await createLessonAssignment(teacher, requestA),
    assignmentA,
    "Activation does not invalidate the creation replay",
  );

  const dashboardA = await studentDashboard(studentA);
  const dashboardB = await studentDashboard(studentB);
  assert.equal(
    dashboardA.lessons.find((lesson) => lesson.id === assignmentA.id)
      ?.instructions,
    requestA.instructions,
  );
  assert.equal(
    dashboardB.lessons.find((lesson) => lesson.id === assignmentB.id)
      ?.instructions,
    instructionsB,
  );
  assert.ok(!dashboardA.lessons.some((lesson) => lesson.id === assignmentB.id));
  assert.ok(!dashboardB.lessons.some((lesson) => lesson.id === assignmentA.id));
  const snapshots = [];
  for (const [assignment, student, correct, response] of [
    [
      assignmentA,
      studentA,
      true,
      "Evaporation changes liquid water into gas; condensation changes gas into liquid.",
    ],
    [
      assignmentB,
      studentB,
      false,
      "Evaporation is gas becoming liquid, and condensation is liquid becoming gas.",
    ],
  ] as const) {
    const content = await readAssignmentContent(
      student,
      assignment.id,
      "student",
    );
    assert.deepEqual(content.content_ref, lessonV1.content_ref);
    const session = await startSession(
      student,
      assignment.id,
      "synthetic_fixture",
    );
    const attempt = await presentQuestion(student, session.id, {
      question: getCuratedQuestion(content, "WC-01"),
      intent: "initial_retrieval",
    });
    await submitAnswer(student, session.id, {
      attempt_id: attempt.id,
      submission_key: randomUUID(),
      response_text: response,
    });
    const submitted = (await readSession(student, session.id, "student"))
      .attempts[0];
    const prompt = evaluationPrompt(content, submitted);
    assert.match(prompt.input, /Water changing state/);
    assert.doesNotMatch(prompt.input, /NP-TX-01|transmission_delay/);
    const evaluation = await evaluateFixture(
      student,
      session.id,
      submitted,
      correct,
    );
    const next = await applyTutoring(student, session.id, evaluation.id);
    if (correct) assert.equal(next.session.status, "completed");
    else
      assert.equal(
        (await readSession(student, session.id, "student")).attempts.at(-1)
          ?.question.question_id,
        "WC-DIAGNOSTIC",
      );
    const reading = await studentReading(student, session.id);
    assert.deepEqual(reading.content_ref, lessonV1.content_ref);
    assert.equal(reading.sections[0].id, "water-01");
    assert.doesNotMatch(
      JSON.stringify(reading),
      /answer_guidance|rubric|original_bytes|misconception_ids/,
    );
    assert.doesNotMatch(
      JSON.stringify(await readStudentSession(student, session.id)),
      /answer_guidance|rubric|original_bytes|misconception_ids/,
    );
    const teacherView = await readTeacherSession(teacher, session.id);
    assert.equal(teacherView.evidence.attempts[0].response_text, response);
    assert.deepEqual(
      teacherView.evidence.attempts[0].question.content_ref,
      lessonV1.content_ref,
    );
    assert.deepEqual(
      teacherView.evidence.evaluations[0].result?.source_passage_ids,
      ["water-01", "water-02"],
    );
    await denied(readTeacherSession(otherTeacher, session.id), 404);
    const otherStudent = student === studentA ? studentB : studentA;
    await denied(readStudentSession(otherStudent, session.id), 404);
    snapshots.push({
      assignment,
      student,
      session,
      evidence: teacherView.evidence,
      reading,
    });
  }

  for (const snapshot of snapshots) {
    const dashboard = await readAssignmentEvidence(
      teacher,
      snapshot.assignment.id,
      "synthetic_fixture",
    );
    assert.deepEqual(
      dashboard.students.map((student) => student.student_id),
      [snapshot.student.actor.profileId],
    );
    assert.deepEqual(
      dashboard.evidence.map((item) => item.session.id),
      [snapshot.session.id],
    );
    assert.equal(
      dashboard.evidence[0].session.class_id,
      snapshot.assignment.class_id,
    );
    assert.deepEqual(dashboard.metrics.participation, {
      numerator: 1,
      denominator: 1,
    });
    assert.equal(dashboard.metrics.enrolled_students, 1);
    await denied(
      readAssignmentEvidence(otherTeacher, snapshot.assignment.id),
      404,
    );
  }

  // Later source/lesson revisions must not rewrite either class's original work.
  const sourceV2 = await createSourceVersion(teacher, {
    ...sourceInput,
    request_id: randomUUID(),
    document_id: source.document_id,
    expected_latest_version: 1,
  });
  const lessonV2 = makeTeacherLesson(sourceV2.source_ref, draft.id, "2");
  lessonV2.questions[0].prompt_text +=
    " State both starting states explicitly.";
  lessonV2.sequence.nodes[0].prompt = lessonV2.questions[0].prompt_text;
  const oldRevision = draft.revision;
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: "Synthetic publishing water version 2",
    draft: lessonV2,
  });
  await denied(publishLessonVersion(teacher, draft.id, oldRevision), 409);
  await denied(publishLessonVersion(teacher, draft.id, draft.revision), 409);
  await approveLessonDraft(teacher, draft.id, draft.revision);
  await publishLessonVersion(teacher, draft.id, draft.revision);
  const assignmentV2 = await createLessonAssignment(teacher, {
    ...requestA,
    request_id: randomUUID(),
    version: "2",
    title: "Synthetic water version 2",
  });
  const previewV2 = await assignmentReview(teacher, assignmentV2.id);
  await approveAssignment(teacher, assignmentV2.id, previewV2.review_token);
  const newContent = await readAssignmentContent(
    studentA,
    assignmentV2.id,
    "student",
  );
  assert.deepEqual(newContent.content_ref, lessonV2.content_ref);
  assert.notDeepEqual(newContent.content_ref, lessonV1.content_ref);
  for (const snapshot of snapshots) {
    assert.deepEqual(
      (await readTeacherSession(teacher, snapshot.session.id)).evidence,
      snapshot.evidence,
    );
    assert.deepEqual(
      await studentReading(snapshot.student, snapshot.session.id),
      snapshot.reading,
    );
    assert.deepEqual(
      (
        await readAssignmentContent(
          snapshot.student,
          snapshot.assignment.id,
          "student",
        )
      ).content_ref,
      lessonV1.content_ref,
    );
    const reader = await studentReader(snapshot.student, {
      assignmentId: snapshot.assignment.id,
      contentVersion: "1",
    });
    assert.deepEqual(reader?.reading.content_ref, lessonV1.content_ref);
  }
  console.log(
    "PASS: real objective/bank approval services with synthetic inputs; reviewed publication and source gates; ownership; stale/concurrent/replayed publication, creation and activation; immutable assignment instructions; two authorized classes with isolated student evidence; exact uploaded reading/evaluator/controller/teacher evidence paths; private rubric protection; prior source/version snapshots preserved after v2. No model call was made.",
  );
  console.log(
    `Retained labeled synthetic publishing probe ${run} in the configured development database.`,
  );
} finally {
  await db.end();
}
