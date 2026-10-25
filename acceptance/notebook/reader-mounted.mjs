/** Actual standalone N1/N4 route, actual PostgreSQL receipts, fictional identity. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
} from "../../lib/evidence/store.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../../lib/evidence/content.ts";
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3407");
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5907");
assert.equal(process.env.PGDATABASE, "reader_visibility_n7_01a1742c");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const base = process.env.AUTH_URL,
  pool = getPool();
const out = path.join(
  "acceptance/notebook/evidence",
  `mounted-reader-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const report = { paidCalls: 0, checks: [], result: "RUNNING" };
const actor = (
  await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
    DEMO_IDS.studentOne,
  ])
).rows[0];
const access = evidenceAccess({
  profileId: actor.id,
  userId: actor.auth_user_id,
});
const session = await startSession(access, DEMO_IDS.assignmentId, "live_demo");
const attempt = await presentQuestion(access, session.id, {
  question: getCuratedQuestion(loadApprovedContent(), "NP-TX-01"),
  intent: "initial_retrieval",
});
report.session = session.id;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
context.setDefaultTimeout(15000);
const page = await context.newPage();
const readRows = async () =>
  (
    await pool.query(
      "SELECT id,delivery_status,visible_at,source_passage_ids FROM interventions WHERE session_id=$1 ORDER BY created_at,id",
      [session.id],
    )
  ).rows;
const until = async (fn) => {
  for (let n = 0; n < 120; n++) {
    if (await fn()) return;
    await page.waitForTimeout(100);
  }
  assert.fail("bounded condition timed out");
};
try {
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200);
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let delivery;
  let receipts = 0;
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      r.url().includes(`/api/sessions/${session.id}/interventions/`)
    )
      receipts++;
  });
  await page.route(
    base + `/api/tutoring/${session.id}/reading`,
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      delivery = await response.json();
      await held;
      await route.fulfill({ response });
    },
  );
  await page.goto(
    base +
      `/study/reading?assignment=${DEMO_IDS.assignmentId}&session=${session.id}&version=${encodeURIComponent(attempt.question.content_ref.content_version)}&passage=P07&from=study`,
  );
  await until(() => Boolean(delivery));
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  assert.equal(
    await page
      .locator("[data-n7-standalone-reader]")
      .getAttribute("data-reader-active"),
    "false",
  );
  release();
  await page.waitForTimeout(500);
  let rows = await readRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].delivery_status, "created");
  assert.equal(rows[0].visible_at, null);
  assert.equal(receipts, 0);
  report.checks.push(
    "committed delivery arriving behind mobile overlay sends zero display receipts",
  );
  await page.getByRole("button", { name: "Back to page", exact: true }).click();
  await page.locator(".reading-article").scrollIntoViewIfNeeded();
  await until(
    async () => (await readRows())[0]?.delivery_status === "displayed",
  );
  rows = await readRows();
  assert.equal(receipts, 1);
  const receiptId = rows[0].id;
  const visibleAt = rows[0].visible_at.toISOString();
  await page.getByLabel("Account menu", { exact: true }).click();
  assert.equal(
    await page
      .locator("[data-n7-standalone-reader]")
      .getAttribute("data-reader-active"),
    "false",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  rows = await readRows();
  assert.equal(rows[0].id, receiptId);
  assert.equal(rows[0].visible_at.toISOString(), visibleAt);
  assert.equal(receipts, 1);
  report.checks.push(
    "exposure acknowledges original delivery once; repeated overlays retain receipt identity/time",
  );
  await page.screenshot({
    path: path.join(out, "visible-reading-390.png"),
    fullPage: true,
  });
  await page.unroute(base + `/api/tutoring/${session.id}/reading`);
  let failed = false;
  await page.route(
    base + `/api/sessions/${session.id}/interventions/*`,
    async (route) => {
      if (!failed && route.request().method() === "POST") {
        failed = true;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic lost receipt" }),
        });
      }
      return route.continue();
    },
  );
  await page.goto(
    base +
      `/study/reading?assignment=${DEMO_IDS.assignmentId}&session=${session.id}&version=${encodeURIComponent(attempt.question.content_ref.content_version)}&passage=P08&from=study`,
  );
  await page.locator(".reading-article").scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Retry saving reading", exact: true })
    .waitFor();
  rows = await readRows();
  assert.equal(rows.length, 2);
  assert.equal(rows[1].visible_at, null);
  const retryId = rows[1].id;
  const beforeRetry = receipts;
  await page.getByLabel("Account menu", { exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  assert.equal(
    receipts,
    beforeRetry,
    "overlay close must not silently retry uncertain receipt",
  );
  await page
    .getByRole("button", { name: "Retry saving reading", exact: true })
    .click();
  await until(
    async () => (await readRows())[1]?.delivery_status === "displayed",
  );
  rows = await readRows();
  assert.equal(rows[1].id, retryId);
  assert.equal(receipts, beforeRetry + 1);
  report.checks.push(
    "failed receipt remains pending across overlay changes and explicit retry reuses delivery",
  );
  report.result = "PASS";
  console.log(JSON.stringify(report));
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => {});
} finally {
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await context.close();
  await browser.close();
  await pool.end();
}
