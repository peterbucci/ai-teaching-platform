/** Authenticated N7 acceptance. Only the separately authorized disposable runtime.
 * All judgments/activity generation are authored fixtures, never model results. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS, buildDemoFixture } from "../../lib/evidence/demo.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../../lib/evidence/content.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  readSession,
  recordEvaluation,
} from "../../lib/evidence/store.ts";
import { applyTutoring } from "../../lib/tutoring/store.ts";
import { readAssignmentEvidence } from "../../lib/teacher/store.ts";
import { buildInterventionEvidence } from "../../lib/interventions/evidence.ts";
import { generateInterventionDraft } from "../../lib/interventions/store.ts";
import { applyInterventionAction } from "../../lib/interventions/approval.ts";
import { prepareFallback } from "../student-blockers/recovery-browser-check.mjs";

assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5907");
assert.equal(process.env.PGDATABASE, "reader_visibility_n7_01a1742c");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3407");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const base = process.env.AUTH_URL;
const root = process.cwd();
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const out = path.join(
  root,
  "acceptance/notebook/evidence",
  process.env.N7_RUN || `journey-${Date.now()}`,
);
assert.ok(!fs.existsSync(out), "Preserve prior evidence; use a new run name.");
fs.mkdirSync(out, { recursive: true });
const pool = getPool();
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  diffSha256: createHash("sha256")
    .update(execFileSync("git", ["diff", "HEAD"]))
    .digest("hex"),
  base,
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
  screenshots: [],
  errors: [],
};
const saveReport = () =>
  fs.writeFileSync(
    path.join(out, "journey.json"),
    JSON.stringify(report, null, 2),
  );
const check = (name) => {
  report.checks.push(name);
  saveReport();
  console.log(`PASS ${name}`);
};
const actor = async (id) => {
  const r = (
    await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [id])
  ).rows[0];
  assert.ok(r?.auth_user_id);
  return evidenceAccess({ profileId: r.id, userId: r.auth_user_id });
};
const student = await actor(DEMO_IDS.studentOne),
  teacher = await actor(DEMO_IDS.teacher);
const content = loadApprovedContent();
const session = await startSession(student, DEMO_IDS.assignmentId, "live_demo");
const attempt = await presentQuestion(student, session.id, {
  question: getCuratedQuestion(content, content.sequence.initial_question_id),
  intent: "initial_retrieval",
});
report.session = session.id;
report.attempt = attempt.id;
const study = `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${session.id}`;

// A validated authored activity goes through the real teacher review/delivery
// service. The operator acts only as the fictional teacher in this database.
const selection = {
  assignment_id: DEMO_IDS.assignmentId,
  concept_id: "transmission_delay",
  misconception_id: null,
  attempt_ids: [DEMO_IDS.supportedRoot, DEMO_IDS.correctRoot],
  origin: "synthetic_fixture",
};
const bundle = buildInterventionEvidence(
  await readAssignmentEvidence(
    teacher,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  ),
  content,
  selection,
);
const source =
  bundle.sources.find((x) => x.passage_id === "P07") || bundle.sources[0];
const excerpt = source.text.slice(0, 1800);
const examples = ["supporting", "contradictory"].map((role) =>
  bundle.observations.find((row) => row.role === role),
);
assert.ok(examples.every(Boolean));
const guidance = {
  concept_ids: [bundle.concept.id],
  source_passage_ids: [source.passage_id],
  answer_guidance: excerpt,
  criteria: [excerpt.slice(0, 120)],
};
const activity = {
  content_ref: bundle.content_ref,
  title: "Synthetic teacher-reviewed transmission activity",
  learning_objective: bundle.concept.objectives[0],
  strategy: "predict_then_explain",
  exercise_text:
    "Sketch a packet being placed onto a link. Explain which parts depend on packet size, bandwidth and physical distance.",
  source_references: [{ passage_id: source.passage_id, quote: excerpt }],
  practice_questions: [
    {
      ...guidance,
      prompt_text:
        "Predict how sending a longer message on the same link changes transmission time. Explain the role of bandwidth.",
    },
  ],
  fresh_check: {
    ...guidance,
    prompt_text:
      "Compare the transmission delay of the same packet on links with different bandwidths. Explain what determines the time to put the packet onto the link.",
  },
  evidence_references: examples.map((row) => ({
    evidence_id: row.evidence_id,
    response_quote: row.attempt.response_text.slice(0, 200),
    role: row.role,
  })),
  suggested_recipients: [
    {
      pseudonym: examples[0].pseudonym,
      evidence_ids: [examples[0].evidence_id],
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
    result: activity,
    model: "synthetic-n7-fixture",
    responseId: `fixture-${randomUUID()}`,
    latencyMs: 0,
    usage: null,
  }),
);
assert.equal(generated.status, "completed", JSON.stringify(generated));
const draft = generated.draft;
assert.ok(draft);
const approved = await applyInterventionAction(teacher, draft.id, {
  action: "approve",
  request_id: randomUUID(),
  expected_revision: draft.revision,
  recipient_ids: [DEMO_IDS.studentOne],
});
assert.ok(approved.approval);
await applyInterventionAction(teacher, draft.id, {
  action: "deliver",
  request_id: randomUUID(),
  expected_revision: approved.draft.revision,
  approval_id: approved.approval.id,
});
const approvalId = approved.approval.id;
report.approval = approvalId;
check(
  "fictional teacher approves and separately delivers validated authored review",
);

const browser = await chromium.launch({ headless: true });
let context;
let teacherContext;
let page;
try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  context.setDefaultTimeout(15000);
  teacherContext = await browser.newContext();
  const teacherLogin = await teacherContext.request.post(
    `${base}/api/auth/sign-in/email`,
    {
      headers: { Origin: base },
      data: {
        email: process.env.DEMO_TEACHER_EMAIL,
        password: process.env.DEMO_TEACHER_PASSWORD,
      },
    },
  );
  assert.equal(teacherLogin.status(), 200);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const login = await context.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200, "fictional student login");
  page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  const writes = [];
  report.writes = writes;
  report.responses = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST")
      report.responses.push({
        url: new URL(r.url()).pathname,
        status: r.status(),
      });
  });
  page.on("request", (r) => {
    if (r.method() !== "GET" && !r.url().includes("/api/auth/"))
      writes.push({ url: new URL(r.url()).pathname, body: r.postDataJSON() });
  });
  await page.goto(`${base}/study/assignments`);
  await page
    .getByRole("heading", { name: "My learning", exact: true })
    .waitFor();
  assert.equal(
    await page.locator('[data-notebook-slot="teacher-reviews"]').count(),
    1,
  );
  assert.equal(writes.length, 0);
  const cards = await page
    .locator('[data-notebook-slot="teacher-reviews"]')
    .textContent();
  assert.ok(cards.includes(activity.title));
  assert.ok(!cards.includes(excerpt));
  check(
    "authenticated My Learning mounts N1/N2/N5 without review body disclosure or writes",
  );

  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: path.join(out, `application-learning-${width}.png`),
      fullPage: true,
    });
    report.screenshots.push(`application-learning-${width}.png`);
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      geometry.scroll <= geometry.width + 1,
      `My Learning overflow at ${width}: ${JSON.stringify(geometry)}`,
    );
  }
  check("My Learning four viewport widths have no horizontal page overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `${base}/study/assignments/${DEMO_IDS.assignmentId}?tab=overview`,
  );
  await page.locator("[data-assignment-id]").first().waitFor();
  assert.equal((await page.locator("[data-assignment-id]").count()) > 0, true);
  await page.screenshot({
    path: path.join(out, "application-overview-1440.png"),
    fullPage: true,
  });
  check(
    "authenticated assignment overview mounted without starting or evaluating",
  );
  await page.goto(base + study);
  const composer = page.getByRole("textbox", {
    name: "Message your tutor",
    exact: true,
  });
  await composer.waitFor();
  assert.equal(await composer.count(), 1);
  const fixture = {
    page,
    studentContext: context,
    teacherContext,
    sessionId: session.id,
    attemptId: attempt.id,
    url: study,
  };
  const labels = {
    composer: "Message your tutor",
    submit: "Submit this as my answer",
  };
  await prepareFallback({
    base,
    fixture,
    labels,
    message:
      "Please help me distinguish bandwidth and distance without giving away the answer.",
  });
  let evidence = await readSession(teacher, session.id, "teacher");
  assert.equal(evidence.attempts[0].submitted_at, null);
  assert.equal(evidence.evaluations.length, 0);
  check(
    "help/ambiguous fallback preserves question and requires explicit answer confirmation",
  );
  const original =
    "  My original café 🌱 reasoning.\nKeep  two spaces and line breaks.  ";
  await composer.fill(original);
  await page
    .getByRole("button", { name: "Submit this as my answer", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document.querySelector('textarea[aria-label="Message your tutor"]')
        ?.value || document.body.innerText.includes("saved"),
  );
  for (let n = 0; n < 100; n++) {
    evidence = await readSession(teacher, session.id, "teacher");
    if (evidence.attempts[0].submitted_at) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(evidence.attempts[0].response_text, original);
  const snapshot = JSON.stringify(evidence.attempts[0].question.content_ref);
  check(
    "explicitly intended answer saves exact original Unicode whitespace and immutable source snapshot",
  );
  // An accepted synthetic result is persisted through existing services, never
  // inserted as production UI or claimed to be a model judgment.
  const sample = buildDemoFixture(content)
    .sessions.flatMap((s) => s.evaluations)
    .find((e) => e.result);
  const result = structuredClone(sample.result);
  result.per_concept_results = attempt.question.concept_ids.map((id) => ({
    concept_id: id,
    correctness: "uncertain",
    error_type: "insufficient_response",
    rubric_criteria_met: [],
    rubric_criteria_missing: [],
  }));
  result.source_passage_ids = attempt.question.source_passage_ids;
  result.evidence_quotes = [];
  result.misconception_candidates = [];
  result.reasoning_observed =
    "Synthetic N7 persistence fixture, not a model assessment.";
  result.uncertainty_reason = "Authored uncertain outcome for acceptance.";
  result.proposed_next_action = "ASK_SELF_EXPLANATION";
  const accepted = await recordEvaluation(student, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "notebook-integration-v1",
    },
    supersedes_id: null,
    result,
    applied_result: null,
    failure_reason: null,
  });
  await applyTutoring(student, session.id, accepted.id);
  await page.reload();
  await page.locator(".lp-turns").waitFor();
  assert.ok(
    (await page.locator("body").textContent()).includes(original.trim()),
  );
  check(
    "accepted synthetic evaluation resumes through the existing tutoring owner",
  );
  await page.goto(
    `${base}/study/assignments/${DEMO_IDS.assignmentId}?tab=work&session=${session.id}#question-${attempt.id}`,
  );
  const record = page.locator(`#question-${attempt.id}`);
  await record.waitFor();
  assert.equal(
    await record.locator("[data-original-response]").textContent(),
    original,
  );
  assert.ok(
    (await record.textContent()).includes(
      "Assessment unavailable in this view",
    ),
  );
  await page.screenshot({
    path: path.join(out, "application-saved-1440.png"),
    fullPage: true,
  });
  check(
    "N3 current-data saved record preserves original response and does not invent per-attempt assessment",
  );
  await page.goBack();
  await page.locator(".lp-turns").waitFor();
  await page.goForward();
  await record.waitFor();
  check("browser Back/Forward and exact saved-question fragment");
  await page.goto(
    `${base}/study/reading?assignment=${DEMO_IDS.assignmentId}&session=${session.id}&version=${encodeURIComponent(attempt.question.content_ref.content_version)}&passage=P07&from=study`,
  );
  const readerHost = page.locator("[data-n7-standalone-reader]");
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-n7-standalone-reader]")
        ?.getAttribute("data-reader-active") === "true",
  );
  assert.equal(await readerHost.count(), 1);
  await page.screenshot({
    path: path.join(out, "application-reading-1440.png"),
    fullPage: true,
  });
  await page.getByLabel("Account menu", { exact: true }).click();
  assert.equal(await readerHost.getAttribute("data-reader-active"), "false");
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-n7-standalone-reader]")
        ?.getAttribute("data-reader-active") === "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  assert.equal(await readerHost.getAttribute("data-reader-active"), "false");
  await page
    .getByRole("button", { name: "Close navigation", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-n7-standalone-reader]")
        ?.getAttribute("data-reader-active") === "true",
  );
  check(
    "standalone N4 bootstraps and deactivates for account and mobile navigation overlays",
  );
  await page.goto(base + study);
  evidence = await readSession(teacher, session.id, "teacher");
  assert.equal(evidence.attempts[0].response_text, original);
  assert.equal(
    JSON.stringify(evidence.attempts[0].question.content_ref),
    snapshot,
  );
  check("reading return preserves original attempt and source identity");
  await page.goto(`${base}/study/interventions/${approvalId}`);
  await page
    .getByRole("heading", { name: activity.title, exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message your tutor", exact: true })
      .count(),
    0,
  );
  const start = page.getByRole("button", { name: /Start.*fresh check/i });
  await start.click();
  const answer = page.locator("#intervention-response");
  await answer.fill("  Fresh check original\nwith exact spacing.  ");
  await page.reload();
  await answer.waitFor();
  assert.equal(
    await answer.inputValue(),
    "  Fresh check original\nwith exact spacing.  ",
  );
  await page
    .getByRole("button", { name: "Submit fresh-check response", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Saved response", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "application-review-390.png"),
    fullPage: true,
  });
  check(
    "dedicated teacher-approved review retains draft across refresh and saves fresh check with provider disabled",
  );
  const other = await browser.newContext();
  const logged = await other.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_TWO_EMAIL,
      password: process.env.DEMO_STUDENT_TWO_PASSWORD,
    },
  });
  assert.equal(logged.status(), 200);
  assert.equal(
    (await other.request.get(`${base}/api/tutoring/${session.id}`)).status(),
    404,
  );
  assert.equal(
    (
      await other.request.get(`${base}/api/student/interventions/${approvalId}`)
    ).status(),
    404,
  );
  await other.close();
  check(
    "cross-student session and review authorization rejects foreign identities",
  );
  assert.deepEqual(report.errors, []);
  report.result = "PASS";
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
      .catch(() => {});
    fs.writeFileSync(
      path.join(out, "failure.txt"),
      await page
        .locator("body")
        .innerText()
        .catch(() => "unavailable"),
    );
  }
  report.result = "FAIL";
  report.failure = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  saveReport();
  await context?.close();
  await teacherContext?.close();
  await browser.close();
  await pool.end();
}
