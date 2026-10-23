import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { evidenceAccess, EvidenceError } from "../lib/evidence/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  createObjectiveDraft,
  saveObjectiveDraft,
  approveObjectives,
} from "../lib/objectives/store.ts";
import { updateQuestionBank } from "../lib/question-bank/store.ts";
import { validateQuestionBank } from "../lib/question-bank/validation.ts";
import {
  GeneratedQuestionProposalSchema,
  QuestionBankCritiqueSchema,
  QUESTION_BANK_PROMPT_VERSION,
  requestQuestionBank,
  type QuestionBankProvider,
  type QuestionBankProviderOutcome,
} from "../lib/question-bank/generate.ts";
import { fixtureQuestionBankProvider } from "../tests/fixtures/question-bank-provider.ts";
import { makeQuestionBankObjectiveEdits } from "../tests/fixtures/question-bank-objectives.ts";
import {
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// One deliberately false synthetic proposal, one actual production critique call.
// No model generation call, retries, objective-review bypass, publication or activation.
assert.ok(
  process.argv.includes("--run-paid-check"),
  "This probe requires the explicit one-call paid-check scope.",
);
assert.equal(
  process.env.PGPORT,
  "5551",
  "Use the dedicated isolated demo database.",
);
const acknowledgeUnknown = process.argv.includes("--acknowledge-unknown");
const spentReceipt = ".setup/question-bank-semantic-live-spent.json";
assert.ok(
  !existsSync(spentReceipt),
  "This one-call probe already started. Inspect its saved evidence; do not retry an uncertain paid outcome.",
);
const db = getPool();
const capture: { critique: QuestionBankProviderOutcome | null } = {
  critique: null,
};
let paidCalls = 0;
const evidence: Record<string, unknown> = {
  schema_version: 1,
  scope:
    "A constructed false expected answer with valid real source quotation is passed through the production v2 critique, then tested against the real bank approval gate. Generation of the negative-control proposal is deterministic, not an actual model output.",
  prompt_template_version: QUESTION_BANK_PROMPT_VERSION,
  paid_call_limit: 1,
  automatic_retries: 0,
};
const saveEvidence = () => {
  mkdirSync(".setup", { recursive: true });
  const result = capture.critique;
  evidence.paid_provider_calls = paidCalls;
  evidence.checked_at_utc = new Date().toISOString();
  if (result) {
    evidence.actual_provider = {
      ok: result.ok,
      stage: result.stage,
      model: result.model,
      latency_ms: result.latencyMs,
      usage: result.usage ?? null,
      ...(result.ok
        ? {
            critique: QuestionBankCritiqueSchema.parse(
              result.result,
            ).reviews.map((review) => ({
              role: "initial",
              issues: review.issues,
            })),
          }
        : { failure_code: result.code, message: result.message }),
    };
  }
  writeFileSync(
    ".setup/question-bank-semantic-live.json",
    JSON.stringify(evidence, null, 2) + "\n",
    "utf8",
  );
};
try {
  const rows = await db.query("SELECT auth_user_id FROM profiles WHERE id=$1", [
    DEMO_IDS.teacher,
  ]);
  const { auth_user_id } = z
    .object({ auth_user_id: z.string() })
    .parse(rows.rows[0]);
  const teacher = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: auth_user_id,
  });
  const source = await createSourceVersion(teacher, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument, "utf8"),
    file_name: "synthetic-water-semantic-negative-control.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  let lesson = await createObjectiveDraft(teacher, {
    request_id: randomUUID(),
    title: "Semantic critique negative control",
    source_id: source.document_id,
    source_version: source.version,
  });
  lesson = await saveObjectiveDraft(teacher, {
    lesson_id: lesson.id,
    expected_revision: lesson.revision,
    title: lesson.title,
    items: makeQuestionBankObjectiveEdits(),
  });
  lesson = await approveObjectives(teacher, {
    lesson_id: lesson.id,
    expected_revision: lesson.revision,
  });
  assert.ok(lesson.draft?.objective_workflow?.reviewed);
  evidence.objective_review = {
    workflow:
      "Real #100 createObjectiveDraft, saveObjectiveDraft and approveObjectives",
    reviewed: true,
    objectives: lesson.draft.concepts?.map((concept) => ({
      title: concept.title,
      objectives: concept.objectives,
      source_passage_references: concept.source_passage_ids,
    })),
  };
  evidence.source_passages = source.passages.map((passage) => ({
    reference: passage.passage_id,
    text: passage.text,
  }));
  const baseline = await updateQuestionBank(
    teacher,
    lesson.id,
    {
      action: "generate",
      expected_revision: lesson.revision,
      request_id: randomUUID(),
      question_ids: [],
      acknowledge_unknown: acknowledgeUnknown,
    },
    fixtureQuestionBankProvider,
  );
  assert.deepEqual(baseline.issues, []);
  const initial = baseline.draft.question_bank.items.find(
    (item) => item.role === "initial",
  );
  assert.ok(initial);
  const question = baseline.draft.questions?.find(
    (candidate) => candidate.question_id === initial.question_id,
  );
  assert.ok(question);
  const incorrectCriterion =
    "Explain evaporation as water vapor changing into liquid water.";
  const incorrectRubric = {
    ...question.rubric,
    answer_guidance:
      "Evaporation changes water vapor into liquid water. Condensation also changes water vapor into liquid water, so the two processes have the same direction.",
    criteria: [
      incorrectCriterion,
      "Explain condensation as gas changing to liquid.",
    ],
    partial_credit_guidance:
      "Credit an explanation of gas changing to liquid for each observation.",
  };
  const misleadingSupport = initial.source_support.map((support, index) => ({
    ...support,
    criterion: index === 0 ? incorrectCriterion : support.criterion,
  }));
  const candidate = structuredClone(baseline.draft);
  candidate.questions = candidate.questions?.map((entry) =>
    entry.question_id === initial.question_id
      ? { ...entry, rubric: incorrectRubric }
      : entry,
  );
  candidate.question_bank.items = candidate.question_bank.items.map((item) =>
    item.question_id === initial.question_id
      ? { ...item, source_support: misleadingSupport }
      : item,
  );
  const structuralIssues = validateQuestionBank(candidate);
  assert.deepEqual(
    structuralIssues,
    [],
    "The negative control must pass structural checks before spending a critique call.",
  );
  evidence.structural_validation = {
    passed: true,
    issues: structuralIssues,
    explanation:
      "Question/source/concept identities and exact quotation all validate. Those checks do not prove that the quote supports the false expected answer.",
  };
  const proposal = GeneratedQuestionProposalSchema.parse({
    question_id: question.question_id,
    prompt_text: question.prompt_text,
    concept_ids: question.concept_ids,
    source_passage_ids: question.source_passage_ids,
    rubric: {
      answer_guidance: incorrectRubric.answer_guidance,
      criteria: incorrectRubric.criteria,
      acceptable_variations: incorrectRubric.acceptable_variations,
      partial_credit_guidance: incorrectRubric.partial_credit_guidance,
    },
    format: initial.format,
    difficulty: initial.difficulty,
    feedback_guidance: initial.feedback_guidance,
    reasoning_error: initial.reasoning_error,
    source_support: misleadingSupport,
    calculation: null,
    assumptions: [],
    misconception_ids: [],
  });
  evidence.constructed_proposal = {
    role: "initial",
    prompt_text: proposal.prompt_text,
    expected_answer: proposal.rubric.answer_guidance,
    answer_criteria: proposal.rubric.criteria,
    partial_answer_guidance: proposal.rubric.partial_credit_guidance,
    source_support: proposal.source_support.map(
      ({ passage_id, quote, criterion }) => ({
        passage_reference: passage_id,
        quote,
        criterion,
      }),
    ),
  };
  const provider: QuestionBankProvider = async (input) => {
    if (input.stage === "generation")
      return {
        ok: true,
        stage: input.stage,
        result: { questions: [proposal] },
        model: "constructed-semantic-negative-control",
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    assert.equal(
      paidCalls,
      0,
      "Only one actual critique request is authorized.",
    );
    paidCalls++;
    mkdirSync(".setup", { recursive: true });
    writeFileSync(
      spentReceipt,
      JSON.stringify({
        started_at: new Date().toISOString(),
        maximum_paid_calls: 1,
        stage: "critique",
      }) + "\n",
      "utf8",
    );
    saveEvidence();
    console.log(
      "STARTING ONE REAL V2 SEMANTIC CRITIQUE; NO MODEL GENERATION OR RETRY",
    );
    capture.critique = await requestQuestionBank(input);
    saveEvidence();
    console.log(
      `REAL SEMANTIC CRITIQUE FINISHED: ${capture.critique.ok ? "completed" : capture.critique.code}`,
    );
    return capture.critique;
  };
  const requestId = randomUUID();
  const result = await updateQuestionBank(
    teacher,
    lesson.id,
    {
      action: "generate",
      expected_revision: baseline.revision,
      request_id: requestId,
      question_ids: [initial.question_id],
      acknowledge_unknown: acknowledgeUnknown,
    },
    provider,
  );
  const operation = result.operations.find(
    (entry) => entry.request_id === requestId,
  );
  evidence.operation_status = operation?.status;
  assert.equal(
    operation?.status,
    "completed",
    "Inspect retained evidence; no second paid request is permitted.",
  );
  assert.equal(paidCalls, 1);
  const flags =
    result.draft.question_bank.items.find(
      (item) => item.question_id === initial.question_id,
    )?.quality_issues ?? [];
  evidence.persisted_semantic_flags = flags;
  assert.ok(
    flags.some((flag) => /^(incorrect_answer|unsupported_answer):/.test(flag)),
    "The real critique must identify the incorrect or unsupported expected answer.",
  );
  // Attempting to mark reviewed without correcting the false answer must not clear the provider flag.
  const marked = await updateQuestionBank(teacher, lesson.id, {
    action: "save",
    expected_revision: result.revision,
    questions: result.draft.questions,
    question_guidance: result.draft.question_guidance,
    activity_policy: result.draft.activity_policy,
    question_bank: {
      ...result.draft.question_bank,
      items: result.draft.question_bank.items.map((item) => ({
        ...item,
        review_status: "reviewed",
        review_notes:
          "Negative control: attempted review without correcting the flagged answer.",
      })),
    },
  });
  assert.ok(
    marked.draft.question_bank.items.every(
      (item) => item.review_status === "reviewed",
    ),
  );
  let approvalError: { status: number; message: string } | null = null;
  try {
    await updateQuestionBank(teacher, lesson.id, {
      action: "approve",
      expected_revision: marked.revision,
    });
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    approvalError = { status: error.status, message: error.message };
  }
  assert.equal(approvalError?.status, 409);
  assert.match(approvalError?.message ?? "", /Educational review/);
  assert.equal(marked.draft.question_bank.approval, null);
  evidence.approval_gate = {
    all_questions_marked_reviewed: true,
    false_answer_not_corrected: true,
    provider_flags_preserved: true,
    approval_blocked: true,
    error: approvalError,
    bank_approval: null,
  };
  evidence.educational_review =
    "The expected answer reverses evaporation and falsely treats the two changes as having the same direction. The cited passage explicitly defines evaporation as liquid-to-gas. This deliberately constructed false answer demonstrates why exact quotations and valid IDs are insufficient; the actual semantic critique caught the contradiction and the server blocked bank approval. One successful negative control does not establish universal semantic reliability.";
  saveEvidence();
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync(
    "docs/evidence/question-bank-semantic-2026-10-23.json",
    JSON.stringify(evidence, null, 2) + "\n",
    "utf8",
  );
  console.log(
    "PASS: structural checks passed, actual critique flagged the false answer, and real bank approval was blocked. Exactly one paid call.",
  );
} finally {
  saveEvidence();
  await db.end();
}
