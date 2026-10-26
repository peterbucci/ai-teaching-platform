/** Real S2 -> S3 -> S2 navigation using backend-created authorized relations. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { getPool } from "../../../lib/db.ts";
import { DEMO_IDS } from "../../../lib/evidence/demo.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { readStudentNotebook } from "../../../lib/evidence/student-notebook.ts";

assert.equal(process.env.PGDATABASE, "student_notebook_final_01a17503");
assert.equal(process.env.PGPORT, "5931");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3432");
assert.equal(process.env.NOTEBOOK_RECORDED_HISTORY, "1");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const base = process.env.AUTH_URL;
const out = path.resolve(
  "acceptance/student-integration/history-review",
  `review-seam-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
  errors: [],
};
const pool = getPool();
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
let browser;
try {
  const actorRow = (
    await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
      DEMO_IDS.studentOne,
    ])
  ).rows[0];
  const actor = evidenceAccess({
    profileId: actorRow.id,
    userId: actorRow.auth_user_id,
  });
  const before = await readStudentNotebook(actor, DEMO_IDS.supportedSession);
  const recorded = before.pages.find((item) =>
    item.teacher_reviews.some((review) => review.followup),
  );
  assert.ok(
    recorded,
    "Existing backend acceptance provides an own-evidence review and fresh-check relation",
  );
  const review = recorded.teacher_reviews.find((item) => item.followup);
  const origin = `/study/history/${before.session.id}?attempt=${recorded.attempt_id}`;
  const immutable = (item) => ({
    question: item.question,
    source: item.source,
    submission: item.submission,
    assessment: item.assessment,
  });
  report.identities = {
    sessionId: before.session.id,
    attemptId: recorded.attempt_id,
    approvalId: review.approval_id,
    source: recorded.source.content_ref,
  };
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200, "Fictional account signs in");
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const [label, href] of [
    ["Teacher review linked to this work", review.href],
    ["Review and saved fresh check", review.followup.href],
  ]) {
    await page.goto(base + origin);
    await page.locator("[data-recorded-question]").waitFor();
    assert.equal(
      await page.locator("[data-original-response]").textContent(),
      recorded.submission.response_text,
    );
    const link = page
      .getByRole("link", { name: label, exact: true })
      .filter({ hasText: label })
      .first();
    assert.equal(
      await link.getAttribute("href"),
      href + "?returnTo=" + encodeURIComponent(origin),
    );
    await link.click();
    await page.locator('.lp-followup-response[aria-busy="false"]').waitFor();
    assert.equal(await page.locator(".sn-review-controller").count(), 1);
    assert.equal(await page.locator(".lp-review-activity").count(), 1);
    assert.equal(await page.locator(".lp-followup-response").count(), 1);
    const back = page.getByRole("link", {
      name: "Back to Your saved question",
      exact: true,
    });
    assert.equal(await back.getAttribute("href"), origin);
    await page.reload();
    await page.locator('.lp-followup-response[aria-busy="false"]').waitFor();
    assert.equal(await back.getAttribute("href"), origin);
    await back.click();
    await page.locator("[data-recorded-question]").waitFor();
    assert.equal(page.url(), base + origin);
    assert.equal(
      await page.locator("[data-original-response]").textContent(),
      recorded.submission.response_text,
    );
    await page.goBack();
    await page.locator('.lp-followup-response[aria-busy="false"]').waitFor();
    await page.goForward();
    await page.locator("[data-recorded-question]").waitFor();
    await page.reload();
    await page.locator("[data-recorded-question]").waitFor();
    assert.equal(page.url(), base + origin);
    assert.equal(
      await page.locator("[data-original-response]").textContent(),
      recorded.submission.response_text,
    );
    const after = await readStudentNotebook(actor, before.session.id);
    assert.deepEqual(
      immutable(
        after.pages.find((item) => item.attempt_id === recorded.attempt_id),
      ),
      immutable(recorded),
    );
    report.checks.push(
      `${label}: exact approved identity and canonical question return survive review refresh, return link, Back/Forward and history refresh; original question, answer, accepted assessment and saved source remain unchanged`,
    );
  }
  await page.screenshot({
    path: path.join(out, "returned-saved-question-390.png"),
    fullPage: true,
  });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = String(error.stack || error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser?.close();
  await pool.end();
  console.log(
    JSON.stringify({ checks: report.checks, failure: report.failure, out }),
  );
}
