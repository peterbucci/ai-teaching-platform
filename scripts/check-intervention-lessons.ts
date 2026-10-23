import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  evidenceAccess,
  EvidenceError,
  startSession,
  presentQuestion,
  submitAnswer,
  readSession,
  recordEvaluation,
} from "../lib/evidence/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
  readAssignmentContent,
} from "../lib/lessons/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import {
  generateInterventionDraft,
  readInterventionDraft,
} from "../lib/interventions/store.ts";
import {
  ModelInterventionSchema,
  type ModelIntervention,
} from "../lib/interventions/contracts.ts";
import { validateInterventionActivity } from "../lib/interventions/generate.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Retains labeled synthetic immutable source/lesson/evidence records in an isolated
// seeded database. All provider responses below are fixtures; no paid calls.
const db = getPool();
async function actor(profileId: string) {
  const row = await db.query("SELECT auth_user_id FROM profiles WHERE id=$1", [
    profileId,
  ]);
  const userId = z.string().min(1).parse(row.rows[0]?.auth_user_id);
  return evidenceAccess({ profileId, userId });
}
async function syntheticActor(label: string) {
  const profileId = randomUUID();
  const userId = `intervention-lesson-${profileId}`;
  await db.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
    userId,
    `Synthetic intervention ${label}`,
    `${profileId}@example.invalid`,
  ]);
  await db.query(
    "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
    [profileId, userId, `Synthetic intervention ${label}`],
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

try {
  const baselineTeacher = await actor(DEMO_IDS.teacher);
  const teacher = await syntheticActor("owner teacher");
  const student = await syntheticActor("enrolled student");
  const foreign = await syntheticActor("other teacher");
  const classId = randomUUID();
  await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    classId,
    teacher.actor.profileId,
    "Synthetic uploaded intervention class",
  ]);
  await db.query("INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)", [
    classId,
    student.actor.profileId,
  ]);
  const baseline = await readAssignmentEvidence(
    baselineTeacher,
    DEMO_IDS.assignmentId,
    "all",
  );
  const reviewedPassages = teacherSourcePassages.map((passage) => ({
    ...passage,
    text: ` \n${passage.text}\n `,
  }));
  const sourceInput = {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-intervention-water.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: reviewedPassages,
    review_status: "approved" as const,
    permitted_use: true as const,
  };
  const source = await createSourceVersion(teacher, sourceInput);
  let lessonDraft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic uploaded intervention lesson",
    draft: {},
  });
  const lesson = makeTeacherLesson(source.source_ref, lessonDraft.id, "1");
  for (const passage of lesson.passages) {
    passage.text = reviewedPassages.find(
      (item) => item.passage_id === passage.id,
    )!.text;
    passage.sha256 = createHash("sha256").update(passage.text).digest("hex");
  }
  // Objective authoring uses stable UUID concept identities, including digit-leading IDs.
  const conceptIds = lesson.concepts.map(() => `1${randomUUID().slice(1)}`);
  const identities = new Map(
    lesson.concepts.map((concept, index) => [concept.id, conceptIds[index]]),
  );
  for (const concept of lesson.concepts)
    concept.id = identities.get(concept.id)!;
  lesson.sequence.concept_ids = [...conceptIds];
  for (const question of lesson.questions)
    question.concept_ids = question.concept_ids.map((id) =>
      identities.get(id)!,
    );
  lessonDraft = await saveLessonDraft(teacher, {
    lesson_id: lessonDraft.id,
    expected_revision: lessonDraft.revision,
    title: lessonDraft.title,
    draft: lesson,
  });
  await approveLessonDraft(teacher, lessonDraft.id, lessonDraft.revision);
  await publishLessonVersion(teacher, lessonDraft.id, lessonDraft.revision);
  const assignment = await createLessonAssignment(teacher, {
    class_id: classId,
    lesson_id: lessonDraft.id,
    version: "1",
    title: "Synthetic uploaded intervention assignment",
  });
  const review = await assignmentReview(teacher, assignment.id);
  await approveAssignment(teacher, assignment.id, review.review_token);
  const content = await readAssignmentContent(
    student,
    assignment.id,
    "student",
  );
  const session = await startSession(
    student,
    assignment.id,
    "synthetic_fixture",
  );
  const question = content.questions.get("WC-01")!;
  const attempt = await presentQuestion(student, session.id, {
    question,
    intent: "initial_retrieval",
  });
  const response =
    "Evaporation is gas becoming liquid, while condensation is liquid becoming gas.";
  await submitAnswer(student, session.id, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: response,
  });
  await recordEvaluation(student, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "uploaded-intervention-check-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: conceptIds.map((concept_id) => ({
        concept_id,
        correctness: "incorrect",
        error_type: "conceptual",
        rubric_criteria_met: [],
        rubric_criteria_missing: [
          "Explains the direction of the change of state",
        ],
      })),
      source_passage_ids: question.source_passage_ids,
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: response,
          start_character: 0,
          end_character: response.length,
          interpretation: "Synthetic fixture: the stated changes are reversed.",
        },
      ],
      misconception_candidates: [],
      reasoning_observed:
        "Fixture evaluation of the preserved response, not a model judgment.",
      uncertainty_reason: null,
      proposed_next_action: "ASK_DIAGNOSTIC_FOLLOWUP",
    },
  });
  const original = await readSession(student, session.id, "student");
  const selection = {
    assignment_id: assignment.id,
    concept_id: conceptIds[0],
    misconception_id: null,
    attempt_ids: [attempt.id],
    origin: "synthetic_fixture" as const,
  };
  const evidence = buildInterventionEvidence(
    await readAssignmentEvidence(teacher, assignment.id, "synthetic_fixture"),
    content,
    selection,
  );
  assert.equal(evidence.concept.title, "Evaporation");
  assert.equal(evidence.sources[0].text, reviewedPassages[0].text);
  assert.ok(evidence.sources.every((passage) => passage.url === null));
  const passage = evidence.sources[0];
  const observation = evidence.observations[0];
  const guidance = {
    concept_ids: [conceptIds[0]],
    source_passage_ids: [passage.passage_id],
    answer_guidance: passage.text,
    criteria: ["Evaporation changes liquid water into water vapor, a gas."],
  };
  const proposal: ModelIntervention = {
    content_ref: content.content_ref,
    title: "Following water as it changes state",
    learning_objective: evidence.concept.objectives[0],
    strategy: "self_explanation",
    exercise_text:
      "Read the passage about evaporation, then explain what happens to liquid water as it becomes water vapor.",
    source_references: [
      { passage_id: passage.passage_id, quote: passage.text },
    ],
    practice_questions: [
      {
        ...guidance,
        prompt_text:
          "Describe what happens to liquid water as evaporation turns it into water vapor.",
      },
    ],
    fresh_check: {
      ...guidance,
      prompt_text:
        "A learner says evaporation makes water disappear. Explain how liquid water and water vapor describe the same water in different states.",
    },
    evidence_references: [
      {
        evidence_id: observation.evidence_id,
        response_quote: response,
        role: observation.role,
      },
    ],
    suggested_recipients: [
      {
        pseudonym: observation.pseudonym,
        evidence_ids: [observation.evidence_id],
      },
    ],
  };
  let calls = 0;
  const provider: NonNullable<
    Parameters<typeof generateInterventionDraft>[2]
  > = async (input) => {
    calls += 1;
    assert.ok(input.input.includes(source.document_id));
    assert.ok(input.input.includes(conceptIds[0]));
    assert.ok(!input.input.includes("peterson_davie_1_5_1"));
    return {
      ok: true,
      result: structuredClone(proposal),
      model: "injected-uploaded-fixture",
      responseId: `synthetic-${randomUUID()}`,
      latencyMs: 0,
      usage: null,
    };
  };
  const request = {
    request_id: randomUUID(),
    draft_id: randomUUID(),
    expected_revision: 0,
    selection,
    revision_instructions: "",
  };
  await denied(generateInterventionDraft(foreign, request, provider), 404);
  await denied(generateInterventionDraft(student, request, provider), 404);
  assert.equal(calls, 0);
  const generated = await generateInterventionDraft(teacher, request, provider);
  assert.equal(generated.status, "completed", generated.error);
  assert.ok(generated.draft);
  assert.deepEqual(generated.draft.evidence.content_ref, lesson.content_ref);
  assert.equal(generated.draft.evidence.concept.id, conceptIds[0]);
  assert.deepEqual(
    await generateInterventionDraft(teacher, request, provider),
    generated,
  );
  assert.equal(calls, 1);
  await denied(readInterventionDraft(foreign, generated.draft.id), 404);
  await denied(
    generateInterventionDraft(
      teacher,
      { ...request, request_id: randomUUID() },
      provider,
    ),
    409,
  );
  assert.equal(calls, 1);
  const failed = await generateInterventionDraft(
    teacher,
    { ...request, request_id: randomUUID(), expected_revision: 1 },
    async (input) => {
      const value = await provider(input);
      assert.ok(value.ok);
      const invalid = ModelInterventionSchema.parse(value.result);
      assert.ok("source_version" in invalid.content_ref);
      invalid.content_ref.source_version += 1;
      assert.throws(
        () =>
          validateInterventionActivity(invalid, evidence, {
            model: value.model,
            generated_at: new Date().toISOString(),
          }),
        /source or lesson version/,
      );
      return { ...value, result: invalid };
    },
  );
  assert.equal(failed.status, "failed");
  assert.match(failed.error!, /previous draft is intact/);
  assert.deepEqual(
    await readInterventionDraft(teacher, generated.draft.id),
    generated.draft,
  );
  // New source versions never retarget an already-published assignment/draft.
  const newer = await createSourceVersion(teacher, {
    ...sourceInput,
    request_id: randomUUID(),
    document_id: source.document_id,
    expected_latest_version: 1,
  });
  assert.equal(newer.version, 2);
  assert.deepEqual(
    (await readAssignmentContent(teacher, assignment.id, "teacher"))
      .content_ref,
    lesson.content_ref,
  );
  await assert.rejects(
    db.query(
      "UPDATE assignments SET content_ref=jsonb_set(content_ref,'{source_version}','2') WHERE id=$1",
      [assignment.id],
    ),
    /exact authorized/,
  );
  const revised = await generateInterventionDraft(
    teacher,
    { ...request, request_id: randomUUID(), expected_revision: 1 },
    provider,
  );
  assert.equal(revised.status, "completed", revised.error);
  assert.deepEqual(revised.draft!.evidence.content_ref, lesson.content_ref);
  assert.equal(revised.draft!.revision, 2);
  // Emulate a persisted pre-v3 snapshot, leaving its original completed request unchanged.
  async function legacyDraft(promptVersion: string, altered = false) {
    const saved = structuredClone(generated.draft!);
    saved.id = randomUUID();
    saved.provenance.prompt_template_version = promptVersion;
    for (const source of saved.evidence.sources)
      source.text = source.text.trim();
    if (altered) saved.evidence.sources[0].text += " A modified source claim.";
    await db.query(
      "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,1,$4)",
      [saved.id, teacher.actor.profileId, assignment.id, saved],
    );
    return saved;
  }
  const legacy = await legacyDraft("teacher-intervention-v2");
  const upgraded = await generateInterventionDraft(
    teacher,
    {
      ...request,
      request_id: randomUUID(),
      draft_id: legacy.id,
      expected_revision: 1,
    },
    provider,
  );
  assert.equal(upgraded.status, "completed", upgraded.error);
  assert.equal(
    upgraded.draft!.evidence.sources[0].text,
    reviewedPassages[0].text,
  );
  const afterUpgradeCalls = calls;
  for (const saved of [
    await legacyDraft("teacher-intervention-v2", true),
    await legacyDraft("teacher-intervention-v3"),
  ]) {
    const invalid = await generateInterventionDraft(
      teacher,
      {
        ...request,
        request_id: randomUUID(),
        draft_id: saved.id,
        expected_revision: 1,
      },
      provider,
    );
    assert.equal(invalid.status, "failed");
    assert.equal(
      calls,
      afterUpgradeCalls,
      "Invalid source bytes must reject before provider dispatch",
    );
    assert.deepEqual(await readInterventionDraft(teacher, saved.id), saved);
  }
  assert.deepEqual(
    await generateInterventionDraft(teacher, request, provider),
    generated,
  );
  assert.deepEqual(await readSession(student, session.id, "student"), original);
  assert.deepEqual(
    await readAssignmentEvidence(baselineTeacher, DEMO_IDS.assignmentId, "all"),
    baseline,
  );
  console.log(
    JSON.stringify({
      status: "passed",
      mode: "uploaded-lesson-injected-provider",
      paid_calls: 0,
      fixture_provider_calls: calls,
      source_id: source.document_id,
      source_version: 1,
      lesson_id: lessonDraft.id,
      assignment_id: assignment.id,
      session_id: session.id,
      draft_id: request.draft_id,
      revision: revised.draft!.revision,
      checks: [
        "Canonical approved uploaded source, published lesson and assignment retain exact source and UUID concepts",
        "Private source excerpts retain null URLs without fabricated public links",
        "Only owner teacher may generate/read; stale revisions reject before dispatch",
        "Changed source version in provider output rejects without overwriting the prior draft",
        "Source version append and attempted assignment retarget cannot change pinned draft evidence",
        "Replays do not dispatch again; original student evidence and curated baseline remain unchanged",
        "Legacy trimmed snapshots restore canonical bytes only in new revisions; altered legacy and trimmed v3 sources reject before dispatch",
      ],
    }),
  );
} finally {
  await db.end();
}
