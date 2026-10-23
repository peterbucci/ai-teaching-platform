import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { evidenceAccess } from "../lib/evidence/store.ts";
import { saveLessonDraft } from "../lib/lessons/store.ts";
import {
  createObjectiveDraft,
  saveObjectiveDraft,
  approveObjectives,
} from "../lib/objectives/store.ts";
import {
  createSourceVersion,
  type SourceVersion,
} from "../lib/lessons/sources.ts";
import type { LessonDraftContent } from "../lib/lessons/contracts.ts";
import {
  generateQuestionBank,
  GeneratedQuestionBankSchema,
  requestQuestionBank,
  type GenerationTarget,
  type QuestionBankProvider,
} from "../lib/question-bank/generate.ts";
import {
  DEFAULT_QUESTION_BANK_DELIVERY,
  DEFAULT_QUESTION_BANK_PREFERENCES,
} from "../lib/question-bank/contracts.ts";
import {
  updateQuestionBank,
  type QuestionBankView,
} from "../lib/question-bank/store.ts";
import {
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";
import { fixtureQuestionBankProvider } from "../tests/fixtures/question-bank-provider.ts";
import { makeQuestionBankObjectiveEdits } from "../tests/fixtures/question-bank-objectives.ts";

// Original synthetic material in the seeded local demo DB. Two generation calls
// plus two separate critiques, no retry. Bank review/approval remains with the teacher.
if (!process.argv.includes("--run-paid-check")) {
  throw new Error(
    "Pass --run-paid-check only within the approved four-call live test scope.",
  );
}
// Never infer consent to repeat an uncertain provider outcome from elapsed time.
const acknowledgeUnknown = process.argv.includes("--acknowledge-unknown");
const runId = randomUUID();
const directory = resolve(".setup");
const reportPath = resolve(directory, `question-bank-live-${runId}.json`);
const preferences = {
  ...DEFAULT_QUESTION_BANK_PREFERENCES,
  emphasized_concept_ids: [] as string[],
  priorities: ["comparison" as const, "application" as const],
  reasoning_errors: [
    "Possible confusion that water disappears during evaporation; investigate without assuming a student holds this belief.",
  ],
  student_instructions:
    "Explain the direction of the state change and justify your reasoning from the reading.",
};
const db = getPool();
let paidCalls = 0;
let source: SourceVersion | null = null;
let approvedObjectivesDraft: LessonDraftContent | null = null;
let lessonId: string | null = null;
const provider: QuestionBankProvider = async (input) => {
  assert.ok(
    paidCalls < 4,
    "The approved maximum is four paid calls; no retry is permitted.",
  );
  paidCalls++;
  return requestQuestionBank(input);
};
const reports: {
  label: string;
  request_id: string;
  view: QuestionBankView;
  operation: QuestionBankView["operations"][number] | undefined;
  educational_quality_review: { status: string; notes: string[] };
}[] = [];
const writeReport = async () => {
  await mkdir(directory, { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        run_id: runId,
        checked_at: new Date().toISOString(),
        scope:
          "Synthetic teacher authoring through the canonical source/draft store and durable question-bank operations. At most four paid calls. No publication, activation, or automatic approval.",
        lesson_id: lessonId,
        editor_path: lessonId ? `/teacher/lessons/${lessonId}/questions` : null,
        source_version: source,
        source_passages: approvedObjectivesDraft?.passages,
        approved_objectives: approvedObjectivesDraft?.concepts,
        objective_review_workflow: approvedObjectivesDraft?.objective_workflow,
        paid_provider_calls: paidCalls,
        acknowledged_prior_unknown_outcome: acknowledgeUnknown,
        cases: reports,
        deterministic_injection_check:
          "A deliberately forged source quote is rejected before a critique call; this is a fixture check, not a paid-model result.",
      },
      null,
      2,
    ),
    "utf8",
  );
};

try {
  const teacher = await db.query(
    "SELECT auth_user_id FROM profiles WHERE id=$1",
    [DEMO_IDS.teacher],
  );
  const { auth_user_id } = z
    .object({ auth_user_id: z.string() })
    .parse(teacher.rows[0]);
  const access = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: auth_user_id,
  });
  source = await createSourceVersion(access, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument, "utf8"),
    file_name: `synthetic-water-live-${runId}.txt`,
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  const title = `Synthetic live question bank ${runId.slice(0, 8)}`;
  const initial = await createObjectiveDraft(access, {
    request_id: randomUUID(),
    title,
    source_id: source.document_id,
    source_version: source.version,
  });
  lessonId = initial.id;
  const objectiveEdits = makeQuestionBankObjectiveEdits();
  const savedObjectives = await saveObjectiveDraft(access, {
    lesson_id: lessonId,
    expected_revision: initial.revision,
    title,
    items: objectiveEdits,
  });
  const reviewedObjectives = await approveObjectives(access, {
    lesson_id: lessonId,
    expected_revision: savedObjectives.revision,
  });
  approvedObjectivesDraft = reviewedObjectives.draft;
  assert.ok(
    approvedObjectivesDraft?.objective_workflow?.reviewed,
    "The live check must consume #50's actual server-owned objective review receipt",
  );
  preferences.emphasized_concept_ids = objectiveEdits
    .filter((item) => item.emphasis === "essential")
    .map((item) => item.concept_id);
  const draft: LessonDraftContent = {
    ...approvedObjectivesDraft,
    question_bank: {
      preferences,
      items: [],
      delivery: DEFAULT_QUESTION_BANK_DELIVERY,
      approval: null,
    },
  };
  const saved = await saveLessonDraft(access, {
    lesson_id: lessonId,
    expected_revision: reviewedObjectives.revision,
    title,
    draft,
  });

  const target: GenerationTarget = {
    question_id: "deterministic-forged-quote",
    family_id: "synthetic-rejection",
    role: "initial",
    concept_ids: preferences.emphasized_concept_ids,
  };
  let rejectionCheckCalls = 0;
  const unsupportedProvider: QuestionBankProvider = async (input) => {
    rejectionCheckCalls++;
    if (input.stage === "critique")
      throw new Error("A forged citation must be rejected before critique.");
    const result = await fixtureQuestionBankProvider(input);
    if (!result.ok) return result;
    const proposal = GeneratedQuestionBankSchema.parse(result.result);
    proposal.questions[0].source_support[0].quote =
      "A fabricated statement absent from the approved passage.";
    return { ...result, result: proposal };
  };
  const rejected = await generateQuestionBank(
    { draft, preferences, targets: [target] },
    unsupportedProvider,
  );
  assert.ok(!rejected.ok);
  assert.equal(rejected.code, "invalid_output");
  assert.equal(
    rejectionCheckCalls,
    1,
    "The forged quote is rejected after generation and before critique",
  );
  assert.equal(paidCalls, 0);

  const firstRequest = randomUUID();
  const first = await updateQuestionBank(
    access,
    lessonId,
    {
      action: "generate",
      expected_revision: saved.revision,
      request_id: firstRequest,
      acknowledge_unknown: acknowledgeUnknown,
      question_ids: [],
    },
    provider,
  );
  const firstOperation = first.operations.find(
    (operation) => operation.request_id === firstRequest,
  );
  reports.push({
    label: "Initial multi-concept short-answer question family",
    request_id: firstRequest,
    view: first,
    operation: firstOperation,
    educational_quality_review: {
      status: "pending_inspection_of_actual_output",
      notes: [
        "Actual questions, expected answers, criterion-level passage quotes, model identifiers, usage, and independent critique flags are retained in the draft and operation result.",
        "Inspect source fidelity, reasoning demand, answerability, alternative/diagnostic usefulness and meaningful retest variation. Model critique is not proof of correctness.",
      ],
    },
  });
  await writeReport();
  assert.equal(
    firstOperation?.status,
    "completed",
    "Initial generation failed; inspect the report. No automatic paid retry is made.",
  );
  assert.equal(first.draft.questions?.length, 4);
  const bank = first.draft.question_bank;
  const retest = bank.items.find((item) => item.role === "retest");
  assert.ok(retest);
  const unrelatedBefore = structuredClone(
    first.draft.questions?.filter(
      (question) => question.question_id !== retest.question_id,
    ),
  );
  const changedFormat = await updateQuestionBank(access, lessonId, {
    action: "save",
    expected_revision: first.revision,
    questions: first.draft.questions,
    question_guidance: first.draft.question_guidance,
    question_bank: {
      ...bank,
      items: bank.items.map((item) =>
        item.question_id === retest.question_id
          ? {
              ...item,
              format: "multiple_choice",
              review_status: "needs_review",
            }
          : item,
      ),
    },
    activity_policy: first.draft.activity_policy,
  });
  const secondRequest = randomUUID();
  const second = await updateQuestionBank(
    access,
    lessonId,
    {
      action: "generate",
      expected_revision: changedFormat.revision,
      request_id: secondRequest,
      acknowledge_unknown: acknowledgeUnknown,
      question_ids: [retest.question_id],
    },
    provider,
  );
  const secondOperation = second.operations.find(
    (operation) => operation.request_id === secondRequest,
  );
  reports.push({
    label: "Selective multiple-choice retest regeneration",
    request_id: secondRequest,
    view: second,
    operation: secondOperation,
    educational_quality_review: {
      status: "pending_inspection_of_actual_output",
      notes: [
        "Inspect choice labels, one defensible best answer, plausible distractors, reasoning demand, and difference from the retained initial question.",
        "Other teacher questions are checked byte-for-byte unchanged. Private criteria remain separate from student prompt_text. Bank approval is still pending.",
      ],
    },
  });
  await writeReport();
  assert.equal(
    secondOperation?.status,
    "completed",
    "Selective regeneration failed; inspect the report. No automatic paid retry is made.",
  );
  assert.deepEqual(
    second.draft.questions?.filter(
      (question) => question.question_id !== retest.question_id,
    ),
    unrelatedBefore,
  );
  assert.equal(
    second.draft.question_bank.items.find(
      (item) => item.question_id === retest.question_id,
    )?.format,
    "multiple_choice",
  );
  assert.equal(second.draft.question_bank.approval, null);
  assert.equal(paidCalls, 4);
  console.log(
    `Completed the bounded live authoring check (${paidCalls} calls). Review the saved draft at /teacher/lessons/${lessonId}/questions`,
  );
  if (second.issues.length)
    console.log(
      `${second.issues.length} issues require teacher inspection; no bank was approved or published.`,
    );
} finally {
  await writeReport();
  await db.end();
  console.log(`Retained live check report: ${reportPath}`);
}
