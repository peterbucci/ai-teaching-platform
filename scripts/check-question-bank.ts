import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { evidenceAccess, EvidenceError } from "../lib/evidence/store.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  saveLessonDraft,
  readLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
} from "../lib/lessons/store.ts";
import type { LessonDraftContent } from "../lib/lessons/contracts.ts";
import {
  createObjectiveDraft,
  saveObjectiveDraft,
  approveObjectives,
} from "../lib/objectives/store.ts";
import { ObjectiveEditSchema } from "../lib/objectives/contracts.ts";
import {
  readQuestionBank,
  updateQuestionBank,
  bankMetadata,
} from "../lib/question-bank/store.ts";
import {
  getReviewedQuestionBank,
  fingerprintQuestionBank,
} from "../lib/question-bank/validation.ts";
import type { QuestionBankProvider } from "../lib/question-bank/generate.ts";
import { fixtureQuestionBankProvider } from "../tests/fixtures/question-bank-provider.ts";
import {
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
  makeTeacherLesson,
} from "../tests/fixtures/teacher-lesson.ts";
import { makeQuestionBankObjectiveEdits } from "../tests/fixtures/question-bank-objectives.ts";

// Dedicated disposable DB, synthetic material and injected provider. Zero paid calls.
const pool = getPool();
const checkTeacherId = randomUUID();
const teacher = evidenceAccess({
  profileId: checkTeacherId,
  userId: `synthetic-question-bank-${checkTeacherId}`,
});
const student = evidenceAccess({
  profileId: DEMO_IDS.studentOne,
  userId: "synthetic-student-check",
});
const foreignTeacher = evidenceAccess({
  profileId: randomUUID(),
  userId: "synthetic-foreign-check",
});
async function denied(action: Promise<unknown>, status: number) {
  await assert.rejects(
    action,
    (error) => error instanceof EvidenceError && error.status === status,
  );
}
try {
  await pool.query("INSERT INTO auth_user(id,name,email) VALUES($1,$2,$3)", [
    teacher.actor.userId,
    "Synthetic bank check",
    `${checkTeacherId}@example.invalid`,
  ]);
  await pool.query(
    "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,$3)",
    [checkTeacherId, teacher.actor.userId, "Synthetic bank check"],
  );
  await pool.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    randomUUID(),
    checkTeacherId,
    "Synthetic bank check",
  ]);
  const source = await createSourceVersion(teacher, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-water.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  let row = await createObjectiveDraft(teacher, {
    request_id: randomUUID(),
    title: "Synthetic #51 database check",
    source_id: source.document_id,
    source_version: source.version,
  });
  const objectiveEdits = makeQuestionBankObjectiveEdits(true);
  row = await saveObjectiveDraft(teacher, {
    lesson_id: row.id,
    expected_revision: row.revision,
    title: row.title,
    items: objectiveEdits,
  });
  let calls = 0;
  const provider: QuestionBankProvider = async (request) => {
    calls++;
    return fixtureQuestionBankProvider(request);
  };
  await denied(
    updateQuestionBank(
      teacher,
      row.id,
      {
        action: "generate",
        expected_revision: row.revision,
        request_id: randomUUID(),
        question_ids: [],
      },
      provider,
    ),
    409,
  );
  assert.equal(
    calls,
    0,
    "Unapproved objective workflow cannot incur a provider call",
  );
  row = await approveObjectives(teacher, {
    lesson_id: row.id,
    expected_revision: row.revision,
  });
  assert.ok(row.draft?.objective_workflow?.reviewed);
  assert.deepEqual(
    bankMetadata(row.draft!).preferences.emphasized_concept_ids,
    objectiveEdits
      .filter((item) => item.emphasis === "essential")
      .map((item) => item.concept_id),
    "A new bank consumes #50 essential emphasis without selecting supporting objectives",
  );
  const generation = {
    action: "generate",
    expected_revision: row.revision,
    request_id: randomUUID(),
    question_ids: [],
  };
  let view = await updateQuestionBank(teacher, row.id, generation, provider);
  assert.equal(calls, 2);
  assert.equal(view.operations[0].status, "completed");
  assert.equal(view.draft.questions?.length, 4);
  assert.deepEqual(view.issues, []);
  assert.equal(view.draft.question_bank.approval, null);
  await updateQuestionBank(teacher, row.id, generation, provider);
  assert.equal(calls, 2, "Identical replay must not pay again");
  await denied(
    updateQuestionBank(
      teacher,
      row.id,
      { ...generation, question_ids: [view.draft.questions![0].question_id!] },
      provider,
    ),
    409,
  );
  await denied(readQuestionBank(student, row.id), 404);
  await denied(readQuestionBank(foreignTeacher, row.id), 404);
  await denied(
    updateQuestionBank(student, row.id, {
      action: "approve",
      expected_revision: view.revision,
    }),
    404,
  );
  await denied(
    updateQuestionBank(teacher, row.id, {
      action: "approve",
      expected_revision: view.revision,
    }),
    409,
  );
  const save = (current: typeof view) => ({
    action: "save",
    expected_revision: current.revision,
    questions: current.draft.questions!,
    question_guidance: current.draft.question_guidance!,
    question_bank: current.draft.question_bank,
    activity_policy: current.draft.activity_policy,
  });
  const untouchedId = view.draft.questions![0].question_id!;
  const selectedId = view.draft.questions![3].question_id!;
  view.draft.questions![0].prompt_text += " Explain your reasoning clearly.";
  view = await updateQuestionBank(teacher, row.id, save(view));
  const untouched = structuredClone(view.draft.questions![0]);
  view = await updateQuestionBank(
    teacher,
    row.id,
    {
      action: "generate",
      expected_revision: view.revision,
      request_id: randomUUID(),
      question_ids: [selectedId],
    },
    provider,
  );
  assert.equal(calls, 4);
  assert.deepEqual(
    view.draft.questions!.find((q) => q.question_id === untouchedId),
    untouched,
    "Selective regeneration preserves unrelated teacher edits",
  );
  const staleRevision = view.revision;
  view.draft.question_bank.items = view.draft.question_bank.items.map(
    (item) => ({
      ...item,
      review_status: "reviewed",
      review_notes: "Synthetic check: compared answers with the cited source.",
    }),
  );
  view = await updateQuestionBank(teacher, row.id, save(view));
  await denied(
    updateQuestionBank(teacher, row.id, {
      action: "approve",
      expected_revision: staleRevision,
    }),
    409,
  );
  view = await updateQuestionBank(teacher, row.id, {
    action: "approve",
    expected_revision: view.revision,
  });
  assert.equal(getReviewedQuestionBank(view.draft).questions.length, 4);
  assert.equal(
    (await readLessonDraft(teacher, row.id)).approved_revision,
    null,
    "Bank approval never approves whole lesson or publishes",
  );
  const versionCount = await pool.query(
    "SELECT count(*)::int AS count FROM lesson_versions WHERE lesson_id=$1",
    [row.id],
  );
  assert.equal(versionCount.rows[0].count, 0);

  // Simulate #52 attaching its derived sequence. Bank edits must not retain old feedback.
  const assembled = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: view.revision,
    title: row.title,
    draft: {
      ...view.draft,
      sequence: makeTeacherLesson(source.source_ref, row.id, "1").sequence,
    },
  });
  assert.ok(assembled.draft?.sequence);
  assert.ok(
    assembled.draft?.question_bank?.approval,
    "Assembly alone preserves the reviewed bank",
  );
  view = await readQuestionBank(teacher, row.id);
  view.draft.question_bank.items[0].feedback_guidance +=
    " Explain both state changes in your own words.";
  view = await updateQuestionBank(teacher, row.id, save(view));
  assert.equal(
    view.draft.sequence,
    undefined,
    "Editing reviewed feedback removes the old derived sequence",
  );
  assert.equal(view.draft.question_bank.approval, null);

  // A generic draft save cannot replace a bank receipt or mint one for edited content.
  view = await updateQuestionBank(teacher, row.id, {
    action: "approve",
    expected_revision: view.revision,
  });
  assert.equal(
    view.draft.sequence,
    undefined,
    "Bank reapproval cannot resurrect stale feedback; #52 must assemble again",
  );
  const receiptBeforeOmission = structuredClone(
    view.draft.question_bank.approval,
  );
  const omittedMetadata: LessonDraftContent = structuredClone(view.draft);
  delete omittedMetadata.question_bank;
  row = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: view.revision,
    title: row.title,
    draft: omittedMetadata,
  });
  assert.deepEqual(
    row.draft?.question_bank?.approval,
    receiptBeforeOmission,
    "A generic editor omitting bank metadata preserves the existing reviewed bank",
  );
  const editedWithoutMetadata: LessonDraftContent = structuredClone(row.draft!);
  delete editedWithoutMetadata.question_bank;
  editedWithoutMetadata.questions![0].prompt_text += " Name both states.";
  row = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: row.revision,
    title: row.title,
    draft: editedWithoutMetadata,
  });
  assert.ok(
    row.draft?.question_bank,
    "Omission cannot delete the bank review gate",
  );
  assert.equal(row.draft.question_bank.approval, null);
  assert.throws(
    () => getReviewedQuestionBank(row.draft!),
    /explicit teacher approval/,
  );
  await assert.rejects(approveLessonDraft(teacher, row.id, row.revision));
  await denied(publishLessonVersion(teacher, row.id, row.revision), 409);
  assert.equal(
    (await readLessonDraft(teacher, row.id)).approved_revision,
    null,
  );
  view = await updateQuestionBank(teacher, row.id, {
    action: "approve",
    expected_revision: row.revision,
  });
  const originalReceipt = structuredClone(view.draft.question_bank.approval);
  const forgedDraft = structuredClone(view.draft);
  forgedDraft.question_bank.approval = {
    ...originalReceipt!,
    reviewed_by: foreignTeacher.actor.profileId,
  };
  row = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: view.revision,
    title: row.title,
    draft: forgedDraft,
  });
  assert.deepEqual(
    row.draft?.question_bank?.approval,
    originalReceipt,
    "Unchanged generic saves retain only the original server receipt",
  );
  view = await readQuestionBank(teacher, row.id);
  const forgedEdit = structuredClone(view.draft);
  forgedEdit.questions![0].prompt_text += " Include a reason.";
  forgedEdit.question_bank.approval = {
    ...originalReceipt!,
    content_fingerprint: fingerprintQuestionBank(forgedEdit),
  };
  row = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: view.revision,
    title: row.title,
    draft: forgedEdit,
  });
  assert.equal(
    row.draft?.question_bank?.approval,
    null,
    "A forged matching fingerprint cannot approve edited question content",
  );
  view = await updateQuestionBank(teacher, row.id, {
    action: "approve",
    expected_revision: row.revision,
  });

  // Real #50 edits invalidate objective approval and bank approval immediately.
  const reviewedQuestions = structuredClone(view.draft.questions);
  const previousBankReceipt = structuredClone(
    view.draft.question_bank.approval,
  );
  const revisedObjectives = view.draft.objective_workflow!.items.map((item) =>
    ObjectiveEditSchema.strip().parse(item),
  );
  revisedObjectives[0].objective += " Identify the starting and ending states.";
  row = await saveObjectiveDraft(teacher, {
    lesson_id: row.id,
    expected_revision: view.revision,
    title: row.title,
    items: revisedObjectives,
  });
  assert.equal(row.draft?.objective_workflow?.reviewed, null);
  assert.equal(
    row.draft?.question_bank?.approval,
    null,
    "Objective edits must clear the question-bank receipt immediately",
  );
  assert.deepEqual(row.draft?.questions, reviewedQuestions);
  const callsBeforeObjectiveCheck = calls;
  await denied(
    updateQuestionBank(
      teacher,
      row.id,
      {
        action: "generate",
        expected_revision: row.revision,
        request_id: randomUUID(),
        question_ids: [selectedId],
      },
      provider,
    ),
    409,
  );
  assert.equal(calls, callsBeforeObjectiveCheck);
  row = await approveObjectives(teacher, {
    lesson_id: row.id,
    expected_revision: row.revision,
  });
  assert.equal(
    row.draft?.question_bank?.approval,
    null,
    "Reapproving objectives never silently restores a stale bank approval",
  );
  assert.throws(
    () => getReviewedQuestionBank(row.draft!),
    /explicit teacher approval/,
  );
  const replayedReceipt = {
    ...row.draft!,
    question_bank: {
      ...row.draft!.question_bank!,
      approval: previousBankReceipt,
    },
  };
  row = await saveLessonDraft(teacher, {
    lesson_id: row.id,
    expected_revision: row.revision,
    title: row.title,
    draft: replayedReceipt,
  });
  assert.equal(row.draft?.question_bank?.approval, null);
  view = await updateQuestionBank(teacher, row.id, {
    action: "approve",
    expected_revision: row.revision,
  });
  assert.equal(getReviewedQuestionBank(view.draft).questions.length, 4);

  // Persist synthetic reviewer findings, then correct only the field each finding concerns.
  // Notes or a client-cleared issue list alone must not erase an unresolved finding.
  const flaggedId = view.draft.questions![0].question_id!;
  const flaggedSnapshot = structuredClone(view.draft.questions![0]);
  async function persistReviewFixture(
    change: (draft: typeof view.draft) => void,
  ) {
    const draft = structuredClone(view.draft);
    change(draft);
    const stored = await saveLessonDraft(teacher, {
      lesson_id: row.id,
      expected_revision: view.revision,
      title: row.title,
      draft,
    });
    view = await readQuestionBank(teacher, stored.id);
  }
  await persistReviewFixture((draft) => {
    const item = draft.question_bank.items.find(
      (item) => item.question_id === flaggedId,
    )!;
    item.format = "multiple_choice";
    item.quality_issues = [
      "format_mismatch: A multiple-choice question needs answer options.",
    ];
    item.review_notes = "";
  });
  const flaggedItem = view.draft.question_bank.items.find(
    (item) => item.question_id === flaggedId,
  )!;
  flaggedItem.review_notes = "I reviewed this finding.";
  flaggedItem.quality_issues = [];
  view = await updateQuestionBank(teacher, row.id, save(view));
  assert.equal(
    view.draft.question_bank.items.find(
      (item) => item.question_id === flaggedId,
    )!.quality_issues.length,
    1,
  );
  const correctedFormat = view.draft.question_bank.items.find(
    (item) => item.question_id === flaggedId,
  )!;
  correctedFormat.format = "short_answer";
  correctedFormat.review_notes =
    "Corrected the format to match the open-response prompt.";
  view = await updateQuestionBank(teacher, row.id, save(view));
  assert.deepEqual(
    view.draft.question_bank.items.find(
      (item) => item.question_id === flaggedId,
    )!.quality_issues,
    [],
  );

  for (const field of ["assumptions", "misconception_ids"] as const) {
    await persistReviewFixture((draft) => {
      const guidance = draft.question_guidance!.find(
        (item) => item.question_id === flaggedId,
      )!;
      guidance[field] =
        field === "assumptions"
          ? ["Evaporation requires boiling."]
          : ["unsupported-confirmed-misconception"];
      const item = draft.question_bank.items.find(
        (item) => item.question_id === flaggedId,
      )!;
      item.quality_issues = [
        `unsupported_${field}: Remove unsupported private guidance.`,
      ];
      item.review_notes = "";
    });
    view.draft.question_guidance!.find(
      (item) => item.question_id === flaggedId,
    )![field] = [];
    view.draft.question_bank.items.find(
      (item) => item.question_id === flaggedId,
    )!.review_notes = `Removed unsupported ${field} after checking the source.`;
    view = await updateQuestionBank(teacher, row.id, save(view));
    assert.deepEqual(
      view.draft.question_bank.items.find(
        (item) => item.question_id === flaggedId,
      )!.quality_issues,
      [],
      `Correcting only private ${field} with review notes resolves its reviewer finding`,
    );
  }
  assert.deepEqual(
    view.draft.questions!.find(
      (question) => question.question_id === flaggedId,
    ),
    flaggedSnapshot,
  );
  assert.deepEqual(view.issues, []);

  // Reorder/add/delete manual questions through the real transaction and reload.
  const manual = structuredClone(view.draft.questions![1]);
  const manualId = randomUUID();
  manual.question_id = manualId;
  manual.prompt_text =
    "Which state change moves water from liquid to gas, and which moves it back? Explain both directions.";
  view.draft.questions = [manual, ...view.draft.questions!];
  view.draft.question_guidance!.unshift({
    ...view.draft.question_guidance![1],
    question_id: manualId,
  });
  view.draft.question_bank.items.unshift({
    ...view.draft.question_bank.items[1],
    question_id: manualId,
    review_status: "needs_review",
  });
  view = await updateQuestionBank(teacher, row.id, save(view));
  assert.equal(view.draft.questions![0].origin, "curated");
  assert.equal(view.draft.questions![0].generation, null);
  assert.equal(view.draft.question_bank.approval, null);
  view.draft.questions = view.draft
    .questions!.filter((q) => q.question_id !== manualId)
    .reverse();
  view.draft.question_guidance = view.draft.question_guidance!.filter(
    (q) => q.question_id !== manualId,
  );
  view.draft.question_bank.items = view.draft.question_bank.items
    .filter((q) => q.question_id !== manualId)
    .reverse();
  view = await updateQuestionBank(teacher, row.id, save(view));
  assert.equal(
    (await readQuestionBank(teacher, row.id)).draft.questions![0].question_id,
    selectedId,
  );

  // An in-flight call cannot overwrite a newer manual edit; retained result is inspectable.
  let release!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  const deferred: QuestionBankProvider = async (request) => {
    if (request.stage === "generation") {
      started();
      await paused;
    }
    return provider(request);
  };
  const pendingRequest = {
    action: "generate",
    expected_revision: view.revision,
    request_id: randomUUID(),
    question_ids: [selectedId],
  };
  const pending = updateQuestionBank(teacher, row.id, pendingRequest, deferred);
  await startedPromise;
  const replay = await updateQuestionBank(
    teacher,
    row.id,
    pendingRequest,
    provider,
  );
  assert.equal(replay.operations[0].status, "pending");
  await denied(
    updateQuestionBank(
      teacher,
      row.id,
      { ...pendingRequest, request_id: randomUUID() },
      provider,
    ),
    409,
  );
  view.draft.questions!.find(
    (q) => q.question_id === untouchedId,
  )!.prompt_text += " Include the starting and ending states.";
  view = await updateQuestionBank(teacher, row.id, save(view));
  const newer = structuredClone(view.draft.questions);
  release();
  view = await pending;
  assert.equal(view.operations[0].status, "stale");
  assert.ok(view.operations[0].result);
  assert.deepEqual(view.draft.questions, newer);

  const beforeFailure = structuredClone(view.draft);
  const failing: QuestionBankProvider = async (request) => ({
    ok: false,
    code: "timeout",
    message: "Synthetic timeout",
    model: "fixture",
    stage: request.stage,
    latencyMs: 1,
  });
  const failedRequest = {
    action: "generate",
    expected_revision: view.revision,
    request_id: randomUUID(),
    question_ids: [selectedId],
  };
  view = await updateQuestionBank(teacher, row.id, failedRequest, failing);
  assert.equal(view.operations[0].status, "unknown");
  assert.equal(view.has_unknown_outcome, true);
  const otherLesson = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic other lesson after an uncertain request",
    draft: {},
  });
  const otherView = await readQuestionBank(teacher, otherLesson.id);
  assert.equal(otherView.operations.length, 0);
  assert.equal(
    otherView.has_unknown_outcome,
    true,
    "Unknown usage on another lesson remains visible so the teacher can acknowledge it",
  );
  assert.deepEqual(view.draft, beforeFailure);
  await updateQuestionBank(teacher, row.id, failedRequest, provider);
  assert.equal(calls, 6, "Failure replay must not invoke provider again");
  await denied(
    updateQuestionBank(
      teacher,
      row.id,
      { ...failedRequest, request_id: randomUUID() },
      provider,
    ),
    409,
  );
  view = await updateQuestionBank(
    teacher,
    row.id,
    { ...failedRequest, request_id: randomUUID(), acknowledge_unknown: true },
    async (req) => ({
      ok: true,
      result: { unexpected: "invalid" },
      stage: req.stage,
      model: "fixture",
      latencyMs: 1,
    }),
  );
  assert.equal(view.operations[0].status, "failed");
  assert.deepEqual(view.draft, beforeFailure);

  // Approved-source gate occurs before provider usage.
  const badDraft = {
    ...view.draft,
    content_ref: { ...view.draft.content_ref!, source_version: 999 },
  };
  await denied(
    saveLessonDraft(teacher, {
      lesson_id: row.id,
      expected_revision: view.revision,
      title: row.title,
      draft: badDraft,
    }),
    409,
  );
  console.log(
    JSON.stringify({
      ok: true,
      lesson_id: row.id,
      deterministic_provider_calls: calls,
      paid_calls: 0,
      checks: [
        "approved-objective generation",
        "real objective save/approval and essential emphasis",
        "unreviewed/edited objectives block paid generation",
        "objective edits immediately invalidate bank approval",
        "generic bank-receipt forgery rejected",
        "omitted bank metadata cannot bypass approval or publication",
        "format and private-guidance corrections resolve reviewer flags",
        "review notes alone preserve unresolved reviewer flags",
        "multi-concept/source grounding",
        "selective regeneration",
        "manual edit/add/delete/reorder",
        "bank-only approval/reload",
        "bank edits invalidate previously assembled feedback",
        "ownership",
        "stale draft/in-flight result",
        "durable replay/concurrency",
        "provider failure",
        "invalid output",
        "wrong source version",
      ],
    }),
  );
} finally {
  await pool.end();
}
