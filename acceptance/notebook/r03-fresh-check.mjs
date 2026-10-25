/** R03 combined production acceptance: fictional uploaded lesson, UUID concepts,
 * existing N7 review route and one unchanged DeliveredActivity controller.
 * Run only through the existing guarded .setup/runtime/run.cjs after rebuilding:
 * N7_R03_RUNTIME=production node .setup/runtime/run.cjs acceptance/notebook/r03-fresh-check.mjs
 * Setup intentionally creates new synthetic source/lesson/approval/evidence rows.
 * Accepted evaluations are authored fixtures, never claimed as model judgments.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  readSession,
  recordEvaluation,
} from "../../lib/evidence/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../../lib/assignments/store.ts";
import { createSourceVersion } from "../../lib/lessons/sources.ts";
import {
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
  createLessonAssignment,
  readAssignmentContent,
} from "../../lib/lessons/store.ts";
import { readAssignmentEvidence } from "../../lib/teacher/store.ts";
import { buildInterventionEvidence } from "../../lib/interventions/evidence.ts";
import { generateInterventionDraft } from "../../lib/interventions/store.ts";
import { applyInterventionAction } from "../../lib/interventions/approval.ts";
import { readStudentInterventionFollowup } from "../../lib/interventions/outcomes.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../../tests/fixtures/teacher-lesson.ts";

assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5907");
assert.equal(process.env.PGDATABASE, "reader_visibility_n7_01a1742c");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3407");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
assert.equal(process.env.DATABASE_URL, undefined);
assert.equal(process.env.N7_R03_RUNTIME, "production");
const root = process.cwd();
const base = process.env.AUTH_URL;
const buildId = fs
  .readFileSync(path.join(root, ".next/BUILD_ID"), "utf8")
  .trim();
assert.ok(buildId, "A completed production build is required");
const run = process.env.N7_R03_RUN || `r03-fresh-check-${Date.now()}`;
assert.match(run, /^[a-zA-Z0-9_-]+$/);
const out = path.join(root, "acceptance/notebook/evidence", run);
assert.ok(!fs.existsSync(out), "Preserve previous acceptance evidence");
fs.mkdirSync(out, { recursive: true });
const pool = getPool();
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const sourceFiles = [
  "app/study/interventions/[approvalId]/activity.tsx",
  "app/study/interventions/[approvalId]/page.tsx",
  "app/study/notebook/reviews/presenters.tsx",
  "lib/interventions/student-concept-names.ts",
  "lib/interventions/outcomes.ts",
  "app/teacher/interventions/followup.tsx",
].map((file) => ({
  file,
  sha256: hash(fs.readFileSync(path.join(root, file))),
}));
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  diffSha256: hash(execFileSync("git", ["diff", "HEAD"])),
  runtime: "production",
  buildId,
  base,
  sourceFiles,
  sourceFilesSha256: hash(canonical(sourceFiles)),
  fixture:
    "New uploaded synthetic water-state lesson with digit-leading UUID concepts",
  evaluationProvenance:
    "Authored synthetic fixture; no actual-model assessment",
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
  comparisons: [],
  screenshots: [],
  pageErrors: [],
  knownGaps: [
    "The existing teacher follow-up UI still displays raw concept IDs. This check compares its accepted identity/results, not student/teacher label parity.",
  ],
  result: "RUNNING",
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "r03-fresh-check.json"),
    JSON.stringify(report, null, 2),
  );
const check = (name) => {
  report.checks.push(name);
  save();
  console.log(`PASS ${name}`);
};
const exactAnswer =
  "  Water has not disappeared.\nEvaporation changes liquid water into water vapor, a gas.\nThe same water is in a different state.  ";
let browser;
let studentContext;
let teacherContext;
let studentPage;
let teacherPage;
let fixture;

async function actor(profileId) {
  const row = (
    await pool.query(
      "SELECT id,auth_user_id,display_name FROM profiles WHERE id=$1",
      [profileId],
    )
  ).rows[0];
  assert.ok(row?.auth_user_id, "The guarded fictional profile must exist");
  return {
    access: evidenceAccess({ profileId: row.id, userId: row.auth_user_id }),
    name: row.display_name,
  };
}

async function authoredEvaluation(
  access,
  sessionId,
  attempt,
  response,
  correctness,
) {
  return recordEvaluation(access, sessionId, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "n7-r03-uploaded-browser-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: attempt.question.concept_ids.map((concept_id) => ({
        concept_id,
        correctness,
        error_type: correctness === "correct" ? null : "conceptual",
        rubric_criteria_met:
          correctness === "correct"
            ? ["Explains the direction of the change of state"]
            : [],
        rubric_criteria_missing:
          correctness === "correct"
            ? []
            : ["Explains the direction of the change of state"],
      })),
      source_passage_ids: attempt.question.source_passage_ids,
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: response,
          start_character: 0,
          end_character: response.length,
          interpretation:
            "Authored synthetic acceptance fixture; not a model judgment.",
        },
      ],
      misconception_candidates: [],
      reasoning_observed:
        "Authored synthetic evaluation for the R03 display and preservation check.",
      uncertainty_reason: null,
      proposed_next_action:
        correctness === "correct"
          ? "ASK_SELF_EXPLANATION"
          : "ASK_DIAGNOSTIC_FOLLOWUP",
    },
  });
}

async function makeFixture(student, teacher) {
  const enrollment = await pool.query(
    "SELECT 1 FROM classes c JOIN enrollments e ON e.class_id=c.id WHERE c.id=$1 AND c.teacher_id=$2 AND e.student_id=$3",
    [DEMO_IDS.classId, DEMO_IDS.teacher, DEMO_IDS.studentOne],
  );
  assert.equal(
    enrollment.rowCount,
    1,
    "Use only the existing fictional demo class",
  );
  const source = await createSourceVersion(teacher, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-n7-r03-water.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  let draft = await saveLessonDraft(teacher, {
    expected_revision: 0,
    title: "Synthetic N7 R03 uploaded lesson",
    draft: {},
  });
  const lesson = makeTeacherLesson(source.source_ref, draft.id, "1");
  const identities = new Map(
    lesson.concepts.map((concept) => [concept.id, `1${randomUUID().slice(1)}`]),
  );
  for (const concept of lesson.concepts)
    concept.id = identities.get(concept.id);
  lesson.sequence.concept_ids = [...identities.values()];
  for (const question of lesson.questions)
    question.concept_ids = question.concept_ids.map((id) => identities.get(id));
  draft = await saveLessonDraft(teacher, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: lesson,
  });
  await approveLessonDraft(teacher, draft.id, draft.revision);
  await publishLessonVersion(teacher, draft.id, draft.revision);
  const assignment = await createLessonAssignment(teacher, {
    class_id: DEMO_IDS.classId,
    lesson_id: draft.id,
    version: "1",
    title: "Synthetic N7 R03 water-state assignment",
    instructions: "Use the approved synthetic water-state passages.",
  });
  const review = await assignmentReview(teacher, assignment.id);
  await approveAssignment(teacher, assignment.id, review.review_token);
  const content = await readAssignmentContent(
    student,
    assignment.id,
    "student",
  );
  const originalSession = await startSession(
    student,
    assignment.id,
    "synthetic_fixture",
  );
  const question = content.questions.get("WC-01");
  assert.ok(question);
  const original = await presentQuestion(student, originalSession.id, {
    question,
    intent: "initial_retrieval",
  });
  const originalAnswer =
    "Evaporation is gas becoming liquid, while condensation is liquid becoming gas.";
  await submitAnswer(student, originalSession.id, {
    attempt_id: original.id,
    submission_key: randomUUID(),
    response_text: originalAnswer,
  });
  await authoredEvaluation(
    student,
    originalSession.id,
    original,
    originalAnswer,
    "incorrect",
  );
  const conceptId = lesson.concepts[0].id;
  const selection = {
    assignment_id: assignment.id,
    concept_id: conceptId,
    misconception_id: null,
    attempt_ids: [original.id],
    origin: "synthetic_fixture",
  };
  const evidence = buildInterventionEvidence(
    await readAssignmentEvidence(teacher, assignment.id, "synthetic_fixture"),
    content,
    selection,
  );
  const sourcePassage = evidence.sources[0];
  const observation = evidence.observations[0];
  assert.ok(sourcePassage && observation);
  const guidance = {
    concept_ids: [conceptId],
    source_passage_ids: [sourcePassage.passage_id],
    answer_guidance: sourcePassage.text,
    criteria: ["Evaporation changes liquid water into water vapor, a gas."],
  };
  const proposal = {
    content_ref: content.content_ref,
    title: "Following water as it changes state",
    learning_objective: evidence.concept.objectives[0],
    strategy: "self_explanation",
    exercise_text:
      "Read the passage about evaporation, then explain how liquid water becomes water vapor.",
    source_references: [
      { passage_id: sourcePassage.passage_id, quote: sourcePassage.text },
    ],
    practice_questions: [
      {
        ...guidance,
        prompt_text:
          "Describe the water's starting and ending states during evaporation.",
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
        response_quote: originalAnswer,
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
  const generated = await generateInterventionDraft(
    teacher,
    {
      request_id: randomUUID(),
      draft_id: randomUUID(),
      expected_revision: 0,
      selection,
      revision_instructions: "",
    },
    async () => ({
      ok: true,
      result: proposal,
      model: "injected-n7-r03-fixture",
      responseId: `fixture-${randomUUID()}`,
      latencyMs: 0,
      usage: null,
    }),
  );
  assert.equal(
    generated.status,
    "completed",
    `Authored uploaded activity must validate: ${generated.error ?? generated.status}`,
  );
  assert.ok(generated.draft);
  const approved = await applyInterventionAction(teacher, generated.draft.id, {
    action: "approve",
    request_id: randomUUID(),
    expected_revision: generated.draft.revision,
    recipient_ids: [DEMO_IDS.studentOne],
  });
  assert.ok(approved.approval);
  await applyInterventionAction(teacher, generated.draft.id, {
    action: "deliver",
    request_id: randomUUID(),
    expected_revision: approved.draft.revision,
    approval_id: approved.approval.id,
  });
  return {
    approvalId: approved.approval.id,
    draftId: generated.draft.id,
    assignmentId: assignment.id,
    conceptId,
    conceptName: content.concepts.get(conceptId).title,
    contentRef: content.content_ref,
    originalAttemptId: original.id,
    originalSessionId: originalSession.id,
  };
}

async function snapshot(approvalId, attemptId) {
  const [approval, attempt, evaluations] = await Promise.all([
    pool.query(
      "SELECT to_jsonb(a) AS row FROM teacher_intervention_approvals a WHERE id=$1",
      [approvalId],
    ),
    pool.query("SELECT to_jsonb(a) AS row FROM attempts a WHERE id=$1", [
      attemptId,
    ]),
    pool.query(
      "SELECT to_jsonb(e) AS row FROM evaluations e WHERE attempt_id=$1 ORDER BY id",
      [attemptId],
    ),
  ]);
  assert.equal(approval.rowCount, 1);
  assert.equal(attempt.rowCount, 1);
  const rows = {
    approval: approval.rows[0].row,
    attempt: attempt.rows[0].row,
    evaluations: evaluations.rows.map((r) => r.row),
  };
  return {
    rows,
    sha256: hash(canonical(rows)),
    hashes: Object.fromEntries(
      Object.entries(rows).map(([key, value]) => [key, hash(canonical(value))]),
    ),
  };
}

async function login(context, kind) {
  const result = await context.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: process.env[`DEMO_${kind}_EMAIL`],
      password: process.env[`DEMO_${kind}_PASSWORD`],
    },
  });
  assert.equal(result.status(), 200, `Fictional ${kind} login`);
}

async function singleController(page) {
  const controller = page.locator(".sn-review-controller");
  await controller.locator(".lp-followup-response").waitFor();
  assert.equal(await page.locator(".sn-review-detail").count(), 1);
  assert.equal(await controller.count(), 1);
  assert.equal(await controller.locator(".lp-review-activity").count(), 1);
  assert.equal(await controller.locator(".lp-followup-response").count(), 1);
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message your tutor", exact: true })
      .count(),
    0,
  );
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  report.screenshots.push(name);
}

try {
  const studentActor = await actor(DEMO_IDS.studentOne);
  const teacherActor = await actor(DEMO_IDS.teacher);
  fixture = await makeFixture(studentActor.access, teacherActor.access);
  report.identities = fixture;
  check(
    "authorized fictional uploaded lesson and teacher-approved activity use UUID concept identities",
  );
  browser = await chromium.launch({ headless: true });
  studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  teacherContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  for (const context of [studentContext, teacherContext]) {
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(20000);
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
  }
  await login(studentContext, "STUDENT_ONE");
  await login(teacherContext, "TEACHER");
  studentPage = await studentContext.newPage();
  teacherPage = await teacherContext.newPage();
  for (const [label, page] of [
    ["student", studentPage],
    ["teacher", teacherPage],
  ]) {
    page.on("pageerror", (error) =>
      report.pageErrors.push({
        page: label,
        name: error.name,
        message: error.message.split("\n")[0].slice(0, 300),
      }),
    );
    page.on("dialog", (dialog) => dialog.accept());
  }
  const studentRoute = `${base}/study/interventions/${fixture.approvalId}`;
  const endpoint = `${base}/api/student/interventions/${fixture.approvalId}/followup`;
  let starts = 0;
  let submissions = 0;
  let retries = 0;
  studentPage.on("request", (request) => {
    if (request.url() !== endpoint || request.method() !== "POST") return;
    const action = request.postDataJSON().action;
    if (action === "start") starts++;
    if (action === "submit") submissions++;
    if (action === "retry") retries++;
  });
  await studentPage.goto(studentRoute);
  await singleController(studentPage);
  await studentPage
    .getByRole("button", { name: "Start fresh check", exact: true })
    .click();
  const answer = studentPage.locator("#intervention-response");
  await answer.fill(exactAnswer);
  await studentPage.reload();
  await answer.waitFor();
  assert.equal(await answer.inputValue(), exactAnswer);
  await studentPage.goto(`${base}/study/assignments`);
  await studentPage.goBack();
  await answer.waitFor();
  assert.equal(await answer.inputValue(), exactAnswer);
  await studentPage.goForward();
  await studentPage.goBack();
  await answer.waitFor();
  assert.equal(await answer.inputValue(), exactAnswer);
  await singleController(studentPage);
  assert.equal(starts, 1);
  check(
    "one mounted review controller preserves exact unsent draft across refresh and browser Back/Forward",
  );

  let interrupted = false;
  await studentPage.route(endpoint, async (route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON().action !== "submit" ||
      interrupted
    )
      return route.continue();
    interrupted = true;
    const response = await route.fetch();
    assert.equal(
      response.status(),
      200,
      "Provider-disabled save must return its durable status",
    );
    await route.abort("failed");
  });
  await studentPage
    .getByRole("button", { name: "Submit fresh-check response", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "Retry same request", exact: true })
    .waitFor();
  await studentPage
    .getByRole("button", { name: "Refresh saved status", exact: true })
    .click();
  const saved = studentPage.locator(".lp-followup-saved");
  await saved
    .getByRole("heading", { name: "Saved response", exact: true })
    .waitFor();
  assert.equal(await saved.locator("blockquote").textContent(), exactAnswer);
  assert.equal(interrupted, true);
  assert.equal(submissions, 1);
  assert.equal(retries, 0);
  await studentPage.unroute(endpoint);
  check(
    "lost submit response recovers the exact saved answer without resubmission or evaluation retry",
  );

  const followup = await readStudentInterventionFollowup(
    studentActor.access,
    fixture.approvalId,
  );
  assert.equal(followup.response_text, exactAnswer);
  assert.ok(followup.attempt_id);
  const link = (
    await pool.query(
      "SELECT session_id,attempt_id FROM teacher_intervention_followups WHERE approval_id=$1 AND student_id=$2",
      [fixture.approvalId, DEMO_IDS.studentOne],
    )
  ).rows[0];
  assert.equal(link.attempt_id, followup.attempt_id);
  const evidence = await readSession(
    teacherActor.access,
    link.session_id,
    "teacher",
  );
  const attempt = evidence.attempts.find((item) => item.id === link.attempt_id);
  assert.ok(attempt);
  assert.deepEqual(attempt.question.content_ref, fixture.contentRef);
  const accepted = await authoredEvaluation(
    studentActor.access,
    link.session_id,
    attempt,
    exactAnswer,
    "correct",
  );
  const acceptedFollowup = await readStudentInterventionFollowup(
    studentActor.access,
    fixture.approvalId,
  );
  assert.equal(acceptedFollowup.evaluation_status, "accepted");
  assert.equal(acceptedFollowup.evaluation_id, accepted.id);
  assert.deepEqual(acceptedFollowup.results, [
    { concept_id: fixture.conceptId, correctness: "correct" },
  ]);
  report.accepted = {
    sessionId: link.session_id,
    attemptId: attempt.id,
    evaluationId: accepted.id,
    results: acceptedFollowup.results,
    responseText: exactAnswer,
  };
  const baseline = await snapshot(fixture.approvalId, attempt.id);
  report.baseline = {
    sha256: baseline.sha256,
    hashes: baseline.hashes,
    evaluationIds: baseline.rows.evaluations.map((row) => row.id),
  };
  check(
    "authored accepted fixture is established before the immutable comparison baseline",
  );
  async function unchanged(stage) {
    const current = await snapshot(fixture.approvalId, attempt.id);
    assert.equal(
      current.sha256,
      baseline.sha256,
      `${stage}: approval, attempt and every evaluation must remain unchanged`,
    );
    report.comparisons.push({
      stage,
      sha256: current.sha256,
      hashes: current.hashes,
    });
  }

  for (const width of [390, 320]) {
    await studentPage.setViewportSize({ width, height: 844 });
    await studentPage.goto(studentRoute);
    await singleController(studentPage);
    await saved
      .getByRole("heading", { name: "Evaluation accepted", exact: true })
      .waitFor();
    assert.equal(await saved.locator("blockquote").textContent(), exactAnswer);
    assert.deepEqual(await saved.locator("ul > li").allTextContents(), [
      `${fixture.conceptName}: correct`,
    ]);
    assert.ok(
      !(await saved.locator("ul").textContent()).includes(fixture.conceptId),
      "Student result must use the public title, not the UUID",
    );
    const api = await studentContext.request.get(endpoint);
    assert.equal(api.status(), 200);
    const apiResult = await api.json();
    assert.equal(apiResult.attempt_id, attempt.id);
    assert.equal(apiResult.evaluation_id, accepted.id);
    assert.equal(apiResult.response_text, exactAnswer);
    assert.deepEqual(apiResult.results, acceptedFollowup.results);
    const viewport = await studentPage.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      viewport.scrollWidth <= viewport.clientWidth + 1,
      `${width}px review must not overflow horizontally`,
    );
    await saved.scrollIntoViewIfNeeded();
    await capture(studentPage, `student-fresh-check-${width}.png`);
    await unchanged(`student-${width}`);
    await studentPage.reload();
    await saved
      .getByRole("heading", { name: "Evaluation accepted", exact: true })
      .waitFor();
    await studentPage.goto(`${base}/study/assignments`);
    await studentPage.goBack();
    await saved
      .getByRole("heading", { name: "Evaluation accepted", exact: true })
      .waitFor();
    await studentPage.goForward();
    await studentPage.goBack();
    await saved
      .getByRole("heading", { name: "Evaluation accepted", exact: true })
      .waitFor();
    assert.equal(await saved.locator("blockquote").textContent(), exactAnswer);
    await unchanged(`student-${width}-refresh-history`);
    check(
      `student ${width}px shows public UUID-concept title, exact saved text and accepted result through refresh/history`,
    );
  }
  const comparisonResponse = await teacherContext.request.get(
    `${base}/api/teacher/interventions/${fixture.draftId}/followup`,
  );
  assert.equal(comparisonResponse.status(), 200);
  const comparison = await comparisonResponse.json();
  assert.equal(comparison.approval_id, fixture.approvalId);
  const recipient = comparison.recipients.find(
    (row) => row.student_id === DEMO_IDS.studentOne,
  );
  assert.ok(recipient);
  assert.equal(recipient.followup.evaluation_id, accepted.id);
  assert.equal(recipient.evaluation.id, accepted.id);
  assert.equal(recipient.attempt.id, attempt.id);
  assert.equal(recipient.followup.response_text, exactAnswer);
  assert.deepEqual(recipient.followup.results, acceptedFollowup.results);
  assert.deepEqual(recipient.evaluation.result, accepted.result);
  assert.deepEqual(
    recipient.evaluations.map((row) => row.id).sort(),
    baseline.rows.evaluations.map((row) => row.id).sort(),
  );
  await teacherPage.goto(
    `${base}/teacher/interventions?${new URLSearchParams({ assignment: fixture.assignmentId, origin: "all", draft: fixture.draftId })}`,
  );
  const recipientView = teacherPage
    .locator(".lp-followup-recipient")
    .filter({ hasText: studentActor.name });
  await recipientView.locator("summary").first().click();
  const after = recipientView.locator(".lp-followup-after");
  await after
    .getByRole("heading", { name: "Evaluation accepted", exact: true })
    .waitFor();
  assert.equal(await after.locator("blockquote").textContent(), exactAnswer);
  assert.equal(
    (await after.locator("ul > li").first().textContent()).trim(),
    `${fixture.conceptId}: correct`,
  );
  await after.scrollIntoViewIfNeeded();
  await capture(teacherPage, "teacher-same-accepted-fresh-check.png");
  await teacherPage.goto(
    `${base}/teacher/sessions/${link.session_id}#evaluation-${accepted.id}`,
  );
  const evaluationView = teacherPage.locator(`#evaluation-${accepted.id}`);
  await evaluationView.waitFor();
  assert.equal(
    await evaluationView.getAttribute("id"),
    `evaluation-${accepted.id}`,
  );
  assert.ok(
    (await evaluationView.locator("h3").textContent()).includes(
      "current accepted judgment",
    ),
  );
  await unchanged("teacher-accepted-result-and-evidence");
  check(
    "authenticated teacher API and UI retain the same accepted evaluation, original response and complete evaluation history",
  );
  assert.equal(starts, 1);
  assert.equal(submissions, 1);
  assert.equal(retries, 0);
  report.followupWrites = { starts, submissions, retries };
  assert.deepEqual(report.pageErrors, []);
  await unchanged("final");
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  // Do not serialize request traces, cookies, account credentials or raw stacks.
  report.failure = {
    name: error instanceof Error ? error.name : "Error",
    message:
      error instanceof Error
        ? error.message.split("\n")[0].slice(0, 300)
        : "Acceptance failed",
  };
  console.error(`${report.failure.name}: ${report.failure.message}`);
  if (studentPage)
    await capture(studentPage, "failure-student.png").catch(() => {});
  process.exitCode = 1;
} finally {
  save();
  await studentContext?.close();
  await teacherContext?.close();
  await browser?.close();
  await pool.end();
}
