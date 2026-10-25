/** Authenticated presentation/recovery checks, synthetic records and injected
 * evaluation outcomes only. No configured model can be called in this runtime. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fixtureKit } from "./replay-r03.mjs";
import { getPool } from "../../../../../../lib/db.ts";
import { DEMO_IDS } from "../../../../../../lib/evidence/demo.ts";
import { applyStudentInterventionFollowup } from "../../../../../../lib/interventions/outcomes.ts";
import { InterventionDraftSchema } from "../../../../../../lib/interventions/drafts.ts";
import {
  applyInterventionAction,
  readInterventionReview,
} from "../../../../../../lib/interventions/approval.ts";

assert.equal(process.env.PGDATABASE, "lp_s3_review_01a1749b");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3413");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const root = process.cwd();
const base = process.env.AUTH_URL;
const out = path.resolve(
  "app/study/notebook/reviews/verification/s3",
  `workflow-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const pool = getPool();
const { actor, makeFixture } = await fixtureKit();
// A rerun may explicitly reuse earlier real teacher-approved fictional fixtures
// whose checks stopped before answering. This preserves the generation budget.
const reuse = fs.existsSync(".setup/workflow-fixtures.json")
  ? JSON.parse(fs.readFileSync(".setup/workflow-fixtures.json", "utf8"))
  : {};
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
  states: [],
  errors: [],
  requests: [],
  snapshots: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "workflow.json"),
    JSON.stringify(report, null, 2),
  );
function pass(name) {
  report.checks.push(name);
  save();
  console.log("PASS " + name);
}
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function fingerprint(approval) {
  const rows = {};
  for (const table of [
    "teacher_intervention_approvals",
    "teacher_intervention_recipients",
    "teacher_intervention_deliveries",
    "teacher_intervention_followups",
    "teacher_intervention_evaluation_requests",
  ]) {
    const column =
      table === "teacher_intervention_approvals" ? "id" : "approval_id";
    rows[table] = (
      await pool.query(
        `SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${column}=$1 ORDER BY to_jsonb(t)::text`,
        [approval],
      )
    ).rows;
  }
  for (const table of ["attempts", "evaluations", "interventions"]) {
    const relation =
      table === "evaluations"
        ? "attempt_id IN (SELECT attempt_id FROM teacher_intervention_followups WHERE approval_id=$1)"
        : "session_id IN (SELECT session_id FROM teacher_intervention_followups WHERE approval_id=$1)";
    rows[table] = (
      await pool.query(
        `SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${relation} ORDER BY to_jsonb(t)::text`,
        [approval],
      )
    ).rows;
  }
  return hash(rows);
}
async function login(context, kind = "STUDENT_ONE") {
  const r = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env[`DEMO_${kind}_EMAIL`],
      password: process.env[`DEMO_${kind}_PASSWORD`],
    },
  });
  assert.equal(r.status(), 200, "fictional login");
}
async function controller(page) {
  await page.locator('.lp-followup-response[aria-busy="false"]').waitFor();
  assert.equal(await page.locator(".sn-review-controller").count(), 1);
  assert.equal(await page.locator(".lp-review-activity").count(), 1);
  assert.equal(await page.locator(".lp-followup-response").count(), 1);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message your tutor", exact: true })
      .count(),
    0,
  );
}
async function capture(page, name) {
  await page.screenshot({
    path: path.join(out, name + ".png"),
    fullPage: true,
  });
}
async function provider(kind, prompt) {
  if (kind === "pending")
    return {
      ok: false,
      needsReconciliation: true,
      code: "timeout",
      message: "Authored unknown outcome; no model call.",
      model: "s3-fixture",
      latencyMs: 0,
    };
  const { question, student_response } = JSON.parse(prompt.input);
  return {
    ok: true,
    needsReconciliation: false,
    model: "s3-fixture",
    responseId: "fixture-" + randomUUID(),
    latencyMs: 0,
    usage: null,
    result: {
      per_concept_results: question.concept_ids.map((concept_id) => ({
        concept_id,
        correctness: "uncertain",
        error_type: "insufficient_response",
        rubric_criteria_met: [],
        rubric_criteria_missing: question.rubric.criteria,
      })),
      source_passage_ids: question.source_passage_ids,
      evidence_quotes: [
        {
          quote: student_response,
          interpretation: "Authored fixture, not a model judgment.",
        },
      ],
      misconception_candidates: [],
      reasoning_observed:
        "Synthetic uncertain response for presentation acceptance.",
      uncertainty_reason: "Insufficient reasoning in this synthetic example.",
      proposed_next_action: "ASK_SELF_EXPLANATION",
    },
  };
}
let browser;
async function preparedFixture(kind, student, teacher) {
  if (!reuse.source) return reuse[kind] ?? makeFixture(student, teacher);
  // Fixture-copy setup follows check-intervention-outcomes.ts. A copied synthetic
  // draft goes through real teacher approval/delivery; no generation is requested.
  const source = (await readInterventionReview(teacher, reuse.source.draftId))
    .draft;
  assert.ok(
    source.evidence.observations.every(
      (row) => row.data_origin === "synthetic_fixture",
    ),
  );
  const now = new Date().toISOString();
  const draft = InterventionDraftSchema.parse({
    ...source,
    id: randomUUID(),
    revision: 1,
    status: "private_draft",
    created_at: now,
    updated_at: now,
  });
  await pool.query(
    "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,1,$4)",
    [draft.id, DEMO_IDS.teacher, draft.assignment_id, draft],
  );
  const approved = await applyInterventionAction(teacher, draft.id, {
    action: "approve",
    request_id: randomUUID(),
    expected_revision: 1,
    recipient_ids: [DEMO_IDS.studentOne],
  });
  assert.ok(approved.approval);
  await applyInterventionAction(teacher, draft.id, {
    action: "deliver",
    request_id: randomUUID(),
    expected_revision: approved.draft.revision,
    approval_id: approved.approval.id,
  });
  return {
    ...reuse.source,
    draftId: draft.id,
    approvalId: approved.approval.id,
  };
}
try {
  const student = await actor(DEMO_IDS.studentOne),
    teacher = await actor(DEMO_IDS.teacher);
  const fixture = await preparedFixture(
    "initial",
    student.access,
    teacher.access,
  );
  report.fixture = fixture;
  const route = base + "/study/interventions/" + fixture.approvalId;
  const endpoint =
    base + "/api/student/interventions/" + fixture.approvalId + "/followup";
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 320, height: 300 },
  });
  const other = await browser.newContext();
  for (const ctx of [context, other]) {
    ctx.setDefaultTimeout(15000);
    await ctx.route("**/*", (r) =>
      new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
    );
  }
  await login(context);
  await login(other, "STUDENT_TWO");
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/student/interventions/")
    )
      report.requests.push({
        path: new URL(request.url()).pathname,
        action: request.postDataJSON().action,
      });
  });
  const displayed = async () =>
    (
      await pool.query(
        "SELECT displayed_at FROM teacher_intervention_recipients WHERE approval_id=$1 AND student_id=$2",
        [fixture.approvalId, DEMO_IDS.studentOne],
      )
    ).rows[0].displayed_at;
  assert.equal(await displayed(), null);
  await page.goto(base + "/study/assignments");
  await page
    .locator(`a[href="/study/interventions/${fixture.approvalId}"]`)
    .waitFor();
  assert.equal(await displayed(), null);
  assert.equal(report.requests.length, 0);
  for (const suffix of ["", "/followup"])
    assert.equal(
      (
        await other.request.get(
          base + "/api/student/interventions/" + fixture.approvalId + suffix,
        )
      ).status(),
      404,
    );
  const deniedPage = await other.newPage();
  await deniedPage.goto(route);
  assert.equal(await deniedPage.locator(".sn-review-controller").count(), 0);
  assert.equal(
    (await deniedPage.locator("body").innerText()).includes(
      fixture.conceptName,
    ),
    false,
  );
  await deniedPage
    .getByRole("heading", {
      name: "This review isn’t available to you",
      exact: true,
    })
    .waitFor();
  await deniedPage.close();
  const otherList = await other.request.get(
    base + "/api/student/interventions",
  );
  assert.equal(
    JSON.stringify(await otherList.json()).includes(fixture.approvalId),
    false,
  );
  pass(
    "delivered summary has no display/start/submit mutation; another student cannot list, read or open the assigned review",
  );
  await page.goto(route);
  await controller(page);
  assert.equal(
    await displayed(),
    null,
    "offscreen explanation is not displayed",
  );
  await page
    .getByRole("button", { name: "Review reading", exact: true })
    .click();
  await page.locator('aside[aria-label="Review reading"]').waitFor();
  await page.waitForTimeout(250);
  assert.equal(
    await displayed(),
    null,
    "source links in facing pane do not display help",
  );
  assert.equal(await page.locator(".lp-followup-response").isVisible(), false);
  await page
    .getByRole("button", { name: "Back to page", exact: true })
    .filter({ visible: true })
    .click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.locator(".lp-review-explanation").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    async ({ base, id }) => {
      const r = await fetch(base + "/api/student/interventions/" + id);
      return r.ok && typeof (await r.json()).displayed_at === "string";
    },
    { base, id: fixture.approvalId },
    { polling: 250 },
  );
  for (let poll = 0; poll < 40 && !(await displayed()); poll++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(await displayed());
  assert.equal(
    report.requests.filter((r) => r.action === "displayed").length,
    1,
  );
  assert.equal(
    report.requests.filter((r) => r.action === "start" || r.action === "submit")
      .length,
    0,
  );
  pass(
    "offscreen and hidden-pane source links produce no help receipt; actual explanation visibility records display once without answering",
  );
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await controller(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Start fresh check", exact: true })
        .count(),
      1,
    );
    await capture(page, "unanswered-" + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Start fresh check", exact: true })
    .click();
  const draft =
    "Water remains water.\n  It changes from liquid into water vapor.\nUnsent exact text.";
  await page.locator("#intervention-response").fill(draft);
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await controller(page);
    assert.equal(
      await page.locator("#intervention-response").inputValue(),
      draft,
    );
    await capture(page, "draft-" + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Pages", exact: true }).click();
  await page
    .getByRole("link", { name: "Fresh check and saved response", exact: true })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.id === "fresh-check-response-title",
  );
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  assert.equal(await page.locator("#intervention-response").count(), 1);
  pass(
    "mobile page navigation focuses the fresh-check heading, keeps one composer and preserves its exact draft",
  );
  await page.reload();
  await controller(page);
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  await page.goto(base + "/study/assignments");
  await page.goBack();
  await controller(page);
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  await page.goForward();
  await page.goBack();
  await controller(page);
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  const row = await pool.query(
    "SELECT auth_user_id FROM profiles WHERE id=$1",
    [DEMO_IDS.studentOne],
  );
  await pool.query(
    'UPDATE auth_session SET "expiresAt"=clock_timestamp()-interval \'1 minute\' WHERE "userId"=$1',
    [row.rows[0].auth_user_id],
  );
  await page.reload();
  await page.waitForURL("**/login");
  await login(context);
  await page.goto(route);
  await controller(page);
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  assert.equal(report.requests.filter((r) => r.action === "submit").length, 0);
  pass(
    "genuine fictional session expiry and sign-in recover the same-tab draft without resubmission",
  );
  const origin = "/study/history?search=water&origin=synthetic_fixture";
  await page.goto(route + "?returnTo=" + encodeURIComponent(origin));
  await controller(page);
  assert.equal(
    await page
      .getByRole("link", { name: "Back to Your notebook", exact: true })
      .getAttribute("href"),
    origin,
  );
  await page
    .getByRole("link", { name: "Back to Your notebook", exact: true })
    .click();
  assert.equal(page.url(), base + origin);
  await page.goBack();
  await controller(page);
  assert.equal(
    await page.locator("#intervention-response").inputValue(),
    draft,
  );
  pass(
    "native Notebook return preserves the supplied return URL and browser Back restores draft (S2 filter-state restoration is outside this check)",
  );
  let lost = false;
  await page.route(endpoint, async (r) => {
    if (
      r.request().method() === "POST" &&
      r.request().postDataJSON().action === "submit" &&
      !lost
    ) {
      lost = true;
      const response = await r.fetch();
      assert.equal(response.status(), 200);
      return r.abort("failed");
    }
    return r.continue();
  });
  await page
    .getByRole("button", { name: "Submit fresh-check response", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Refresh saved status", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Evaluation failed", exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".lp-followup-saved blockquote").textContent(),
    draft,
  );
  assert.equal(report.requests.filter((r) => r.action === "submit").length, 1);
  assert.equal(report.requests.filter((r) => r.action === "retry").length, 0);
  await capture(page, "failed-lost-response");
  pass(
    "lost submit response recovers one saved original answer and explicit failed status, without an evaluation retry",
  );
  for (const kind of ["pending", "uncertain"]) {
    const f = await preparedFixture(kind, student.access, teacher.access);
    await applyStudentInterventionFollowup(student.access, f.approvalId, {
      action: "start",
    });
    const saved = await applyStudentInterventionFollowup(
      student.access,
      f.approvalId,
      { action: "submit", request_id: randomUUID(), response_text: draft },
      { provider: (prompt) => provider(kind, prompt) },
    );
    assert.equal(
      saved.evaluation_status,
      kind === "pending" ? "pending" : "accepted",
    );
    assert.equal(saved.uncertain, kind === "uncertain");
    const stateRoute = base + "/study/interventions/" + f.approvalId;
    await page.goto(stateRoute);
    await controller(page);
    await page.locator(".lp-review-explanation").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      async ({ base, id }) => {
        const r = await fetch(base + "/api/student/interventions/" + id);
        return r.ok && typeof (await r.json()).displayed_at === "string";
      },
      { base, id: f.approvalId },
    );
    const before = await fingerprint(f.approvalId);
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [390, 844],
      [320, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(stateRoute);
      await controller(page);
      const title =
        kind === "pending"
          ? "Evaluation pending"
          : "Evaluation accepted · uncertain judgment";
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(
        await page.locator(".lp-followup-saved blockquote").textContent(),
        draft,
      );
      assert.equal(
        await page.locator(".lp-followup-response textarea").count(),
        0,
      );
      if (kind === "uncertain") {
        assert.match(
          await page.locator(".lp-followup-saved ul").textContent(),
          /Evaporation: uncertain/,
        );
        assert.equal(
          (await page.locator(".lp-followup-saved ul").textContent()).includes(
            f.conceptId,
          ),
          false,
        );
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await capture(page, kind + "-" + width);
      assert.equal(await fingerprint(f.approvalId), before);
      report.states.push({
        kind,
        width,
        approval: f.approvalId,
        fingerprint: before,
      });
    }
    pass(
      kind +
        " state uses actual services/persistence, retains original text/source and remains unchanged across four responsive captures",
    );
  }
  await page.route("**/api/student/interventions/*/followup", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "Synthetic unavailable saved state" },
    }),
  );
  await page.goto(route);
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("#intervention-response").count(), 0);
  await capture(page, "unavailable-saved-status");
  pass(
    "unavailable saved status shows an alert and refresh control without a stale composer (HTTP fault injection)",
  );
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack || error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
  await pool.end();
  console.log("REPORT " + path.relative(root, out));
}
